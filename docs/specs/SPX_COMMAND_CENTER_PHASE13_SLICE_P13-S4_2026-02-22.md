# SPX Command Center Phase 13 Slice P13-S4 (2026-02-22)

## Objective
Refine SPX execution discipline with:
1. Tighter regime-aware contract filtering (delta banding, setup-family 0DTE rollover discipline, and late-theta guards).
2. Deterministic 1R/2R exit mechanics with structural runner trailing in the position advisor path.

## Scope
In scope:
1. `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/positions/exitAdvisor.ts`
3. `/Users/natekahl/ITM-gd/backend/src/workers/positionTrackerWorker.ts`
4. `/Users/natekahl/ITM-gd/backend/src/services/positions/__tests__/exitAdvisor.test.ts`
5. `/Users/natekahl/ITM-gd/backend/.env.example`

Out of scope:
1. New strategy family introduction.
2. Brokerage routing/execution adapters.

## Implementation Details
1. Contract selector refinements:
   - Added setup/regime-aware delta banding around target delta.
   - Added setup-family-specific 0DTE rollover cutoffs (`trend` families roll earlier).
   - Added strict/relaxed 0DTE theta caps to avoid terminal decay traps.
2. Exit advisor refinements:
   - Shifted to deterministic scale-out policy:
     - 1R: scale 65% and move stop to breakeven.
     - 2R: scale additional 25%, retain 10% runner.
   - Added structural trailing stop model (`pivot_runner` / `pivot_runner_tight`) using pivot anchors when available and risk-proxy pivots otherwise.
   - Extended advice input with `entryPrice` to improve risk-unit derivation.
3. Worker wiring:
   - Position tracker now forwards `entryPrice` into advisor input.

## Validation Gates
1. `pnpm --dir backend exec tsc --noEmit`
2. `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts src/services/spx/__tests__/microbarAggregator.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/positions/__tests__/exitAdvisor.test.ts`

## Promotion Gates
1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
   - `attemptedDays=5`, `successfulDays=5`, `failedDays=0`.
2. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
   - `usedMassiveMinuteBars=false`.
   - Window: `2026-02-16` → `2026-02-20`.
   - Result: `triggered=1`, `resolved=1`, `T1=0.00%`, `T2=0.00%`, `expectancyR=-1.04`.

## Baseline Delta Comparison
Baseline reference (strict second-resolution, documented in change control):
1. `T1=76.47%`
2. `T2=70.59%`
3. `expectancyR=+1.0587`

Current gate output:
1. `T1=0.00%` (`delta -76.47pp`)
2. `T2=0.00%` (`delta -70.59pp`)
3. `expectancyR=-1.04` (`delta -2.0987R`)

## Outcome
1. Code-level P13-S4 mechanics are implemented and validated by unit/integration gates.
2. Promotion metrics are below baseline due throughput collapse (non-actionable filtering / paused families), not minute-bar fallback or replay-resolution drift.
3. Next action remains policy recalibration (gate/mix thresholds) before promotion.

## Rollback
1. Revert this slice commit.
2. Temporarily relax contract strictness by reverting delta-band/theta filters if execution candidate starvation appears in live scan.
3. Revert advisor behavior to prior heuristic profile if user-experience regression is observed in live position coaching.
