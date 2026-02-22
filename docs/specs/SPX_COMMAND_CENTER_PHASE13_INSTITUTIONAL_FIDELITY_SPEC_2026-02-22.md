# SPX Command Center Phase 13: Institutional Fidelity & Hardening

**Date:** 2026-02-22  
**Owner:** Autonomous Implementation Run  
**Status:** Approved for implementation (spec-first)

## 1) Objective
Advance SPX Command Center from current Gold Standard to higher institutional fidelity by:
1. Adding quote microstructure (bid/ask, size imbalance, aggressor proxy) to tick and microbar pipelines.
2. Improving setup trigger quality and execution management with deterministic mechanics.
3. Hardening Massive historical replay/backfill reliability for long windows.

## 2) Completeness Review (Resolved)
The requested spec is directionally strong, but required these additions for production-safe execution:
1. **Feature flags:** Add guarded rollout controls (`ENABLE_L2_MICROSTRUCTURE`) for safe fallback.
2. **Deterministic formulas:** Define exact imbalance/aggressor math to avoid implementation drift.
3. **Data source constraints:** Massive tick payloads can be sparse by feed/entitlement; microstructure must degrade gracefully.
4. **Macro kill-switch definition:** Current repo has basis/regime/flow context, but not guaranteed DXY/yield realtime feed in setup path. Initial implementation must use available macro proxies and remain fail-closed.
5. **Observability contract:** Emit metrics/logging for microstructure coverage and setup gating impacts.
6. **Backtest gate precision:** Promotion criteria must include exact source/resolution and sample-size floor.

## 3) Scope
In scope:
1. `backend/src/services/massiveTickStream.ts`
2. `backend/src/services/tickCache.ts`
3. `backend/src/services/spx/microbarAggregator.ts`
4. `backend/src/services/setupDetector/*` (targeted detector updates per slices)
5. `backend/src/services/spx/setupDetector.ts`
6. `backend/src/services/spx/contractSelector.ts`
7. `backend/src/services/positions/exitAdvisor.ts`
8. `backend/src/config/massive.ts`
9. `backend/src/services/spx/historicalReconstruction.ts`

Out of scope (Phase 13):
1. Broker-side execution routing integration.
2. Non-Massive macro feed expansion beyond already wired services.
3. UI redesign outside targeted telemetry/scorecard surfaces.

## 4) Architecture Slices

### P13-S1: Tick + Microbar Microstructure Fidelity
1. Extend normalized tick model with optional quote fields (`bid`, `ask`, `bidSize`, `askSize`).
2. Compute per-tick aggressor-side proxy:
   - `buyer` if `price >= ask` (with valid ask),
   - `seller` if `price <= bid` (with valid bid),
   - `neutral` otherwise.
3. Extend microbars with:
   - `buyVolume`, `sellVolume`, `neutralVolume`,
   - `bidAskImbalance` in `[-1, 1]` using `(bidSize - askSize)/(bidSize + askSize)` when denominator > 0.
4. Keep compatibility: when quote data is unavailable, fields remain nullable and OHLCV logic unchanged.

### P13-S2: Detector Fidelity Upgrades
1. Inject microstructure confirmation into `levelTest`, `vwap`, `volumeClimax`.
2. Refactor `gammaSqueeze` toward intraday flow-pressure + dynamic OI proxy blend.
3. Add macro alignment kill-switch using available regime/basis/flow proxies, with explicit blocked-reason telemetry.

### P13-S3: Strategy Diversification / ORB Unlock
1. Recalibrate ORB flow thresholds using aggressor-skewed confirmation.
2. Keep diversification caps to avoid setup-family concentration.
3. Auto-requarantine ORB if floor metrics are not met.

### P13-S4: Execution Discipline
1. Regime-aware delta targeting in `contractSelector`.
2. Deterministic 1R/2R mechanics and pivot-based runner trail in `exitAdvisor`.

### P13-S5: Replay/Backfill Resiliency
1. Harden Massive historical fetches with bounded retries/backoff and retry taxonomy.
2. Handle sparse/zero-volume bars by explicit nullability/interpolation policy without crashing setup instance generation.

## 5) Data Contract Changes
Planned migration: `supabase/migrations/20260324000000_spx_microstructure_tracking.sql`
1. `spx_setup_instances.metadata` additions:
   - `bid_ask_imbalance_at_trigger` (number | null),
   - `aggressor_skew_at_trigger` (number | null),
   - `macro_alignment_score` (number | null),
   - `trailing_stop_path` (array/object | null).
2. If promoted from metadata to columns later, add indexes only after cardinality review.

## 6) Rollout Flags
1. `ENABLE_L2_MICROSTRUCTURE=true|false` (default `true` non-breaking; false disables quote-derived metrics).
2. Existing fallback behavior remains fail-closed for degraded options/GEX states.

## 7) Validation Gates
Slice gates:
1. `pnpm --dir backend test -- src/services/__tests__/massiveTickStream.test.ts`
2. `pnpm --dir backend test -- src/services/spx/__tests__/microbarAggregator.test.ts`
3. `pnpm --dir backend exec tsc --noEmit`

Release gates:
1. `pnpm --dir backend test -- src/services/spx/__tests__/contractSelector.test.ts`
2. `pnpm --dir backend test -- src/services/positions/__tests__/exitAdvisor.test.ts`
3. `pnpm --dir backend spx:backfill-historical <from> <to>`
4. `pnpm --dir backend backtest:last-week instances second`

Promotion criteria:
1. `usedMassiveMinuteBars=false`
2. T1 delta `>= +1.0pp` vs baseline
3. Expectancy delta `>= +0.05R`
4. Minimum resolved trade count threshold met for comparison window.

## 8) Rollback
1. Disable `ENABLE_L2_MICROSTRUCTURE` to revert to current OHLCV-only behavior.
2. Re-quarantine `orb_breakout` in optimizer profile if floor performance fails.
3. Revert Phase 13 commits if runtime latency/regression appears in production gates.

