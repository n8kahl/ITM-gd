#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-n8kahl/ITM-gd}"
ENV_FILE="${2:-.env.local}"
DEFAULT_BYPASS_USER_ID="00000000-0000-4000-8000-000000000001"

required_env_vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

print_header() {
  echo "AI Coach Staging Gate Secret Configuration"
  echo "Repo: ${REPO}"
  echo "Env file: ${ENV_FILE}"
  echo
}

require_gh_auth() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: gh CLI is not installed."
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "ERROR: gh CLI is not authenticated."
    exit 1
  fi
}

load_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: env file not found: ${ENV_FILE}"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
}

require_env_values() {
  local missing=0
  for key in "${required_env_vars[@]}"; do
    if [[ -z "${!key:-}" ]]; then
      echo "ERROR: required ${key} is missing in ${ENV_FILE}"
      missing=1
    fi
  done

  if [[ "${missing}" -ne 0 ]]; then
    exit 1
  fi
}

configure_defaults() {
  export E2E_BYPASS_USER_ID="${E2E_BYPASS_USER_ID:-$DEFAULT_BYPASS_USER_ID}"

  if [[ -z "${E2E_BYPASS_TOKEN:-}" ]]; then
    if [[ -n "${E2E_BYPASS_SHARED_SECRET:-}" ]]; then
      export E2E_BYPASS_TOKEN="e2e:${E2E_BYPASS_SHARED_SECRET}:${E2E_BYPASS_USER_ID}"
    else
      export E2E_BYPASS_TOKEN="e2e:${E2E_BYPASS_USER_ID}"
    fi
  fi
}

set_secret() {
  local name="$1"
  local value="$2"
  printf '%s' "${value}" | gh secret set "${name}" --repo "${REPO}" >/dev/null
  echo "SET: ${name}"
}

write_secrets() {
  set_secret "NEXT_PUBLIC_SUPABASE_URL" "${NEXT_PUBLIC_SUPABASE_URL}"
  set_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
  set_secret "E2E_BYPASS_TOKEN" "${E2E_BYPASS_TOKEN}"
  set_secret "E2E_BYPASS_USER_ID" "${E2E_BYPASS_USER_ID}"

  if [[ -n "${E2E_BYPASS_SHARED_SECRET:-}" ]]; then
    set_secret "E2E_BYPASS_SHARED_SECRET" "${E2E_BYPASS_SHARED_SECRET}"
  else
    echo "SKIP: E2E_BYPASS_SHARED_SECRET (not present in ${ENV_FILE})"
  fi
}

print_header
require_gh_auth
load_env_file
require_env_values
configure_defaults
write_secrets

echo
echo "Done. Run preflight next:"
echo "  pnpm ai-coach:staging:preflight"
