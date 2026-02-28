# Trade Day Replay V2 — Release Notes

> **Release Date:** 2026-02-28  
> **Status:** RELEASED (Session C hardening + closeout complete)

---

## Highlights

1. Upgraded replay chart from static overlays to native chart annotations.
2. Enabled indicator-driven replay context (EMA8/EMA21, VWAP, Opening Range defaults).
3. Added key level overlays (PDH/PDL) from backend prior-day aggregates.
4. Added richer session analysis (equity curve, letter-grade scoring, aggregated drivers/risks).
5. Completed Slice 6 and Slice 7 polish (levels controls/legend and trade-card sparkline fallback).
6. Added deterministic unit and E2E coverage for replay UX and non-happy preflight behavior.

---

## Included Changes

### Chart + Marker Layer
- `components/trade-day-replay/replay-chart.tsx`
- `components/trade-day-replay/indicator-toolbar.tsx`
- `components/trade-day-replay/trade-chart-markers.ts`

### Analysis Layer
- `components/trade-day-replay/session-analysis.tsx`
- `components/trade-day-replay/equity-curve.tsx`
- `lib/trade-day-replay/session-grader.ts`

### Backend Payload Enhancements
- `backend/src/routes/trade-day-replay.ts`
- `backend/src/services/trade-day-replay/types.ts`
- `lib/trade-day-replay/types.ts`

### Test Coverage Added
- `lib/trade-day-replay/__tests__/session-grader.test.ts`
- `components/trade-day-replay/__tests__/trade-chart-markers.test.ts`
- `e2e/specs/members/trade-day-replay.spec.ts`
- `e2e/specs/members/trade-day-replay-test-helpers.ts`

---

## Validation Summary

Node 22 environment:

```text
v22.22.0
/Users/natekahl/.nvm/versions/node/v22.22.0/bin/node
pnpm 10.29.1
```

| Command | Output Evidence | Result |
|---|---|---|
| `pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts` | no stdout/stderr | PASS (exit 0) |
| `pnpm exec tsc --noEmit` | no stdout/stderr | PASS (exit 0) |
| `pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts lib/trade-day-replay/__tests__/session-grader.test.ts` | `Test Files 2 passed`, `Tests 6 passed` | PASS (exit 0) |
| `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1` | `Running 5 tests using 1 worker`, `5 passed (21.7s)` | PASS (exit 0) |
| `cd /Users/natekahl/ITM-gd/backend && npx tsc --noEmit` | no stdout/stderr | PASS (exit 0) |

Observed warnings during Playwright run (non-gating): repeated `NO_COLOR` warning and Massive `NOT_AUTHORIZED` log lines; suite still passed and validated fallback behavior.

---

## Final Residual Risks

1. Prior-day levels (`priorDayBar`) depend on upstream daily aggregate availability; replay remains functional without PDH/PDL lines.
2. Market/AI dependency outages can still fail replay build; UX shows deterministic degraded states but does not fully offline-cache.
3. Options context remains day-granularity (`as_of`) and is not candle-timestamp synchronized.
4. Lightweight-charts marker API drift remains possible on future major upgrades.

## V2 Rollback Points

1. Marker/price-line regression: revert native marker integration in `components/trade-day-replay/replay-chart.tsx` and `components/trade-day-replay/trade-chart-markers.ts`.
2. Prior-day level instability: remove `priorDayBar` enrichment in `backend/src/routes/trade-day-replay.ts` and mirrored payload typing.
3. Session-analysis regression: revert `equity-curve` and grading blocks in `components/trade-day-replay/session-analysis.tsx` and `lib/trade-day-replay/session-grader.ts`.
