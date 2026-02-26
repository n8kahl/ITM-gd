# SPX Command Center — Master System Audit

**Date:** 2026-02-26
**Scope:** End-to-end audit of the SPX Command Center across 10 domains
**Auditor:** Claude (Orchestrator Agent)
**Status:** All 10 audits complete. Implementation pending.

---

## Executive Summary

The SPX Command Center was audited across 10 domains covering every layer from Massive.com data ingestion through chart rendering. The audit identified **55+ discrete findings** categorized by severity. The system is functional for basic setup detection and display but has **critical gaps in trade lifecycle management, optimizer credibility, cache freshness, and chart data completeness** that could erode trust in trading decisions.

### Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 19 | Could cause real money loss, wrong trade decisions, or security exposure |
| HIGH | 18 | Degrades accuracy, creates confusion, or misses opportunities |
| MEDIUM | 14 | Suboptimal but not dangerous |
| LOW | 6 | Cosmetic or minor |

---

## Priority Implementation Plan

### P0 — Fix This Week (Real Money / Security Risk)

| # | Finding | Audit | Impact | Fix Complexity |
|---|---------|-------|--------|----------------|
| 1 | EOD cleanup job: auto-invalidate triggered setups at 4:01 PM ET | Lifecycle | Zombie setups persist overnight, confuse next-day trading | Low — add scheduled job |
| 2 | Optimizer revert endpoint missing (frontend references it, backend 404s) | Optimizer | Users cannot roll back bad optimization runs | Low — implement route handler |
| 3 | Reduce OPTIONS_CHAIN_CACHE_TTL from 60s to 20s | Cache | Contract recommendations use 60s-old Greeks in fast markets | Low — single constant change |
| 4 | Fix `spx_execution_active_states` RLS policy (add user isolation) | RLS | Service role leak exposes all users' execution states | Low — add `auth.uid()` policy |
| 5 | Add RLS policies to `spx_level_touches` (currently zero policies) | RLS | Table completely inaccessible to authenticated users | Low — add basic CRUD policies |
| 6 | Bound fallback snapshot age to 5 minutes max | Cache | Stage timeout returns 20+ minute old snapshot data | Low — add age check |
| 7 | VWAP missing from chart annotations (data flow break in collectLegacyLevels) | Chart | Traders cannot see VWAP — critical intraday S/R level | Medium — extract from indicators |
| 8 | Zero Gamma level missing from GEX-derived levels | Chart | Key options S/R level not rendered on chart | Low — add to buildGexDerivedLevels |

### P1 — Fix Next 2 Weeks (Trust / Accuracy Risk)

| # | Finding | Audit | Impact | Fix Complexity |
|---|---------|-------|--------|----------------|
| 9 | Increase optimizer minimum sample size from 12 to 30+ trades | Optimizer | Wilson 95% CI at n=12 is 28-72% — statistically meaningless | Low — constant change |
| 10 | Persist tickEvaluator state to Redis (survive backend restarts) | Lifecycle | Stop breach streak resets on restart; may miss confirmed stops | Medium — serialize Map to Redis |
| 11 | Add mutex to enterTrade() preventing concurrent trade entry | Lifecycle | User can enter multiple trades, blowing position size | Low — null check guard |
| 12 | Coach ↔ Command Center data alignment | AI Coach | Coach advice can contradict what trader sees on screen | Medium — shared snapshot |
| 13 | Screenshot cross-validation against actual options chain | AI Coach | GPT-4o Vision can hallucinate strike prices | Medium — post-analysis check |
| 14 | Reduce levels cache TTL from 30s to 15s | Cache | 30s levels + 20s snapshot = 50s compound staleness | Low — constant change |
| 15 | Fix `spx_setup_execution_fills` SELECT policy for user isolation | RLS | Any authenticated user can read all fills | Low — add user_id filter |
| 16 | Separate strict vs fallback replay results in optimizer output | Replay | Optimizer trains on mixed-fidelity data without distinction | Medium — add quality tags |
| 17 | Scenario lanes not updating with live price movement | Chart | Stale scenario lanes during active trades | Medium — add price dependency |
| 18 | Fibonacci levels not refreshing on intraday swing changes | Chart | Fib levels based on stale swing highs/lows | Medium — trigger recalc |

