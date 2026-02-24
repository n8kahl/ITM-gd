#!/usr/bin/env bash
# tsc-check-commit.sh — Post-commit TypeScript error checker
# Only flags NEW errors in files changed by the latest commit.
# Pre-existing errors in untouched files are ignored.
# False positives from Node.js globals (process, Buffer, __dirname) that
# Next.js provides at build time are filtered out.

set -euo pipefail

cd /home/user/ITM-gd

# Get .ts/.tsx files changed in the latest commit
CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD -- '*.ts' '*.tsx' 2>/dev/null || true)

if [ -z "$CHANGED" ]; then
  echo "[tsc-agent] No TypeScript files in commit — skipping check" >&2
  exit 0
fi

echo "[tsc-agent] Checking TypeScript for committed files..." >&2

# Run full tsc (required for cross-file resolution) and capture output
TSC_OUT=$(pnpm exec tsc --noEmit 2>&1 || true)

# Filter errors to only files in this commit
ERRORS=""
while IFS= read -r file; do
  # Match errors starting with this file path
  FILE_ERRORS=$(echo "$TSC_OUT" | grep "^${file}(" || true)
  if [ -n "$FILE_ERRORS" ]; then
    ERRORS="${ERRORS}${FILE_ERRORS}"$'\n'
  fi
done <<< "$CHANGED"

# Remove known false positives: Node.js globals that Next.js provides at build time
# These always show up in tsc --noEmit but never break the actual Next.js build.
ERRORS=$(echo "$ERRORS" | grep -v "Cannot find name 'process'" || true)
ERRORS=$(echo "$ERRORS" | grep -v "Cannot find name 'Buffer'" || true)
ERRORS=$(echo "$ERRORS" | grep -v "Cannot find name '__dirname'" || true)
ERRORS=$(echo "$ERRORS" | grep -v "Cannot find name '__filename'" || true)
ERRORS=$(echo "$ERRORS" | grep -v "Cannot find module 'node:" || true)

# Trim empty lines
ERRORS=$(echo "$ERRORS" | sed '/^$/d')

if [ -n "$ERRORS" ]; then
  echo "" >&2
  echo "=== TypeScript errors in committed files ===" >&2
  echo "$ERRORS" >&2
  echo "" >&2
  echo "Fix these errors before pushing." >&2
  exit 1
else
  echo "[tsc-agent] TypeScript check passed — no actionable errors in committed files" >&2
  exit 0
fi
