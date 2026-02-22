# SPX Command Center Phase 14 Slice Report: P14-S4

**Date:** 2026-02-22  
**Slice:** P14-S4  
**Objective:** Add broker-vs-internal position reconciliation and wire a slippage feedback loop that auto-adjusts optimizer `minEvR` under sustained execution friction.  
**Status:** Done

## 1) Scope
In scope:
1. `backend/src/services/positions/brokerLedgerReconciliation.ts` (new)
2. `backend/src/services/positions/__tests__/brokerLedgerReconciliation.test.ts` (new)
3. `backend/src/services/broker/tradier/client.ts`
4. `backend/src/workers/positionTrackerWorker.ts`
5. `backend/src/services/spx/optimizer.ts`
6. `backend/src/services/spx/__tests__/optimizer-confidence.test.ts`
7. `backend/.env.example`

Out of scope:
1. Broker order placement/routing orchestration beyond current adapter foundation.
2. UI-specific “post-trade mode” rendering changes.
3. Full KMS-backed credential decryption.

## 2) Implementation
1. Added Tradier positions endpoint support in the client:
   - `TradierClient.getPositions()` now parses broker position payloads safely.
2. Added new broker ledger reconciliation service:
   - Compares `ai_coach_positions` (internal open positions) to live Tradier position exposure.
   - Force-closes internal positions when broker quantity is zero.
   - Syncs internal quantity when broker quantity diverges.
   - Uses strict key normalization for SPX options (`SPXW` normalized to `SPX`, expiry/type/strike matching).
3. Wired reconciliation into `positionTrackerWorker` with throttling:
   - Runs periodically before live snapshot recalculation.
   - Logs reconciliation deltas and broker errors without failing the cycle.
4. Added optimizer slippage guardrail in `optimizer.ts`:
   - Computes rolling average absolute entry slippage from recent broker entry fills.
   - If avg slippage over the 5-fill window exceeds `0.25` points, bumps `qualityGate.minEvR` by `0.05` (capped).
   - Persists profile/scorecard update and history audit entry.
   - Prevents duplicate re-application on the same fill window signature.
5. Wired slippage guardrail execution into `positionTrackerWorker` with throttling.

## 3) Validation Evidence
1. `pnpm --dir backend test -- src/services/positions/__tests__/brokerLedgerReconciliation.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/contractSelector.test.ts`
- Result: pass (34/34 tests)
2. `pnpm --dir backend exec tsc --noEmit`
- Result: pass
3. `pnpm --dir backend test -- src/workers/__tests__/spxOptimizerWorker.test.ts`
- Result: pass (5/5 tests)
4. `pnpm exec eslint backend/src/services/broker/tradier/client.ts backend/src/services/positions/brokerLedgerReconciliation.ts backend/src/services/positions/__tests__/brokerLedgerReconciliation.test.ts backend/src/workers/positionTrackerWorker.ts backend/src/services/spx/optimizer.ts backend/src/services/spx/__tests__/optimizer-confidence.test.ts`
- Result: warning-only; backend files matched ignore pattern in root eslint config.

## 4) Risks Introduced
1. Broker position reconciliation depends on Tradier position payload fidelity and key normalization assumptions.
2. Force-close automation could close internal positions when broker payloads are unexpectedly sparse or malformed.
3. Slippage guardrail can ratchet `minEvR` upward and reduce trigger throughput if execution quality degrades.

## 5) Mitigations
1. Reconciliation is disabled by default (`TRADIER_POSITION_RECONCILIATION_ENABLED=false`).
2. Reconciliation only acts on confirmed broker payloads and runs with warning-only fault handling.
3. Slippage guardrail is idempotent per fill-window signature and bounded by a configurable max `minEvR`.
4. All mutations are persisted with optimizer history for audit and revertability.

## 6) Rollback
1. Revert this slice commit and redeploy worker services.
2. Immediate runtime mitigation:
   - `TRADIER_POSITION_RECONCILIATION_ENABLED=false`
   - `SPX_OPTIMIZER_SLIPPAGE_GUARDRAIL_ENABLED=false`
3. If guardrail already raised `minEvR`, revert optimizer profile from history via existing optimizer revert endpoint.

## 7) Next Slice
`P14-S5`: full promotion gates and parity report with strict replay/backtest evidence after P14 stack integration.
