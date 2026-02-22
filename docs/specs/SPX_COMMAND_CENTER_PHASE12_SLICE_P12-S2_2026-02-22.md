# SPX Command Center Phase 12 Slice P12-S2 (2026-02-22)

## Objective
Add production-grade optimizer operations controls by:
1. Running SPX optimizer scans automatically every trading night (ET schedule).
2. Exposing scheduler + latest optimization metadata via API.
3. Providing a dedicated SPX Command Center Settings surface with manual run control and last optimization stats.

## Scope
In scope:
1. Backend nightly worker + schedule status endpoint.
2. Frontend SPX settings sheet with scan trigger + last stats display.
3. Mobile and desktop entry points for opening settings.
4. Test coverage for worker scheduling behavior and API schema.

Out of scope:
1. Strategy logic changes in setup generation.
2. New optimization objective functions.
3. Non-SPX settings platform changes.

## Files Changed
1. `/Users/natekahl/ITM-gd/backend/src/workers/spxOptimizerWorker.ts`
2. `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
3. `/Users/natekahl/ITM-gd/backend/src/routes/spx.ts`
4. `/Users/natekahl/ITM-gd/backend/src/server.ts`
5. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
6. `/Users/natekahl/ITM-gd/backend/src/__tests__/integration/spx-api.test.ts`
7. `/Users/natekahl/ITM-gd/hooks/use-spx-optimizer.ts`
8. `/Users/natekahl/ITM-gd/hooks/use-spx-command-controller.ts`
9. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-settings-sheet.tsx`
10. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-header.tsx`
11. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx`
12. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx`
13. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`

## Implementation Notes
1. Added `nightly_auto` optimizer mode and reused strict automated promotion guardrails.
2. Added worker schedule controls via env:
   - `SPX_OPTIMIZER_NIGHTLY_ENABLED` (default `true`)
   - `SPX_OPTIMIZER_TARGET_MINUTE_ET` (default `1150`, i.e. 19:10 ET)
   - `SPX_OPTIMIZER_CHECK_INTERVAL_MS` (default `60000`)
3. Added API endpoint:
   - `GET /api/spx/analytics/optimizer/schedule`
4. Added SPX settings sheet with:
   - Nightly automation status
   - Last optimization scan metadata
   - `Run Scan & Optimize` action

## Validation Gates
1. `pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit` ✅
2. `pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/workers/__tests__/spxOptimizerWorker.test.ts src/__tests__/integration/spx-api.test.ts src/__tests__/integration/spx-coach-stream.test.ts` ✅
3. `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit` ✅
4. `pnpm --dir /Users/natekahl/ITM-gd exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1` ✅

## Risk + Rollback
Risk:
1. Nightly worker introduces an additional scheduled background process.
2. Manual and nightly scans can overlap at the data layer if triggered simultaneously.

Rollback:
1. Disable scheduler instantly via `SPX_OPTIMIZER_NIGHTLY_ENABLED=false` and restart backend.
2. Revert files listed in this slice if full rollback required.
