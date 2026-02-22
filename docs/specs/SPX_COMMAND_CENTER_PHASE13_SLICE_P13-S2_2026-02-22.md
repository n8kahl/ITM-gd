# SPX Command Center Phase 13 Slice P13-S2 (2026-02-22)

## Objective
Inject microstructure-aware and macro-aware gating into the production SPX setup detection path to reduce false positives before setups become actionable.

## Scope
In scope:
1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/types.ts`
3. `backend/src/services/spx/outcomeTracker.ts`
4. `backend/src/services/spx/__tests__/setupDetector.test.ts`
5. `backend/.env.example`

Out of scope:
1. Legacy scanner detector modules under `backend/src/services/setupDetector/*` (non-command-center path).
2. Contract selection and exit advisor mechanics (P13-S4).
3. Historical replay retry/backoff hardening (P13-S5).

## Implementation Plan
1. Add configurable macro kill-switch with deterministic score and block reasons.
2. Build live microstructure summary from recent tick cache:
   - aggressor skew,
   - quote coverage,
   - bid/ask imbalance,
   - average spread bps.
3. Apply microstructure alignment checks in confluence and optimization gate.
4. Add strike-flow and intraday gamma-pressure confluence tags from flow events.
5. Persist macro/microstructure diagnostics into setup metadata for optimizer governance.

## Risks
1. Historical replay can be contaminated if live tick cache is used with historical timestamps.
2. Overly strict macro floors can suppress valid setups.
3. Sparse quote fields can cause unstable microstructure alignment if not guarded.

## Mitigations
1. Disable live microstructure ingestion for historical timestamp runs.
2. Make macro/microstructure floors fully environment-configurable.
3. Require sample-size, directional-volume, and quote-coverage minima before microstructure is considered available.

## Rollback
1. Disable macro kill-switch: `SPX_SETUP_MACRO_KILLSWITCH_ENABLED=false`.
2. Disable microstructure gating: `SPX_SETUP_MICROSTRUCTURE_ENABLED=false`.
3. Revert this slice commit if setup trigger quality degrades.

## Validation Gates (Slice)
1. `pnpm exec eslint --no-ignore backend/src/services/spx/setupDetector.ts backend/src/services/spx/types.ts backend/src/services/spx/outcomeTracker.ts backend/src/services/spx/__tests__/setupDetector.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`
3. `pnpm --dir backend exec tsc --noEmit`

## Acceptance Criteria Status
1. Macro alignment score is computed and can block low-alignment actionable setups. ✅
2. Microstructure alignment is integrated into confluence/gating for live runs only. ✅
3. Optimizer/outcome metadata captures macro/microstructure diagnostics. ✅
4. Slice validation gates are green. ✅

## Execution Log
1. Slice spec documented and scoped to production SPX setup path. ✅
2. Implementation completed for macro + microstructure scoring/gating. ✅
3. Validation completed. ✅

## Validation Evidence
1. `pnpm exec eslint --no-ignore backend/src/services/spx/setupDetector.ts backend/src/services/spx/types.ts backend/src/services/spx/outcomeTracker.ts backend/src/services/spx/__tests__/setupDetector.test.ts` ✅
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts` ✅
3. `pnpm --dir backend exec tsc --noEmit` ✅
