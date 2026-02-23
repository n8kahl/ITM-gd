# SPX Command Center Phase 16 Slice Report: P16-S2

**Date:** 2026-02-22  
**Slice:** P16-S2  
**Objective:** Recover trend-family throughput without reintroducing ORB sparse-flow grace.
**Status:** Completed (partial blocker reduction; promotion still not eligible)

## 1) Scope
In scope:
1. Replace hard `trend_orb_confluence_required` dependency with bounded alternatives.
2. Widen trend pullback timing windows by regime with explicit limits.
3. Keep ORB sparse-flow grace removed from P16-S1.

Out of scope:
1. Flow telemetry persistence upgrades (`spx_setup_instances` metadata contract expansion).
2. Broker execution realism/KMS hardening.
3. Optimizer governance changes (diversity/proxy-share promotion gates).

## 2) Files Changed
1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/__tests__/setupDetector.test.ts`

## 3) Implementation Summary
1. Added bounded trend pullback alternatives when `requireOrbTrendConfluence=true` and ORB confluence is not fully aligned:
   1. ORB proximity alternative.
   2. Confirmed ORB break-context alternative.
   3. Trend-continuation context alternative (EMA + flow/volume validity + stronger confluence floor).
2. Added `TREND_ORB_ALTERNATIVE_MIN_CONFLUENCE=3.5` to avoid low-conviction relaxation.
3. Widened trend pullback timing caps by regime (bounded +30 minutes):
   1. breakout: `240 -> 270`
   2. trending: `260 -> 290`
   3. compression: `220 -> 250`
   4. ranging: `200 -> 230`
4. Added/updated optimization-gate tests for:
   1. still-blocked baseline when no valid alternative context exists.
   2. allowed ORB proximity alternative.
   3. allowed trend-continuation alternative.
   4. blocked continuation alternative under insufficient confluence.

## 4) Validation Gates and Results
1. `pnpm --dir backend exec tsc --noEmit`  
Result: pass.
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`  
Result: pass (`44/44`).
3. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-22`  
Result: pass (`attemptedDays=5`, `successfulDays=5`, `failedDays=0`).

## 5) Strict Replay Results
Command:
1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result:
1. `usedMassiveMinuteBars=false`
2. `setupCount=1`
3. `triggeredCount=1`
4. `resolvedCount=1`
5. `t1WinRatePct=100`
6. `t2WinRatePct=100`
7. `failureRatePct=0`
8. `expectancyR=+3.4064`
9. Notes: `Skipped 94 gate-blocked rows`, `Skipped 62 hidden-tier non-triggered rows`

Interpretation:
1. Throughput recovered from 0 (P16-S1) to 1, but remains far below production target throughput.
2. Sample size is too small for promotion-quality confidence.

## 6) Blocker Mix Delta (2026-02-16 to 2026-02-20)
Command:
1. `LOG_LEVEL=warn pnpm --dir backend exec tsx src/scripts/spxFailureAttribution.ts 2026-02-16 2026-02-20`

Top blockers after P16-S2:
1. `pwin_below_floor`: 53
2. `evr_below_floor`: 37
3. `timing_gate_blocked`: 36
4. `trend_orb_confluence_required`: 21
5. `orb_flow_or_confluence_required`: 15
6. `trend_timing_window`: 10

Notable movement vs immediate prior baseline:
1. `trend_timing_window` decreased (`17 -> 10`).
2. `trend_orb_confluence_required` decreased marginally (`22 -> 21`).
3. Quality floors (`pWin`, `EVR`) remain dominant blockers.

## 7) Gold Standard Delta
Targets:
1. `T1 >= 76.47%`
2. `T2 >= 70.59%`
3. `failureRate <= 17.65%`
4. `expectancyR >= +1.128`

Current last-week strict:
1. Quality metrics exceed targets, but with `resolvedCount=1`.
2. Throughput target (`triggeredCount >= 10`) is not met.
3. Promotion remains blocked on sample adequacy/throughput.

## 8) Outcome and Next Step
1. P16-S2 achieved bounded structural relaxation without reintroducing ORB sparse-flow grace.
2. It reduced trend timing blocks and restored non-zero strict throughput.
3. It did not deliver sufficient scale/diversity for promotion.
4. Next: `P16-S3` (flow/microstructure evidence persistence) to improve attribution and confidence in gate behavior across historical windows.

## 9) Rollback
1. Revert `P16-S2` changes in `setupDetector.ts` and corresponding tests.
2. Re-run targeted tests and strict replay baseline commands.