### P2 — Fix This Sprint (Quality / UX)

| # | Finding | Audit | Impact | Fix Complexity |
|---|---------|-------|--------|----------------|
| 19 | Add market close auto-resolution for all open setups | Lifecycle | Forming/ready setups also need EOD cleanup | Low — extend EOD job |
| 20 | Add optimizer dry-run mode | Optimizer | No way to preview optimization impact before applying | Medium |
| 21 | Add manual pause pinning (separate from auto-pause) | Optimizer | Nightly optimizer can override manual pauses | Medium |
| 22 | Cache warm-up on backend startup | Cache | First 60s of trading serves degraded data | Medium |
| 23 | Add freshness timestamps to coach responses | AI Coach | Trader doesn't know how old coach's data is | Low |
| 24 | Add hallucination guardrail to coach system prompt | AI Coach | Coach can invent price levels not in actual data | Low |
| 25 | Opening Range levels not calculated or rendered | Chart | OR-High/OR-Low missing from chart | High — new calculation |
| 26 | SPX header horizontal overflow on mobile | Mobile | Header unusable on 375px screens | Medium — responsive hiding |
| 27 | Action strip horizontal overflow on mobile | Mobile | Trade buttons may be hidden off-screen | Medium — responsive layout |
| 28 | Chart level label overlap on mobile | Mobile | Labels unreadable on narrow viewport | Medium — mobile suppression |
| 29 | Regime not re-classified during backtest replay | Replay | Optimizer may attribute wins/losses to wrong regime | High — add re-classification |
| 30 | Flow uses daily aggregates in replay, not intraday state | Replay | Backtested flow confirmation differs from live | High — intraday reconstruction |

### P3 — Future Improvements

| # | Finding | Audit | Impact |
|---|---------|-------|--------|
| 31 | VWAP not reconstructed during backtest replay | Replay | VWAP-filter compliance can't be validated |
| 32 | Entry fill assumes market order, no limit simulation | Replay | Backtests overly optimistic on fills |
| 33 | Overnight gaps not modeled in replay | Replay | Stop losses understated |
| 34 | Ambiguous bars detected but not filtered from optimizer | Replay | Optimizer learns from bars with unknown order |
| 35 | Touch targets below 44px accessibility standard | Mobile | Hard to tap on mobile |
| 36 | Confluence score decay not real-time between polls | Lifecycle | Stale scores between 10s polling intervals |
| 37 | Level deduplication by $0.25 rounding masks distinct levels | Chart | Two close levels merged into one |
| 38 | Frontend 12s grace period can mask legitimate downgrades | Lifecycle | Setup downgrade delayed up to 12s on frontend |

---

## Detailed Findings by Audit Domain

### Audit #1: Trade Lifecycle State Machine

**State definitions:** `SetupStatus = 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired'` (lib/types/spx-command-center.ts:118). Backend tick evaluator uses extended `TransitionPhase` adding `target1_hit` and `target2_hit` with monotonic rank enforcement.

**CRITICAL-1: Triggered setups can persist overnight.** TTL expiration only fires when `detectActiveSetups()` is called (setupDetector.ts:1739). If no API calls occur after market close, triggered setups linger until next morning. A triggered setup at 3:50 PM with 90-min TTL won't expire until 5:20 PM — after market close — and only if someone polls.

**CRITICAL-2: Backend restart wipes all in-flight state.** `setupStateById` is a plain `Map<string, SetupRuntimeState>` (tickEvaluator.ts:50) with no persistence. On restart, stop breach streak resets to 0, sequence counters reset. A setup that had 1/2 confirmed stop breaches pre-restart would need to re-accumulate from scratch.

**CRITICAL-3: Frontend relies on 10-second HTTP polling only.** No WebSocket or Supabase Realtime subscription for setup state changes (use-spx-setups.ts:14). Setup can transition through triggered→target1→expired between polls. Trader sees stale state.

**CRITICAL-4: No guard preventing concurrent trade entry.** `enterTrade()` has no check that `inTradeSetup === null`. User can enter multiple trades simultaneously, creating position size blowup risk (SPXSetupContext.tsx:41-62).

