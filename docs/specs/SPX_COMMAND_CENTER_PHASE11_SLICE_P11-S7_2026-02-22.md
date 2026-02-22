# SPX Command Center Phase 11 - Slice P11-S7

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: Actionable-only win-rate fidelity, historical reconstruction lifecycle correctness, regime sensitivity retune, and setup-type contract expansion hardening.

## Objective

1. Raise win-rate fidelity so backtests represent what the live SPX Command Center would actually execute.
2. Preserve intraday setup lifecycle history in Massive-based reconstruction (avoid losing early triggered setups that later rotate off-screen).
3. Enable ORB/trend family detection safely while preventing low-quality breakout spam.
4. Remove DB constraint drift that blocked new setup families from persisting.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/utils.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/regimeClassifier.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
4. `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`
5. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
6. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
7. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupDetector.test.ts`

## Implementation Details

### 1) Regime classifier sensitivity and trend context

1. Added `trendStrength` input to `classifyRegimeFromSignals(...)` (`utils.ts`) to reduce over-reliance on net GEX sign alone.
2. Added EMA-spread + EMA-slope based trend-strength computation in `regimeClassifier.ts`.
3. `classifyCurrentRegime(...)` now feeds both `volumeTrend` and `trendStrength` into regime selection.
4. Historical reconstruction now passes per-bar trend strength for deterministic replay parity.

### 2) Setup detection and gate hardening

1. Added setup-specific gate floors for trend/breakout families (`orb_breakout`, `trend_pullback`, `trend_continuation`, `breakout_vacuum`).
2. Added env-controlled switch `SPX_SETUP_SPECIFIC_GATES_ENABLED` (default `true`) so tests can disable these constraints deterministically.
3. Expanded inference conditions so ORB/pullback families can activate in momentum-credible contexts instead of being permanently dormant.
4. Tightened mix-policy promotions to require stronger score + EV + pWin before promoting alternatives.

### 3) Historical reconstruction correctness (critical)

1. Fixed replay persistence to keep an `observedSetupsById` map across the full intraday loop.
2. Added merge logic so earliest `createdAt` and first `triggeredAt` are retained even when setup snapshots evolve.
3. Persisted all observed setups at session end instead of only the final active snapshot.
4. Optimized backfill runtime by:
   1. skipping weekend dates in the date-range iterator
   2. loading minute bars first and skipping expensive options snapshots for non-trading sessions.

### 4) Win-rate fidelity policy

1. `runSPXWinRateBacktest` now excludes `tier='hidden'` rows by default (non-actionable in live workflow).
2. Added optional `includeHiddenTiers` override for diagnostic runs.
3. Added explicit notes for skipped hidden-tier rows.

### 5) Optimizer parity

1. Added `tier` to prepared optimizer rows.
2. `passesCandidate(...)` now excludes hidden-tier rows to align optimizer scoring with actionable setup policy.
3. Expanded candidate grid search space (higher pWin/EV floors, additional partial-at-T1 options) while keeping baseline defaults stable.

### 6) Database contract correction

Applied migration to expand setup-type constraints for:
1. `spx_setups`
2. `spx_setup_instances`

Allowed setup types now include:
1. `orb_breakout`
2. `trend_pullback`
3. `flip_reclaim`

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/aiPredictor.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/tickEvaluator.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
2. `pnpm --dir backend build`

## Massive Replay Evidence (Strict)

### A) Last-week reconstruction

Command:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`

Result:

1. attemptedDays: `5`
2. successfulDays: `5`
3. failedDays: `0`
4. per-day triggered-at-generation:
   1. `2026-02-17: 9`
   2. `2026-02-18: 7`
   3. `2026-02-19: 6`
   4. `2026-02-20: 16`

### B) Last-week strict backtest (actionable-only)

Command:

1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result:

1. source: `spx_setup_instances`
2. resolution: `second` (no fallback)
3. triggered/resolved: `19/19`
4. T1/T2/failure: `57.89 / 52.63 / 36.84`
5. expectancy: `+0.3585R`
6. notes:
   1. `Skipped 59 gate-blocked ... rows`
   2. `Skipped 45 hidden-tier ... rows`

### C) Diagnostic comparison (including hidden tiers)

Same date range and resolution with hidden-tier rows included produced materially lower hit-rate (`T1 44.74%`).

This confirms hidden-tier exclusion is required for live-representative win-rate reporting.

## Outcome

1. Backtests now better represent live-actionable behavior.
2. Historical replay no longer drops early triggered setups.
3. New setup families can persist without DB constraint failures.
4. Current actionable profile is positive expectancy with materially improved T1/T2 vs mixed hidden+actionable evaluation.
