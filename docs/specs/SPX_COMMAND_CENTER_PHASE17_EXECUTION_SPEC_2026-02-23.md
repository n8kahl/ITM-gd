# SPX Command Center Phase 17: Execution Hardening & Strategy Optimization

**Date:** 2026-02-23
**Owner:** Orchestrator + Backend Agent + SPX Engine Agent + Frontend Agent + QA Agent
**Primary Route:** `/members/spx-command-center`
**Execution Mode:** Safety-first hardening, then strategy optimization, then signal quality
**Governing Findings:**
- `SPX_E2E_CONTRACT_EXECUTION_AUDIT_2026-02-23.md` (7 findings, 2 critical)
- `SPX_STRATEGY_OPTIMIZATION_RESEARCH_2026-02-23.md` (8 optimizations)

---

## 1. Objective

Productionalize the SPX Command Center execution pipeline by closing all critical and high-severity gaps identified in the E2E audit, then implement evidence-backed strategy optimizations to improve R:R, win rate, and profitability.

This spec must:

1. Eliminate the in-memory execution state risk by persisting active trade states to Supabase, ensuring no orphaned positions on backend restart.
2. Make the kill switch actually cancel all open orders on Tradier, not just set a flag.
3. Implement order status polling so the system knows whether orders filled, rejected, or partially filled.
4. Replace display-only safety controls (auto-flatten, PDT tracking) with enforced backend logic.
5. Implement time-decay aware geometry, adaptive partial profit scaling, and VIX regime overlay to improve YTD expectancy from +0.48R toward +0.90R.
6. Prune dead strategies (breakout_vacuum), relax ORB gates, and add VWAP as a micro-filter.
7. Deliver all changes with strict replay validation, walk-forward optimizer promotion gates, and full E2E test coverage.

---

## 2. Scope and Constraints

### 2.1 In Scope

1. Execution state persistence (Supabase table + rehydration on startup)
2. Kill switch order cancellation (Tradier API integration)
3. Order status polling loop (fill confirmation, rejection handling, partial fills)
4. 0DTE auto-flatten enforcement (scheduled job, 5 min before close)
5. PDT tracking and gating (daily trade count per user)
6. Duplicate order prevention (database-level uniqueness constraint)
7. T1 target price inference from actual setup geometry (replace 1.35x hardcode)
8. Time-decay aware geometry adjustment (morning/midday/late/final-hour buckets)
9. Adaptive partial profit scaling (regime-dependent T1 exit percentages)
10. VIX regime overlay (strategy filtering and geometry adaptation by VIX level)
11. ORB breakout gate relaxation (reduce conjunction severity, add range-width filter)
12. Strategy pruning (remove breakout_vacuum, merge flip_reclaim into fade family)
13. VWAP micro-filter integration (directional confirmation + deviation bands)
14. Day-of-week and event calendar filtering (FOMC, OPEX awareness)
15. GEX-adaptive stop-loss widths

### 2.2 Out of Scope

1. New broker integrations (Tradier only for this phase)
2. Multi-leg strategies (spreads, iron condors)
3. Overnight or swing-trade position management
4. Admin dashboard execution analytics (Phase 18)
5. Real-time P&L streaming (Phase 18)
6. Mobile execution UI (Phase 18)

### 2.3 Non-Negotiable Constraints

1. All execution-path changes must be validated in Tradier sandbox before any live credential testing.
2. sell_to_open remains hard-blocked at the client level. No exceptions.
3. Every new Supabase table must have RLS policies. Run `get_advisors(type: "security")` after DDL.
4. Strategy optimization changes must pass walk-forward promotion gates (T1 delta >= +3pp, expectancy delta >= +0.10R, failure rate delta <= +1pp).
5. Emerald Standard design system for all new UI components.
6. Strict replay validation (Massive second bars, `usedMassiveMinuteBars=false`) for all performance claims.
7. No strategy changes ship without minimum 20 resolved trades in validation window.

---

## 3. Baseline Findings (Validated 2026-02-23)