**HIGH-1: No coordinated market close handling.** No automatic setup resolution at 4:00 PM ET. `getSPXMarketSessionStatus()` detects after-hours but takes no cleanup action (marketSessionService.ts:9-11).

**HIGH-2: Stop confirmation requires 2 consecutive ticks.** If price briefly breaches stop then bounces back, streak resets to 0. Intentional noise filter but creates risk of allowing breached positions to continue (tickEvaluator.ts:264-274).

**MEDIUM-1: Frontend 12s grace period can mask legitimate downgrades.** If backend genuinely downgrades a triggered setup to ready (e.g., environment gate), frontend ignores it for 12 seconds (setup-stream-state.ts:72-94).

**MEDIUM-2: Invalidation reasons not consistently persisted.** If `transitionReason` is not 'stop', invalidationReason falls back to 'unknown', losing audit trail (tickEvaluator.ts:121-146).

---

### Audit #2: P&L Tracking & Outcome Resolution

**Generally sound.** R-multiple calculation is correct for both long/short. Slippage applied directionally. Partial exits at T1 properly tracked. Commission deducted uniformly. Outcome writes to Supabase with all required optimizer fields.

**HIGH-1: No retry on Supabase write failure.** If outcome persistence fails, partial data may be written. No idempotent retry mechanism (outcomeTracker.ts).

---

### Audit #3: Target Management (T1/T2, Trailing Stops)

**Functional.** T1 partial exit triggers breakeven stop move. T2 tracked independently. Runner position sized correctly after T1 fill. Trailing stop logic present but only activates after T1 hit.

**MEDIUM-1: Breakeven stop move assumes zero slippage.** In fast markets, breakeven fill may not execute at exact entry price (winRateBacktest.ts:997-1002).

---

### Audit #4: Optimizer & Learning Loop

**CRITICAL-1: Revert endpoint not implemented.** Frontend `useOptimizer` hook references `/api/spx/optimizer/revert` but backend has no matching route. Users cannot roll back bad optimization runs (optimizer.ts routes).

**CRITICAL-2: Minimum sample size is only 12 trades.** Wilson 95% CI at n=12 with 50% win rate is 28-72% — far too wide for actionable decisions. At n=30, CI narrows to 33-67%. At n=50, it's 37-63% (optimizer.ts:115).

**CRITICAL-3: Silent backtest fallback.** Optimizer can train on minute-bar fallback data without flagging results as lower-fidelity. Mixed strict/fallback results aggregated together (winRateBacktest.ts:1243-1286).

**HIGH-1: No dry-run mode.** No way to preview optimization impact before applying live.

**HIGH-2: Manual pause not pinned.** Nightly optimizer can override manual parameter pauses.

**HIGH-3: Trade management policy changes affect in-flight trades immediately.** No isolation between optimization runs and active positions.

---

### Audit #5: Replay Engine Fidelity

**CRITICAL-1: GEX uses EOD snapshot, not intraday state.** Historical GEX reconstruction pulls end-of-day snapshot, not the actual gamma landscape at the time the setup was triggered. GEX walls could be completely different (historicalReconstruction.ts:148-248).

**CRITICAL-2: Regime not re-classified during replay.** Backtest uses persisted regime from original detection, not re-classified from historical bars. If regime shifted intraday, optimizer learns from wrong context (winRateBacktest.ts:241, 833).

**CRITICAL-3: Flow uses daily aggregates, not intraday context.** Flow "confirmed" status in replay based on daily premium thresholds, not time-windowed cumulative flow at the moment of setup detection (historicalReconstruction.ts:374-415).

**CRITICAL-4: VWAP not reconstructed during replay.** No `calculateVWAP()` call in backtest path. VWAP-filter compliance cannot be validated (winRateBacktest.ts — missing).

**HIGH-1: Minute-bar fallback not separated from strict results.** `usedMassiveMinuteBars` boolean tracked but not propagated to optimizer scorecard. Results have 60x different temporal resolution treated equally (winRateBacktest.ts:1284).

**HIGH-2: Entry fill assumes market order.** No limit order simulation, no bid/ask spread check, no volume/queue modeling. Backtests overly optimistic on fill quality (winRateBacktest.ts:922-943).

