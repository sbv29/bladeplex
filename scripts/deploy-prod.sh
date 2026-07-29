#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
readonly CONTAINER_NAME="bladeplex"
readonly IMAGE_NAME="bladeplex:latest"
readonly CONFIG_PATH="/opt/stacks/seerr/config"
readonly HTTP_URL="http://127.0.0.1:5055"

skip_fetch=false
deployment_started=false
rollback_image=""

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

  expected_image_id="$(docker image inspect "${IMAGE_NAME}" --format '{{.Id}}')"
  running_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
  [[ "${running_image_id}" == "${expected_image_id}" ]] ||
    die "Running container does not use ${IMAGE_NAME}."

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

  if docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p 5055:5055 \
    -v "${CONFIG_PATH}:/app/config" \
    "${rollback_image}" >/dev/null && wait_for_http; then
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

case "${1:-}" in
  '') ;;
  --skip-fetch) skip_fetch=true ;;
  *) die "Usage: $0 [--skip-fetch]" ;;
esac

cd "${REPO_DIR}"

command -v git >/dev/null 2>&1 || die "git is not installed."
command -v docker >/dev/null 2>&1 || die "Docker is not installed."
command -v curl >/dev/null 2>&1 || die "curl is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is not available."
docker info >/dev/null 2>&1 || die "The Docker daemon is unavailable."

[[ "$(git branch --show-current)" == "main" ]] || die "Production deployments require branch 'main'."
[[ -z "$(git status --porcelain)" ]] || die "The Git working tree must be clean."

if [[ "${skip_fetch}" == false ]]; then
  log "Fetching origin/main."
  git fetch origin main
else
  warn "Skipping fetch; origin/main may be stale."
fi

git show-ref --verify --quiet refs/remotes/origin/main || die "origin/main is unavailable."
git merge-base --is-ancestor origin/main HEAD ||
  die "Local main is behind or has diverged from origin/main. Update it before deploying."

full_hash="$(git rev-parse HEAD)"
short_hash="$(git rev-parse --short=8 HEAD)"
commit_tag="${short_hash}-main"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

log "Building ${IMAGE_NAME} from ${full_hash} with COMMIT_TAG=${commit_tag}."
COMMIT_TAG="${commit_tag}" docker compose -f "${COMPOSE_FILE}" build bladeplex
validate_image_metadata "${IMAGE_NAME}" "${commit_tag}"

if container_exists bladeplex-old; then
  warn "Existing rollback container 'bladeplex-old' was found and will not be modified."
fi

if container_exists "${CONTAINER_NAME}"; then
  current_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
  rollback_image="bladeplex:rollback-${timestamp}"
  if docker image inspect "${rollback_image}" >/dev/null 2>&1; then
    die "Rollback tag ${rollback_image} already exists; refusing to overwrite it."
  fi

  if docker image inspect "${current_image_id}" >/dev/null 2>&1; then
    docker image tag "${current_image_id}" "${rollback_image}"
    log "Preserved the current production image as ${rollback_image}."
  else
    warn "The running container image ${current_image_id} is no longer available in Docker's image store."
    docker commit "${CONTAINER_NAME}" "${rollback_image}" >/dev/null
    log "Created rollback image ${rollback_image} from the running ${CONTAINER_NAME} container."
  fi

  docker image inspect "${rollback_image}" >/dev/null 2>&1 ||
    die "Rollback image ${rollback_image} could not be verified."
else
  warn "No existing ${CONTAINER_NAME} container was found; automatic rollback is unavailable."
fi

deployment_started=true
if container_exists "${CONTAINER_NAME}"; then
  docker stop "${CONTAINER_NAME}"
  docker rm "${CONTAINER_NAME}"
fi

log "Starting production with Docker Compose."
COMMIT_TAG="${commit_tag}" docker compose -f "${COMPOSE_FILE}" up \
  --detach --no-build --force-recreate bladeplex

validate_deployment "${commit_tag}"
deployment_started=false

log "Deployment succeeded."
printf '  Commit:       %s\n' "${full_hash}"
printf '  COMMIT_TAG:   %s\n' "${commit_tag}"
printf '  Image:        %s\n' "${IMAGE_NAME}"
printf '  Container:    %s\n' "${CONTAINER_NAME}"
printf '  URL:          %s\n' "${HTTP_URL}"
printf '  Rollback:     %s\n' "${rollback_image:-not available}"
