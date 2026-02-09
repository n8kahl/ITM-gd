#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-n8kahl/ITM-gd}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
WORKFLOW_PATH="${WORKFLOW_PATH:-.github/workflows/ai-coach-live-e2e.yml}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backend_url>"
  echo "Example: $0 https://staging-api.example.com"
  exit 1
fi

BACKEND_URL="$1"

if [[ ! "${BACKEND_URL}" =~ ^https?:// ]]; then
  echo "ERROR: backend_url must start with http:// or https://"
  exit 1
fi

echo "Running staging gate preflight..."
"$(dirname "$0")/check-staging-gate-readiness.sh" "${REPO}" "${TARGET_BRANCH}"

echo
echo "Dispatching workflow ${WORKFLOW_PATH} on ${TARGET_BRANCH}"
gh workflow run "${WORKFLOW_PATH}" \
  --repo "${REPO}" \
  --ref "${TARGET_BRANCH}" \
  -f backend_url="${BACKEND_URL}"

echo
echo "Workflow dispatched."
echo "List runs:"
echo "  gh run list --repo ${REPO} --workflow \"AI Coach Live E2E\" --limit 5"
echo
echo "Watch latest run:"
echo "  gh run watch --repo ${REPO}"