**HIGH-3: Overnight gaps not modeled.** Setup triggered on Day 1 doesn't account for Day 2 gap open. Stop fill price assumes intraday continuity (winRateBacktest.ts:960-1051).

**HIGH-4: Ambiguity detected but not filtered.** Bars where both stop AND target are touched are flagged (`ambiguousBarCount`) but included in win-rate calculations at full weight (winRateBacktest.ts:945-958).

**HIGH-5: Setup detection not re-run in backtest.** Only persisted setups tested. If detection parameters change, old setups are tested with old zones. Survivorship bias: can't optimize entry geometry (winRateBacktest.ts loading path).

**MEDIUM-1: Early close days not handled.** Time-of-day geometry assumes 390-minute session. On early close days (1:00 PM), afternoon policies applied incorrectly (winRateBacktest.ts:217-224).

**MEDIUM-2: Execution model env vars undocumented.** Backtest slippage, commission controlled by env vars not in .env.example (winRateBacktest.ts:123-131).

---

### Audit #6: Cache Staleness & TTL Consistency

**CRITICAL-1: Options chain 60s TTL.** Contract recommendations use 60s-old Greeks while basis refreshes every 5s. In fast markets, recommended spread could be wrong (optionsChainFetcher.ts:39).

**CRITICAL-2: Snapshot in-flight promise masking.** If GEX is slow (12s), entire snapshot waits on stale promise. New requests get the in-flight result even if data is aging (index.ts:353-354).

**CRITICAL-3: Fallback cascade has no age limit.** If a stage times out, returns previous snapshot which could be 20+ minutes old with no upper bound (index.ts:195).

**HIGH-1: Compound staleness = 50-70s.** Options chain (60s) + levels (30s) + snapshot age (20s) + SWR dedup (1.5s) chains together. Trader can act on data nearly a minute old.

**HIGH-2: Levels 30s + snapshot 20s = 50s compound.** Levels displayed 50 seconds after price move in worst case (levelEngine.ts:20 + index.ts:390).

**HIGH-3: Flow 8s TTL misaligned with multi-minute windows.** 5m/15m/30m flow aggregation recomputed every 8s — wasteful and doesn't match analysis window (flowAggregator.ts:44).

**MEDIUM-1: Cold cache on startup.** No pre-warming. First 60s of trading serves degraded data (redis.ts + all services).

**MEDIUM-2: SWR 1.5s dedup + 8s refresh = stale window.** Rapid re-renders use stale SWR cache (use-spx-api.ts:268).

**MEDIUM-3: Tick stream gap tolerance unbounded.** If stream drops 2 minutes, tick buffer stales but levels still use it (tickCache.ts).

### Cross-Layer TTL Matrix

| Data Type | Cache TTL | Frontend Poll | Compound Staleness |
|-----------|-----------|---------------|-------------------|
| Tick Stream | In-memory (6000 ticks) | WebSocket live | 0s (real-time) |
| GEX | 15s Redis | 15s | 30s worst case |
| Levels | 30s Redis | 30s | 50s worst case |
| Flow | 8s Redis | 5s | 28s worst case |
| Contract | 10s Redis | On-demand | 70s (includes 60s opts chain) |
| Options Chain | 60s Redis | On-demand | 60s |
| Snapshot | 20s in-memory | 8s | 20s + sum of deps |

---

### Audit #7: Supabase RLS Policies on SPX Tables

**CRITICAL-1: `spx_execution_active_states` has blanket USING(true) WITH CHECK(true).** If service role key leaks, attacker gets full read/write to all users' execution states including order IDs, entry prices, quantities.

**CRITICAL-2: `spx_level_touches` has RLS enabled but zero policies.** Table is completely inaccessible to authenticated users — likely a missed policy during migration.

**HIGH-1: `spx_setup_execution_fills` INSERT allows null reported_by_user_id.** SELECT policy lets any authenticated user read all fills regardless of ownership.

**HIGH-2: Backend uses service role key for everything.** Single point of failure — if key leaks, all table protections bypassed.

---

### Audit #8: Chart Annotation Completeness

