# SPX Command Center Phase 14 Slice Report: P14-S7

**Date:** 2026-02-23
**Slice:** P14-S7
**Objective:** Enhance walk-forward optimizer with two-stage architecture (threshold + geometry) and expand threshold grid with `moveStopToBreakeven` sweep.
**Status:** Completed

## 1) Scope
In scope:
1. Extract geometry sweep library from standalone CLI script into callable module.
2. Add `moveStopToBreakeven` boolean to threshold candidate grid (14,400 → 28,800 candidates).
3. Add `direction` field to `PreparedOptimizationRow` for observability.
4. Integrate geometry sweep as Stage 2 in `runSPXOptimizerScan()`.
5. Write winning geometry into optimizer profile's `geometryPolicy.bySetupType`.
6. Add `geometryOptimization` summary to scorecard with per-family results.

Out of scope:
1. Geometry optimization on validation window (Stage 2 sweeps training data only).
2. Per-regime geometry (`bySetupRegime`, `bySetupRegimeTimeBucket`) optimization.
3. Direction-aware threshold gating (direction is observability-only).
4. Additional sweep families beyond existing 4.

## 2) Files Changed
1. `backend/src/services/spx/geometrySweep.ts` — **New**: extracted geometry sweep library
2. `backend/src/scripts/spxSweepGeometry.ts` — Refactored to import from library
3. `backend/src/services/spx/optimizer.ts` — Two-stage optimizer, expanded grid, profile/scorecard
4. `backend/src/services/spx/__tests__/optimizer-confidence.test.ts` — Updated test for new param

## 3) Validation Evidence
1. `pnpm --dir backend exec tsc --noEmit` — pass (clean compile)
2. `pnpm exec jest src/services/spx/__tests__/` — 71 tests, 15 suites, all pass
3. ESLint — 0 errors (4 file-ignore warnings only)

## 4) Key Changes

### Stage 1 Enhancement: Expanded Threshold Grid
- `ThresholdCandidate` interface gains `moveStopToBreakeven: boolean`
- `candidateGrid()` sweeps `[true, false]` as outermost loop: 14,400 → 28,800 candidates
- `realizedRForOutcome()` accepts optional `moveStopToBreakevenOverride` parameter
- `toMetrics()` passes candidate-level `moveStopToBreakeven` through to R computation
- Profile assembly writes `activeCandidate.moveStopToBreakeven` (was hardcoded `true`)
- `evaluateBuckets()` and `resolveDriftAlerts()` propagate `moveStopToBreakeven`

### Stage 2: Geometry Sweep Integration
- After Stage 1 selects winning thresholds, Stage 2 runs geometry sweep per family:
  1. Converts raw DB rows to `EvalSetupCandidate[]` for training window
  2. Loads Massive.com 1-second bars for training sessions (~20 sessions)
  3. Calls `sweepGeometryForFamilies()` with fast mode
  4. For improved families, writes winning scales to profile's `geometryPolicy.bySetupType`
- `loadOptimizationRows()` now returns `{ prepared, raw }` to support both stages
- Geometry sweep results appear in `SPXGeometrySweepSummary` scorecard section

### Observability
- `direction: 'bullish' | 'bearish' | null` added to `PreparedOptimizationRow`
- Scorecard notes include per-family geometry sweep deltas and winning configurations

## 5) Risks and Mitigations
1. **Stage 2 API calls**: ~25 Massive.com calls per scan. Mitigated by fast mode and rate limits.
2. **Geometry overfitting**: Mitigated by conservative objective (Wilson CI lower bounds).
3. **Grid doubling runtime**: Pure in-memory, ~0.1s additional for 28,800 vs 14,400.

## 6) Rollback
1. Remove `moveStopToBreakeven` loop in `candidateGrid()` + hardcode `true` in profile assembly
2. Remove Stage 2 block from `runSPXOptimizerScan()`
3. `geometrySweep.ts` library can remain regardless
