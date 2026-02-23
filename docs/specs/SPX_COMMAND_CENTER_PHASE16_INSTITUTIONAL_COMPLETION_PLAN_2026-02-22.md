# SPX Command Center Phase 16: Institutional Completion Plan

**Date:** 2026-02-22  
**Owner:** SPX Autonomous Delivery  
**Status:** Proposed (ready to execute)

## 1) Objective
Close the remaining gaps in setup detection, trade management, and optimizer governance so SPX can meet institutional promotion standards on strict Massive-backed replay.

This phase is explicitly driven by the P15-S6 outcome:
1. Throughput improved, but quality collapsed.
2. Promotion remained blocked.
3. ORB sparse-flow grace produced low-conviction triggers and degraded expectancy.

## 2) Non-Negotiable Policy Decision
Per product directive, do not retune ORB sparse-flow grace. Remove it.

1. Remove ORB sparse-flow grace logic from setup gating.
2. Remove associated threshold reductions tied to sparse flow availability.
3. Keep explicit rollback path in case throughput collapses below minimum.

Reference failure context:
1. `t1WinRatePct=28.57`, `expectancyR=-0.0932`, all 7 triggers in `orb_breakout`.
2. Promotion blocked.

## 3) Scope
In scope:
1. Setup detection gate policy and telemetry persistence.
2. Trade management and execution-realism hardening.
3. Optimizer promotion governance and confidence/coverage reporting.
4. Strict replay parity gates and release criteria updates.

Out of scope:
1. UI redesign unrelated to setup/trade/optimizer fidelity.
2. Non-SPX strategy families.

## 4) Phase 16 Slice Plan

### P16-S1: Remove ORB Sparse-Flow Grace and Re-Baseline
Goal: eliminate low-conviction ORB admissions introduced by sparse-flow grace.

Changes:
1. Remove `orbSparseFlowGrace` path from `backend/src/services/spx/setupDetector.ts`.
2. Restore ORB flow-quality discipline to non-sparse shortcut behavior.
3. Update unit tests to assert ORB does not bypass flow confirmation under sparse/unavailable flow.
4. Run strict replay on last-week and YTD windows with same source/resolution.

