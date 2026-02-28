# Trade Day Replay V2 — Phase 1 Slice Report (Chart + Analysis)

> **Date:** 2026-02-28  
> **Status:** COMPLETE  
> **Scope:** Slices 1-5 from `TRADE_DAY_REPLAY_V2_CHART_UPGRADE_SPEC_2026-02-27.md`

---

## Objective

Ship the chart and analysis upgrades that materially improve replay fidelity and insight:
- Indicator defaults + toolbar
- Native chart markers
- PDH/PDL key levels
- Session analysis upgrades (equity curve, grade, aggregated drivers/risks)

---

## In Scope

- `components/trade-day-replay/replay-chart.tsx`
- `components/trade-day-replay/indicator-toolbar.tsx`
- `components/trade-day-replay/trade-chart-markers.ts`
- `components/trade-day-replay/session-analysis.tsx`
- `components/trade-day-replay/equity-curve.tsx`
- `lib/trade-day-replay/session-grader.ts`
- `backend/src/routes/trade-day-replay.ts`
- `backend/src/services/trade-day-replay/types.ts`
- `lib/trade-day-replay/types.ts`
- `app/members/trade-day-replay/trade-day-replay-shell.tsx`

## Out of Scope

- Slice 6 toolbar polish
- Slice 7 trade-card sparkline polish
- Auto-journaling or AI Coach integration

---

## Delivery Summary

1. Enabled indicator-driven replay chart defaults and a compact toggle toolbar.
2. Replaced static HTML marker overlay with native lightweight-charts markers and price lines.
3. Added backend prior-day bar fetch (`PDH/PDL`) and frontend rendering.
4. Upgraded session analysis with:
   - equity curve visual,
   - deterministic session grade,
   - aggregated drivers/risks and grade factors.

---

## Validation (Phase Slice)

### Frontend
- `pnpm exec eslint components/trade-day-replay/ lib/trade-day-replay/` -> PASS
- `pnpm exec tsc --noEmit` -> PASS

### Backend
- `cd backend && npx tsc --noEmit` -> PASS

---

## Risks & Rollback

### Residual Risks
- Marker rendering depends on lightweight-charts plugin APIs; future major upgrades should keep a regression test around marker mapping.
- Day-level options context remains intentionally coarse (not point-in-time Greeks).

### Rollback
- Revert chart marker integration to legacy overlay by restoring `trade-marker-overlay.tsx` usage in `replay-chart.tsx`.
- Remove `priorDayBar` fields from payload/types if backend daily aggregate calls are unstable.

