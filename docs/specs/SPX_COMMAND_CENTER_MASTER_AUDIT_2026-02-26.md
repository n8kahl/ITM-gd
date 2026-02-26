# SPX Command Center — Master Audit Validation Report

**Date:** 2026-02-26
**Auditor:** QA Agent (Claude Code)
**Branch:** `claude/validate-spx-audit-fixes-oc2De`
**Scope:** Validate all audit fixes from Master Audit (2026-02-26), 10-domain coverage

---

## Executive Summary

**Overall Status: 36 items audited — 10 PASS / 7 PARTIAL / 19 MISS**

The Master Audit fixes are **largely unimplemented**. All 9 known gaps from the previous verification session are **confirmed still open**. Phase 1 (Safety-Critical) has zero complete subsystems. Phase 2 (Accuracy) has 3 passes out of 17 items. Phase 3 (Quality/UX) has 4 passes out of 15 items. Multiple CRITICAL-severity gaps remain in production safety, data freshness, and security (RLS).

---

## Phase 1: Safety-Critical Fixes

### 1A — EOD Cleanup Job — ❌ MISS (0% Complete)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | Worker file exists | ❌ MISS | `backend/src/workers/spxEodCleanupWorker.ts` | — | File does not exist. 9 workers in directory; this is not one of them. |
| 2 | Registered in server.ts | ❌ MISS | `backend/src/server.ts` | 32-38 | No import or call to spxEodCleanup. Only 7 workers registered. |
| 3 | Polls every 30s | ❌ N/A | — | — | Worker doesn't exist |
| 4 | Checks minute 961 | ❌ N/A | — | — | Worker doesn't exist |
| 5 | Checks minute 781 | ❌ N/A | — | — | Worker doesn't exist |
| 6 | Redis dedup key | ❌ N/A | — | — | Worker doesn't exist |
| 7 | Invalidates forming/ready/triggered | ❌ N/A | — | — | Worker doesn't exist |
| 8 | Sets invalidationReason 'market_closed' | ❌ N/A | — | — | Worker doesn't exist |
| 9 | 'market_closed' in SetupInvalidationReason | ❌ MISS | `backend/src/services/spx/types.ts` | 34-44 | Union type has 10 values; 'market_closed' is NOT included |

**Production Risk:** Setups (forming/ready/triggered) are never invalidated at market close. Stale setups persist across sessions.

---

### 1B — Optimizer Revert Endpoint — ❌ MISS (0% Complete)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | POST /api/spx/analytics/optimizer/revert route | ❌ MISS | `backend/src/routes/spx.ts` | — | Route does not exist. POST routes found: `/scan`, `/contract-select`, `/broker/*`, `/coach/*`. No revert. |
| 2 | revertSPXOptimizationProfile function | ❌ MISS | `backend/src/services/spx/optimizer.ts` | — | Function does not exist. Zero matches for "revert" in 2198-line file. |
| 3 | Reads from spx_optimizer_history | ⚠️ PARTIAL | `backend/src/routes/spx.ts` | 256-399 | History GET route reads `reverted_from_history_id` (line 274), but this is read-only, not a write/revert operation. |
| 4 | Validates historyId as positive integer | ❌ MISS | — | — | No endpoint exists to validate. |
| 5 | Frontend hook calls matching URL | ❌ MISMATCH | `hooks/use-spx-optimizer.ts` | 402 | Hook calls `/api/spx/analytics/optimizer/revert` with `{ historyId, reason }` — **backend will return 404**. |

**Production Risk:** Frontend "Revert Optimizer" button will fail with 404. Users cannot undo bad optimization profiles.

---