Files:
1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/__tests__/setupDetector.test.ts`
3. `docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S1_2026-02-22.md`

### P16-S2: Trend Pullback Throughput Recovery Without ORB Over-Admission
Goal: recover quality trend throughput by removing structural bottlenecks, not grace broadening.

Changes:
1. Replace hard `trend_orb_confluence_required` with deterministic alternate condition:
   - ORB level proximity to setup zone, or
   - confirmed opening-range break context, or
   - validated trend continuation context with stronger confluence floor.
2. Recalibrate trend timing window by regime/time-bucket with bounded widening.
3. Add blocker attribution assertions so recovered rows are primarily trend family.

Files:
1. `backend/src/services/spx/setupDetector.ts`
2. `backend/src/services/spx/__tests__/setupDetector.test.ts`
3. `backend/src/scripts/spxFailureAttribution.ts`
4. `docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S2_2026-02-22.md`

### P16-S3: Persist Flow/Microstructure Evidence for Historical Attribution
Goal: eliminate flow-telemetry blind spot in `spx_setup_instances`.

Changes:
1. Persist flow availability/alignment/effective-flow evidence at detection time into setup-instance metadata.
2. Persist directional flow event counts and microstructure coverage summaries used by gating.
3. Update attribution and backtest readers to consume persisted evidence deterministically.

Files:
1. `backend/src/services/spx/outcomeTracker.ts`
2. `backend/src/services/spx/setupDetector.ts`
3. `backend/src/services/spx/winRateBacktest.ts`
4. `supabase/migrations/<new_phase16_flow_telemetry_migration>.sql`
5. `docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S3_2026-02-22.md`

### P16-S4: Execution Truth Hardening (Broker Realism)
Goal: reduce proxy dependence and close fill-realism gaps.

Changes:
1. Implement production-safe credential decryption path (KMS/envelope-backed), replacing placeholder behavior.
2. Require explicit environment enablement for broker reconciliation in production; document staged rollout gates.
3. Extend execution reconciliation metrics to report source composition (`broker_tradier` vs `proxy/manual`) and slippage by source.
4. Add warning/fail gates for excessive proxy-share in promotion windows.

Files:
1. `backend/src/services/broker/tradier/client.ts`
2. `backend/src/services/positions/brokerLedgerReconciliation.ts`
3. `backend/src/services/spx/executionReconciliation.ts`
4. `backend/src/workers/positionTrackerWorker.ts`
5. `docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S4_2026-02-22.md`

### P16-S5: Optimizer Governance Tightening
Goal: prevent promotions on low-diversity or low-realism windows.

Changes:
1. Add promotion preconditions:
   - minimum resolved trades,
   - minimum setup-family diversity,
   - maximum proxy-fill share,
   - confidence-aware objective delta.
2. Expose diversity/realism gates in scorecard and nightly logs.
3. Keep fail-closed behavior as hard stop.

Files:
1. `backend/src/services/spx/optimizer.ts`
2. `backend/src/workers/spxOptimizerWorker.ts`
3. `backend/src/services/spx/__tests__/optimizer-confidence.test.ts`
4. `components/spx-command-center/optimizer-scorecard-panel.tsx`
5. `hooks/use-spx-optimizer.ts`
6. `docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S5_2026-02-22.md`

### P16-S6: Release Gates and Institutional Promotion Decision
Goal: run full validation and make promote/block decision with explicit evidence.

Changes:
1. Execute required gates under Node >=22.
2. Run strict replay for last-week and YTD windows.
3. Run failure attribution and execution-source composition audit.
4. Compare against Gold Standard and document delta.
5. Record promotion decision in release notes and runbook.

Files:
1. `docs/specs/SPX_COMMAND_CENTER_PHASE16_SLICE_P16-S6_2026-02-22.md`
2. `docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`
3. `docs/specs/SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md`
4. `docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
5. `docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
6. `docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`

## 5) Institutional Promotion Gates (Phase 16)
All must pass:

1. Fidelity:
   1. `usedMassiveMinuteBars=false`
   2. No unresolved replay data-quality failure.
2. Throughput:
   1. `triggeredCount >= 10` on last-week strict window.
   2. At least 2 setup families triggered in-window.
3. Quality:
   1. `T1 >= 76.47%` (Gold Standard last-week baseline)
   2. `T2 >= 70.59%` (Gold Standard last-week baseline)
   3. `failureRate <= 17.65%` (Gold Standard last-week baseline)
   4. `expectancyR >= +1.128` (Gold Standard last-week baseline)
4. Execution realism:
   1. Broker-backed fills available and auditable.
   2. Proxy/manual fill share below agreed cap for promotion window.
5. Governance:
   1. Weekly optimizer decision is confidence-qualified and diversity-qualified.
   2. No fail-closed guardrail bypass.

## 6) Validation Commands

### Slice-level gates
1. `pnpm --dir backend exec tsc --noEmit`
2. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
3. `pnpm --dir backend test -- src/services/positions/__tests__/brokerLedgerReconciliation.test.ts src/services/spx/__tests__/contractSelector.test.ts`

### Release-level gates
1. `pnpm --dir backend test`
2. `pnpm --dir backend build`
3. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-22`
4. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
5. `LOG_LEVEL=warn pnpm --dir backend exec tsx src/scripts/spxFailureAttribution.ts --from 2026-01-02 --to 2026-02-22 --source instances --strict`
6. `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`

## 7) Risks and Controls
1. Risk: removing ORB sparse-flow grace drops throughput too sharply.
Control: gate with setup-family recovery in P16-S2 and do not promote on single-family recovery.

2. Risk: trend pullback relaxation over-admits weak setups.
Control: keep confluence/pWin/EVR floors unchanged while altering structural ORB dependency only.

3. Risk: broker hardening introduces operational fragility.
Control: staged enablement with explicit environment flags, source-composition reporting, and rollback switches.

## 8) Rollback
1. Revert P16 slice commits by slice.
2. Runtime safety switches:
   1. `TRADIER_PORTFOLIO_SYNC_ENABLED=false`
   2. `TRADIER_POSITION_RECONCILIATION_ENABLED=false`
   3. `SPX_OPTIMIZER_SLIPPAGE_GUARDRAIL_ENABLED=false`
3. Revert optimizer profile from history if guardrail changes degrade live behavior.

## 9) Definition of Done
Phase 16 is complete only when:
1. All promotion gates pass on strict replay evidence.
2. Release notes, runbook, change control, risk register, and tracker are current.
3. Promotion decision is explicitly recorded as approved or blocked with reasons.
