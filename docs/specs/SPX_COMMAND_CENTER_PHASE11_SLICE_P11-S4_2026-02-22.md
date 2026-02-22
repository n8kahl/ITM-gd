# SPX Command Center Phase 11 - Slice P11-S4

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: Confidence-aware optimizer scoring, gating, and scorecard transparency for SPX win-rate operations.

## Objective

1. Prevent overfitting and false optimizer promotions on low sample windows.
2. Introduce confidence-aware setup pause/add recommendations.
3. Expose confidence and conservative objective metrics in the UI scorecard.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/optimizer-confidence.test.ts`
3. `/Users/natekahl/ITM-gd/hooks/use-spx-optimizer.ts`
4. `/Users/natekahl/ITM-gd/components/spx-command-center/optimizer-scorecard-panel.tsx`

## Implementation Details

### 1) Confidence intervals + conservative objective (`optimizer.ts`)

Added Wilson 95% confidence intervals for T1/T2/failure rates:

1. `SPXConfidenceInterval` type.
2. `wilsonIntervalPct()` utility.
3. Metrics now include:
   1. `t1Confidence95`
   2. `t2Confidence95`
   3. `failureConfidence95`
   4. `objectiveScoreConservative`

Conservative objective formula:

1. Uses lower bounds for T1/T2 and upper bound for failure.
2. Designed to penalize noisy small-N windows.

### 2) Promotion logic hardened to confidence-aware objective (`optimizer.ts`)

Optimizer candidate selection and promotion now use conservative objective discipline:

1. Training candidate comparison now prefers higher `objectiveScoreConservative`.
2. Validation promotion compares conservative objective versus baseline.
3. Weekly auto guardrails now require `objectiveConservativeDelta >= 0`.
4. Scorecard now reports:
   1. `improvementPct.objectiveConservativeDelta`
   2. baseline/optimized conservative objective values in notes.

### 3) Confidence-aware pause/add decisions (`optimizer.ts`)

Setup pause/add heuristics now require statistical separation:

1. Regime combo pause now only triggers if:
   1. `t1WinRatePct` is below floor and
   2. `t1Confidence95.upperPct` is also below floor.
2. Drift pause now requires both:
   1. point-estimate drop over threshold and
   2. confidence drop (`long lower bound - short upper bound > 0`).
3. Add recommendations require stronger lower-bound evidence:
   1. minimum T1 lower 95% bound threshold.

### 4) Scorecard/UI contract expanded (`hooks` + panel)

Frontend now surfaces confidence-aware truth:

1. Added new fields to `SPXOptimizerScorecard`/metrics types:
   1. confidence intervals
   2. conservative objective
   3. conservative delta
2. Scorecard panel now displays:
   1. 95% CI for baseline/optimized T1/T2
   2. conservative objective delta
   3. baseline -> optimized conservative objective row

## Validation Gates

Executed and passed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/optimizer-confidence.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/contractSelector.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/setupDetector/__tests__/tradeBuilder.test.ts src/services/positions/__tests__/exitAdvisor.test.ts`
3. `pnpm --dir backend build`
4. `pnpm exec eslint components/spx-command-center/optimizer-scorecard-panel.tsx hooks/use-spx-optimizer.ts`
5. `pnpm exec tsc --noEmit`

Known unrelated workspace blocker:

1. `pnpm run build` failed due an existing/import-surface issue outside this slice:
   1. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-containers.tsx`
   2. missing export `createCloseLevelOverlayHandler` from `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-adapters.ts`

## Strict Massive Replay/Backtest Evidence

### A) Backfill last week

Command:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`

Result:

1. attemptedDays: `5`
2. successfulDays: `5`
3. failedDays: `0`

### B) Weekly optimizer scan (`weekly_auto`)

Command:

1. `pnpm --dir backend spx:optimizer-weekly`

Result highlights:

1. `optimizationApplied=false` (baseline retained)
2. validation sample remained low (`tradeCount=2`)
3. conservative objective now explicit:
   1. baseline `-35.08`
   2. optimized `-35.08`
4. scorecard now includes 95% confidence bounds and conservative delta fields.

### C) Last-week strict backtest (actionable-only)

Command:

1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result:

1. sourceUsed: `spx_setup_instances`
2. resolutionUsed: `second`
3. usedMassiveMinuteBars: `false`
4. setupCount: `18`
5. triggeredCount: `3`
6. T1: `66.67%`
7. T2: `33.33%`
8. failure: `33.33%`
9. expectancy: `+0.3813R`
10. note: `Skipped 14 gate-blocked spx_setup_instances rows (non-actionable).`

### D) YTD strict replay summary (2026-01-02 to 2026-02-20)

Command:

1. `runSPXWinRateBacktest({ from:'2026-01-02', to:'2026-02-20', source:'spx_setup_instances', resolution:'second' })`
2. comparator: same call with `includeBlockedSetups:true`

Result:

1. actionable-only:
   1. setupCount `166`
   2. triggeredCount `42`
   3. T1 `54.76%`
   4. T2 `28.57%`
   5. failure `45.24%`
   6. expectancy `+0.1986R`
2. include-blocked:
   1. setupCount `270`
   2. triggeredCount `69`
   3. T1 `50.72%`
   4. T2 `33.33%`
   5. failure `40.58%`
   6. expectancy `+0.3011R`

## Why This Improves Accuracy

1. Point-estimate-only optimization can over-promote thresholds when N is small.
2. Confidence-aware objective and pause logic reduce false positives in optimizer decisions.
3. UI now communicates uncertainty directly so operational decisions are made from robust evidence, not only raw percentages.
