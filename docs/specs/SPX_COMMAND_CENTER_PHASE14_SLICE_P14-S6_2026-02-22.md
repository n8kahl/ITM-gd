# SPX Command Center Phase 14 Slice Report: P14-S6

**Date:** 2026-02-22  
**Slice:** P14-S6  
**Objective:** Restore strict replay actionability parity, reduce ORB/trend false blocks under sparse flow telemetry, and revert optimizer profile to last best-known snapshot.  
**Status:** Completed

## 1) Scope
In scope:
1. Fix strict replay filtering so triggered hidden-tier rows are not incorrectly dropped.
2. Add guarded ORB/trend gate grace for sparse flow-alignment telemetry.
3. Align failure attribution strict mode with actionable (`gateStatus=eligible`) semantics.
4. Revert optimizer profile to best historical snapshot (`historyId=3`) and verify persisted state.
5. Restore interrupted weekly reconstruction window (`2026-02-16` through `2026-02-20`).

Out of scope:
1. Full-range historical rebuild (`2026-01-27` through `2026-02-21`) completion.
2. New strategy-family additions.

## 2) Files Changed
1. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/winRateBacktest.test.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
4. `/Users/natekahl/ITM-gd/backend/src/scripts/spxFailureAttribution.ts`
5. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PHASE14_SLICE_P14-S6_2026-02-22.md`
6. `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
7. `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`

## 3) Validation Evidence
1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts`  
Result: pass.
2. `pnpm --dir backend exec tsc --noEmit`  
Result: pass.
3. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`  
Result: pass (`attemptedDays=5`, `successfulDays=5`, `failedDays=0`).
4. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`  
Result:
   - `usedMassiveMinuteBars=false`
   - `setupCount=1`
   - `triggeredCount=1`
   - `resolvedCount=1`
   - `t1WinRatePct=100`
   - `t2WinRatePct=100`
   - `expectancyR=3.4064`
5. Optimizer profile rollback:
   - Executed `revertSPXOptimizerToHistory({ historyId: 3, ... })`
   - Verified `activeGeneratedAt=2026-02-22T07:01:36.301Z`
   - Verified history append entry `id=18`, `action=revert`, `revertedFromHistoryId=3`.

## 4) Key Changes
1. Strict replay hidden-tier policy now excludes only non-triggered hidden rows (or blocked rows) when hidden tiers are disabled.
2. ORB/trend setup gating now supports guarded grace when flow alignment is unavailable but confluence/EMA/orb-confluence evidence is strong.
3. Failure attribution strict filter now treats hidden rows with `gateStatus=eligible` as valid strict-trigger population.
4. Active optimizer profile reverted to last best-known snapshot for Monday-open readiness.

## 5) Risks and Mitigations
1. Risk: Flow-unavailable grace could over-admit low-quality momentum setups.  
Mitigation: Grace is constrained to trend-family setups with EMA + confluence + ORB context and existing macro/micro gates remain active.
2. Risk: Interrupted long-range backfill can leave sparse windows empty if terminated mid-run.  
Mitigation: Run targeted date-range backfill immediately after interruption and verify row counts before replay.

## 6) Rollback
1. Code rollback: revert this slice commit.
2. Runtime rollback: call `revertSPXOptimizerToHistory` with prior `historyId`.
3. Data rollback: rerun `spx:backfill-historical` for affected date range.