### 1C — Cache TTL Fixes — ❌ MISS (0% Complete)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | OPTIONS_CHAIN_CACHE_TTL = 20 | ❌ MISS | `backend/src/services/options/optionsChainFetcher.ts` | 39 | Value is `60` (should be 20). 3x too long. |
| 2 | OPTIONS_MATRIX_CACHE_TTL = 20 | ❌ MISS | Same file | 40 | Value is `60` (should be 20). 3x too long. |
| 3 | SNAPSHOT_MAX_FALLBACK_AGE_MS = 300000 | ❌ MISS | `backend/src/services/spx/index.ts` | — | Constant does not exist. No fallback age limit. |
| 4 | Fallback nulled when age exceeds max | ❌ MISS | Same file | 363-371 | Code always serves `lastGoodSnapshot` if available, regardless of age. No age comparison. |
| 5 | SNAPSHOT_INFLIGHT_STALENESS_MS = 10000 | ❌ MISS | Same file | — | Constant does not exist. |
| 6 | snapshotInFlightStartedAt tracked | ❌ MISS | Same file | 26 | Only `snapshotInFlight: Promise | null` — no timestamp variable. |
| 7 | Stale in-flight triggers fresh build | ❌ MISS | Same file | 352-354 | `if (snapshotInFlight) return snapshotInFlight;` — no staleness check. Hung promise blocks all requests. |

**Production Risk:** Options chain data can be 60s stale (should be 20s). Fallback snapshots served with unlimited age. A hung in-flight promise blocks the entire snapshot pipeline indefinitely.

---