**CRITICAL-1: VWAP missing from chart.** VWAP is computed in `calculateVWAP()` and stored in `indicators.vwap`, but `collectLegacyLevels()` only extracts from resistance/support arrays — never the indicators object. VWAP line does NOT render on chart (levelEngine.ts:118-123).

**CRITICAL-2: Opening Range levels not calculated.** OR-High and OR-Low are referenced in setup specs but no `calculateOpeningRange()` function exists. These are critical setup triggers that don't appear on the chart.

**HIGH-1: Zero Gamma level missing.** GEX profile includes `zeroGamma` field but `buildGexDerivedLevels()` never maps it to an SPXLevel. Critical options S/R level absent (levelEngine.ts:163-169).

**HIGH-2: Scenario lanes stale during active trades.** Recalculate only when `selectedSetup` object changes, not when price moves. During active trades, lanes are frozen at entry-time prices (spx-chart.tsx:359-376).

**HIGH-3: Fibonacci levels not refreshing on intraday swings.** Fib levels cached and only refresh on manual/snapshot refresh. If a new swing high occurs mid-day, extensions based on old swing persist (levelEngine.ts:403-411).

**HIGH-4: Structural levels can be filtered by visibility budget.** PWH/PWL and other structural levels suppressed if near-window budget (7 labels) is exhausted by tactical levels (spatial-hud.ts:344-428).

**MEDIUM-1: SPY-derived level colors inconsistent between rendering paths.** spx-chart.tsx uses opacity 0.72, priority-level-overlay.tsx uses 0.9 for same levels.

**MEDIUM-2: Label deduplication by $0.25 rounding.** Two levels within $0.25 (VWAP at 4500.10 and Pivot at 4500.15) merged into one, hiding the lower-priority level (spatial-hud.ts:366-375).

**MEDIUM-3: MAX_LABELS = 10 can starve setup annotations.** 4 setup annotations + 6+ market levels = potential label starvation (priority-level-overlay.tsx:55).

### Annotation Inventory

| Type | Backend | Frontend | Chart | Real-Time | Status |
|------|---------|----------|-------|-----------|--------|
| Entry Zone | Yes | Yes | Yes (shaded rect) | On setup change | OK |
| Stop Level | Yes | Yes | Yes | On setup change | OK |
| Target 1 | Yes | Yes | Yes | On setup change | OK |
| Target 2 | Yes | Yes | Yes | On setup change | OK |
| PDH/PDL | Yes | Yes | Yes (if visible) | 30s poll | OK |
| VWAP | Yes (computed) | **NO** (not extracted) | **NO** | Should be real-time | **CRITICAL BUG** |
| Opening Range | **NO** (not calculated) | **NO** | **NO** | N/A | **CRITICAL BUG** |
| Call Wall (GEX) | Yes | Yes | Yes (if visible) | 30s poll | OK |
| Put Wall (GEX) | Yes | Yes | Yes (if visible) | 30s poll | OK |
| Flip Point | Yes | Yes | Yes (if visible) | 30s poll | OK |
| Zero Gamma | Yes (in profile) | **NO** (not mapped) | **NO** | N/A | **HIGH BUG** |
| Fibonacci | Yes | Yes | Yes (if visible) | Manual refresh only | **HIGH BUG** |
| SPY→SPX | Yes | Yes | Yes (special color) | 30s poll | OK |
| Scenario Lanes | Client-side | Yes | Yes | On setup change only | **HIGH BUG** |

---

### Audit #9: Mobile Responsiveness

**Overall Mobile Readiness: 35-40% (Poor)**

**CRITICAL-1: SPX header horizontal overflow.** 6 chips + 2 buttons in flex row with gap-2.5, no `hidden md:` variants. Estimated width needed: 500-600px. Will overflow on 375px (spx-header.tsx:90, 124-197).

**CRITICAL-2: Action strip horizontal overflow.** Timeframes + separators + overlay buttons + primary CTA in single flex row. Uses `overflow-x-auto` but primary action button may be hidden off-screen (action-strip.tsx:115-234).

**CRITICAL-3: Chart level labels overlap on narrow viewport.** On 375px width, chart area ~330px. With 14+ level annotations, labels will overlap or truncate. No mobile label suppression (spx-chart.tsx:63-68).

