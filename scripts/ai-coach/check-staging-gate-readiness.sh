#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-n8kahl/ITM-gd}"
TARGET_BRANCH="${2:-Aiupgrade}"
WORKFLOW_PATH=".github/workflows/ai-coach-live-e2e.yml"

required_secrets=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "E2E_BYPASS_TOKEN"
)

optional_secrets=(
  "E2E_BYPASS_USER_ID"
  "E2E_BYPASS_SHARED_SECRET"
)

failures=0
warnings=0

print_header() {
  echo "AI Coach Staging Gate Preflight"
  echo "Repo: ${REPO}"
  echo "Target Branch: ${TARGET_BRANCH}"
  echo
}

check_prereqs() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "FAIL: gh CLI is not installed."
    failures=$((failures + 1))
    return
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "FAIL: gh CLI is not authenticated."
    failures=$((failures + 1))
  else
    echo "PASS: gh CLI authenticated."
  fi
}

check_workflow_exists_on_branch() {
  if gh api "repos/${REPO}/contents/${WORKFLOW_PATH}?ref=${TARGET_BRANCH}" >/dev/null 2>&1; then
    echo "PASS: ${WORKFLOW_PATH} exists on ${TARGET_BRANCH}."
  else
    echo "FAIL: ${WORKFLOW_PATH} not found on ${TARGET_BRANCH}."
    failures=$((failures + 1))
  fi
}

check_workflow_exists_on_main() {
  if gh api "repos/${REPO}/contents/${WORKFLOW_PATH}?ref=main" >/dev/null 2>&1; then
    echo "PASS: ${WORKFLOW_PATH} exists on main."
  else
    echo "WARN: ${WORKFLOW_PATH} is not on main yet (expected before merge)."
    warnings=$((warnings + 1))
  fi
}

check_secrets() {
  local secret_list
  secret_list="$(gh secret list --repo "${REPO}" --json name --jq '.[].name' 2>/dev/null || true)"

  if [[ -z "${secret_list}" ]]; then
    echo "FAIL: No repository secrets visible via gh for ${REPO}."
    failures=$((failures + 1))
    return
  fi

  for key in "${required_secrets[@]}"; do
    if grep -qx "${key}" <<<"${secret_list}"; then
      echo "PASS: required secret ${key} is configured."
    else
      echo "FAIL: required secret ${key} is missing."
      failures=$((failures + 1))
    fi
  done

  for key in "${optional_secrets[@]}"; do
    if grep -qx "${key}" <<<"${secret_list}"; then
      echo "PASS: optional secret ${key} is configured."
    else
      echo "WARN: optional secret ${key} is not configured."
      warnings=$((warnings + 1))
    fi
  done
}

check_migration_drift() {
  if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
    echo "WARN: origin/main not available locally. Run: git fetch origin"
    warnings=$((warnings + 1))
    return
  fi

  local branch_only main_only
  branch_only="$(git diff --name-only origin/main...HEAD -- supabase/migrations | wc -l | tr -d ' ')"
  main_only="$(git diff --name-only HEAD...origin/main -- supabase/migrations | wc -l | tr -d ' ')"

  if [[ "${main_only}" == "0" ]]; then
    echo "PASS: no pending supabase migrations from main missing on current branch."
  else
    echo "FAIL: ${main_only} migration file(s) exist on main but not on current branch."
    git diff --name-status HEAD...origin/main -- supabase/migrations
    failures=$((failures + 1))
  fi

  if [[ "${branch_only}" == "0" ]]; then
    echo "PASS: current branch has no additional supabase migrations relative to main."
  else
    echo "INFO: ${branch_only} migration file(s) are ahead of main on current branch."
    git diff --name-status origin/main...HEAD -- supabase/migrations
  fi
}

print_summary() {
  echo
  echo "Summary: ${failures} failure(s), ${warnings} warning(s)."
  if [[ "${failures}" == "0" ]]; then
    echo "READY: staging live gate can be executed."
  else
    echo "NOT READY: resolve failures before running staging live gate."
    exit 1
  fi
}

print_header
check_prereqs
check_workflow_exists_on_branch
check_workflow_exists_on_main
check_secrets
check_migration_drift
print_summary
