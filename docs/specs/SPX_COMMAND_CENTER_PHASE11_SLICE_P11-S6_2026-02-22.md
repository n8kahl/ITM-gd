# SPX Command Center Phase 11 - Slice P11-S6

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: Setup-specific SL/TP policy for fade runners, mean-reversion target retune, and strict Massive replay validation.

## Objective

1. Improve T2 capture and expectancy for `fade_at_wall` without degrading T1.
2. Reduce unrealistic `mean_reversion` target geometry and tighten quality gating for better forward win-rate viability.
3. Ensure live tick transitions, backtest execution, and optimizer scoring are behaviorally consistent.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/tickEvaluator.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
4. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
5. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/tickEvaluator.test.ts`
6. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/winRateBacktest.test.ts`

## Implementation Details

### 1) Setup-specific trade management policy (`setupDetector.ts`)

Implemented `resolveTradeManagementForSetup(...)` and now persist setup-level policy in each setup record:

1. `mean_reversion`
   1. force `moveStopToBreakeven=true`
   2. minimum `partialAtT1Pct=0.75`
2. `fade_at_wall` (ranging + high confluence)
   1. when `confluenceScore >= 4` and (`flowConfirmed` or confluence=5): `moveStopToBreakeven=false`
   2. retain minimum `partialAtT1Pct=0.65`
3. all other setups inherit active optimizer profile trade management.

### 2) Mean-reversion target retune (`setupDetector.ts`)

1. Reduced base mean-reversion target multipliers:
   1. `T1: 1.45R -> 1.2R`
   2. `T2: 2.35R -> 1.9R`
2. Added hard caps for mean-reversion target distances:
   1. `T1 <= 1.85R`
   2. `T2 <= 2.7R`
3. Removed relaxed ranging-ready threshold for mean reversion:
   1. now requires confluence `>=3` (same as default), reducing weak ready setups.

### 3) Live execution parity (`tickEvaluator.ts`)

`stopBreached(...)` now uses setup-level `tradeManagement.moveStopToBreakeven` before env fallback, so per-setup runner policy affects live transition logic.

### 4) Backtest parity (`winRateBacktest.ts`)

1. `spx_setup_instances` metadata `tradeManagement` is parsed per setup.
2. Backtest execution now resolves an effective model per setup:
   1. global execution model + setup-level overrides.
3. Existing runner realized-R correction from P11-S5 is preserved.

### 5) Optimizer expectancy parity (`optimizer.ts`)

1. Added `stop_hit_at` to optimizer row loading/override path.
2. Added `stopHit` and `moveStopToBreakeven` into prepared rows.
3. Updated simulated realized-R for `t1_before_stop`:
   1. runner leg now modeled as `0R` if BE, `-1R` if no-BE when stop was hit.

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/tickEvaluator.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
3. `pnpm --dir backend build`

Additional lint note:

1. Root `pnpm exec eslint <backend files>` reports those files as ignored by root config.
2. Backend-local `eslint` binary is not present via `pnpm --dir backend exec eslint` in this workspace.

## Massive Replay Evidence

### A) Historical reconstruction refresh (last week)

Command:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`

Result:

1. attemptedDays: `5`
2. successfulDays: `5`
3. failedDays: `0`

### B) Strict last-week backtest after rebuild

Command:

1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result:

1. source: `spx_setup_instances`
2. resolution: `second` (no fallback)
3. triggered/resolved: `3/3`
4. T1/T2/failure: `66.67 / 66.67 / 33.33`
5. expectancy: `+0.5096R`

Delta vs prior run before this slice:

1. T1 unchanged (`66.67%`)
2. T2 improved (`33.33% -> 66.67%`)
3. expectancy improved (`0.4052R -> 0.5096R`)

### C) Last-week setup policy confirmation

Rebuilt rows show setup-level trade management and tuned target geometry persisted in `metadata.tradeManagement`:

1. high-confluence `fade_at_wall` rows use `moveStopToBreakeven=false`, `partialAtT1Pct=0.65`
2. `mean_reversion` rows use `moveStopToBreakeven=true`, `partialAtT1Pct=0.75`, with tuned `T1/T2` mostly around `1.2R / 1.9R` (capped up to `1.85R / 2.7R`)

### D) Weekly optimizer scan after slice

Command:

1. `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`

Result:

1. profile retained (`optimizationApplied=false`) due low validation sample guardrails.
2. setup-type panel improved for fade regime on the scan window:
   1. `fade_at_wall` T2 now `35.71%` on scan window data.

### E) YTD strict replay snapshot after slice

Date range: `2026-01-02` to `2026-02-20` (source `spx_setup_instances`, resolution `second`, no minute fallback).

1. overall:
   1. triggered/resolved: `42/42`
   2. T1/T2/failure: `54.76 / 30.95 / 45.24`
   3. expectancy: `+0.2363R`
2. by setup:
   1. `fade_at_wall`: T1 `56.41%`, T2 `30.77%`, expectancy `+0.2606R`
   2. `mean_reversion`: T1 `33.33%`, failure `66.67%`, expectancy `-0.0794R`

## Outcome

1. Live and backtest now support setup-level runner policy.
2. Mean-reversion setup geometry is more reachable and quality threshold is stricter.
3. Last-week strict replay shows higher T2 capture and improved expectancy without T1 degradation.
