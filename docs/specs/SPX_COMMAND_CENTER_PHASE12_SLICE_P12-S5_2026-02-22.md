# SPX Command Center Phase 12 Slice P12-S5 (2026-02-22)

## Objective
Raise live setup-selection fidelity and nightly optimization accuracy by:
1. Replacing heuristic-only setup win-probability calibration with realized-outcome calibration from `spx_setup_instances`.
2. Running nightly replay reconstruction before optimizer promotion so nightly scans use up-to-date Massive-driven actual outcomes.

## Scope
In scope:
1. Setup calibration service with hierarchical fallback (`setup|regime|time_bucket` -> `setup|regime` -> `setup` -> `global` -> heuristic) and conservative blending.
2. Integration of calibrated `pWin` into live setup scoring/gating in `setupDetector`.
3. Nightly replay->optimizer orchestrator and nightly worker integration.
4. Targeted unit/integration tests for calibration and replay orchestration paths.

Out of scope:
1. New setup families or detector heuristic rewrites.
2. UI redesign beyond existing settings/schedule surfaces.
3. Contract-selection and exit-advisor model changes.

## Files Changed
1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupCalibration.ts` (new)
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/nightlyReplayOptimizer.ts` (new)
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
4. `/Users/natekahl/ITM-gd/backend/src/workers/spxOptimizerWorker.ts`
5. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupCalibration.test.ts` (new)
6. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts` (new)
7. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/setupDetector.test.ts`
8. `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/spxOptimizerWorker.test.ts`

## Implementation Notes
1. Added `loadSetupPWinCalibrationModel()` with ET-date bounded loading (`asOfDateEt - 1`), paginated Supabase reads, Bayesian smoothing, and in-memory TTL cache.
2. Calibration source selection priority:
   - `setup_regime_bucket`
   - `setup_regime`
   - `setup_type`
   - `global`
   - `heuristic`
3. `setupDetector` now computes heuristic `pWin`, then applies calibration model blend to produce final `pWinCalibrated`.
4. `setup.probability` now reflects calibrated probability (`pWinCalibrated * 100`).
5. Added `runSPXNightlyReplayOptimizerCycle()`:
   - Resolves replay window from optimizer walk-forward horizon.
   - Runs `backfillHistoricalSPXSetupInstances()` first.
   - Fail-closes on replay quality errors based on env thresholds.
   - Runs `runSPXOptimizerScan()` on the same window.
6. Nightly worker now executes replay->optimize orchestration instead of optimizer-only scan.

## Acceptance Criteria Status
1. `pWinCalibrated` is no longer score-map-only heuristic. ✅
2. Nightly worker runs replay reconstruction before optimizer scan. ✅
3. Automated fail-closed promotion remains enforced via optimizer data-quality gate. ✅
4. Targeted tests cover calibration fallback and replay failure behavior. ✅

## Validation Gates
1. `pnpm --dir /Users/natekahl/ITM-gd exec eslint --no-ignore backend/src/services/spx/setupCalibration.ts backend/src/services/spx/setupDetector.ts backend/src/services/spx/nightlyReplayOptimizer.ts backend/src/workers/spxOptimizerWorker.ts backend/src/services/spx/__tests__/setupCalibration.test.ts backend/src/services/spx/__tests__/nightlyReplayOptimizer.test.ts backend/src/services/spx/__tests__/setupDetector.test.ts backend/src/workers/__tests__/spxOptimizerWorker.test.ts` ✅
2. `pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit` ✅
3. `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit` ✅
4. `pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/setupCalibration.test.ts src/services/spx/__tests__/nightlyReplayOptimizer.test.ts src/services/spx/__tests__/setupDetector.test.ts src/workers/__tests__/spxOptimizerWorker.test.ts src/__tests__/integration/spx-api.test.ts` ✅
5. `pnpm --dir /Users/natekahl/ITM-gd exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1` ✅
6. `pnpm --dir /Users/natekahl/ITM-gd/backend backtest:last-week instances second` ✅
   - `triggered=17`
   - `T1=76.47%`
   - `T2=70.59%`
   - `failure=17.65%`
   - `expectancyR=+1.0587`
   - `usedMassiveMinuteBars=false` (second-bar fidelity)

## Risk / Rollback
Risk:
1. Calibration quality depends on outcome-row freshness and sufficient resolved sample.
2. Nightly replay adds runtime and can fail before optimizer scan if data windows are degraded.

Mitigations:
1. Hierarchical smoothing + conservative blending limits overreaction in low-sample buckets.
2. Replay fail-closed controls are explicit and environment-tunable.

Rollback:
1. Revert this slice commit.
2. Disable replay pre-pass via `SPX_OPTIMIZER_NIGHTLY_REPLAY_ENABLED=false`.
3. Tune calibration blend weights to zero (`SPX_SETUP_CALIBRATION_BLEND_MIN_WEIGHT=0`, `SPX_SETUP_CALIBRATION_BLEND_MAX_WEIGHT=0`) if heuristic-only fallback is needed temporarily.