1. **Execution state is in-memory only.** `stateByUserSetup` is a `Map<string, TradierExecutionState>` in `executionEngine.ts` line 80. Backend restart = orphaned positions with no T1/T2/stop management.
2. **Kill switch sets `is_active=false` but does not cancel open orders.** Comment on lines 883-885 of `spx.ts` acknowledges this gap.
3. **No order status polling.** After `placeOrder()`, the system never checks back for fill/reject/partial status.
4. **Safety controls are display-only.** `broker-safety-controls.tsx` shows "0DTE Auto-Flatten: Enforced" and "PDT Alert Threshold: 3 trades/day" as static labels with no backing logic.
5. **No partial fill handling.** System assumes full fills; quantity mismatch cascades to incorrect T1 sizing and phantom runner stops.
6. **Duplicate order race condition.** Two concurrent `handleTriggeredTransition()` calls can both place entry orders before either writes state.
7. **T1 exit price is hardcoded at 1.35x entry.** Does not use actual setup geometry target.
8. **YTD performance:** T1 63.16%, T2 51.75%, Failure 35.96%, Expectancy +0.48R.
9. **Late-session T2 degradation:** T2 drops to 35.29% after minute 300.
10. **ORB breakout: 0% trigger rate.** 117 opportunities, 0 triggered, 103 blocked by gate conjunction.
11. **breakout_vacuum: permanently quarantined.** 0% trigger rate, dead code.
12. **No VIX, VWAP, or day-of-week awareness** in strategy selection or geometry.

---

## 4. Product Principles

1. **Safety before speed.** No execution path ships without persistent state, confirmed fills, and cancellation capability.
2. **Measure before changing.** Every strategy optimization must have a baseline measurement, an A/B comparison via replay, and promotion gate evidence.
3. **Fail closed.** If order status is unknown, assume unfilled. If VIX data is unavailable, use baseline geometry. If VWAP is stale, skip the filter.
4. **One source of truth for position state.** Supabase, not in-memory maps.
5. **Additive signal quality.** New filters (VWAP, VIX, day-of-week) must improve metrics without reducing trigger rate below 15% for any active strategy.
6. **Every safety claim must be enforced, not displayed.**

---

## 5. Target Technical Architecture

### 5.1 Execution State Persistence

New Supabase table `spx_execution_active_states` replaces in-memory `Map`. Fields mirror `TradierExecutionState` plus `created_at`, `closed_at`, `close_reason`. On startup, the execution engine queries all rows where `closed_at IS NULL` and rehydrates into the processing loop. State writes use `UPSERT` with `(user_id, setup_id, session_date)` as the unique key, eliminating the duplicate order race condition at the database level.

### 5.2 Order Lifecycle Manager

New service `orderLifecycleManager.ts` wraps Tradier order placement with a polling loop. After `placeOrder()`, it enqueues the order ID into a poll queue. Every 5 seconds, the poller calls `GET /accounts/{id}/orders/{orderId}` and updates the execution state with actual `filled_quantity`, `avg_fill_price`, and `status` (pending/filled/partially_filled/rejected/cancelled). On rejection, it publishes a coach message and marks the state as failed. On partial fill, it adjusts `quantity` to match actual fills.

### 5.3 Kill Switch v2

The kill switch endpoint:
1. Sets `is_active=false` and `spx_auto_execute=false` (existing behavior)
2. Queries `spx_execution_active_states` for all open states for this user
3. For each active state with `entry_order_id` or `runner_stop_order_id`, calls `tradier.cancelOrder()`
4. Calls `GET /accounts/{id}/orders?status=pending` to find any other SPX-tagged orders and cancels them
5. Returns the count of cancelled orders

### 5.4 Auto-Flatten Service

New scheduled job `autoFlattenJob.ts` runs at 3:55 PM ET (configurable). It queries `spx_execution_active_states` for all open states, places market exit orders for remaining quantities, and marks states as `closed_at = now, close_reason = 'auto_flatten'`. A safety net cron at 3:59 PM re-checks for any surviving positions.

### 5.5 PDT Tracker

New service `pdtTracker.ts` queries `spx_setup_execution_fills` for `side = 'entry'` fills grouped by `user_id` and `session_date`. Before any new entry order, the execution engine calls `pdtTracker.canTrade(userId)`. If the user has >= 3 round-trips today and `totalEquity < 25000`, the order is blocked and a coach message is published explaining why.

### 5.6 Strategy Optimization Pipeline

The optimizer profile gains new fields:
- `geometryPolicy.byTimeBucket` with 4 buckets: `opening` (0-90m), `midday` (91-240m), `late` (241-330m), `final` (331+m)
- `vixRegimePolicy` with thresholds and per-regime strategy allowlists + geometry multipliers
- `vwapFilter` with `enabled`, `deviationBands`, `confluenceBonus`
- `dayOfWeekPolicy` with per-day strategy overrides and event calendar (FOMC, OPEX)
- `gexAdaptiveStops` with positive/negative GEX stop multipliers

---

## 6. Feature Flag Policy

### 6.1 Stable defaults ON (ship production-enabled)

