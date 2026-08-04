#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
readonly CONTAINER_NAME="bladeplex"
readonly IMAGE_REPOSITORY="ghcr.io/sbv29/bladeplex"
readonly CONFIG_PATH="/opt/stacks/seerr/config"
readonly HTTP_URL="http://127.0.0.1:5055"
readonly PRODUCTION_PORT_BINDING="127.0.0.1:5055:5055"
readonly EXISTING_ROLLBACK_CONTAINER="bladeplex-old"

skip_fetch=false
allow_existing_rollback=false
local_build=false
requested_commit=""
deployment_started=false
rollback_image=""
rollback_tag=""
image_name="${IMAGE_REPOSITORY}:latest"

log() {
  printf '[bladeplex deploy] %s\n' "$*"
}

warn() {
  printf '[bladeplex deploy] WARNING: %s\n' "$*" >&2
}

die() {
  printf '[bladeplex deploy] ERROR: %s\n' "$*" >&2

  if [[ "${deployment_started}" == true && -n "${rollback_image}" ]]; then
    attempt_rollback 1
  fi

  exit 1
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

compose_production() {
  COMMIT_TAG="${commit_tag:-}" \
  BLADEPLEX_PROJECT_NAME="bladeplex" \
  BLADEPLEX_CONTAINER_NAME="${CONTAINER_NAME}" \
  BLADEPLEX_IMAGE="${image_name}" \
  BLADEPLEX_HOST_PORT="5055" \
  BLADEPLEX_CONFIG_PATH="${CONFIG_PATH}" \
    docker compose -f "${COMPOSE_FILE}" -p bladeplex "$@"
}

select_existing_rollback() {
  local existing_image existing_image_id container_tag image_tag

  if ! container_exists "${EXISTING_ROLLBACK_CONTAINER}"; then
    warn "Existing rollback container '${EXISTING_ROLLBACK_CONTAINER}' was not found."
    return 1
  fi

  existing_image="$(docker inspect --format '{{.Config.Image}}' \
    "${EXISTING_ROLLBACK_CONTAINER}")" || return 1
  if ! docker image inspect "${existing_image}" >/dev/null 2>&1; then
    warn "Image ${existing_image} for ${EXISTING_ROLLBACK_CONTAINER} cannot be inspected."
    return 1
  fi
  existing_image_id="$(docker image inspect "${existing_image}" --format '{{.Id}}')" ||
    return 1

  container_tag="$(docker inspect "${EXISTING_ROLLBACK_CONTAINER}" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^COMMIT_TAG=//p')"
  image_tag="$(docker image inspect "${existing_image}" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^COMMIT_TAG=//p')"
  if [[ -z "${container_tag}" || "${container_tag}" != "${image_tag}" ]]; then
    warn "Existing rollback COMMIT_TAG is missing or does not match its image."
    return 1
  fi

  log "Existing rollback container ${EXISTING_ROLLBACK_CONTAINER} has COMMIT_TAG=${container_tag}."
  rollback_image="${existing_image_id}"
}

wait_for_http() {
  local attempt status

  for attempt in $(seq 1 60); do
    status="$(curl --silent --show-error --output /dev/null \
      --write-out '%{http_code}' --max-time 5 "${HTTP_URL}" 2>/dev/null || true)"
    if [[ "${status}" =~ ^[23][0-9][0-9]$ ]]; then
      log "HTTP validation passed with status ${status}."
      return 0
    fi
    sleep 2
  done

  return 1
}

validate_production_port_binding() {
  local resolved_config

  [[ "${PRODUCTION_PORT_BINDING}" == "127.0.0.1:5055:5055" ]] ||
    die "Production port binding must be 127.0.0.1:5055:5055."

  resolved_config="$(compose_production config)" ||
    die "Unable to resolve the production Compose configuration."
  grep -Eq '^[[:space:]]+host_ip: 127\.0\.0\.1$' <<<"${resolved_config}" ||
    die "Resolved Compose configuration does not bind production port 5055 to 127.0.0.1."
  grep -Eq '^[[:space:]]+target: 5055$' <<<"${resolved_config}" ||
    die "Resolved Compose configuration does not target container port 5055."
  grep -Eq '^[[:space:]]+published: "5055"$' <<<"${resolved_config}" ||
    die "Resolved Compose configuration does not publish host port 5055."
}

validate_image_metadata() {
  local image="$1" expected_tag="$2" image_tag metadata

  image_tag="$(docker image inspect "${image}" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^COMMIT_TAG=//p')"
  [[ "${image_tag}" == "${expected_tag}" ]] ||
    die "Image COMMIT_TAG is '${image_tag:-<blank>}', expected '${expected_tag}'."

  metadata="$(docker run --rm --entrypoint cat "${image}" /app/committag.json)"
  [[ "${metadata}" == *"\"commitTag\": \"${expected_tag}\""* ]] ||
    die "Image committag.json is incorrect: ${metadata}"

  log "Image metadata is valid (${expected_tag})."
}

validate_deployment() {
  local expected_tag="$1" expected_image_id running_image_id runtime_tag metadata state

  state="$(docker inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")"
  [[ "${state}" == "running" ]] || die "Container state is '${state}', not running."

  expected_image_id="$(docker image inspect "${image_name}" --format '{{.Id}}')"
  running_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
  [[ "${running_image_id}" == "${expected_image_id}" ]] ||
    die "Running container does not use ${image_name}."

  runtime_tag="$(docker inspect "${CONTAINER_NAME}" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^COMMIT_TAG=//p')"
  [[ "${runtime_tag}" == "${expected_tag}" ]] ||
    die "Running COMMIT_TAG is '${runtime_tag:-<blank>}', expected '${expected_tag}'."

  metadata="$(docker exec "${CONTAINER_NAME}" cat /app/committag.json)"
  [[ "${metadata}" == *"\"commitTag\": \"${expected_tag}\""* ]] ||
    die "Running committag.json is incorrect: ${metadata}"

  wait_for_http || die "${HTTP_URL} did not return a 2xx or 3xx response in time."
}

