# Chart Level Visibility Rollout (2026-02-15)

## Summary

This rollout adds production-level chart filtering by level type so traders can quickly reduce noise and focus on the levels they care about (for example, Fibonacci only).

## What Shipped

- Added level grouping and filtering utilities:
  - `fib`, `pivot`, `supportResistance`, `vwap`, `gex`, `openingRange`, `position`, `other`
- Added a new `Levels` control in the chart toolbar with:
  - Per-type toggles
  - Group counts
  - `All`, `None`, and `Reset` actions
- Added persistent level visibility preferences so user selections survive reloads.
- Added explicit group tags for derived overlays (opening range and position plan levels).
- Updated chart header/status messaging to show visible vs total level counts.
- Fixed mobile chart expansion routing so inline chat chart levels/GEX overlays persist in the full-screen sheet.

## User-Facing Behavior

- Traders can hide/show level families without re-running analysis.
- Chart labels and chart lines stay in sync with selected filters.
- The chart header reflects filter state using `visible/total` level count.
- A small status note indicates when levels are hidden by filters.
- On mobile, expanding inline chat charts now keeps the originating level overlays instead of dropping to symbol/timeframe only.

## Implementation Notes

- New grouping module:
  - `components/ai-coach/chart-level-groups.ts`
- Toolbar controls:
  - `components/ai-coach/chart-toolbar.tsx`
- Chart integration and preference wiring:
  - `components/ai-coach/center-panel.tsx`
  - `components/ai-coach/preferences.ts`
  - `components/ai-coach/trading-chart.tsx`
  - `app/members/ai-coach/page.tsx`
  - `hooks/use-mobile-tool-sheet.ts`
- Test coverage:
  - `components/ai-coach/__tests__/chart-level-groups.test.ts`
  - `components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`

## Validation

- `pnpm exec tsc --noEmit` passed.
- `pnpm exec vitest run components/ai-coach/__tests__/chart-level-groups.test.ts` passed.
- `pnpm exec vitest run components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts` passed.
- Targeted eslint run passed with no new errors (existing unrelated warnings remain in `center-panel.tsx`).

## Follow-Up Opportunities

- Add one-tap presets (for example: `Day`, `Swing`, `Options`) on top of per-type toggles.
- Add smarter right-rail label collision handling in high-density level scenarios.
- Add chart interaction telemetry (filter usage and render latency) for ongoing UX optimization.
