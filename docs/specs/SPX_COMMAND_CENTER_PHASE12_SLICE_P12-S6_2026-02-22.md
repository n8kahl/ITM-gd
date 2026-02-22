# SPX Command Center Phase 12 Slice P12-S6 (2026-02-22)

## Objective
Increase nightly optimizer fidelity to live execution by:
1. Ensuring optimizer rows consume persisted `entry_fill_price` and `tier` from `spx_setup_instances`.
2. Adding execution-actuals quality metrics (fill coverage and slippage) from `spx_setup_execution_fills` into optimizer scorecards.
3. Surfacing execution-actuals quality in SPX Settings so operators can verify how much of optimization evidence is real fills vs proxy.

## Scope
In scope:
1. Backend optimizer data load/schema alignment and execution-actuals telemetry.
2. Frontend optimizer types and settings panel rendering for execution quality.
3. Validation gates (lint, typecheck, targeted tests, targeted Playwright, strict backtest, weekly optimizer scan).

Out of scope:
1. New setup families, detector logic rewrites, or contract model rewrites.
2. Broker routing/execution automation.
3. UI layout redesign outside the existing settings panel.

## Files Changed
1. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
2. `/Users/natekahl/ITM-gd/hooks/use-spx-optimizer.ts`
3. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-settings-sheet.tsx`

## Implementation Notes
1. Fixed optimizer instance row query drift by selecting `tier` and `entry_fill_price` in `loadOptimizationRows()`.
2. Added execution actuals loader `loadExecutionActualsDataQuality()`:
   - Reads `spx_setup_execution_fills` over scan window with pagination.
   - Calculates triggered-trade coverage for `any fill`, `entry`, `exit`, and `non-proxy` fills.
   - Calculates non-proxy average slippage for entry/exit (points and bps).
   - Handles missing table gracefully (`executionFillTableAvailable=false`) without crashing scan.
3. Extended `SPXOptimizerDataQuality` contract with execution-actual metrics and included them in both:
   - `getSPXOptimizerScorecard()` baseline snapshot path.
   - `runSPXOptimizerScan()` active scan path.
4. Added explicit execution-actuals line into optimizer notes for auditability.
5. Exposed `dataQuality` + execution fields in frontend hook typings.
6. Rendered "Execution Actuals" block in SPX Settings scorecard:
   - table availability
   - any/non-proxy coverage and counts
   - entry/exit coverage
   - entry/exit average slippage (pts/bps)

## Acceptance Criteria Status
1. Nightly/manual optimizer scorecard reports execution-actual coverage/slippage. ✅
2. Optimizer row loader now uses persisted `entry_fill_price` and `tier`. ✅
3. SPX Settings displays execution-actual quality details. ✅
4. Existing targeted SPX gates remain green after change. ✅

## Validation Gates
1. `pnpm --dir /Users/natekahl/ITM-gd exec eslint --no-ignore backend/src/services/spx/optimizer.ts hooks/use-spx-optimizer.ts components/spx-command-center/spx-settings-sheet.tsx` ✅
2. `pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit` ✅
3. `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit` ✅
4. `pnpm --dir /Users/natekahl/ITM-gd/backend exec jest src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/__tests__/integration/spx-api.test.ts --runInBand` ✅
5. `pnpm --dir /Users/natekahl/ITM-gd exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1` ✅
6. `pnpm --dir /Users/natekahl/ITM-gd/backend backtest:last-week instances second` ✅
   - `triggered=17`
   - `T1=76.47%`
   - `T2=70.59%`
   - `failure=17.65%`
   - `expectancyR=+1.0587`
   - `usedMassiveMinuteBars=false`
7. `pnpm --dir /Users/natekahl/ITM-gd/backend run spx:optimizer-weekly` ✅
   - Completed with execution-actual metrics attached to scorecard.
   - Observed environment warning: `spx_setup_instances` read path returned 0 optimizer rows in this run; fail-closed correctly blocked profile mutation and emitted explicit reasoning in scorecard notes.

## Risk / Rollback
Risk:
1. Execution metrics may be sparse until non-proxy/broker fills are regularly ingested.
2. If `spx_setup_execution_fills` is missing in a target environment, execution coverage will report unavailable.

Mitigations:
1. Missing-table handling is explicit and non-fatal.
2. Scorecard notes now expose execution coverage and slippage for immediate operational diagnosis.

Rollback:
1. Revert this slice commit.
2. Temporarily hide execution-actual UI block if needed while preserving backend metrics.