attempt_rollback() {
  local failed_status="$1"

  trap - ERR
  set +e
  warn "Deployment failed (exit ${failed_status}); attempting rollback with ${rollback_image}."

  if container_exists "${CONTAINER_NAME}"; then
    docker stop "${CONTAINER_NAME}" >/dev/null 2>&1
    docker rm "${CONTAINER_NAME}" >/dev/null 2>&1
  fi

  if COMMIT_TAG="" BLADEPLEX_PROJECT_NAME="bladeplex" \
    BLADEPLEX_CONTAINER_NAME="${CONTAINER_NAME}" \
    BLADEPLEX_IMAGE="${rollback_image}" BLADEPLEX_HOST_PORT="5055" \
    BLADEPLEX_CONFIG_PATH="${CONFIG_PATH}" \
    docker compose -f "${COMPOSE_FILE}" -p bladeplex up \
    --detach --no-build --no-deps --pull never --force-recreate bladeplex >/dev/null &&
    wait_for_http; then
    warn "Rollback succeeded. Production is running ${rollback_image}."
  else
    warn "Automatic rollback failed. Inspect with: docker logs ${CONTAINER_NAME}"
  fi

  exit "${failed_status}"
}

on_error() {
  local status=$?

  if [[ "${deployment_started}" == true && -n "${rollback_image}" ]]; then
    attempt_rollback "${status}"
  fi

  exit "${status}"
}

trap on_error ERR

while (($# > 0)); do
  case "$1" in
    --skip-fetch) skip_fetch=true ;;
    --allow-existing-rollback) allow_existing_rollback=true ;;
    --local-build) local_build=true ;;
    --help)
      printf 'Usage: %s [COMMIT_SHA] [--skip-fetch] [--allow-existing-rollback]\n' "$0"
      printf '       %s --local-build [--skip-fetch] [--allow-existing-rollback]\n' "$0"
      exit 0
      ;;
    --*) die "Unknown option: $1" ;;
    *)
      [[ -z "${requested_commit}" ]] || die "Specify only one commit SHA."
      requested_commit="$1"
      ;;
  esac
  shift
done

if [[ "${local_build}" == true && -n "${requested_commit}" ]]; then
  die "A commit SHA cannot be combined with --local-build."
fi

cd "${REPO_DIR}"

command -v git >/dev/null 2>&1 || die "git is not installed."
command -v docker >/dev/null 2>&1 || die "Docker is not installed."
command -v curl >/dev/null 2>&1 || die "curl is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is not available."
docker info >/dev/null 2>&1 || die "The Docker daemon is unavailable."
validate_production_port_binding

if [[ "${skip_fetch}" == false ]]; then
  log "Fetching origin/main."
  git fetch origin main
else
  warn "Skipping fetch; origin/main may be stale."
fi

git show-ref --verify --quiet refs/remotes/origin/main || die "origin/main is unavailable."

