#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy-prod.sh"
readonly ROLLBACK_SCRIPT="${SCRIPT_DIR}/rollback-prod.sh"
readonly EXPECTED_IMAGE_ID="sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

test_dir="$(mktemp -d)"
trap 'rm -rf -- "${test_dir}"' EXIT
fake_bin="${test_dir}/bin"
command_log="${test_dir}/docker.log"
mkdir -p "${fake_bin}"
cp "${SCRIPT_DIR}/test-fixtures/docker" "${fake_bin}/docker"
cp "${SCRIPT_DIR}/test-fixtures/curl" "${fake_bin}/curl"
chmod +x "${fake_bin}/docker" "${fake_bin}/curl"

fail() {
  printf '[production safety test] FAIL: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf '[production safety test] PASS: %s\n' "$*"
}

run_expect_failure() {
  local description="$1" expected="$2"
  shift 2
  local output status

  set +e
  output="$(PATH="${fake_bin}:${PATH}" FAKE_DOCKER_LOG="${command_log}" "$@" 2>&1)"
  status=$?
  set -e
  [[ ${status} -ne 0 ]] || fail "${description} unexpectedly succeeded"
  [[ "${output}" == *"${expected}"* ]] ||
    fail "${description} did not report '${expected}': ${output}"
  ! grep -Fq 'compose-up' "${command_log}" ||
    fail "${description} reached Compose recreation"
  pass "${description}"
}

: >"${command_log}"
run_expect_failure 'missing explicit rollback image' 'Specify the exact rollback image' \
  env FAKE_IMAGE_ID="${EXPECTED_IMAGE_ID}" "${ROLLBACK_SCRIPT}" --yes

: >"${command_log}"
run_expect_failure 'missing local rollback image' 'Rollback image does not exist locally' \
  env FAKE_IMAGE_ID="${EXPECTED_IMAGE_ID}" FAKE_IMAGE_EXISTS=false \
  "${ROLLBACK_SCRIPT}" bladeplex:rollback-test --yes

: >"${command_log}"
run_expect_failure 'invalid rollback metadata' 'metadata is missing or invalid' \
  env FAKE_IMAGE_ID="${EXPECTED_IMAGE_ID}" FAKE_METADATA_VALID=false \
  "${ROLLBACK_SCRIPT}" bladeplex:rollback-test --yes

: >"${command_log}"
run_expect_failure 'mismatched rollback metadata' 'metadata does not match COMMIT_TAG' \
  env FAKE_IMAGE_ID="${EXPECTED_IMAGE_ID}" FAKE_METADATA_TAG=wrong-commit \
  "${ROLLBACK_SCRIPT}" bladeplex:rollback-test --yes

: >"${command_log}"
PATH="${fake_bin}:${PATH}" FAKE_DOCKER_LOG="${command_log}" \
  FAKE_IMAGE_ID="${EXPECTED_IMAGE_ID}" \
  "${ROLLBACK_SCRIPT}" bladeplex:rollback-test --yes >/dev/null
grep -Fq "compose-up image=${EXPECTED_IMAGE_ID}" "${command_log}" ||
  fail 'rollback did not pass the immutable image ID to Compose'
grep -Fq -- '--pull never' "${command_log}" ||
  fail 'rollback did not disable image pulls'
! grep -Fq 'compose-up image=bladeplex:latest' "${command_log}" ||
  fail 'rollback silently used bladeplex:latest'
pass 'immutable image ID reaches Compose without pulling'

COMMIT_TAG='' BLADEPLEX_IMAGE="${EXPECTED_IMAGE_ID}" \
  docker compose -f "${REPO_DIR}/docker-compose.yml" -p bladeplex config |
  grep -Fq "image: ${EXPECTED_IMAGE_ID}" ||
  fail 'Compose did not preserve the immutable image ID'
pass 'Compose resolves the immutable image ID'

grep -Fq 'readonly IMAGE_REPOSITORY="ghcr.io/sbv29/bladeplex"' "${DEPLOY_SCRIPT}" ||
  fail 'production does not use the BladePlex GHCR repository'
grep -Fq 'image_name="${IMAGE_REPOSITORY}:${full_hash}"' "${DEPLOY_SCRIPT}" ||
  fail 'production does not select an immutable full-commit image tag'
grep -Fq 'docker pull "${image_name}"' "${DEPLOY_SCRIPT}" ||
  fail 'production does not pull the selected immutable image'
grep -Fq 'compose_production up' "${DEPLOY_SCRIPT}" ||
  fail 'production recreation bypasses the pinned Compose wrapper'
grep -Fq 'BLADEPLEX_IMAGE="${rollback_image}"' "${DEPLOY_SCRIPT}" ||
  fail 'automatic rollback does not pass its captured image ID'
grep -Fq -- '--pull never' "${DEPLOY_SCRIPT}" ||
  fail 'automatic rollback permits image pulls'
pass 'registry deployment and automatic rollback variables are pinned'
