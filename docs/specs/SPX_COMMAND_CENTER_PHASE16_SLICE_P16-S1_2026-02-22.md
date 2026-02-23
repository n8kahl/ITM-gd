# SPX Command Center Phase 16 Slice Report: P16-S1

**Date:** 2026-02-22  
**Slice:** P16-S1  
**Objective:** Remove ORB sparse-flow grace and re-baseline strict replay performance.
**Status:** Completed (Re-baseline captured; promotion not eligible)

## 1) Scope
In scope:
1. Remove ORB sparse-flow grace in optimization gating path.
2. Restore ORB flow-quality threshold behavior (no sparse reduction).
3. Preserve ORB confluence fallback behavior (`orb_flow_or_confluence_required`).
4. Ensure optimizer parity does not mark blocked ORB rows as flow-confirmed.

Out of scope:
1. Trend pullback structural retune (`trend_orb_confluence_required` and timing windows).
2. Flow telemetry persistence migration into setup-instance metadata.
3. Broker realism and optimizer governance expansion slices.

## 2) Files Changed
1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/__tests__/setupDetector.test.ts`

## 3) Implementation Summary
1. Removed `orbSparseFlowGrace` from ORB gate logic.
2. Removed sparse-flow quality floor reduction (`ORB_MIN_FLOW_QUALITY_SCORE - 7`), restoring canonical ORB floor.
3. Kept ORB eligibility rule deterministic:
   - with directional flow sample: enforce flow event count + flow quality floor.
   - without directional flow sample: require ORB trend confluence alignment.
4. Added `orbFlowConfluenceBlocked` guard so `effectiveFlowConfirmed` is not set true via generic flow-unavailable grace when ORB is blocked by missing flow and missing confluence.
5. Updated tests to assert:
   - ORB blocks without directional flow sample and without ORB confluence.
   - ORB remains allowed without directional flow sample when ORB confluence is aligned.

## 4) Validation Gates and Results
1. `pnpm --dir backend exec tsc --noEmit`  
Result: pass.
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`  
Result: pass (`40/40`).
3. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-22`  
Result: pass (`attemptedDays=5`, `successfulDays=5`, `failedDays=0`).
4. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`  
Result:
   - `usedMassiveMinuteBars=false`
   - `setupCount=0`
   - `triggeredCount=0`
   - `resolvedCount=0`
   - `resolutionUsed=none`
   - note: no backtestable setups in requested strict window.
5. YTD strict replay snapshot:  
`LOG_LEVEL=warn pnpm --dir backend exec tsx -e "...runSPXWinRateBacktest({ from:'2026-01-02', to:'2026-02-20', source:'spx_setup_instances', resolution:'second' })..."`  
Result:
   - `usedMassiveMinuteBars=false`
   - `setupCount=25`
   - `triggeredCount=21`
   - `resolvedCount=21`
   - `T1=80.95%`
   - `T2=52.38%`
   - `failure=19.05%`
   - `expectancyR=+0.5846`

## 5) Gold Standard Delta (Last-Week Targets)
Targets (Gold Standard):
1. `T1 >= 76.47%`
2. `T2 >= 70.59%`
3. `failureRate <= 17.65%`
4. `expectancyR >= +1.128`

Current P16-S1 last-week strict window:
1. `triggered=0`, `resolved=0`, therefore no eligible KPI comparison.
2. Promotion decision cannot be made from this slice alone.

## 6) Outcome and Next Step
1. ORB sparse-flow grace removal is complete and tested.
2. Throughput under strict last-week window is currently zero, requiring next structural recovery slice.
3. Proceed to `P16-S2` to recover trend-family throughput without reintroducing low-conviction ORB grace behavior.

## 7) Rollback
1. Revert this slice commit.
2. Re-run targeted tests and strict replay baseline commands.
