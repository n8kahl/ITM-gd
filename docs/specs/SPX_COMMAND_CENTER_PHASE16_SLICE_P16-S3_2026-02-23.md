# SPX Command Center Phase 16 Slice Report: P16-S3

**Date:** 2026-02-23  
**Slice:** P16-S3  
**Objective:** Persist deterministic flow/microstructure gate evidence into `spx_setup_instances.metadata` and consume it in replay/attribution readers.
**Status:** Completed (evidence durability improved; throughput unchanged)

## 1) Scope
In scope:
1. Expand setup-instance metadata persistence for flow availability, flow quality, effective gate booleans, ORB confluence snapshot, and microstructure summary flags.
2. Update replay/attribution readers to consume persisted evidence keys (with legacy fallbacks).
3. Verify strict replay and blocker attribution with the new evidence contract.

Out of scope:
1. Structural gate retunes (`pwin_below_floor`, `evr_below_floor`, timing floors).
2. Broker execution realism and infrastructure hardening.
3. Optimizer governance/promotion policy changes.

## 2) Files Changed
1. `backend/src/services/spx/types.ts`
2. `backend/src/services/spx/setupDetector.ts`
3. `backend/src/services/spx/outcomeTracker.ts`
4. `backend/src/services/spx/winRateBacktest.ts`
5. `backend/src/scripts/spxFailureAttribution.ts`

## 3) Implementation Summary
1. Added setup evidence fields to detector output:
   1. `flowAvailability` (`available|sparse|unavailable`)
   2. `flowQuality` metrics (score/events/premium/local coverage)
   3. ORB confluence snapshot (`available/aligned/distance/break/reclaim/retest/reasons`)
2. Extended optimization-gate evaluation payload to return evidence-level diagnostics:
   1. `flowAvailability`, `flowDataSparse`, `hasDirectionalFlowSample`
   2. `flowGraceApplied`, `volumeGraceApplied`
   3. `trendPullbackOrbAlternativeEligible`
3. Persisted expanded evidence in `spx_setup_instances.metadata`:
   1. `effectiveFlowConfirmed`, `effectiveVolumeAligned`
   2. `flowAvailability`, `flowQuality`, flattened flow quality keys
   3. microstructure summary flags (`microstructureAvailable`, `microstructureQuoteCoveragePct`, `microstructureAvgSpreadBps`, etc.)
   4. ORB confluence object + flattened ORB confluence flags
4. Updated replay and attribution readers:
   1. `winRateBacktest` now parses evidence keys and reports evidence coverage in notes.
   2. `spxFailureAttribution` now prefers persisted evidence keys and falls back to legacy inference.

## 4) Validation Gates and Results
1. `pnpm -C backend exec tsc --noEmit`  
Result: pass.
2. `pnpm -C backend test -- src/services/spx/__tests__/setupDetector.test.ts`  
Result: pass (`23/23`).
3. `pnpm -C backend test -- src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/outcomeTracker.test.ts`  
Result: pass (`19/19`).
4. `LOG_LEVEL=warn pnpm -C backend spx:backfill-historical 2026-02-16 2026-02-22`  
Result: pass (`attemptedDays=5`, `successfulDays=5`, `failedDays=0`).

## 5) Strict Replay Results (Post-S3)
Command:
1. `LOG_LEVEL=warn pnpm -C backend backtest:last-week instances second`

Result:
1. `usedMassiveMinuteBars=false`
2. `setupCount=1`
3. `triggeredCount=1`
4. `resolvedCount=1`
5. `t1WinRatePct=100`
6. `t2WinRatePct=100`
7. `failureRatePct=0`
8. `expectancyR=+3.4064`
9. Backtest notes now include evidence coverage: `flowAvailability 157/157`, `effectiveFlowConfirmed 157/157`, `microstructure 157/157`.

Interpretation:
1. S3 did not change throughput or quality distribution (as expected).
2. S3 removed evidence blind spots in replay diagnostics.

## 6) Blocker Mix and Evidence View (2026-02-16 to 2026-02-20)
Command:
1. `LOG_LEVEL=warn pnpm -C backend exec tsx src/scripts/spxFailureAttribution.ts 2026-02-16 2026-02-20`

Top blockers:
1. `pwin_below_floor`: 53
2. `evr_below_floor`: 37
3. `timing_gate_blocked`: 36
4. `trend_orb_confluence_required`: 21
5. `orb_flow_or_confluence_required`: 15
6. `trend_timing_window`: 10

New evidence outputs now exposed directly:
1. `effectiveFlowConfirmedPct` by date.
2. `flowSparsePct` vs `flowUnavailablePct` by date.
3. strict-triggered slices for `effectiveFlowConfirmed` and `flowAvailability`.

## 7) Gold Standard Delta
Targets:
1. `T1 >= 76.47%`
2. `T2 >= 70.59%`
3. `failureRate <= 17.65%`
4. `expectancyR >= +1.128`

Current last-week strict:
1. Metrics exceed targets (`100/100/0/+3.4064`) but `resolvedCount=1`.
2. Throughput target remains unmet (sample size too low for promotion).
3. Dominant remaining blockers are still quality/timing floors (`pwin`, `evr`, `timing`).

## 8) Outcome and Next Step
1. P16-S3 delivered deterministic, durable evidence for setup gate behavior and attribution.
2. Institutional-grade gap now shifts from observability to throughput + quality-floor tuning under sample constraints.
3. Next slice should target blocker reduction with bounded guardrails (starting with `pwin_below_floor`/`evr_below_floor` calibration and timing-gate precision).

## 9) Rollback
1. Revert the five files listed in Section 2.
2. Re-run typecheck/tests and replay commands in Sections 4-6.