1. `spx_execution_state_persistence` — Supabase state persistence
2. `spx_kill_switch_v2` — Order cancellation on kill
3. `spx_order_status_polling` — Fill confirmation loop
4. `spx_duplicate_order_prevention` — Database-level uniqueness
5. `spx_t1_geometry_inference` — Replace 1.35x hardcode
6. `spx_prune_breakout_vacuum` — Remove dead strategy

### 6.2 Beta defaults OFF (opt-in, requires replay validation)

1. `spx_auto_flatten` — 0DTE forced close at 3:55 PM
2. `spx_pdt_tracking` — PDT gate enforcement
3. `spx_time_decay_geometry` — Time-bucket geometry adaptation
4. `spx_adaptive_partial_scaling` — Regime-dependent T1 exit %
5. `spx_vix_regime_overlay` — VIX-based strategy filtering
6. `spx_orb_gate_relaxation` — Reduced ORB conjunction
7. `spx_vwap_filter` — VWAP directional filter
8. `spx_day_of_week_filter` — Calendar-aware gating
9. `spx_gex_adaptive_stops` — GEX-based stop width

### 6.3 Flag hygiene

Every flag must list: owner, purpose, rollout date, and removal condition. Beta flags auto-expire after 30 days if not promoted to stable.

---

## 7. Concrete Implementation Plan (PR-Sliced)

### Phase 17-S1: Execution State Persistence (P0)

**Goal:** Eliminate orphaned position risk by persisting all execution state to Supabase.

**Deliverables:**
1. Migration: `spx_execution_active_states` table with RLS policies
2. `executionStateStore.ts` service with `upsert()`, `close()`, `loadOpen()`, `rehydrate()`
3. Refactor `executionEngine.ts` to write/read from Supabase instead of in-memory Map
4. Startup rehydration: on backend boot, load open states and resume management
5. Integration test: simulate restart mid-trade, verify T1/stop/terminal still fire

**New/changed files:**
1. `supabase/migrations/YYYYMMDDHHMMSS_create_spx_execution_active_states.sql` (new)
2. `backend/src/services/spx/executionStateStore.ts` (new)
3. `backend/src/services/broker/tradier/executionEngine.ts` (modify)
4. `backend/src/services/spx/__tests__/executionStateStore.test.ts` (new)

**Exit criteria:**
1. `spx_execution_active_states` table exists with RLS policies; `get_advisors(type: "security")` returns no new warnings.
2. Backend restart does not orphan any active execution state.
3. UPSERT constraint on `(user_id, setup_id, session_date)` prevents duplicate rows.
4. All existing execution engine tests pass.
5. Integration test: create state → restart → verify state rehydrated → verify T1 transition fires.

---

### Phase 17-S2: Kill Switch v2 + Order Cancellation (P0)

**Goal:** Kill switch actually cancels all open orders on Tradier.

**Deliverables:**
1. Refactor `/broker/tradier/kill` endpoint to cancel active orders
2. Query `spx_execution_active_states` for open entries/stops
3. Call `tradier.cancelOrder()` for each active order ID
4. Fallback: query Tradier `GET /orders?status=pending` for any missed `spx:*` tagged orders
5. Return cancelled order count in response

**New/changed files:**
1. `backend/src/routes/spx.ts` (modify kill endpoint, lines 821-907)
2. `backend/src/services/broker/tradier/client.ts` (add `getOpenOrders()` method)
3. `components/spx-command-center/kill-switch-button.tsx` (show cancelled count)

**Exit criteria:**
1. Kill switch cancels all open orders for the user on Tradier (verified in sandbox).
2. Response includes `cancelledOrders: N` with actual count.
3. All `spx_execution_active_states` rows for user are marked `closed_at = now, close_reason = 'kill_switch'`.
4. Frontend displays cancelled order count after kill.

---

### Phase 17-S3: Order Status Polling (P0)

**Goal:** Confirm fills, detect rejections, handle partial fills.

**Deliverables:**
1. `orderLifecycleManager.ts` service with poll queue and 5-second interval
2. `tradier.getOrderStatus(orderId)` client method
3. On fill: update `spx_execution_active_states` with `actual_fill_qty` and `avg_fill_price`
4. On reject: mark state as failed, publish coach message, log to `spx_setup_execution_fills`
5. On partial fill: adjust `quantity` and `remainingQuantity` to match actual fills
6. On timeout (order pending > 2 minutes): cancel and retry at market if configured

