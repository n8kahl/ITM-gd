#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backend_url> [symbol]"
  echo "Example: $0 https://itm-gd-staging.up.railway.app SPY"
  exit 1
fi

BACKEND_URL="$1"
SYMBOL="${2:-SPY}"
WATCHLIST="${WATCHLIST:-SPY,QQQ,AAPL}"
DAYS_AHEAD="${DAYS_AHEAD:-14}"
TOKEN="${E2E_BYPASS_TOKEN:-}"

if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: E2E_BYPASS_TOKEN is required to run authenticated earnings validation."
  exit 1
fi

if [[ ! "${BACKEND_URL}" =~ ^https?:// ]]; then
  echo "ERROR: backend_url must start with http:// or https://"
  exit 1
fi

BASE_URL="${BACKEND_URL%/}"
CALENDAR_URL="${BASE_URL}/api/earnings/calendar?watchlist=${WATCHLIST}&days=${DAYS_AHEAD}"
ANALYSIS_URL="${BASE_URL}/api/earnings/${SYMBOL}/analysis"

calendar_body="$(mktemp)"
analysis_body="$(mktemp)"
trap 'rm -f "${calendar_body}" "${analysis_body}"' EXIT

echo "Validating earnings calendar endpoint..."
calendar_status="$(curl -sS -o "${calendar_body}" -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  "${CALENDAR_URL}")"

if [[ "${calendar_status}" != "200" ]]; then
  echo "FAIL: GET /api/earnings/calendar returned ${calendar_status}"
  cat "${calendar_body}"
  exit 1
fi

node -e "
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
if (!Array.isArray(payload.watchlist)) throw new Error('watchlist must be an array');
if (!Array.isArray(payload.events)) throw new Error('events must be an array');
if (typeof payload.daysAhead !== 'number') throw new Error('daysAhead must be a number');
" "${calendar_body}"

echo "PASS: GET /api/earnings/calendar"

echo "Validating earnings analysis endpoint..."
analysis_status="$(curl -sS -o "${analysis_body}" -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  "${ANALYSIS_URL}")"

if [[ "${analysis_status}" == "200" ]]; then
  node -e "
const fs = require('fs');
const expectedSymbol = process.argv[2];
const payload = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
if (payload.symbol !== expectedSymbol) throw new Error('symbol mismatch');
if (!payload.expectedMove || typeof payload.expectedMove !== 'object') throw new Error('expectedMove missing');
if (!Array.isArray(payload.suggestedStrategies)) throw new Error('suggestedStrategies must be an array');
" "${analysis_body}" "${SYMBOL}"
  echo "PASS: GET /api/earnings/${SYMBOL}/analysis"
else
  echo "FAIL: GET /api/earnings/${SYMBOL}/analysis returned ${analysis_status}"
  cat "${analysis_body}"
  exit 1
fi

echo
echo "Earnings endpoint validation passed for ${BASE_URL}."
