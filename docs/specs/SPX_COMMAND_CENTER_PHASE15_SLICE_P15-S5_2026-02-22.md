# SPX Command Center Phase 15 Slice Report: P15-S5

**Date:** 2026-02-22
**Slice:** P15-S5
**Objective:** Ensure optimizer `passesCandidate` produces consistent results with detector's grace-aware gating.
**Status:** Completed

## 1) Scope
In scope:
1. Refactor `evaluateOptimizationGate` return type to include `effectiveFlowConfirmed` and `effectiveVolumeAligned` booleans.
2. Persist effective values in setup metadata for optimizer consumption.
3. Update `toPreparedRow` in optimizer to read effective values.
4. Fix `passesCandidate` alignment check to handle null alignment when flow grace applies.

Out of scope:
1. Gate logic changes (S2-S4).
2. Profile tuning or scan parameter changes.

## 2) Files Changed
1. `backend/src/services/spx/setupDetector.ts` — Changed `evaluateOptimizationGate` return type, added grace-aware effective booleans, hoisted ORB grace variables for accessibility.
2. `backend/src/services/spx/optimizer.ts` — Updated `toPreparedRow` to read `effectiveFlowConfirmed`/`effectiveVolumeAligned`, fixed `passesCandidate` null-alignment handling.
3. `backend/src/services/spx/types.ts` — Added `effectiveFlowConfirmed`, `emaAligned`, `volumeRegimeAligned`, `effectiveVolumeAligned` to `Setup` interface.
4. `backend/src/services/spx/__tests__/setupDetector.test.ts` — Updated all grace path tests to verify effective boolean outputs.

## 3) Key Changes
1. `evaluateOptimizationGate` now returns `{ reasons, effectiveFlowConfirmed, effectiveVolumeAligned }` instead of `string[]`.
2. `flowGraceApplied` is true when any flow grace (unavailable, trend-family, ORB, sparse-flow, fusion) activates for a setup that has `requireFlowConfirmation`.
3. `volumeGraceApplied` is true when any volume grace (expanded, trend-family, ORB, fusion) activates for a setup that has `requireVolumeRegimeAlignment`.
4. Optimizer `toPreparedRow` reads `effectiveFlowConfirmed` and `effectiveVolumeAligned` from metadata, making grace-admitted setups visible to the optimizer scan.
5. `passesCandidate` alignment check changed from `(flowAlignmentPct ?? -1) < threshold` to `flowAlignmentPct != null && flowAlignmentPct < threshold` — skips check when alignment data is unavailable but flow is effectively confirmed.

## 4) Validation
- `pnpm --dir backend exec tsc --noEmit`: pass
- `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`: 40/40 pass

## 5) Rollback
Revert setupDetector.ts, optimizer.ts, and types.ts changes.