**New/changed files:**
1. `backend/src/services/broker/tradier/orderLifecycleManager.ts` (new)
2. `backend/src/services/broker/tradier/client.ts` (add `getOrderStatus()`)
3. `backend/src/services/broker/tradier/executionEngine.ts` (integrate poll after each placeOrder)
4. `backend/src/services/broker/tradier/__tests__/orderLifecycleManager.test.ts` (new)

**Exit criteria:**
1. Every `placeOrder()` call is followed by status polling until terminal state (filled/rejected/cancelled).
2. Partial fills correctly adjust downstream quantities (T1 partial qty = 65% of ACTUAL filled qty).
3. Rejected orders produce a coach message and do not leave stale state.
4. Polling stops after order reaches terminal state (no leaked intervals).

---

### Phase 17-S4: Auto-Flatten + PDT Enforcement (P1)

**Goal:** Replace display-only safety controls with enforced backend logic.

**Deliverables:**
1. `autoFlattenJob.ts` scheduled at 3:55 PM ET, exits all open SPX positions
2. Safety net cron at 3:59 PM ET re-checks for survivors
3. `pdtTracker.ts` service: counts daily round-trips per user
4. Execution engine calls `pdtTracker.canTrade()` before entry; blocks if PDT limit reached and equity < $25k
5. Update `broker-safety-controls.tsx` to show live enforcement status instead of static labels
6. Coach messages for both auto-flatten events and PDT blocks

**New/changed files:**
1. `backend/src/workers/autoFlattenJob.ts` (new)
2. `backend/src/services/spx/pdtTracker.ts` (new)
3. `backend/src/services/broker/tradier/executionEngine.ts` (add PDT check before entry)
4. `backend/src/services/spx/__tests__/pdtTracker.test.ts` (new)
5. `backend/src/workers/__tests__/autoFlattenJob.test.ts` (new)
6. `components/spx-command-center/broker-safety-controls.tsx` (modify: live status)

**Exit criteria:**
1. At 3:55 PM ET, all open SPX positions are market-exited (verified in sandbox with mock clock).
2. PDT gate blocks 4th entry when equity < $25k; allows when equity >= $25k.
3. Safety controls component shows real-time enforcement status (not static labels).
4. Coach messages fire for both auto-flatten and PDT blocks.

---

### Phase 17-S5: Duplicate Prevention + T1 Geometry Fix (P1)

**Goal:** Eliminate duplicate order race condition and fix T1 exit pricing.

**Deliverables:**
1. Database-level `UNIQUE(user_id, setup_id, session_date)` constraint on `spx_execution_active_states` prevents concurrent inserts
2. Application-level: `INSERT ... ON CONFLICT DO NOTHING` returns 0 rows if duplicate, skipping order
3. Replace `entryLimitPrice * 1.35` with actual geometry-based T1 option price calculation
4. T1 price formula: `mid + abs(delta) * moveToT1 + gamma * moveToT1^2 / 2`
5. Pass `setup.target1.price` through execution engine to order builder

**New/changed files:**
1. `supabase/migrations/YYYYMMDDHHMMSS_add_unique_constraint_execution_states.sql` (new, if not done in S1)
2. `backend/src/services/broker/tradier/executionEngine.ts` (fix T1 pricing, add ON CONFLICT)
3. `backend/src/services/spx/__tests__/t1PriceInference.test.ts` (new)

**Exit criteria:**
1. Two concurrent `handleTriggeredTransition()` calls for same setup produce exactly 1 entry order.
2. T1 exit price reflects actual setup geometry (varies by strategy type).
3. Unit test: fade_at_wall T1 at 1.2R produces different option price than orb_breakout T1 at 2.4R.

---

### Phase 17-S6: Time-Decay Geometry + Adaptive Partial Scaling (P1)

**Goal:** Improve late-session R:R by compressing T2 targets and adapting T1 exit percentages.

**Deliverables:**
1. Add `final` time bucket (331+ minutes) to `geometryPolicy.byTimeBucket`
2. Morning: widen T2 by 15%. Midday: baseline. Late: compress T2 by 20%, T1 partial at 80%. Final: T1-only (100% exit at T1), T1 at 1.0-1.2R.
3. Regime-adaptive partial exit: compression 75%, ranging 70%, trending 55%, breakout 50%
4. After T1, move stop to entry + 0.15R (not just breakeven)
5. Time-based T2 exit: if T2 not hit within 45 minutes of T1, exit runner at market
6. Walk-forward replay validation against YTD data

