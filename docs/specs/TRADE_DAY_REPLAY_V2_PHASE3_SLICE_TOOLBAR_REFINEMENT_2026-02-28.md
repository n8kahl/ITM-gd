# Trade Day Replay V2 — Phase 3 Slice Report (Toolbar Refinement)

> **Date:** 2026-02-28  
> **Status:** COMPLETE  
> **Scope:** Slice 6 from `TRADE_DAY_REPLAY_V2_CHART_UPGRADE_SPEC_2026-02-27.md`

---

## Objective

Refine replay chart controls so users can independently manage chart indicators and structural levels while keeping replay behavior and mobile layout stable.

---

## In Scope

- `components/trade-day-replay/indicator-toolbar.tsx`
- `components/trade-day-replay/replay-chart.tsx`
- `components/trade-day-replay/replay-controls.tsx`
- `e2e/specs/members/trade-day-replay.spec.ts`
- `e2e/specs/members/trade-day-replay-test-helpers.ts`
- `docs/specs/TRADE_DAY_REPLAY_V2_CHART_UPGRADE_SPEC_2026-02-27.md`

## Out of Scope

- Slice 7 trade-card sparkline polish
- Replay parser/backend payload contract changes

---

## Delivery Summary

1. Added a dedicated `Levels` toggle group with:
   - `PDH/PDL` visibility toggle,
   - `Opening Range` visibility toggle.
2. Added compact active-only legend chips (colored dots + labels) for active overlays/levels.
3. Preserved replay controls behavior (play/pause, speed, scrubber, jump-to-trade, native markers/stop lines).
4. Added E2E coverage for:
   - levels + legend behavior,
   - non-happy path when `priorDayBar` is missing (`PDH/PDL` toggle disabled),
   - mobile viewport no-horizontal-overflow guard.

---

## Validation Commands

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
pnpm exec eslint components/trade-day-replay/ e2e/specs/members/trade-day-replay.spec.ts e2e/specs/members/trade-day-replay-test-helpers.ts
pnpm exec tsc --noEmit
pnpm vitest run components/trade-day-replay/__tests__/trade-chart-markers.test.ts
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/trade-day-replay.spec.ts --project=chromium --workers=1
```
