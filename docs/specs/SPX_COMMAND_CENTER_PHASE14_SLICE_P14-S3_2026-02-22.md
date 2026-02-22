# SPX Command Center Phase 14 Slice Report: P14-S3

**Date:** 2026-02-22
**Slice:** P14-S3
**Objective:** Establish Tradier broker-adapter foundations, DTBP-aware contract sizing hooks, and portfolio snapshot sync plumbing behind explicit runtime flags.
**Status:** Done

## 1) Scope
In scope:
1. `backend/src/services/broker/tradier/occFormatter.ts`
2. `backend/src/services/broker/tradier/client.ts`
3. `backend/src/services/broker/tradier/orderRouter.ts`
4. `backend/src/services/broker/tradier/__tests__/occFormatter.test.ts`
5. `backend/src/services/broker/tradier/__tests__/orderRouter.test.ts`
6. `backend/src/services/portfolio/portfolioSync.ts`
7. `backend/src/workers/portfolioSyncWorker.ts`
8. `backend/src/server.ts`
9. `backend/src/services/spx/contractSelector.ts`
10. `backend/src/services/spx/types.ts`
11. `backend/src/routes/spx.ts`
12. `backend/.env.example`
13. `supabase/migrations/20260326000000_institutional_upgrade.sql`

Out of scope:
1. Live broker execution state transitions in setup lifecycle.
2. Position reconciliation against broker holdings.
3. Slippage feedback loop into optimizer promotion policy.

## 2) Implementation
1. Added OCC symbol conversion/parsing helpers for Massive and Tradier symbol formats.
2. Added Tradier REST client foundation:
   - balances fetch
   - place/cancel/replace order helpers
3. Added order-router payload builders for:
   - entry (`buy_to_open` limit)
   - T1 scale (`sell_to_close` limit)
   - runner stop (`stop` or `stop_limit`)
4. Added portfolio sync service + worker:
   - reads active `broker_credentials`
   - fetches balances from Tradier
   - writes `portfolio_snapshots`
   - guarded by `TRADIER_PORTFOLIO_SYNC_ENABLED` (default disabled)
5. Wired worker start/stop in backend server lifecycle.
6. Added Supabase migration for broker credentials, portfolio snapshots, and execution-fidelity columns on `spx_setup_instances`.
7. Added DTBP/PDT-aware contract selector context:
   - optional request inputs: `dayTradeBuyingPower`, `maxRiskDollars`, `pdtQualified`
   - 0DTE blocking policy when PDT is false or DTBP is below floor
   - recommendation payload now includes suggested contracts/cost and sizing reason
8. Fixed recommendation cache scope:
   - cache key now includes risk-context fingerprint
   - ad-hoc setup requests bypass cache to avoid stale sizing leakage.

## 3) Validation Evidence
1. `pnpm --dir backend test -- src/services/broker/tradier/__tests__/occFormatter.test.ts src/services/broker/tradier/__tests__/orderRouter.test.ts src/services/spx/__tests__/contractSelector.test.ts`
- Result: pass (32/32 tests)
2. `pnpm --dir backend exec tsc --noEmit`
- Result: pass
3. `pnpm exec eslint backend/src/services/broker/tradier/client.ts backend/src/services/broker/tradier/orderRouter.ts backend/src/services/broker/tradier/occFormatter.ts backend/src/services/broker/tradier/__tests__/occFormatter.test.ts backend/src/services/broker/tradier/__tests__/orderRouter.test.ts backend/src/services/portfolio/portfolioSync.ts backend/src/workers/portfolioSyncWorker.ts backend/src/services/spx/contractSelector.ts backend/src/routes/spx.ts backend/src/server.ts backend/src/services/spx/types.ts`
- Result: warning-only; backend sources matched ignore pattern in root eslint config.

## 4) Risks Introduced
1. Token decryption is currently a placeholder pass-through in this foundation slice.
2. Portfolio sync writes depend on migration deployment; missing tables would otherwise fail runtime.
3. New risk-context cache keys increase key cardinality for contract recommendation cache.

## 5) Mitigations
1. Portfolio sync worker is fail-safe and disabled by default (`TRADIER_PORTFOLIO_SYNC_ENABLED=false`).
2. Portfolio sync tolerates missing tables by warning and skipping writes until migration is applied.
3. Tradier client defaults to sandbox URL unless explicitly set otherwise.
4. Cache correctness prioritized over cache-hit rate; TTL remains short (10s).

## 6) Rollback
1. Revert `P14-S3` files listed above.
2. Disable any partial runtime wiring via env:
   - `TRADIER_PORTFOLIO_SYNC_ENABLED=false`
3. If migration already applied and rollback required, leave schema additive changes in place and gate usage through feature flags.

## 7) Next Slice
`P14-S4`: implement broker/internal position reconciliation and realized slippage feedback loop into optimizer guardrails.