**New/changed files:**
1. `backend/src/services/spx/optimizer.ts` (add time bucket + regime partial config)
2. `lib/spx/engine.ts` (geometry resolution with final bucket)
3. `backend/src/services/spx/setupDetector.ts` (time-based T2 exit logic)
4. `backend/src/services/broker/tradier/executionEngine.ts` (adaptive partial %, BE+0.15R stop)
5. `lib/spx/__tests__/time-decay-geometry.test.ts` (new)

**Exit criteria:**
1. Late-bucket (241-330m) T2 targets are 20% narrower than baseline.
2. Final-hour (331+m) setups use 100% T1 exit with no T2 runner.
3. Regime-adaptive partial exits: compression exits 75% at T1 (not fixed 65%).
4. Runner stop moves to entry + 0.15R after T1 (not flat breakeven).
5. Walk-forward replay shows expectancy improvement >= +0.10R in late + final buckets.

---

### Phase 17-S7: Strategy Pruning + ORB Gate Relaxation (P1)

**Goal:** Remove dead strategies and unlock ORB breakout from 0% trigger rate.

**Deliverables:**
1. Remove `breakout_vacuum` from strategy type registry and optimizer profile
2. Raise `trend_pullback` minPWinCalibrated from 0.58 to 0.62
3. ORB changes: reduce minConfluenceScore from 4 to 3, reduce minFlowQualityScore from 58 to 45
4. Add EMA alignment grace period during ORB window (first 30 minutes)
5. Add ORB range-width filter: only trigger when opening range is 4-18 SPX points
6. Replay validation: verify ORB trigger rate reaches 15-25% without degrading quality

**New/changed files:**
1. `backend/src/services/spx/setupDetector.ts` (remove breakout_vacuum, relax ORB gates)
2. `backend/src/services/spx/optimizer.ts` (remove breakout_vacuum from profile)
3. `lib/spx/engine.ts` (ORB range-width filter)
4. `hooks/use-spx-optimizer.ts` (remove breakout_vacuum references)
5. `lib/spx/__tests__/orb-gate-relaxation.test.ts` (new)

**Exit criteria:**
1. `breakout_vacuum` no longer appears in any strategy type enumeration or optimizer profile.
2. ORB trigger rate >= 15% on YTD replay (vs 0% baseline).
3. ORB T1 win rate >= 55% on replay with new gates.
4. `trend_pullback` failure rate decreases with higher pWin floor.
5. Walk-forward promotion gates pass for modified profile.

---

### Phase 17-S8: VIX Regime Overlay (P2)

**Goal:** Adapt strategy selection and geometry based on implied volatility environment.

**Deliverables:**
1. Add VIX data feed to snapshot service (source: Massive.com `I:VIX` or CBOE)
2. Classify VIX regime: low (< 14), normal (14-20), elevated (20-28), high (> 28)
3. High VIX: block breakout/trend strategies, restrict to mean_reversion + fade_at_wall, T1 at 0.8-1.0R
4. Low VIX: widen stops 10%, widen targets 15%
5. Elevated VIX: tighten T1 10%, widen stops 15%
6. Add `vixRegime` field to decision engine context
7. Replay validation across VIX regime transitions in YTD data

**New/changed files:**
1. `backend/src/services/spx/snapshotService.ts` (add VIX feed)
2. `backend/src/services/spx/setupDetector.ts` (VIX regime gating)
3. `backend/src/services/spx/optimizer.ts` (VIX geometry multipliers)
4. `lib/spx/decision-engine.ts` (VIX regime in context)
5. `lib/spx/__tests__/vix-regime-overlay.test.ts` (new)

**Exit criteria:**
1. VIX data populates in snapshot within 30 seconds of market open.
2. High-VIX regime (> 28) blocks trend_continuation and orb_breakout strategies.
3. Replay across Feb 2026 VIX spike shows reduced drawdown >= 15%.
4. Fail-closed: missing VIX data defaults to `normal` regime (no geometry adjustment).

---

### Phase 17-S9: VWAP Micro-Filter (P2)

**Goal:** Add VWAP as directional confirmation to improve signal quality.

**Deliverables:**
1. VWAP calculation service using 1-minute bars with volume from Massive.com
2. Directional filter: bullish setups require price >= VWAP, bearish require price <= VWAP
3. VWAP deviation bands: > 1 SD from VWAP favors mean-reversion, within 0.5 SD favors continuation
4. VWAP cross adds +1 confluence bonus for aligned direction
5. Grace period: VWAP filter disabled before 10:00 AM (insufficient bars for reliable VWAP)

