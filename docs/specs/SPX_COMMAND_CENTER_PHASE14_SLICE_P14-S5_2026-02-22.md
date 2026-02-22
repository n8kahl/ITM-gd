# SPX Command Center Phase 14 Slice Report: P14-S5

**Date:** 2026-02-22  
**Slice:** P14-S5  
**Objective:** Execute Phase 14 promotion gates and produce strict replay parity evidence against baseline before production promotion.  
**Status:** Completed (Promotion Blocked)

## 1) Scope
In scope:
1. Execute required validation gates for the integrated Phase 14 stack.
2. Run strict Massive historical backfill gate.
3. Run strict last-week replay backtest gate and compare parity outcomes.
4. Record promotion decision and blocker attribution.

Out of scope:
1. Policy retuning/remediation implementation.
2. Feature behavior changes beyond gate execution and reporting.

## 2) Gate Commands and Results
1. Unit/integration confidence gates:
   - `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/vwap.test.ts src/services/broker/tradier/__tests__/occFormatter.test.ts src/services/broker/tradier/__tests__/orderRouter.test.ts src/services/positions/__tests__/brokerLedgerReconciliation.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
   - Result: pass (29/29 tests)
2. Static compile gate:
   - `pnpm --dir backend exec tsc --noEmit`
   - Result: pass
3. Worker guardrail gate:
   - `pnpm --dir backend test -- src/workers/__tests__/spxOptimizerWorker.test.ts`
   - Result: pass (5/5 tests)
4. Strict production backfill gate:
   - `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-10 2026-02-22`
   - Result: pass (`attemptedDays=9`, `successfulDays=9`, `failedDays=0`)
5. Strict replay parity gate:
   - `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
   - Result: completed, but zero actionable setups:
     - `setupCount=0`
     - `evaluatedSetupCount=0`
     - `usedMassiveMinuteBars=false`
     - Notes: `Skipped 95 gate-blocked rows` and `Skipped 62 hidden-tier rows`.

## 3) Promotion Parity Findings
1. Data fidelity condition:
   - `usedMassiveMinuteBars=false` satisfied (strict second-bar fidelity maintained).
2. Promotion performance condition:
   - Not satisfiable for this run because `resolvedCount=0`.
   - Effective T1/T2/expectancy outputs all `0` due zero actionable trades.
3. Root-cause attribution from setup-instance audit (`2026-02-16` through `2026-02-20`):
   - `totalRows=157`
   - `byStatusTier: expired|hidden = 157`
   - `gateStatus: blocked=95, eligible=62`
   - Top blockers:
     - `volume_regime_alignment_required` (42)
     - `flow_confirmation_required` (30)
     - `flow_alignment_unavailable` (30)
     - `trend_orb_confluence_required` (23)
4. Baseline comparison:
   - Prior strict baseline reference in governance packet: `T1 76.47%`, `T2 70.59%`, `expectancyR +1.0587`.
   - Current strict gate result: throughput collapse to zero actionable trades.

## 4) Promotion Decision
**Decision:** Block production promotion for Phase 14 at this time.

Rationale:
1. Required KPI deltas cannot be validated with zero resolved trades.
2. Throughput collapse violates institutional readiness despite successful fidelity/backfill gates.

## 5) Immediate Remediation Targets
1. Restore actionable throughput by separating `eligible` from forced-hidden terminal treatment in replay/evaluation path.
2. Recalibrate high-frequency blockers (`flow_alignment_unavailable`, `volume_regime_alignment_required`, trend-confluence strictness) with guardrailed sweep.
3. Re-run strict gates after policy recalibration and require non-zero resolved sample before promotion.
