# Trade Day Replay V2 — Phase 4 Slice Report (Trade Card Sparkline)

> **Date:** 2026-02-28  
> **Status:** COMPLETE  
> **Scope:** Slice 7 from `TRADE_DAY_REPLAY_V2_CHART_UPGRADE_SPEC_2026-02-27.md`

---

## Objective

Polish expanded trade cards with a compact SPX hold-window sparkline that improves per-trade context without changing replay controls or card interaction patterns.

---

## In Scope

- `components/trade-day-replay/trade-card.tsx`
- `components/trade-day-replay/session-analysis.tsx`
- `e2e/specs/members/trade-day-replay.spec.ts`
- `e2e/specs/members/trade-day-replay-test-helpers.ts`
- `docs/specs/TRADE_DAY_REPLAY_V2_CHART_UPGRADE_SPEC_2026-02-27.md`

## Out of Scope

- Replay parser/backend payload contract changes
- Chart panel indicator/marker behavior changes
- Trade card information architecture changes outside sparkline section

---

## Delivery Summary

1. Added a compact SPX sparkline to expanded trade cards.
2. Filtered replay bars by each trade hold window (entry to resolved exit).
3. Added entry/exit markers and a highlighted entry→exit segment.
4. Added a fail-safe fallback (`Sparkline unavailable`) for missing/invalid bars or timestamps.
5. Added E2E coverage for sparkline visibility and an invalid-timestamp fallback path.

---

## Validation Commands

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts
pnpm exec tsc --noEmit
pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1
```