**New/changed files:**
1. `backend/src/services/spx/vwapService.ts` (new)
2. `backend/src/services/spx/setupDetector.ts` (VWAP filter integration)
3. `backend/src/services/spx/snapshotService.ts` (add VWAP to snapshot)
4. `lib/spx/decision-engine.ts` (VWAP alignment in scoring)
5. `lib/spx/__tests__/vwap-filter.test.ts` (new)

**Exit criteria:**
1. VWAP value available in snapshot data after 9:45 AM ET.
2. Bullish setup with price below VWAP is filtered (unless grace period active).
3. VWAP cross event adds +1 confluence bonus (visible in setup metadata).
4. Replay shows +3pp directional win rate improvement with VWAP filter enabled.
5. Fail-closed: stale VWAP (> 5 minutes old) disables filter, does not block setups.

---

### Phase 17-S10: Day-of-Week + GEX-Adaptive Stops (P2)

**Goal:** Add calendar awareness and gamma-responsive stop sizing.

**Deliverables:**
1. FOMC calendar feed (static schedule or FRED API) with event detection
2. OPEX week detection (3rd Friday of month ± 1 trading day)
3. Wednesday FOMC: block all strategies until 2:30 PM ET post-announcement
4. Thursday pre-OPEX: increase T1 partial to 80%, compress T2
5. Friday OPEX: only allow fade_at_wall + mean_reversion, targets at 1.0-1.5R
6. Positive GEX: tighten stops 10-15%. Negative GEX: widen stops 10-15% for mean-reversion
7. Extreme GEX (> 2 SD): increase confluence floor by +1

**New/changed files:**
1. `backend/src/services/spx/calendarService.ts` (new)
2. `backend/src/services/spx/setupDetector.ts` (day-of-week + GEX stop logic)
3. `backend/src/services/spx/optimizer.ts` (dayOfWeekPolicy + gexAdaptiveStops config)
4. `lib/spx/__tests__/day-of-week-filter.test.ts` (new)
5. `lib/spx/__tests__/gex-adaptive-stops.test.ts` (new)

**Exit criteria:**
1. FOMC day correctly detected; strategies blocked until 2:30 PM ET on those days.
2. OPEX Friday limits active strategies to fade_at_wall + mean_reversion only.
3. Positive GEX environment produces 10% tighter stops (verified in geometry output).
4. Negative GEX + mean_reversion produces 10% wider stops.
5. Replay across FOMC dates shows reduced failure rate on those days.

---

## 8. Quality Matrix

### 8.1 Unit Tests

1. `executionStateStore.test.ts` — CRUD operations, rehydration, uniqueness constraint
2. `orderLifecycleManager.test.ts` — Poll loop, partial fill handling, rejection, timeout
3. `pdtTracker.test.ts` — Count logic, equity threshold, edge cases (exactly 3 trades)
4. `t1PriceInference.test.ts` — Geometry-based pricing vs hardcoded 1.35x across all strategy types
5. `time-decay-geometry.test.ts` — Bucket assignment, target compression/expansion factors
6. `orb-gate-relaxation.test.ts` — Gate conjunction with relaxed thresholds, range-width filter
7. `vix-regime-overlay.test.ts` — Classification boundaries, strategy blocking, geometry multipliers
8. `vwap-filter.test.ts` — VWAP calculation, directional filter, confluence bonus, grace period
9. `day-of-week-filter.test.ts` — FOMC detection, OPEX detection, strategy restrictions
10. `gex-adaptive-stops.test.ts` — Positive/negative/extreme GEX stop multipliers

### 8.2 Integration Tests

1. Execution engine restart recovery: create active state → simulate restart → verify rehydration → verify T1 fires
2. Kill switch end-to-end: place entry + runner stop → activate kill → verify both cancelled on Tradier
3. Auto-flatten: create open position at 3:54 PM mock clock → advance to 3:55 PM → verify market exit
4. PDT block: place 3 entries in one day → attempt 4th → verify blocked
5. Full trade lifecycle: triggered → entry filled → T1 hit → partial exit → runner stop → T2 hit → terminal exit → state closed

### 8.3 Replay Validation

1. Baseline YTD replay with current profile (control)
2. Time-decay geometry replay (treatment A)
3. Adaptive partial scaling replay (treatment B)
4. ORB relaxation replay (treatment C)
5. Combined A+B+C replay (candidate profile)
6. VIX overlay replay (treatment D)
7. VWAP filter replay (treatment E)
8. Full candidate profile replay (all treatments)

Each treatment must independently pass promotion gates before combination.

### 8.4 E2E Tests

