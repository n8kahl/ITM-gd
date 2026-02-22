# SPX Command Center Phase 14 Slice Report: P14-S2

**Date:** 2026-02-22
**Slice:** P14-S2
**Objective:** Integrate microstructure telemetry into `volumeClimax` and `vwap` setup detectors with directional pressure gating.
**Status:** Done

## 1) Scope
In scope:
1. `backend/src/services/setupDetector/types.ts`
2. `backend/src/services/setupDetector/index.ts`
3. `backend/src/services/setupDetector/volumeClimax.ts`
4. `backend/src/services/setupDetector/vwap.ts`
5. `backend/src/services/setupDetector/__tests__/volumeClimax.test.ts`
6. `backend/src/services/setupDetector/__tests__/vwap.test.ts` (new)

Out of scope:
1. Optimizer scorecard blocker-mix for this detector stack.
2. SPX core `backend/src/services/spx/setupDetector.ts` threshold changes.
3. Tradier execution and reconciliation slices.

## 2) Implementation
1. Extended `DetectorSnapshot` with optional `microstructure` payload.
2. Added live tick-cache microstructure summarization in setup detector service:
   - sample count, quote coverage %, aggressor skew
   - normalized imbalance, ask/bid size ratio
   - spread bps and close quote sizes
3. Updated `volumeClimax` detector:
   - when microstructure is available, require directional pressure confirmation for detected setup direction.
   - fail-open when microstructure is unavailable.
4. Updated `vwap` detector:
   - for cross/bounce/deviation signals, require directional microstructure confirmation when available.
   - fail-open when unavailable.
5. Added/updated tests for conflict and confirmation cases.

## 3) Validation Evidence
1. `pnpm --dir backend test -- src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/vwap.test.ts src/services/setupDetector/__tests__/detectors.test.ts`
- Result: pass (12/12 tests)
2. `pnpm --dir backend exec tsc --noEmit`
- Result: pass

## 4) Risks Introduced
1. Fail-open policy preserves continuity but can admit lower-quality setups during sparse quote coverage.
2. Ratio/imbalance thresholds are static and may require per-regime tuning for best win-rate impact.

## 5) Mitigations
1. Added explicit microstructure fields in signal telemetry (`signalData.microstructure`) for auditability.
2. Preserved baseline behavior when microstructure is unavailable to prevent hard regressions.

## 6) Rollback
1. Revert `P14-S2` detector files and new test file.
2. Re-run targeted detector tests and backend typecheck.

## 7) Next Slice
`P14-S3`: add broker adapter foundations (Tradier interfaces, portfolio sync skeleton, DTBP-aware sizing hooks) behind explicit feature flags.
