#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
readonly CONTAINER_NAME="bladeplex-beta"
readonly IMAGE_NAME="bladeplex:beta"
readonly CONFIG_PATH="/opt/stacks/seerr-beta/config"
readonly HTTP_URL="http://127.0.0.1:5057"

allow_main=false

log() {
  printf '[bladeplex beta] %s\n' "$*"
}

warn() {
  printf '[bladeplex beta] WARNING: %s\n' "$*" >&2
}

die() {
  printf '[bladeplex beta] ERROR: %s\n' "$*" >&2
  exit 1
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

compose_beta() {
  COMMIT_TAG="${commit_tag}" \
  BLADEPLEX_PROJECT_NAME="bladeplex-beta" \
  BLADEPLEX_CONTAINER_NAME="${CONTAINER_NAME}" \
  BLADEPLEX_IMAGE="${IMAGE_NAME}" \
  BLADEPLEX_HOST_PORT="5057" \
  BLADEPLEX_CONFIG_PATH="${CONFIG_PATH}" \
    docker compose -f "${COMPOSE_FILE}" "$@"
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

case "${1:-}" in
  '') ;;
  --allow-main) allow_main=true ;;
  *) die "Usage: $0 [--allow-main]" ;;
esac

cd "${REPO_DIR}"

command -v git >/dev/null 2>&1 || die "git is not installed."
command -v docker >/dev/null 2>&1 || die "Docker is not installed."
command -v curl >/dev/null 2>&1 || die "curl is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is not available."
docker info >/dev/null 2>&1 || die "The Docker daemon is unavailable."

branch="$(git branch --show-current)"
[[ -n "${branch}" ]] || die "A named Git branch must be checked out."
if [[ "${branch}" == "main" && "${allow_main}" == false ]]; then
  die "Beta deployment rejects 'main' by default. Use --allow-main to override intentionally."
fi
[[ -z "$(git status --porcelain)" ]] || die "The Git working tree must be clean."

short_hash="$(git rev-parse --short=8 HEAD)"
sanitized_branch="$(printf '%s' "${branch}" |
  tr '[:upper:]' '[:lower:]' |
  sed -E 's/[^a-z0-9_.-]+/-/g; s/^[.-]+//; s/[.-]+$//; s/-+/-/g' |
  cut -c1-80)"
[[ -n "${sanitized_branch}" ]] || die "The branch name cannot be converted into a safe image tag."
commit_tag="${short_hash}-${sanitized_branch}"

if [[ ! -d "${CONFIG_PATH}" ]]; then
  log "Creating the separate beta config directory: ${CONFIG_PATH}"
  if ! mkdir -p "${CONFIG_PATH}"; then
    die "Unable to create ${CONFIG_PATH}. Create it with appropriate privileges and ownership for UID/GID 1000."
  fi
  warn "The image runs as UID/GID 1000. Ensure ${CONFIG_PATH} remains writable by that account."
fi

log "Building ${IMAGE_NAME} from ${branch} with COMMIT_TAG=${commit_tag}."
compose_beta build bladeplex

image_tag="$(docker image inspect "${IMAGE_NAME}" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  sed -n 's/^COMMIT_TAG=//p')"
[[ "${image_tag}" == "${commit_tag}" ]] ||
  die "Image COMMIT_TAG is '${image_tag:-<blank>}', expected '${commit_tag}'."

metadata="$(docker run --rm --entrypoint cat "${IMAGE_NAME}" /app/committag.json)"
[[ "${metadata}" == *"\"commitTag\": \"${commit_tag}\""* ]] ||
  die "Image committag.json is incorrect: ${metadata}"

docker run --rm --entrypoint sh \
  -v "${CONFIG_PATH}:/app/config" "${IMAGE_NAME}" \
  -c 'test -w /app/config' ||
  die "${CONFIG_PATH} is not writable by the container's UID/GID 1000. Fix ownership before deploying."

if container_exists "${CONTAINER_NAME}"; then
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  current_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
  rollback_image="bladeplex:beta-rollback-${timestamp}"
  docker image inspect "${rollback_image}" >/dev/null 2>&1 &&
    die "Rollback tag ${rollback_image} already exists; refusing to overwrite it."
  docker image tag "${current_image_id}" "${rollback_image}"
  log "Preserved the current beta image as ${rollback_image}."
  docker stop "${CONTAINER_NAME}"
  docker rm "${CONTAINER_NAME}"
fi

compose_beta up --detach --no-build --force-recreate bladeplex

[[ "$(docker inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")" == "running" ]] ||
  die "Beta container is not running."
expected_image_id="$(docker image inspect "${IMAGE_NAME}" --format '{{.Id}}')"
running_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
[[ "${running_image_id}" == "${expected_image_id}" ]] ||
  die "Running beta container does not use ${IMAGE_NAME}."
runtime_tag="$(docker inspect "${CONTAINER_NAME}" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  sed -n 's/^COMMIT_TAG=//p')"
[[ "${runtime_tag}" == "${commit_tag}" ]] ||
  die "Running COMMIT_TAG is '${runtime_tag:-<blank>}', expected '${commit_tag}'."
runtime_metadata="$(docker exec "${CONTAINER_NAME}" cat /app/committag.json)"
[[ "${runtime_metadata}" == *"\"commitTag\": \"${commit_tag}\""* ]] ||
  die "Running committag.json is incorrect: ${runtime_metadata}"
wait_for_http || die "${HTTP_URL} did not return a 2xx or 3xx response in time."

log "Beta deployment succeeded: ${IMAGE_NAME} (${commit_tag}) at ${HTTP_URL}."
warn "Cloudflare is unchanged. beta.sblade.io should eventually target localhost:5057, not production port 5055."