**HIGH-1: Header typography compression.** "SPX Command Center" title + price + regime chip all fight for space. No truncation or mobile variant (spx-header.tsx:100-102).

**HIGH-2: Touch targets below 44px standard.** Header settings button (36px) and timeframe buttons (36px) below accessibility minimum (spx-header.tsx:183, action-strip.tsx:127-145).

**MEDIUM-1: Setup card 4-column confluence grid is tight.** 80px per column on 375px — readable but cramped (setup-card.tsx:271).

**Positive findings:** Mobile-specific components exist (mobile-surface-orchestrator, mobile-panel-tabs, coach-bottom-sheet). Mobile primary CTA meets 44px target. Performance optimizations in place (reduced blur, hidden grid overlay).

---

### Audit #10: AI Coach Data Accuracy

**CRITICAL-1: Coach and command center use independent data paths.** Coach rebuilds levels fresh on every message (hitting 5-minute Redis cache) while command center polls snapshot every 8s. Coach can show different price levels than what trader sees on screen.

**CRITICAL-2: Screenshot analysis has no cross-validation.** GPT-4o Vision analyzes screenshots in isolation with no check against actual Massive.com data. Can hallucinate strike prices, contract details, or implied volatility values.

**HIGH-1: Coach has no access to setup detection engine.** pWin, confluence score, and regime classification from the command center are not passed to the coach context. Coach advice can contradict the command center's assessment.

**HIGH-2: No hallucination guardrail in system prompt.** Coach system prompt doesn't explicitly prohibit inventing price levels or making up market data. No "only reference data from provided context" instruction.

**MEDIUM-1: No freshness timestamp on coach responses.** Trader doesn't know how old the coach's underlying data is.

---

## Implementation Order (Step-by-Step Prompts)

Each fix below is designed as a standalone prompt that can be executed by an agent session. They're ordered by priority and grouped by minimal dependency chains.

### Phase 1: Safety-Critical Fixes (Items 1-8)

**Prompt 1A — EOD Cleanup + Market Close Handler**
Scope: Add scheduled 4:01 PM ET job to auto-invalidate all triggered/ready/forming setups with reason 'market_closed'. Files: setupDetector.ts, add new spxEodCleanup.ts service.

**Prompt 1B — Optimizer Revert Endpoint**
Scope: Implement POST `/api/spx/optimizer/revert` that restores previous optimization profile from `spx_optimizer_history` table. Files: backend/src/routes/spx.ts, optimizer.ts.

**Prompt 1C — Cache TTL Fixes (3 changes)**
Scope: (1) OPTIONS_CHAIN_CACHE_TTL 60→20 in optionsChainFetcher.ts, (2) Add 5-minute max age to fallback snapshot in index.ts, (3) Add generation ID + 10s staleness check to in-flight promise in index.ts.

**Prompt 1D — Supabase RLS Fixes**
Scope: (1) Replace blanket policy on spx_execution_active_states with auth.uid() filter, (2) Add CRUD policies to spx_level_touches, (3) Fix spx_setup_execution_fills SELECT for user isolation.

**Prompt 1E — Chart Data Flow Fixes**
Scope: (1) Extract VWAP from indicators.vwap in collectLegacyLevels or add to resistance array, (2) Add zeroGamma to buildGexDerivedLevels.

### Phase 2: Accuracy Fixes (Items 9-18)

**Prompt 2A — Optimizer Guardrails**
Scope: (1) Increase MIN_SAMPLE_SIZE from 12 to 30, (2) Add strict/fallback quality tag to SPXOptimizerScorecard, (3) Propagate usedMassiveMinuteBars to optimization metrics.

**Prompt 2B — Trade Lifecycle Hardening**
Scope: (1) Persist setupStateById to Redis with 24h TTL, (2) Add null check guard to enterTrade() preventing concurrent entry, (3) Add periodic 30s background job for TTL enforcement.

**Prompt 2C — AI Coach Data Alignment**
Scope: (1) Pass current snapshot data (levels, regime, pWin) to coach context, (2) Add freshness timestamp to coach responses, (3) Add hallucination guardrail to system prompt.

**Prompt 2D — Chart Real-Time Updates**
Scope: (1) Add price dependency to scenario lanes memo, (2) Add significant-move trigger for fib recalculation, (3) Unify SPY-derived level colors across rendering paths.

