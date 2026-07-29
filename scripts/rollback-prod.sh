#!/usr/bin/env bash

set -Eeuo pipefail

readonly CONTAINER_NAME="bladeplex"
readonly CONFIG_PATH="/opt/stacks/seerr/config"
readonly HTTP_URL="http://127.0.0.1:5055"

assume_yes=false
rollback_image=""

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
      printf 'Usage: %s [ROLLBACK_IMAGE] [--yes]\n' "$0"
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
docker info >/dev/null 2>&1 || die "The Docker daemon is unavailable."

if [[ -z "${rollback_image}" ]]; then
  rollback_image="$(docker image ls \
    --filter 'reference=bladeplex:rollback-*' \
    --format '{{.Repository}}:{{.Tag}}' | sort --reverse | head -n 1)"
  [[ -n "${rollback_image}" ]] ||
    die "No tagged rollback image was found. Supply one explicitly."
  log "Selected the most recent rollback image: ${rollback_image}"
fi

docker image inspect "${rollback_image}" >/dev/null 2>&1 ||
  die "Rollback image does not exist locally: ${rollback_image}"

image_tag="$(docker image inspect "${rollback_image}" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  sed -n 's/^COMMIT_TAG=//p')"
metadata="$(docker run --rm --entrypoint cat "${rollback_image}" /app/committag.json 2>/dev/null || true)"

printf 'Rollback image: %s\n' "${rollback_image}"
printf 'COMMIT_TAG:     %s\n' "${image_tag:-<blank>}"
printf 'committag.json: %s\n' "${metadata:-<unavailable>}"

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

docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p 5055:5055 \
  -v "${CONFIG_PATH}:/app/config" \
  "${rollback_image}" >/dev/null

[[ "$(docker inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")" == "running" ]] ||
  die "Rollback container is not running."
expected_image_id="$(docker image inspect "${rollback_image}" --format '{{.Id}}')"
running_image_id="$(docker inspect --format '{{.Image}}' "${CONTAINER_NAME}")"
[[ "${running_image_id}" == "${expected_image_id}" ]] ||
  die "Running container does not use ${rollback_image}."
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
