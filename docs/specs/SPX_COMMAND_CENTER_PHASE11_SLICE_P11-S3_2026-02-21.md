# SPX Command Center Phase 11 - Slice P11-S3

Date: 2026-02-21  
Owner: Codex implementation run  
Scope: Setup-mix diversification controls and actionable-only backtest fidelity.

## Objective

1. Add explicit setup-type quota/cap logic in SPX setup detection.
2. Allow controlled recovery for paused diversification combos.
3. Ensure strict backtests represent live-actionable setups (exclude gate-blocked setups by default).

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/winRateBacktest.test.ts`

## Implementation Details

### 1) Setup diversification controls (`setupDetector.ts`)

Added `SetupDiversificationConfig` with env-backed controls:

1. `SPX_SETUP_DIVERSIFICATION_ENABLED` (default `true`)
2. `SPX_SETUP_ALLOW_RECOVERY_COMBOS` (default `true`)
3. `SPX_SETUP_FADE_READY_MAX_SHARE` (default `0.5`)
4. `SPX_SETUP_MIN_ALTERNATIVE_READY_SETUPS` (default `1`)

Logic added:

1. `applySetupMixPolicy` caps dominant `fade_at_wall` ready-share and blocks overflow with `mix_cap_blocked:*` gate reason.
2. Promotes strongest non-fade alternatives (`mean_reversion`, `flip_reclaim`, `orb_breakout`, `trend_pullback`) to maintain minimum alternative-ready count.
3. Enables controlled combo recovery by removing optimizer pause enforcement for selected recovery combos:
   1. `mean_reversion|ranging`
   2. `flip_reclaim|ranging`
4. Lowers ready threshold to confluence `>=2` for ranging `mean_reversion` / `flip_reclaim` to improve alternative setup activation.

### 2) Actionable-only strict backtest fidelity (`winRateBacktest.ts`)

Backtest behavior change:

1. `runSPXWinRateBacktest` now excludes `metadata.gateStatus='blocked'` setups by default.
2. Added optional override `includeBlockedSetups` for analysis parity comparisons.
3. Response notes now include count of skipped gate-blocked rows.

Rationale:

1. Gate-blocked setups are non-actionable in live operation and should not dilute true live win-rate reporting.

## Validation Gates

Executed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/contractSelector.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts` ✅
2. `pnpm --dir backend test -- src/services/setupDetector/__tests__/tradeBuilder.test.ts src/services/positions/__tests__/exitAdvisor.test.ts` ✅
3. `pnpm --dir backend build` ✅

## Strict Massive Replay Runs

### A) Last-week strict window

Commands:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
2. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result (actionable-only default):

1. `setupCount=18` (14 blocked setups excluded)
2. `triggeredCount=3`
3. `T1 win rate=66.67%`
4. `T2 win rate=33.33%`
5. `failure rate=33.33%`
6. `expectancy=+0.3813R`

Comparator (`includeBlockedSetups=true`):

1. `setupCount=32`
2. `triggeredCount=8`
3. `T1 win rate=50.00%`
4. `T2 win rate=37.50%`
5. `failure rate=37.50%`
6. `expectancy=+0.3564R`

### B) YTD 2026 strict window

Commands:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-01-02 2026-02-20`
2. `runSPXWinRateBacktest({ from: '2026-01-02', to: '2026-02-20', source: 'spx_setup_instances', resolution: 'second' })`

Backfill result:

1. `attemptedDays=50`
2. `successfulDays=50`
3. `failedDays=0`

YTD result (actionable-only default):

1. `setupCount=166`
2. `triggeredCount=42`
3. `T1 win rate=54.76%`
4. `T2 win rate=28.57%`
5. `failure rate=45.24%`
6. `expectancy=+0.1986R`
7. setup-type breakdown includes non-fade activity:
   1. `fade_at_wall`: 39 triggered
   2. `mean_reversion`: 3 triggered

Comparator (`includeBlockedSetups=true`):

1. `setupCount=270`
2. `triggeredCount=69`
3. `T1 win rate=50.72%`
4. `T2 win rate=33.33%`
5. `failure rate=40.58%`
6. `expectancy=+0.3011R`

## Notes

1. Diversification is now active but still dominated by ranging/fade in this market sample; mean-reversion is now entering the triggered distribution.
2. Actionable-only reporting is now a truer live representation of setups that pass your gating system.
