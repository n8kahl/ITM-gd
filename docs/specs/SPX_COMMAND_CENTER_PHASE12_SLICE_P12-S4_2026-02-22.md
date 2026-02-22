# SPX Command Center Phase 12 Slice P12-S4 (2026-02-22)

## Objective
Implement fail-closed nightly optimizer quality gates and database/query optimizations so nightly optimization only promotes from high-fidelity Massive-driven actuals and scales safely for larger historical ranges.

## Scope
In scope:
1. Fail-closed data-quality gate for automated optimizer scans (`weekly_auto`, `nightly_auto`).
2. Worker enforcement so failed data-quality scans are marked as nightly failures.
3. Paginated Supabase loaders for optimizer/backtest (`spx_setup_instances`) to avoid silent row truncation.
4. Database index optimization for date-range scan paths.

Out of scope:
1. New setup families or signal scoring model changes.
2. UI redesign of settings/scorecard surfaces.
3. Contract-selection or exit-policy model changes.

## Files Changed
1. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
3. `/Users/natekahl/ITM-gd/backend/src/workers/spxOptimizerWorker.ts`
4. `/Users/natekahl/ITM-gd/supabase/migrations/20260323060000_spx_optimizer_db_optimization.sql`

## Design Notes
1. Added `scorecard.dataQuality` telemetry (source, resolution, missing/fallback sessions, override coverage, gate status/reasons).
2. Automated fail-closed controlled by env + thresholds:
   - `SPX_OPTIMIZER_FAIL_CLOSED_AUTOMATED` (default `true`)
   - `SPX_OPTIMIZER_FAIL_CLOSED_REQUIRE_SECOND_BARS` (default `true`)
   - `SPX_OPTIMIZER_FAIL_CLOSED_REQUIRE_INSTANCE_SOURCE` (default `true`)
   - `SPX_OPTIMIZER_FAIL_CLOSED_MIN_OVERRIDE_COVERAGE_PCT` (default `95`)
   - `SPX_OPTIMIZER_FAIL_CLOSED_MAX_FALLBACK_SESSIONS` (default `0`)
   - `SPX_OPTIMIZER_FAIL_CLOSED_MAX_MISSING_BARS_SESSIONS` (default `0`)
3. `optimizationApplied` now requires `dataQuality.gatePassed` for automated modes.
4. Nightly worker now throws/records failure when fail-closed gate blocks promotion.
5. `spx_setup_instances` reads now use deterministic pagination with `order + range` in both optimizer and backtest loaders.

## Database Optimization
Migration: `/Users/natekahl/ITM-gd/supabase/migrations/20260323060000_spx_optimizer_db_optimization.sql`

Added indexes:
1. `idx_spx_setup_instances_session_engine` on `(session_date, engine_setup_id)`
2. `idx_spx_setup_instances_session_setup_triggered` on `(session_date, setup_type, regime, triggered_at)`
3. `idx_ai_coach_tracked_setups_symbol_tracked_at` on `(symbol, tracked_at, id)` (conditional if table exists)

Verification SQL confirmed all three indexes exist in `public`.

## Validation Gates
1. `pnpm --dir /Users/natekahl/ITM-gd exec eslint --no-ignore backend/src/services/spx/optimizer.ts backend/src/services/spx/winRateBacktest.ts backend/src/workers/spxOptimizerWorker.ts` ✅
2. `pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit` ✅
3. `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit` ✅
4. `pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/workers/__tests__/spxOptimizerWorker.test.ts src/__tests__/integration/spx-api.test.ts` ✅
5. `pnpm --dir /Users/natekahl/ITM-gd exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1` ✅
6. `pnpm --dir /Users/natekahl/ITM-gd/backend run spx:optimizer-weekly` ✅
   - Confirmed `scorecard.dataQuality.gatePassed=true`
   - Confirmed `overrideCoveragePct=100`

## Risk / Rollback
Risk:
1. Fail-closed thresholds may block automated promotions in sparse or degraded data windows.
2. Pagination increases total DB round-trips on very large ranges.

Rollback:
1. Disable fail-closed temporarily: `SPX_OPTIMIZER_FAIL_CLOSED_AUTOMATED=false`.
2. Revert this slice commit.
3. Drop added indexes if needed:
   - `DROP INDEX IF EXISTS idx_spx_setup_instances_session_engine;`
   - `DROP INDEX IF EXISTS idx_spx_setup_instances_session_setup_triggered;`
   - `DROP INDEX IF EXISTS idx_ai_coach_tracked_setups_symbol_tracked_at;`
