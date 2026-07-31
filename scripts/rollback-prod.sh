#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
readonly CONTAINER_NAME="bladeplex"
readonly CONFIG_PATH="/opt/stacks/seerr/config"
readonly HTTP_URL="http://127.0.0.1:5055"
readonly PRODUCTION_PORT_BINDING="127.0.0.1:5055:5055"

assume_yes=false
rollback_image=""
rollback_image_id=""

log() {
  printf '[bladeplex rollback] %s\n' "$*"
}

die() {
  printf '[bladeplex rollback] ERROR: %s\n' "$*" >&2
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

for argument in "$@"; do
  case "${argument}" in
    --yes) assume_yes=true ;;
    --help)
      printf 'Usage: %s ROLLBACK_IMAGE [--yes]\n' "$0"
      exit 0
      ;;
    --*) die "Unknown option: ${argument}" ;;
    *)
      [[ -z "${rollback_image}" ]] || die "Specify only one rollback image."
      rollback_image="${argument}"
      ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "Docker is not installed."
command -v curl >/dev/null 2>&1 || die "curl is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is not available."
docker info >/dev/null 2>&1 || die "The Docker daemon is unavailable."
[[ "${PRODUCTION_PORT_BINDING}" == "127.0.0.1:5055:5055" ]] ||
  die "Production port binding must be 127.0.0.1:5055:5055."

[[ -n "${rollback_image}" ]] ||
  die "Specify the exact rollback image. List candidates with: docker image ls 'bladeplex:rollback-*'"

docker image inspect "${rollback_image}" >/dev/null 2>&1 ||
  die "Rollback image does not exist locally: ${rollback_image}"
rollback_image_id="$(docker image inspect "${rollback_image}" --format '{{.Id}}')" ||
  die "Unable to resolve rollback image ID: ${rollback_image}"

image_tag="$(docker image inspect "${rollback_image_id}" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  sed -n 's/^COMMIT_TAG=//p')"
[[ -n "${image_tag}" ]] || die "Rollback image has no COMMIT_TAG: ${rollback_image}"
metadata_tag="$(docker run --rm --entrypoint node "${rollback_image_id}" -e \
  "const fs=require('fs');const value=JSON.parse(fs.readFileSync('/app/committag.json','utf8')).commitTag;if(typeof value!=='string')process.exit(1);process.stdout.write(value)" \
  2>/dev/null)" || die "Rollback image metadata is missing or invalid: ${rollback_image}"
[[ "${metadata_tag}" == "${image_tag}" ]] ||
  die "Rollback image metadata does not match COMMIT_TAG: ${rollback_image}"

printf 'Rollback image: %s\n' "${rollback_image}"
printf 'Image ID:       %s\n' "${rollback_image_id}"
printf 'COMMIT_TAG:     %s\n' "${image_tag:-<blank>}"
printf 'committag.json: %s (validated)\n' "${metadata_tag}"

if [[ "${assume_yes}" == false ]]; then
  read -r -p "Replace production with ${rollback_image}? [y/N] " response
  [[ "${response}" =~ ^[Yy]$ ]] || die "Rollback cancelled."
fi

if container_exists "${CONTAINER_NAME}"; then
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  current_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
  safety_tag="bladeplex:pre-rollback-${timestamp}"
  docker image tag "${current_image_id}" "${safety_tag}"
  log "Preserved the current production image as ${safety_tag}."
  docker stop "${CONTAINER_NAME}"
  docker rm "${CONTAINER_NAME}"
fi

COMMIT_TAG="" BLADEPLEX_PROJECT_NAME="bladeplex" \
  BLADEPLEX_CONTAINER_NAME="${CONTAINER_NAME}" \
  BLADEPLEX_IMAGE="${rollback_image_id}" BLADEPLEX_HOST_PORT="5055" \
  BLADEPLEX_CONFIG_PATH="${CONFIG_PATH}" \
  docker compose -f "${COMPOSE_FILE}" -p bladeplex up \
  --detach --no-build --no-deps --pull never --force-recreate bladeplex >/dev/null

[[ "$(docker inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")" == "running" ]] ||
  die "Rollback container is not running."
running_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
[[ "${running_image_id}" == "${rollback_image_id}" ]] ||
  die "Running container does not use ${rollback_image_id}."
wait_for_http || die "Rollback started, but ${HTTP_URL} did not become healthy."

running_tag="$(docker inspect "${CONTAINER_NAME}" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  sed -n 's/^COMMIT_TAG=//p')"
running_metadata="$(docker exec "${CONTAINER_NAME}" cat /app/committag.json 2>/dev/null || true)"

log "Rollback succeeded."
printf '  Image:        %s\n' "${rollback_image}"
printf '  COMMIT_TAG:   %s\n' "${running_tag:-<blank>}"
printf '  Metadata:     %s\n' "${running_metadata:-<unavailable>}"
printf '  Config:       %s (preserved)\n' "${CONFIG_PATH}"
