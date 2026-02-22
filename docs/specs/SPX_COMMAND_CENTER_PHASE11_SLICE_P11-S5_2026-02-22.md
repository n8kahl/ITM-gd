# SPX Command Center Phase 11 - Slice P11-S5

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: SL/TP realized-R model fidelity hardening and execution-policy re-evaluation for SPX win-rate optimization.

## Objective

1. Ensure backtest realized-R math matches live trade-management semantics for runner behavior after T1.
2. Re-evaluate breakeven stop and partial-at-T1 policy using corrected Massive second-bar replay.
3. Produce actionable recommendations to improve T1/T2 and expectancy while preserving production safety.

## Root-Cause Gap Found

In `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`, `t1_before_stop` realized-R previously assumed the runner leg always contributed `0R` after T1.

Impact:

1. `moveStopToBreakevenAfterT1=false` was overstated in some paths because runner stop losses were not fully modeled.
2. T1-hit unresolved cases ignored runner mark-to-close PnL.
3. SL/TP policy comparisons could be directionally biased.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/winRateBacktest.test.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`

## Implementation Details

### 1) Realized-R correction for `t1_before_stop`

Updated realized-R logic in `evaluateSetupAgainstBars(...)`:

1. Added runner leg accounting for `t1_before_stop` outcomes.
2. If stop is hit after T1:
   1. runner R = `0` when `moveStopToBreakevenAfterT1=true`
   2. runner R = `-1` when `moveStopToBreakevenAfterT1=false`
3. If T1 is hit and neither stop nor T2 is hit by session end:
   1. runner leg is marked to close using last observed Massive bar close.
4. `expired_unresolved` now reuses the same mark-to-close runner function for consistency.

### 2) Unit test expansion

Added explicit tests to prevent regressions:

1. Runner-loss accounting when breakeven move is disabled.
2. Runner mark-to-close accounting when T1 hit occurs without stop/T2 before session end.

### 3) Optimizer partial grid expansion

Updated optimizer candidate grid to include `partialAtT1Pct=0.8` so walk-forward search can evaluate higher T1 scaling where samples justify it.

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/winRateBacktest.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/setupDetector/__tests__/tradeBuilder.test.ts src/services/positions/__tests__/exitAdvisor.test.ts`
3. `pnpm --dir backend build`

## Massive Replay Evidence (Corrected Model)

### A) Last-week strict replay (2026-02-16 to 2026-02-20)

Command:

1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result:

1. source: `spx_setup_instances`
2. resolution: `second` (no fallback)
3. triggered/resolved: `3/3`
4. T1/T2/failure: `66.67 / 33.33 / 33.33`
5. expectancy: `+0.4052R`

### B) YTD policy sweep (2026-01-02 to 2026-02-20, actionable-only)

Command class:

1. `runSPXWinRateBacktest(..., source:'spx_setup_instances', resolution:'second', executionModel:{partialAtT1Pct, moveStopToBreakevenAfterT1})`

Results:

1. `moveStop=true`
   1. partial `0.35` -> expectancy `0.2078R`, T2 `28.57%`
   2. partial `0.50` -> expectancy `0.2271R`, T2 `28.57%`
   3. partial `0.65` -> expectancy `0.2464R`, T2 `28.57%`
   4. partial `0.80` -> expectancy `0.2658R`, T2 `28.57%`
2. `moveStop=false`
   1. partial `0.35` -> expectancy `0.2309R`, T2 `33.33%`
   2. partial `0.50` -> expectancy `0.2449R`, T2 `33.33%`
   3. partial `0.65` -> expectancy `0.2589R`, T2 `33.33%`
   4. partial `0.80` -> expectancy `0.2729R`, T2 `33.33%`

Observed:

1. T1 remains unchanged (`54.76%`) across execution policy variants.
2. Higher partial-at-T1 consistently improves expectancy in current sample.
3. Disabling auto-BE improves T2 and expectancy modestly in this window (best delta at current baseline: `+0.0125R` for `0.65` partial).

### C) Setup-level evidence (YTD, partial `0.65`)

1. `fade_at_wall`
   1. BE true: T1 `56.41%`, T2 `28.21%`, expectancy `0.2738R`
   2. BE false: T1 `56.41%`, T2 `33.33%`, expectancy `0.2872R`
2. `mean_reversion`
   1. T1 `33.33%`, failure `66.67%`, expectancy `-0.1094R`
   2. sample size `n=3` (insufficient for policy conclusions)

### D) Geometry pressure (YTD, live model)

1. `fade_at_wall`: avg `T1=1.56R`, `T2=2.42R`
2. `mean_reversion`: avg `T1=2.56R`, `T2=3.75R`

Interpretation:

1. Mean-reversion targets are structurally too far for current hit-rate regime.
2. Improving T1 materially requires detector/target geometry changes, not just exit policy tuning.

### E) Weekly optimizer scan after grid expansion

Command:

1. `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`

Result:

1. profile remained unchanged (`optimizationApplied=false`) due conservative guardrail fail on low validation sample.
2. optimized candidate showed higher raw objective/expectancy but lower conservative objective, so baseline was retained as designed.

## Recommendations (Production-Safe Sequence)

1. Keep current global baseline as-is for this week (`partialAtT1Pct=0.65`, BE enabled) because validation sample is still low.
2. Add a controlled A/B slice for `fade_at_wall` only:
   1. variant A: BE enabled
   2. variant B: BE disabled until a time/range-based runner lock condition
3. Add setup-specific target policy for `mean_reversion`:
   1. reduce T1 objective from current ~`2.56R` toward regime-scaled `1.3R-1.8R`
   2. preserve T2 runner objective only when flow/EMA confluence is high
4. Extend scorecard to include:
   1. setup-level expectancy delta by execution policy
   2. runner stop-state attribution (`t1_then_stop`, `t1_then_expire`, `t1_then_t2`)

## Why This Improves Accuracy

1. Realized-R is now path-consistent for runner legs after T1.
2. SL/TP policy comparisons no longer rely on a flat-runner assumption.
3. Recommendation quality is improved because policy deltas are now measured on corrected Massive replay outcomes.
