#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-n8kahl/ITM-gd}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
WORKFLOW_PATH="${WORKFLOW_PATH:-.github/workflows/trade-journal-release-gates.yml}"

echo "Running Trade Journal release gate preflight..."
"$(dirname "$0")/check-release-gate-readiness.sh" "${REPO}" "${TARGET_BRANCH}"

echo
echo "Dispatching workflow ${WORKFLOW_PATH} on ${TARGET_BRANCH}"
gh workflow run "${WORKFLOW_PATH}" \
  --repo "${REPO}" \
  --ref "${TARGET_BRANCH}"

echo
echo "Workflow dispatched."
echo "List runs:"
echo "  gh run list --repo ${REPO} --workflow \"Trade Journal Release Gates\" --limit 5"
echo
echo "Watch latest run:"
echo "  gh run watch --repo ${REPO}"
