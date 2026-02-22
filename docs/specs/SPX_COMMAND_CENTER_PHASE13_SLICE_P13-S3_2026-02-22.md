# SPX Command Center Phase 13 Slice P13-S3 (2026-02-22)

## Objective
Wire macro/microstructure telemetry into optimizer learning and governance, remove confluence-score saturation, and bring historical replay microstructure parity into setup generation.

## Scope
In scope:
1. `backend/src/services/spx/optimizer.ts`
2. `backend/src/services/spx/setupDetector.ts`
3. `backend/src/services/spx/historicalReconstruction.ts`
4. `backend/src/services/spx/types.ts`
5. `backend/src/services/spx/__tests__/setupDetector.test.ts`
6. `backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts`
7. `backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
8. `backend/src/__tests__/integration/spx-api.test.ts`
9. `backend/.env.example`

Out of scope:
1. Contract/exit mechanics changes (`contractSelector.ts`, `exitAdvisor.ts`) tracked under P13-S4.
2. New strategy-family additions; this slice governs detection/optimizer fidelity and governance only.

## Implementation Plan
1. Extend optimizer row prep to parse and use:
   - `metadata.macroAlignmentScore`
   - `metadata.microstructureScore`
   - `metadata.microstructure.{aligned,available,aggressorSkew,bidAskImbalance,quoteCoveragePct,avgSpreadBps}`
2. Add optimizer candidate knobs and sweeps for:
   - `minMacroAlignmentScore` (`30/34/38`)
   - `requireMicrostructureAlignment` (trend-family)
   - `minMicroAggressorSkewAbs` (`0.07/0.10/0.13`)
   - `minMicroImbalanceAbs` (`0.04/0.06/0.08`)
   - `minMicroQuoteCoveragePct` (`0.30/0.40/0.50`)
3. Replace confluence source-count cap with weighted confluence scoring while preserving existing setup output shape.
4. Add profile-driven macro/micro policy maps (`bySetupType`, `bySetupRegime`, `bySetupRegimeTimeBucket`) and resolve per-setup gates from profile + env safety overrides.
5. Add blocker governance to optimizer scorecard:
   - macro/micro blocked percentages
   - by setup/regime/time-bucket breakdown
   - trigger-rate throughput guardrail to prevent “higher win rate with collapsed throughput”.
6. Add historical microstructure parity:
   - reconstruct synthetic tick microstructure from Massive `I:SPX` second bars in historical replay
   - inject replay ticks into `detectActiveSetups` so historical setup metadata includes microstructure diagnostics.

## Risks
1. Candidate-grid expansion can increase optimizer runtime.
2. Strict macro/micro thresholds can reduce trigger throughput.
3. Historical synthetic quote fields are approximations from second bars, not native quote-tape snapshots.

## Mitigations
1. Candidate grid was reduced to a bounded sweep set (`~6.5k` candidates) to contain scan latency.
2. Added trigger-rate throughput guardrail to block deceptive “win-rate-only” promotions.
3. Retained fail-open microstructure default for unavailable data and surfaced blocker mix in scorecard.

## Rollback
1. Revert profile-driven macro/micro policy mutations in optimizer state (use optimizer history revert).
2. Set conservative envs for temporary fail-open posture:
   - `SPX_SETUP_MACRO_KILLSWITCH_ENABLED=false`
   - `SPX_SETUP_MICROSTRUCTURE_ENABLED=false`
3. Revert this slice commit if promotion gates degrade materially.

## Validation Gates (Slice)
1. `pnpm exec eslint --no-ignore backend/src/services/spx/optimizer.ts backend/src/services/spx/setupDetector.ts backend/src/services/spx/historicalReconstruction.ts backend/src/services/spx/types.ts backend/src/services/spx/__tests__/setupDetector.test.ts backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
2. `pnpm --dir backend exec tsc --noEmit`
3. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/nightlyReplayOptimizer.test.ts src/workers/__tests__/spxOptimizerWorker.test.ts`
4. `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts src/services/spx/__tests__/microbarAggregator.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/positions/__tests__/exitAdvisor.test.ts`

## Promotion Gates (Executed)
1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`
   - `attemptedDays=5`, `successfulDays=5`, `failedDays=0`.
2. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
   - `usedMassiveMinuteBars=false` (strict second resolution).
   - Result window: `2026-02-16` to `2026-02-20`.
3. `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`
   - Scorecard now includes `blockerMix` and throughput guardrail telemetry.

## Acceptance Criteria Status
1. Optimizer consumes macro/micro telemetry and tunes related thresholds. ✅
2. Confluence scoring no longer saturates from source-count cap. ✅
3. Setup macro/micro floors resolved from profile maps by setup/regime/time bucket. ✅
4. Historical replay setup generation includes microstructure diagnostics from Massive second-bar path. ✅
5. Optimizer scorecard includes blocker percentages and throughput-collapse guardrail. ✅

## Notable Gate Outcome
1. Last-week strict replay produced low actionable throughput (`triggeredCount=1`) because most rows were gate-blocked/hidden/paused under current policy. This is now visible in governance outputs and is the next optimization target (policy tuning, not fidelity gap).