**Prompt 2E — Cache Optimization**
Scope: (1) Reduce levels TTL from 30s to 15s, (2) Reduce SWR dedup from 1500ms to 500ms for snapshot, (3) Add cache warm-up on backend startup.

### Phase 3: Quality/UX Fixes (Items 19-30)

**Prompt 3A — Mobile Header + Action Strip**
Scope: Add responsive hiding for header chips on mobile, refactor action strip for vertical stack or collapsible menu on small screens.

**Prompt 3B — Opening Range Calculation**
Scope: Implement calculateOpeningRange() in levels service, add OR-High/OR-Low to resistance/support arrays.

**Prompt 3C — Replay Engine Improvements**
Scope: (1) Add regime re-classification in backtest, (2) Reconstruct VWAP from cumulative volume, (3) Flag ambiguous bars with reduced confidence weight.

**Prompt 3D — Optimizer Safety Features**
Scope: (1) Dry-run mode, (2) Manual pause pinning, (3) In-flight trade isolation from optimization changes.

---

## Test Coverage Map

Tests already created during this audit cycle (167+ tests):

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| Massive Data Validation | massiveDataValidation.test.ts | 19 | All passing |
| Setup Detection Pipeline | setupDetectionPipeline.test.ts | 25 | All passing |
| Regime Classifier | regimeClassifier.test.ts | 30 | All passing |
| Confluence Hardening | confluenceHardening.test.ts | 11 | All passing |
| Contract Selection | contractSelector.test.ts + expanded | 54 | All passing |
| Tick Evaluator | tickEvaluatorExpanded.test.ts | 28 | All passing |
| Levels Pipeline | levelsPipelineHardening.test.ts | 24 | All passing |
| WebSocket Reliability | websocketReliability.test.ts | 10 | All passing |

Tests needed for new fixes:

| Fix | Tests Needed |
|-----|-------------|
| EOD Cleanup | Setup states resolved at 4:01 PM, early close handling, idempotency |
| Optimizer Revert | Revert restores previous profile, revert with no history errors gracefully |
| Cache TTL changes | Contract freshness under 20s, fallback bounded at 5 min |
| RLS fixes | User isolation verified, cross-user access blocked |
| VWAP chart flow | VWAP appears in SPXLevel array, renders on chart |
| Trade lifecycle | Concurrent entry blocked, Redis persistence survives restart |
| Coach alignment | Coach context matches snapshot, freshness displayed |

---

## Architecture Diagrams

### Data Flow: Massive.com → Chart

```
Massive.com API
  ├── Tick Stream (WebSocket) → tickCache (in-memory, 6000/symbol)
  │     ├── tickEvaluator → setup state transitions
  │     └── WebSocket broadcast → frontend price display
  │
  ├── Options Chain (REST) → Redis (60s TTL) ← CRITICAL: reduce to 20s
  │     ├── gexEngine → GEX profile (15s TTL)
  │     │     └── buildGexDerivedLevels → SPXLevel[]
  │     └── contractSelector → recommendation (10s TTL)
  │
  └── Historical Bars (REST) → winRateBacktest → optimizer
        └── historicalReconstruction → replay context

Levels Pipeline:
  calculateLevels() → indicators.vwap ← CRITICAL: not extracted
                    → resistance/support arrays
  collectLegacyLevels() → SPXLevel[] (missing VWAP, Zero Gamma)
  + GEX derived levels
  + Fib levels
  + SPY→SPX derived levels
  → levelEngine cache (30s TTL) ← reduce to 15s

Snapshot Orchestrator (8s refresh):
  buildSnapshot() combines: GEX + flow + basis + fib + levels + regime + setups
  → lastGoodSnapshot (20s TTL) ← bound fallback to 5 min
  → /api/spx/snapshot → SWR cache (1.5s dedup) → React context → chart

Chart Rendering:
  SPXChart → lightweight-charts createPriceLine() (axis labels)
  PriorityLevelOverlay → DOM div positioning (lines + zones)
  resolveVisibleChartLevels() → filtered/budgeted level set
```

### Trade Lifecycle State Machine