### 1D — Supabase RLS Fixes — ⚠️ PARTIAL (2 of 3 tables fixed)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | spx_execution_active_states has user_id | ✅ PASS | `supabase/migrations/20260327000000_*.sql` | 7 | `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` |
| 2 | RLS enabled on spx_execution_active_states | ✅ PASS | Same file | 40 | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` |
| 3 | SELECT policy restricts to auth.uid() = user_id | ✅ PASS | Same file | 49-51 | `USING (auth.uid() = user_id)` correctly scoped |
| 4 | No blanket USING(true) for authenticated role | ✅ PASS | Same file | 43-46 | USING(true) scoped to service_role only (correct) |
| 5 | spx_level_touches RLS policies exist | ✅ PASS | `supabase/migrations/20260327030000_*.sql` | 13-18 | RLS enabled, service_role-only policy (correct for system-level table) |
| 6 | spx_setup_execution_fills SELECT restricted | ❌ MISS | `supabase/migrations/20260323070000_*.sql` | 51-53 | SELECT policy uses `USING (true)` — any authenticated user can read ALL fills. Should be `USING (reported_by_user_id = auth.uid())` |

**Production Risk:** Any authenticated user can read all execution fill records for all other users. **Security vulnerability.**

---

### 1E — Chart Data Flow (VWAP + Zero Gamma) — ⚠️ PARTIAL

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | VWAP extracted from indicators.vwap | ✅ PASS | `backend/src/services/levels/index.ts` | 243-298 | VWAP synthesized with `type: 'VWAP'`, `strength: 'dynamic'` in resistance/support arrays |
| 2 | VWAP as LevelItem with type 'VWAP' | ✅ PASS | Same file | 290 | `type: 'VWAP'` confirmed |
| 3 | spx_zero_gamma from gex.spx.zeroGamma | ❌ MISS | `backend/src/services/spx/levelEngine.ts` | 163-169 | `buildGexDerivedLevels()` adds call_wall, put_wall, flip_point — NOT zero_gamma. GEX engine computes `zeroGamma` (gexEngine.ts:80) but it's unused in level pipeline. |
| 4 | spy_zero_gamma from gex.spy.zeroGamma | ❌ MISS | Same file | 163-169 | Same issue. SPY zero_gamma not synthesized. |
| 5 | Both have strength 'strong' | ❌ N/A | — | — | Levels not created |
| 6 | VWAP label gold/yellow color | ✅ PASS | `components/spx-command-center/priority-level-overlay.tsx` | 128 | `rgba(234,179,8,0.92)` — correct gold/yellow |
| 7 | labelFromSource maps 'spx_zero_gamma' | ✅ PASS (unreachable) | Same file | 69 | `if (normalized.includes('zero_gamma')) return 'Zero Gamma'` exists but never called because levels aren't created |

---

## Phase 2: Accuracy Fixes

### 2A — Optimizer Guardrails — ⚠️ PARTIAL

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | minTradesPerCombo = 30 | ❌ MISS | `backend/src/services/spx/optimizer.ts` | 516 | Value is `12`. Should be `30`. Also `minTrades: 12` at line 577. |
| 2 | SPXOptimizerScorecard replayFidelity field | ❌ MISS | Same file | 163-188 | No `replayFidelity` or `dataQuality` field in interface |
| 3 | usedMassiveMinuteBars in scorecard output | ✅ PASS | `backend/src/services/spx/winRateBacktest.ts` | 598, 1284 | Field tracked: `usedMassiveMinuteBars: loadedMinute > 0` |
| 4 | Optimizer flags fallback-majority results | ⚠️ PARTIAL | `backend/src/services/spx/optimizer.ts` | — | `usedMassiveMinuteBars` tracked in backtest but no optimizer-level filter/flag for fallback-majority results |

---

### 2B — Trade Lifecycle Hardening — ❌ MISS (0% Complete)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | setupStateById persisted to Redis | ❌ MISS | `backend/src/services/spx/tickEvaluator.ts` | 50 | `const setupStateById = new Map<string, SetupRuntimeState>()` — plain in-memory Map, no Redis |
| 2 | syncTickEvaluatorSetups restores from Redis | ⚠️ PARTIAL | Same file | 190-226 | Function exists but only syncs from incoming Setup array, not from Redis |
| 3 | enterTrade() blocks concurrent trade | ⚠️ PARTIAL | `contexts/SPXCommandCenterContext.tsx` | 1893-1952 | No explicit `if (inTradeSetupId) return` guard. selectSetup blocks switching during trade (implicit guard), but enterTrade itself allows re-entry. |
| 4 | Periodic 30s TTL enforcement | ❌ MISS | `backend/src/services/spx/tickEvaluator.ts` | — | No cleanup loop, no TTL field, no expiration logic |

---

### 2C — AI Coach Data Alignment — ❌ MISS (0% Complete)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | Hallucination guardrail in system prompt | ❌ MISS | `backend/src/chatkit/systemPrompt.ts` | 1-127 | No "do not invent/fabricate data" instruction. Only `intentRouter.ts:686` has a partial mention: "do not invent tool outputs" |
| 2 | Coach receives snapshot data | ⚠️ PARTIAL | `backend/src/services/spx/aiCoach.ts` | — | Data flows implicitly via background services; no explicit snapshot injection or freshness validation |
| 3 | Coach response includes dataAsOf | ❌ MISS | Same file | 55-72 | Messages include `timestamp: nowIso()` (creation time), NOT `dataAsOf` (data freshness timestamp) |

---

### 2D — Chart Real-Time Updates — ⚠️ PARTIAL

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | scenarioLanes depends on spxPrice | ✅ PASS | `components/spx-command-center/spx-chart.tsx` | 359-364 | `spxPrice` is in useMemo dependency array |
| 2 | LEVEL_CACHE_TTL_SECONDS = 15 | ❌ MISS | `backend/src/services/spx/levelEngine.ts` | 20 | Value is `30`. Should be `15`. |
| 3 | dedupingInterval = 500 for snapshot | ❌ MISS | `hooks/use-spx-api.ts` | 268 | Value is `1500`. Should be `500`. |
| 4 | SPY-derived level colors unified | ✅ PASS | `backend/src/services/spx/levelEngine.ts` | 57-63 | Consistent emerald rgba(16,185,129,0.5) across backend and both overlay components |

---

### 2E — Cache Optimization — ❌ MISS (0% Complete)

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | Cache warm-up on backend startup | ❌ MISS | `backend/src/server.ts` | 189-247 | No pre-fetch of GEX/levels on boot. Workers start fire-and-forget; no blocking initialization. |
| 2 | isTickStreamHealthy() freshness check | ❌ MISS | `backend/src/services/tickCache.ts` | — | Function does not exist. Tick buffer is simple FIFO with no age checking. |
| 3 | Snapshot builder checks tick freshness | ⚠️ PARTIAL | `backend/src/services/spx/index.ts` | 380-395 | Uses background refresh timing but no explicit tick-age validation |

---

## Phase 3: Quality/UX Fixes

### 3A — Mobile Responsiveness — ❌ MISS

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | Header chips responsive hiding | ❌ MISS | `components/spx-command-center/spx-header.tsx` | 89-198 | No `hidden md:flex` or responsive breakpoint patterns. All chips render unconditionally. |
| 2 | Action buttons stack on mobile | ❌ MISS | `components/spx-command-center/action-strip.tsx` | 117-561 | No stack-on-mobile, uses `overflow-x-auto` only |
| 3 | Touch targets >= 44px | ⚠️ PARTIAL | Same file | 191-193 | Uses `min-h-[36px]` — 8px below recommended 44px minimum |

---

### 3B — Opening Range Calculation — ✅ PASS

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | calculateOpeningRange() exists | ✅ PASS | `components/ai-coach/chart-indicators.ts` | 84-116 | `calculateOpeningRangeBox()` with configurable 15-min default window |
| 2 | OR-High/OR-Low in level arrays | ✅ PASS | `components/ai-coach/trading-chart.tsx` | 1147-1167 | Both levels added with `group: 'openingRange'` |
| 3 | OR levels categorized for chart rendering | ✅ PASS | Same file | 1150-1165 | Proper styling, labels, and colors (#a78bfa) |

---

### 3C — Replay Engine Improvements — ⚠️ PARTIAL

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | Regime re-classified from historical bars | ❌ MISS | `backend/src/services/spx/winRateBacktest.ts` | — | No regime re-evaluation during replay simulation |
| 2 | VWAP reconstructed from cumulative volume | ✅ PASS | `components/ai-coach/chart-indicators.ts` | 62-82 | Proper cumulative TP × volume / cumulative volume |
| 3 | Ambiguous bars flagged with reduced confidence | ❌ MISS | `backend/src/services/spx/winRateBacktest.ts` | — | `ambiguityCount` field exists but no confidence weighting |

---

### 3D — Optimizer Safety Features — ⚠️ PARTIAL

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | Dry-run mode (preview without applying) | ❌ MISS | `backend/src/services/spx/optimizer.ts` | — | No dry-run/preview mode. Direct application only. |
| 2 | Manual pause pinning | ⚠️ PARTIAL | Same file | 52, 118, 2003 | `pausedCombos` and `pausedSetupTypes` arrays exist; nightly override protection is unclear |
| 3 | In-flight trade isolation | ❌ MISS | Same file | — | No mechanism prevents optimizer from modifying active trade parameters |

---

### Entry Zone Rendering Fix — ❌ MISS

| # | Check | Status | File | Line | Finding |
|---|-------|--------|------|------|---------|
| 1 | RenderZone interface exists | ❌ MISS | `components/spx-command-center/priority-level-overlay.tsx` | 30-38 | Only `RenderLine` interface exists (y, label, color). No `RenderZone` with yTop/yBottom. |
| 2 | RenderState includes zones[] | ❌ MISS | Same file | — | No zones array in render state |
| 3 | entryZones memo | ❌ MISS | Same file | 188-211 | Entry zones rendered as two individual OverlayLevel lines (Low and High), not paired zones |
| 4 | Filled rectangle rendering | ❌ MISS | Same file | 194, 204 | Uses `color: 'rgba(16,185,129,0.9)'` (opaque) and `lineStyle: 'dashed'` — not filled rectangles |
| 5 | Zone label centered | ❌ MISS | Same file | — | No centered label inside zone rectangle |
| 6 | spx-chart.tsx reduced opacity (0.35) | ❌ MISS | `components/spx-command-center/spx-chart.tsx` | 554-568 | Uses `rgba(16,185,129,0.75)` and `lineWidth: 1` — should be opacity 0.35 and width 0.75 |

---

## Known Gaps from Previous Session — Verification

All 9 previously identified gaps are **CONFIRMED STILL OPEN**:

| # | Gap | Status | Evidence |
|---|-----|--------|----------|
| 1 | minTradesPerCombo still 12 | **CONFIRMED** | `optimizer.ts:516` — `minTradesPerCombo: 12` |
| 2 | No concurrent trade guard | **CONFIRMED** | `SPXCommandCenterContext.tsx:1893-1952` — enterTrade() has no `if (inTradeSetupId) return` check |
| 3 | setupStateById not persisted to Redis | **CONFIRMED** | `tickEvaluator.ts:50` — `const setupStateById = new Map<>()` (plain in-memory) |
| 4 | No hallucination guardrail in coach prompt | **CONFIRMED** | `chatkit/systemPrompt.ts` — no "do not invent data" instruction; only partial mention in `intentRouter.ts:686` |
| 5 | Levels cache TTL still 30s | **CONFIRMED** | `levelEngine.ts:20` — `const LEVEL_CACHE_TTL_SECONDS = 30` |
| 6 | SWR dedup still 1500ms | **CONFIRMED** | `use-spx-api.ts:268` — `dedupingInterval: 1500` |
| 7 | spx_setup_execution_fills SELECT not fixed | **CONFIRMED** | `20260323070000_*.sql:51-53` — `FOR SELECT TO authenticated USING (true)` |
| 8 | No cache warm-up on startup | **CONFIRMED** | `server.ts:189-247` — no GEX/levels pre-fetch on boot |
| 9 | No tick stream freshness check | **CONFIRMED** | `tickCache.ts` — no `isTickStreamHealthy()` function |

---

## Validation Gates

### TypeScript Check (`pnpm exec tsc --noEmit`)
- **Result:** 16,744 errors
- **Note:** These are pre-existing errors across the entire codebase (including `playwright.config.ts`, `vitest.config.ts`, and hundreds of component files). Not specific to the audit scope.

### ESLint (`pnpm exec eslint`)
- **Result:** Unable to run — `eslint-config-next` package not installed in this environment
- **Note:** Dependencies not fully installed; lint validation requires `pnpm install` first

### Vitest Unit Tests
- **Result:** Unable to run — `vitest` not installed
- **Note:** Requires `pnpm install` in project root

### Build (`pnpm run build`)
- **Status:** 🔍 NEEDS TESTING — not run in this audit (requires full dependency install)

---

## Gap Report — Items Requiring Fix

### CRITICAL Severity

| ID | Finding | File:Line | Expected | Actual | Fix |
|----|---------|-----------|----------|--------|-----|
| 1A-ALL | EOD Cleanup Job entirely missing | `backend/src/workers/spxEodCleanupWorker.ts` | Worker that invalidates setups at 4:01 PM ET | File does not exist | Create worker, register in server.ts, add 'market_closed' to SetupInvalidationReason type |
| 1B-ALL | Optimizer Revert Endpoint missing | `backend/src/routes/spx.ts` | POST /api/spx/analytics/optimizer/revert | Route and service function do not exist | Create `revertSPXOptimizationProfile()` in optimizer.ts, add POST route |
| 1C-1,2 | Options cache TTLs 3x too high | `backend/src/services/options/optionsChainFetcher.ts:39-40` | TTL = 20 | TTL = 60 | Change both constants to 20 |
| 1C-3,4,5,6,7 | Snapshot fallback/inflight unbounded | `backend/src/services/spx/index.ts:26-378` | 5-min max fallback, 10s inflight staleness | No limits at all | Add SNAPSHOT_MAX_FALLBACK_AGE_MS, SNAPSHOT_INFLIGHT_STALENESS_MS, snapshotInFlightStartedAt |
| 1D-6 | spx_setup_execution_fills SELECT open to all users | `supabase/migrations/20260323070000_*.sql:51-53` | `USING (reported_by_user_id = auth.uid())` | `USING (true)` | Create migration to drop and recreate SELECT policy with user_id filter |
| 2B-1 | setupStateById ephemeral in-memory | `backend/src/services/spx/tickEvaluator.ts:50` | Redis persistence | `new Map<>()` | Serialize to Redis after mutations; restore on startup |

### HIGH Severity

| ID | Finding | File:Line | Expected | Actual | Fix |
|----|---------|-----------|----------|--------|-----|
| 1E-3,4 | Zero Gamma levels not synthesized | `backend/src/services/spx/levelEngine.ts:163-169` | `spx_zero_gamma` and `spy_zero_gamma` levels | Not created despite GEX computing zeroGamma | Add `addLevel()` calls for both |
| 2A-1 | minTradesPerCombo too low | `backend/src/services/spx/optimizer.ts:516,577` | 30 | 12 | Change to 30 |
| 2A-2 | Scorecard missing replayFidelity | `backend/src/services/spx/optimizer.ts:163-188` | `replayFidelity: 'strict'\|'fallback'\|'mixed'` | Field absent | Add field to SPXOptimizerScorecard interface and populate |
| 2B-3 | No concurrent trade entry guard | `contexts/SPXCommandCenterContext.tsx:1893` | Explicit `if (inTradeSetupId) return` | Only implicit guard via selectSetup | Add explicit check at top of enterTrade() |
| 2C-1 | No hallucination guardrail | `backend/src/chatkit/systemPrompt.ts` | "Only reference data from provided context" | Absent | Add instruction to system prompt |
| 2D-2 | Levels cache TTL too high | `backend/src/services/spx/levelEngine.ts:20` | 15s | 30s | Change to 15 |
| 2D-3 | SWR dedup interval too high | `hooks/use-spx-api.ts:268` | 500ms | 1500ms | Change to 500 |
| 2E-1,2 | No cache warm-up or tick freshness | `backend/src/server.ts`, `backend/src/services/tickCache.ts` | Pre-fetch on boot + freshness check | Neither exists | Add warm-up to startup sequence; add isTickStreamHealthy() |

### MEDIUM Severity

| ID | Finding | File:Line | Expected | Actual | Fix |
|----|---------|-----------|----------|--------|-----|
| 2B-4 | No periodic TTL enforcement | `backend/src/services/spx/tickEvaluator.ts` | 30s cleanup job | No cleanup loop | Add setInterval TTL enforcement |
| 2C-3 | No dataAsOf in coach response | `backend/src/services/spx/aiCoach.ts` | `dataAsOf: ISO timestamp` | Only creation timestamp | Add data freshness metadata |
| 3A-ALL | Mobile responsiveness missing | `spx-header.tsx`, `action-strip.tsx` | Responsive hiding, touch targets | No breakpoint patterns | Add hidden md:flex, min-h-[44px] |
| 3C-1,3 | Replay: no regime reclassification or ambiguous bar flagging | `winRateBacktest.ts` | Historical regime eval, confidence weighting | Neither exists | Implement both |
| 3D-1,3 | Optimizer: no dry-run or trade isolation | `optimizer.ts` | Preview mode, in-flight isolation | Neither exists | Implement both |

### LOW Severity

| ID | Finding | File:Line | Expected | Actual | Fix |
|----|---------|-----------|----------|--------|-----|
| ENTRY-ALL | Entry zone rendered as lines, not filled rectangles | `priority-level-overlay.tsx:188-211` | Filled rgba(16,185,129,0.18) rectangles with dashed borders | Two dashed lines at opacity 0.9 | Implement RenderZone interface and zone rendering logic |
| ENTRY-CHART | Entry zone chart lines wrong opacity | `spx-chart.tsx:554-568` | Opacity 0.35, width 0.75 | Opacity 0.75, width 1 | Reduce opacity and line width |

---

## Recommended Priority Order

1. **CRITICAL — Security:** Fix `spx_setup_execution_fills` RLS (1D-6) — users can read others' fills
2. **CRITICAL — Safety:** Create EOD Cleanup Worker (1A) — stale setups persist across days
3. **CRITICAL — Freshness:** Fix Cache TTLs (1C) — options 3x stale, snapshots unbounded
4. **CRITICAL — API parity:** Create Optimizer Revert endpoint (1B) — frontend will 404
5. **CRITICAL — Durability:** Persist setupStateById to Redis (2B-1) — state lost on restart
6. **HIGH — Accuracy:** Fix optimizer minTrades (2A-1), add replayFidelity (2A-2)
7. **HIGH — Chart:** Add zero gamma levels (1E-3,4)
8. **HIGH — Safety:** Add concurrent trade guard (2B-3), hallucination guardrail (2C-1)
9. **HIGH — Freshness:** Reduce level cache TTL (2D-2), SWR dedup (2D-3), add cache warm-up (2E)
10. **MEDIUM/LOW:** Mobile responsiveness, replay improvements, optimizer safety, entry zone rendering

---

## Appendix: Files Audited

| File | Items Checked |
|------|---------------|
| `backend/src/workers/` (directory listing) | 1A |
| `backend/src/server.ts` | 1A-2, 2E-1 |
| `backend/src/services/spx/types.ts:34-44` | 1A-9 |
| `backend/src/routes/spx.ts` | 1B |
| `backend/src/services/spx/optimizer.ts` | 1B-2, 2A, 3D |
| `hooks/use-spx-optimizer.ts:402` | 1B-5 |
| `backend/src/services/options/optionsChainFetcher.ts:39-40` | 1C-1,2 |
| `backend/src/services/spx/index.ts:26-395` | 1C-3,4,5,6,7 |
| `supabase/migrations/20260327000000_*.sql` | 1D-1,2,3,4 |
| `supabase/migrations/20260327020000_*.sql` | 1D-5 |
| `supabase/migrations/20260327030000_*.sql` | 1D-5 |
| `supabase/migrations/20260323070000_*.sql` | 1D-6 |
| `backend/src/services/levels/index.ts:243-298` | 1E-1,2 |
| `backend/src/services/spx/levelEngine.ts` | 1E-3,4, 2D-2 |
| `backend/src/services/spx/gexEngine.ts:80,157` | 1E-3 |
| `components/spx-command-center/priority-level-overlay.tsx` | 1E-6,7, Entry Zone |
| `backend/src/services/spx/winRateBacktest.ts` | 2A-3, 3C |
| `backend/src/services/spx/tickEvaluator.ts:50,190-226` | 2B-1,2,4 |
| `contexts/SPXCommandCenterContext.tsx:1893-1952` | 2B-3 |
| `backend/src/chatkit/systemPrompt.ts` | 2C-1 |
| `backend/src/chatkit/intentRouter.ts:686` | 2C-1 |
| `backend/src/services/spx/aiCoach.ts` | 2C-2,3 |
| `components/spx-command-center/spx-chart.tsx:359-364` | 2D-1 |
| `hooks/use-spx-api.ts:268` | 2D-3 |
| `backend/src/services/tickCache.ts` | 2E-2 |
| `components/spx-command-center/spx-header.tsx` | 3A-1 |
| `components/spx-command-center/action-strip.tsx` | 3A-2,3 |
| `components/ai-coach/chart-indicators.ts:62-116` | 3B, 3C-2 |
| `components/ai-coach/trading-chart.tsx:1147-1167` | 3B |