1. `e2e/spx-execution-state.spec.ts` (new) — Verify state persistence through simulated restart
2. `e2e/spx-kill-switch.spec.ts` (new) — Kill switch UI flow + order cancellation verification
3. `e2e/spx-contract-selection.spec.ts` (existing) — Verify no regression in contract selector
4. `e2e/spx-safety-controls.spec.ts` (new) — Auto-flatten and PDT status display accuracy

---

## 9. Acceptance Criteria (Production Ready)

1. No P0/P1 known defects in execution pipeline.
2. Execution state persists to Supabase; backend restart does not orphan positions (verified via integration test).
3. Kill switch cancels all open orders on Tradier (verified in sandbox).
4. Order status polling confirms fills within 10 seconds of placement.
5. Partial fills correctly adjust downstream T1/runner quantities.
6. 0DTE auto-flatten fires at 3:55 PM ET in sandbox testing.
7. PDT gate blocks 4th entry when equity < $25k.
8. No duplicate entry orders for same setup+session (database constraint).
9. T1 exit prices reflect actual setup geometry (per-strategy, per-regime).
10. Walk-forward promotion gates pass for combined optimization profile.
11. YTD replay expectancy >= +0.70R (vs +0.48R baseline) for candidate profile.
12. ORB trigger rate >= 15% (vs 0% baseline) without T1 win rate below 55%.
13. All new tables have RLS policies; `get_advisors(type: "security")` clean.
14. All new/modified files pass `eslint` and `tsc --noEmit`.
15. All E2E specs pass under `--project=chromium --workers=1`.
16. Release notes, runbook, and change control documents current.

---

## 10. Rollback Strategy

1. **Execution state persistence:** Feature flag `spx_execution_state_persistence`. Rollback: disable flag, revert to in-memory Map. Risk: orphaned positions reintroduced, but no data loss (Supabase rows remain).
2. **Kill switch v2:** If order cancellation fails, the old behavior (flag-only) still activates. Users can manually cancel orders in Tradier dashboard.
3. **Order status polling:** Disable `spx_order_status_polling` flag. Orders revert to fire-and-forget. Fills still recorded via transition events.
4. **Auto-flatten:** Disable `spx_auto_flatten` flag. Display changes to "Manual" status. Users must close positions themselves.
5. **Strategy optimizations (S6-S10):** Each optimization is independently flag-gated. Disable any individual flag to revert that optimization without affecting others. Optimizer profile has `source: 'scan'` vs `source: 'default'` to revert to baseline.
6. **Nuclear option:** Disable all `spx_*` beta flags to return to pre-Phase-17 behavior. Kill switch (even v1) prevents new orders.

---

## 11. Branch and Commit Strategy

**Branch:** `codex/phase17-execution-hardening`

One slice per PR where practical. Slices S1-S3 (P0) must land before S4-S7 (P1), which must land before S8-S10 (P2).

**Commit format:**
- `fix(spx): persist execution state to Supabase [P17-S1]`
- `fix(spx): kill switch cancels active Tradier orders [P17-S2]`
- `feat(spx): order status polling with partial fill handling [P17-S3]`
- `feat(spx): enforce auto-flatten and PDT tracking [P17-S4]`
- `fix(spx): eliminate duplicate order race condition [P17-S5]`
- `feat(spx): time-decay geometry and adaptive partial scaling [P17-S6]`
- `refactor(spx): prune breakout_vacuum, relax ORB gates [P17-S7]`
- `feat(spx): VIX regime overlay for strategy adaptation [P17-S8]`
- `feat(spx): VWAP micro-filter for directional confirmation [P17-S9]`
- `feat(spx): day-of-week calendar and GEX-adaptive stops [P17-S10]`

**Every PR must include:** scope, risk, tests run, rollback plan.

---

## 12. Execution Checklist

- [ ] Phase 17-S1: Execution state persistence (P0)
- [ ] Phase 17-S2: Kill switch v2 + order cancellation (P0)
- [ ] Phase 17-S3: Order status polling (P0)
- [ ] Phase 17-S4: Auto-flatten + PDT enforcement (P1)
- [ ] Phase 17-S5: Duplicate prevention + T1 geometry fix (P1)
- [ ] Phase 17-S6: Time-decay geometry + adaptive partial scaling (P1)
- [ ] Phase 17-S7: Strategy pruning + ORB gate relaxation (P1)
- [ ] Phase 17-S8: VIX regime overlay (P2)
- [ ] Phase 17-S9: VWAP micro-filter (P2)
- [ ] Phase 17-S10: Day-of-week + GEX-adaptive stops (P2)
- [ ] Release gates: eslint clean, tsc clean, build succeeds, all E2E pass
- [ ] Replay validation: combined profile passes promotion gates
- [ ] Documentation: release notes + runbook + change control current
- [ ] Production deploy approval recorded