if [[ "${local_build}" == true ]]; then
  [[ "$(git branch --show-current)" == "main" ]] || die "Local production builds require branch 'main'."
  [[ -z "$(git status --porcelain)" ]] || die "The Git working tree must be clean."
  full_hash="$(git rev-parse HEAD)"
  [[ "${full_hash}" == "$(git rev-parse origin/main)" ]] ||
    die "Local main must exactly match origin/main before deploying."
  short_hash="$(git rev-parse --short=8 HEAD)"
  commit_tag="${short_hash}-main"
  image_name="bladeplex:latest"
else
  full_hash="${requested_commit:-$(git rev-parse origin/main)}"
  [[ "${full_hash}" =~ ^[0-9a-fA-F]{40}$ ]] ||
    die "Production image tags require a full 40-character commit SHA."
  git cat-file -e "${full_hash}^{commit}" 2>/dev/null ||
    die "Commit is not available locally: ${full_hash}"
  git merge-base --is-ancestor "${full_hash}" origin/main ||
    die "Commit is not part of origin/main: ${full_hash}"
  commit_tag="${full_hash}"
  image_name="${IMAGE_REPOSITORY}:${full_hash}"
fi
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ "${local_build}" == true ]]; then
  log "Building fallback image ${image_name} from ${full_hash} with COMMIT_TAG=${commit_tag}."
  COMMIT_TAG="${commit_tag}" BLADEPLEX_IMAGE="${image_name}" \
    docker compose -f "${COMPOSE_FILE}" -f "${REPO_DIR}/compose.build.yaml" \
    -p bladeplex build bladeplex
else
  log "Pulling immutable production image ${image_name}."
  docker pull "${image_name}"
fi
validate_image_metadata "${image_name}" "${commit_tag}"

if container_exists "${EXISTING_ROLLBACK_CONTAINER}"; then
  warn "Existing rollback container '${EXISTING_ROLLBACK_CONTAINER}' was found and will not be modified."
fi

if container_exists "${CONTAINER_NAME}"; then
  rollback_preserved=false
  current_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
  rollback_tag="bladeplex:rollback-${timestamp}"
  if docker image inspect "${rollback_tag}" >/dev/null 2>&1; then
    die "Rollback tag ${rollback_tag} already exists; refusing to overwrite it."
  fi

  if docker image inspect "${current_image_id}" >/dev/null 2>&1; then
    if docker image tag "${current_image_id}" "${rollback_tag}" &&
      tagged_image_id="$(docker image inspect "${rollback_tag}" --format '{{.Id}}')" &&
      [[ "${tagged_image_id}" == "${current_image_id}" ]]; then
      rollback_preserved=true
      rollback_image="${current_image_id}"
      log "Preserved the current production image as ${rollback_tag} (${rollback_image})."
    fi
  else
    warn "The running container image ${current_image_id} is no longer available in Docker's image store."
    if docker commit "${CONTAINER_NAME}" "${rollback_tag}" >/dev/null &&
      rollback_image="$(docker image inspect "${rollback_tag}" --format '{{.Id}}')"; then
      rollback_preserved=true
      log "Created rollback image ${rollback_tag} (${rollback_image}) from the running ${CONTAINER_NAME} container."
    fi
  fi

  if [[ "${rollback_preserved}" != true ]]; then
    warn "The current production container could not be preserved as a rollback image."
    rollback_image=""
    rollback_tag=""
    select_existing_rollback ||
      die "Rollback preservation failed and no valid existing rollback is available."

    if [[ "${allow_existing_rollback}" != true ]]; then
      die "Rollback preservation failed. Re-run with --allow-existing-rollback to explicitly use ${EXISTING_ROLLBACK_CONTAINER}."
    fi

    warn "Override enabled: rollback will use ${EXISTING_ROLLBACK_CONTAINER} via image ${rollback_image}."
  fi
else
  warn "No existing ${CONTAINER_NAME} container was found; automatic rollback is unavailable."
fi

deployment_started=true
if container_exists "${CONTAINER_NAME}"; then
  docker stop "${CONTAINER_NAME}"
  docker rm "${CONTAINER_NAME}"
fi

log "Starting production with Docker Compose."
compose_production up \
  --detach --no-build --pull never --force-recreate bladeplex

validate_deployment "${commit_tag}"
deployment_started=false

log "Deployment succeeded."
printf '  Commit:       %s\n' "${full_hash}"
printf '  COMMIT_TAG:   %s\n' "${commit_tag}"
printf '  Image:        %s\n' "${image_name}"
printf '  Container:    %s\n' "${CONTAINER_NAME}"
printf '  URL:          %s\n' "${HTTP_URL}"
printf '  Rollback tag: %s\n' "${rollback_tag:-not available}"
printf '  Rollback ID:  %s\n' "${rollback_image:-not available}"
