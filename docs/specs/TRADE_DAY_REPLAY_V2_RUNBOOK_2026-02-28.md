# Trade Day Replay V2 — Runbook

> **Date:** 2026-02-28  
> **Audience:** Backend/Frontend operators, QA, release owner

---

## 1. Preconditions

1. Admin users must satisfy backend gate (`profiles.role = 'admin'`).
2. `OPENAI_API_KEY` configured for transcript parser.
3. Massive credentials configured for SPX aggregate/snapshot calls.
4. App and backend reachable through Next proxy route:
   - `app/api/trade-day-replay/[...path]/route.ts`.

---

## 2. Smoke Test Procedure

1. Navigate to `/members/trade-day-replay`.
2. Confirm health preflight succeeds (input form visible).
3. Paste known transcript fixture and click `Build Replay`.
4. Verify replay load surfaces:
   - indicator toolbar visible (`EMA 8`, `EMA 21`, `VWAP`, `OR`, `RSI`, `MACD`),
   - native markers/stop lines visible on chart,
   - `Session Analysis` panel and `Trade Cards` render.
5. Verify degraded path:
   - force health 403 and confirm UX shows `Backend admin access not configured`.

---

## 3. Validation Gates

Run from `/Users/natekahl/ITM-gd`:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
node -v
which node
pnpm -v
pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts
pnpm exec tsc --noEmit
pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts lib/trade-day-replay/__tests__/session-grader.test.ts
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1
cd /Users/natekahl/ITM-gd/backend && npx tsc --noEmit
```

Expected gate outcomes for Session C closeout:
- `node -v`: `v22.22.0`
- `which node`: `/Users/natekahl/.nvm/versions/node/v22.22.0/bin/node`
- `pnpm -v`: `10.29.1`
- ESLint gate: no output, exit 0
- Root TypeScript gate: no output, exit 0
- Vitest gate: `2 passed` test files, `6 passed` tests
- Playwright gate: `Running 5 tests using 1 worker`, `5 passed (21.7s)`
- Backend TypeScript gate: no output, exit 0

---

## 4. Failure Triage

1. `403` on health/build:
   - verify `profiles.role = 'admin'`,
   - verify user session token propagation through proxy.
2. Parser failures (`422`/`502`):
   - inspect parser error details from backend response,
   - verify transcript size < configured max and OpenAI availability.
3. Missing PDH/PDL:
   - check backend logs for prior-day aggregate lookup warning,
   - replay should still function without `priorDayBar`.
4. Marker visibility mismatch:
   - validate event timestamps normalize to visible replay window,
   - run marker unit tests for regression checks.

---

## 5. Rollback

1. Marker/line rollback point:
   - revert `components/trade-day-replay/replay-chart.tsx` and `components/trade-day-replay/trade-chart-markers.ts`.
2. Prior-day level rollback point:
   - revert `priorDayBar` wiring in `backend/src/routes/trade-day-replay.ts`,
   - revert payload typing in `backend/src/services/trade-day-replay/types.ts` and `lib/trade-day-replay/types.ts`.
3. Session analysis rollback point:
   - revert `components/trade-day-replay/session-analysis.tsx`,
   - revert `components/trade-day-replay/equity-curve.tsx`,
   - revert `lib/trade-day-replay/session-grader.ts`.
4. Do not rollback parser/build route unless failures are outside V2 scope; V2 is additive to replay visualization/analysis.