---

## 13. Appendix: Canonical Files

### Execution Pipeline
1. `backend/src/services/broker/tradier/executionEngine.ts`
2. `backend/src/services/broker/tradier/client.ts`
3. `backend/src/services/broker/tradier/orderRouter.ts`
4. `backend/src/services/spx/contractSelector.ts`
5. `backend/src/services/spx/executionReconciliation.ts`
6. `backend/src/services/spx/outcomeTracker.ts`
7. `backend/src/services/positions/brokerLedgerReconciliation.ts`
8. `backend/src/routes/spx.ts`

### New Services (Phase 17)
9. `backend/src/services/spx/executionStateStore.ts` (new)
10. `backend/src/services/broker/tradier/orderLifecycleManager.ts` (new)
11. `backend/src/workers/autoFlattenJob.ts` (new)
12. `backend/src/services/spx/pdtTracker.ts` (new)
13. `backend/src/services/spx/vwapService.ts` (new)
14. `backend/src/services/spx/calendarService.ts` (new)

### Strategy Engine
15. `backend/src/services/spx/setupDetector.ts`
16. `backend/src/services/spx/optimizer.ts`
17. `lib/spx/engine.ts`
18. `lib/spx/decision-engine.ts`

### Frontend
19. `components/spx-command-center/broker-tab.tsx`
20. `components/spx-command-center/kill-switch-button.tsx`
21. `components/spx-command-center/broker-safety-controls.tsx`
22. `components/spx-command-center/broker-position-monitor.tsx`
23. `hooks/use-tradier-broker.ts`
24. `hooks/use-spx-optimizer.ts`

### Migrations
25. `supabase/migrations/YYYYMMDDHHMMSS_create_spx_execution_active_states.sql` (new)

---

## 14. Multi-Agent Assignment Matrix

| Slice | Primary Agent | Support Agent | Review Agent |
|-------|--------------|---------------|--------------|
| S1: State persistence | Backend Agent | Database Agent | QA Agent |
| S2: Kill switch v2 | Backend Agent | Frontend Agent | QA Agent |
| S3: Order polling | Backend Agent | — | QA Agent |
| S4: Auto-flatten + PDT | Backend Agent | Frontend Agent | QA Agent |
| S5: Duplicate + T1 fix | Backend Agent | Database Agent | QA Agent |
| S6: Time-decay geometry | SPX Engine Agent | Backend Agent | QA Agent |
| S7: Strategy pruning | SPX Engine Agent | Backend Agent | QA Agent |
| S8: VIX overlay | SPX Engine Agent | Backend Agent | QA Agent |
| S9: VWAP filter | SPX Engine Agent | Backend Agent | QA Agent |
| S10: Day/GEX filters | SPX Engine Agent | Backend Agent | QA Agent |
| Replay validation | QA Agent | SPX Engine Agent | Orchestrator |
| Documentation | Docs Agent | — | Orchestrator |

---

## 15. Autonomous Documentation Packet

1. `docs/specs/SPX_COMMAND_CENTER_PHASE17_EXECUTION_SPEC_2026-02-23.md` (this file)
2. `docs/specs/spx-phase17-autonomous-2026-02-23/06_CHANGE_CONTROL_AND_PR_STANDARD.md` (create at phase start)
3. `docs/specs/spx-phase17-autonomous-2026-02-23/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md` (create at phase start)
4. `docs/specs/spx-phase17-autonomous-2026-02-23/08_AUTONOMOUS_EXECUTION_TRACKER.md` (create at phase start)
5. `docs/specs/SPX_COMMAND_CENTER_PHASE17_RELEASE_NOTES_2026-02-23.md` (update per slice)
6. `docs/specs/SPX_COMMAND_CENTER_PHASE17_RUNBOOK_2026-02-23.md` (update per slice)

---

## 16. Reference Documents

- `SPX_E2E_CONTRACT_EXECUTION_AUDIT_2026-02-23.md` — 7 findings, severity-ranked
- `SPX_STRATEGY_OPTIMIZATION_RESEARCH_2026-02-23.md` — 8 evidence-backed optimizations
- `SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md` — Current optimizer baseline
- `SPX_COMMAND_CENTER_PRODUCTION_RECOVERY_EXECUTION_SPEC_2026-02-20.md` — Phase 12-16 precedent