```
                    ┌─── ttl_expired ──→ expired
                    │
  forming ──→ ready ──→ triggered ──→ target1_hit ──→ target2_hit
     │          │          │              │
     │          │          │              └── stop ──→ invalidated
     │          │          └── stop ──→ invalidated
     │          └── stop ──→ invalidated
     └── ttl_expired ──→ expired

  Missing transitions (to implement):
  - ANY state ──→ invalidated (reason: market_closed) at 4:01 PM ET
  - triggered ──→ should persist to Redis for restart resilience
  - enterTrade() ──→ should guard against concurrent entry
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation | Status |
|------|------------|--------|------------|--------|
| Zombie triggered setup overnight | Medium | High | EOD cleanup job (Prompt 1A) | Open |
| Bad optimizer run with no rollback | High | High | Implement revert endpoint (Prompt 1B) | Open |
| 60s stale contract recommendation | High | Critical | Reduce TTL (Prompt 1C) | Open |
| Service role key leak → full data access | Low | Critical | Fix RLS policies (Prompt 1D) | Open |
| VWAP invisible on chart | Certain | High | Fix data flow (Prompt 1E) | Open |
| Backend restart loses stop streak | Medium | High | Persist to Redis (Prompt 2B) | Open |
| Coach contradicts command center | High | Medium | Share snapshot (Prompt 2C) | Open |
| Mobile trading unusable | Certain | Medium | Responsive fixes (Prompt 3A) | Open |
| Optimizer trains on bad data | High | High | Quality tags + min sample (Prompt 2A) | Open |

---

## Appendix: Files Referenced

### Backend Services
- backend/src/services/spx/setupDetector.ts — Setup detection, TTL, gates
- backend/src/services/spx/tickEvaluator.ts — Tick processing, state machine
- backend/src/services/spx/outcomeTracker.ts — P&L, outcome resolution
- backend/src/services/spx/optimizer.ts — Nightly optimization, profiles
- backend/src/services/spx/winRateBacktest.ts — Replay/backtest engine
- backend/src/services/spx/historicalReconstruction.ts — Historical context rebuild
- backend/src/services/spx/levelEngine.ts — Level computation + GEX integration
- backend/src/services/spx/gexEngine.ts — GEX landscape computation
- backend/src/services/spx/flowAggregator.ts — Flow window aggregation
- backend/src/services/spx/contractSelector.ts — Contract recommendation
- backend/src/services/spx/index.ts — Snapshot orchestrator
- backend/src/services/spx/marketSessionService.ts — Market hours
- backend/src/services/spx/executionStateStore.ts — Execution persistence
- backend/src/services/options/optionsChainFetcher.ts — Options chain data
- backend/src/services/levels/index.ts — Levels calculation pipeline
- backend/src/services/levels/cache.ts — Levels Redis caching
- backend/src/services/tickCache.ts — In-memory tick buffer
- backend/src/services/websocket.ts — WebSocket management
- backend/src/config/redis.ts — Redis client

### Frontend Components
- components/spx-command-center/spx-chart.tsx — Main chart
- components/spx-command-center/priority-level-overlay.tsx — Level overlay
- components/spx-command-center/spx-header.tsx — Header bar
- components/spx-command-center/action-strip.tsx — Trade controls
- components/spx-command-center/setup-card.tsx — Setup display cards
- components/spx-command-center/spx-command-center-shell-containers.tsx — Layout

### Hooks
- hooks/use-spx-setups.ts — Setup polling
- hooks/use-spx-snapshot.ts — Snapshot polling
- hooks/use-spx-api.ts — SWR base config
- hooks/use-chart-coordinates.ts — Chart coordinate mapping
- hooks/use-price-stream.ts — WebSocket price stream

### Contexts
- contexts/spx/SPXSetupContext.tsx — Setup state management
- contexts/SPXCommandCenterContext.tsx — Main context

### Libraries
- lib/spx/spatial-hud.ts — Level visibility resolution
- lib/spx/setup-stream-state.ts — Frontend state merge
- lib/spx/scenario-lanes.ts — Scenario lane computation
- lib/spx/replay-engine.ts — Replay checksum/validation
- lib/types/spx-command-center.ts — Type definitions
