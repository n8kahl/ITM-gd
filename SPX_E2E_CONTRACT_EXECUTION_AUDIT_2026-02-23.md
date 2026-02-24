# SPX Command Center — E2E Contract Selection & Execution Audit

**Date:** February 23, 2026
**Scope:** Full pipeline audit from setup detection through order execution and outcome resolution
**Severity Levels:** CRITICAL (production risk) | HIGH (functionality gap) | MEDIUM (reliability concern) | LOW (improvement opportunity)

---

## Executive Summary

The SPX Command Center has a **well-architected core pipeline** that flows cleanly from setup detection through contract selection, order routing, trade management, and outcome resolution. The contract selection algorithm is sophisticated, with regime-aware delta targeting, multi-factor scoring, health grading, and position sizing. The Tradier execution engine handles the full lifecycle: entry → T1 partial exit → runner stop → terminal exit.

However, the audit identified **7 critical/high-severity gaps** where the implementation is either missing, display-only, or relies on volatile in-memory state. These gaps create real production risk if the system moves from sandbox to live execution.

**Pipeline Completeness:**

| Stage | Status | Notes |
|-------|--------|-------|
| Setup detection & lifecycle | COMPLETE | Forming → ready → triggered → invalidated/expired |
| Contract selection & ranking | COMPLETE | 9-filter pipeline, regime-aware scoring, alternatives |
| Position sizing | COMPLETE | Risk-constrained (2% equity, 90% DTBP utilization) |
| Entry order routing | COMPLETE | Limit order with +$0.20 offset, Tradier API |
| T1 partial exit | COMPLETE | 65% sell-to-close limit at inferred target price |
| Runner stop (breakeven) | COMPLETE | Stop order at entry price for remaining 35% |
| Terminal exit (T2/stop) | COMPLETE | Market order for remaining quantity |
| Execution fill recording | COMPLETE | Supabase persistence with slippage tracking |
| Outcome resolution | COMPLETE | Strict second-bar backtest via Massive.com |
| Portfolio reconciliation | PARTIAL | Scheduled, not real-time |
| Order status monitoring | NOT IMPLEMENTED | Fire-and-forget after submission |
| Kill switch (order cancellation) | NOT IMPLEMENTED | Sets flag only, doesn't cancel open orders |
| Forced close at market close | NOT IMPLEMENTED | Display-only safety control |
| PDT rule enforcement | NOT IMPLEMENTED | Display-only safety control |
| Duplicate order prevention | PARTIAL | In-memory check, lost on restart |

---

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SETUP DETECTION LAYER                      │
│  setupDetector.ts → classifyRegime() → buildSetup()          │
│  States: forming → ready → triggered → invalidated/expired   │
│  Trigger: price enters entryZone (low ≤ price ≤ high)       │
└───────────────────────┬──────────────────────────────────────┘
                        │ setup.status === 'triggered'
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   CONTRACT SELECTION LAYER                     │
│  contractSelector.ts → filterCandidates() → scoreContract()  │
│  Inputs: setup direction, regime, type                       │
│  Outputs: ContractRecommendation + 3 alternatives + sizing   │
└───────────────────────┬──────────────────────────────────────┘
                        │ recommendation ready
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   EXECUTION ENGINE LAYER                      │
│  executionEngine.ts → handleTriggeredTransition()            │
│  → handleTarget1Transition() → handleTerminalTransition()    │
│  Tradier client.ts: placeOrder / cancelOrder / replaceOrder  │
└───────────────────────┬──────────────────────────────────────┘
                        │ fill events
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   RECONCILIATION LAYER                         │
│  executionReconciliation.ts → recordExecutionFill()          │
│  brokerLedgerReconciliation.ts → reconcileTradierBrokerLedger│
│  outcomeTracker.ts → spxResolveOutcomes.ts                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Contract Selection Deep Dive

### Filter Pipeline (9 stages, strict then relaxed fallback)

| # | Filter | Strict | Relaxed | Purpose |
|---|--------|--------|---------|---------|
| 1 | Option type | call/put by direction | same | Match setup direction |
| 2 | Quote validity | bid > 0, ask > bid | same | Reject stale/invalid quotes |
| 3 | Terminal 0-DTE | Block after 1 PM ET | same | Prevent expiry-day theta collapse |
| 4 | Delta range | 0.05–0.65 | 0.02–0.80 | Target probability band |
| 5 | Liquidity (OI) | ≥ 150 OI or ≥ 20 vol | ≥ 10 OI or ≥ 1 vol | Ensure executable |
| 6 | Spread % | ≤ 24% | ≤ 42% | Control execution cost |
| 7 | Late-day tightening | After 2 PM: ≤ 18%, ≤ $0.35, OI ≥ 250 | same | Protect against thin markets |
| 8 | Quote reliability | Bid-ask ratio checks | Relaxed thresholds | Reject suspicious pricing |
| 9 | Max debit | ≤ $2,500 | ≤ $3,500 | Cap per-contract risk |

### Scoring Model (100-point scale)

| Factor | Weight | Direction | Notes |
|--------|--------|-----------|-------|
| Delta distance | -45 max | Penalty | Distance from regime-adjusted target |
| Spread % | -35 max | Penalty | Normalized to MAX_SPREAD_PCT |
| Absolute spread | -10 max | Penalty | Raw dollar spread |
| Theta decay | -20 max | Penalty | Scaled by DTE-aware tolerance |
| Liquidity | +18 max | Bonus | log10(OI) + log10(volume) |
| Gamma | +10 max | Bonus | Acceleration potential |

### Delta Targets by Strategy × Regime

| Strategy | Base Delta | Ranging/Compression | Trending/Breakout |
|----------|-----------|--------------------|--------------------|
| fade_at_wall | 0.18 | 0.24 (+0.06) | 0.18 (unchanged) |
| mean_reversion | 0.22 | 0.28 (+0.06) | 0.22 (unchanged) |
| flip_reclaim | 0.24 | 0.30 (+0.06) | 0.24 (unchanged) |
| trend_pullback | 0.26 | 0.32 (+0.06) | 0.24 (-0.02) |
| breakout_vacuum | 0.28 | 0.34 (+0.06) | 0.24 (-0.04) |
| trend_continuation | 0.30 | 0.36 (+0.06) | 0.26 (-0.04) |
| orb_breakout | 0.32 | 0.38 (+0.06) | 0.28 (-0.04) |

### Contract Health Scoring

| Component | Max Penalty | Threshold |
|-----------|------------|-----------|
| Spread % | -45 pts | Normalized to 20% baseline |
| Liquidity | -25 pts | Below 70 liquidity score |
| Theta decay/15m | -20 pts | Theta * 100 / 26 normalized |
| IV premium | -10 pts | IV > 45% adds penalty |

Health tiers: **Green** (≥ 75) | **Amber** (≥ 55) | **Red** (< 55)

---

## Execution Engine Deep Dive

### Order Types Placed

| Phase | Order Type | Side | Pricing | Tag Pattern |
|-------|-----------|------|---------|-------------|
| Entry | Limit | buy_to_open | ask + $0.20 | `spx:{setupId}:{date}:entry` |
| T1 partial | Limit | sell_to_close | 1.35× entry estimate | `spx:{setupId}:{date}:t1` |
| Runner stop | Stop | sell_to_close | Entry price (breakeven) | `spx:{setupId}:{date}:runner_stop` |
| Terminal exit | Market | sell_to_close | Market | `spx:{setupId}:{date}:terminal` |

### State Machine (in-memory)

```
stateByUserSetup: Map<string, TradierExecutionState>

Key format: "{userId}:{setupId}:{sessionDate}"

TradierExecutionState = {
  userId, setupId, sessionDate,
  symbol,                      // OCC option symbol
  quantity,                    // Original entry quantity
  remainingQuantity,           // After T1 partial exit
  entryOrderId,                // Tradier order ID
  runnerStopOrderId,           // Tradier order ID (set after T1)
  entryLimitPrice,             // Entry price used
  updatedAt                    // ISO timestamp
}
```

### Sizing Logic

```
maxRiskDollars = totalEquity × 2%
contractsByRisk = floor(maxRiskDollars / (ask × 100))
contractsByBuyingPower = floor((DTBP × 90%) / (ask × 100))
quantity = min(contractsByRisk, contractsByBuyingPower)
```

### Safety Guards (Enforced)

| Guard | Implementation | Status |
|-------|---------------|--------|
| sell_to_open block | Throws error before API call | ENFORCED |
| SPX-only filter | Filters events to symbol === 'SPX' | ENFORCED |
| Active credentials check | Queries is_active=true from Supabase | ENFORCED |
| Auto-execute metadata check | Requires spx_auto_execute=true | ENFORCED |
| User whitelist | Optional EXECUTION_ALLOWED_USER_IDS env | ENFORCED |
| Sandbox default | TRADIER_EXECUTION_SANDBOX env | ENFORCED |

---

## Critical Findings

### FINDING 1: In-Memory Execution State — CRITICAL

**Location:** `executionEngine.ts` line 80
**Issue:** `stateByUserSetup` is a `Map<string, TradierExecutionState>` stored **only in process memory**. If the backend restarts (deploy, crash, OOM), all active execution states are lost.

**Impact:** After a restart mid-trade:
- T1 partial exits won't fire (no state to reference)
- Runner stops won't be placed after T1
- Terminal exits won't fire (no state to clean up)
- Open positions become orphaned with no management

**Recommendation:** Persist execution state to Supabase with a `spx_execution_active_states` table. On startup, rehydrate from the table and reconcile against Tradier's open order list.

---

### FINDING 2: Kill Switch Doesn't Cancel Orders — CRITICAL

**Location:** `spx.ts` lines 821-907
**Issue:** The kill switch sets `is_active=false` in `broker_credentials` and `spx_auto_execute=false` in metadata. However, it does **not** cancel any open orders via the Tradier API. A comment on line 883-885 acknowledges this.

**Impact:** If a runner stop order is live on Tradier and the kill switch is activated, the stop order **will still execute** because it lives on Tradier's servers, not ours. The kill switch only prevents *new* orders.

**Recommendation:** Add `tradier.cancelOrder()` calls for all active order IDs in `stateByUserSetup` during kill switch activation. Also add a Tradier `GET /accounts/{id}/orders` call to find any orders tagged with `spx:*` and cancel them.

---

### FINDING 3: No Order Status Polling — HIGH

**Location:** Entire execution engine
**Issue:** After placing an order via `tradier.placeOrder()`, the system records the returned `orderId` and `status` from the immediate response, but **never checks back** to see if the order actually filled, partially filled, or was rejected.

**Impact:**
- Entry order placed → marked as "routed" → may never fill if price moves away
- T1 order placed → may not execute if price touches T1 but doesn't fill the limit
- Runner stop placed → no confirmation it's actually active on Tradier's side
- Rejected orders silently fail

**Recommendation:** Implement an order status polling loop (every 5-10 seconds for active orders) using Tradier's `GET /accounts/{id}/orders/{orderId}` endpoint. Update execution state based on actual fill status. Alternatively, implement Tradier's streaming order events API.

---

### FINDING 4: Safety Controls Are Display-Only — HIGH

**Location:** `broker-safety-controls.tsx`
**Issue:** The safety controls component displays:
- "0DTE Auto-Flatten: Enforced" — **not enforced**
- "Flatten Window: 5 min before close" — **not implemented**
- "PDT Alert Threshold: 3 trades/day" — **not tracked or enforced**

These are static text labels with no backing logic.

**Impact:** Users may believe these protections are active when they are not. In live execution:
- Positions could be held through market close without automatic flattening
- PDT violations could occur without warning
- The "Enforced" label is misleading

**Recommendation:**
1. Implement a scheduled job (runs at 3:55 PM ET) that calls `tradier.placeOrder(market exit)` for all open SPX positions.
2. Track daily trade count per user in Supabase. Block execution when count >= 3 (or user's configured limit) unless account is PDT-eligible ($25k+ equity).
3. Change labels to reflect actual enforcement status.

---

### FINDING 5: No Partial Fill Handling — MEDIUM

**Location:** `executionEngine.ts` — all order handlers
**Issue:** The system assumes orders fill completely or not at all. The `quantity` field from the Tradier response is never checked against the requested quantity.

**Impact:** If an entry order for 5 contracts only fills 3:
- State records quantity as 5
- T1 partial exit calculates 65% of 5 = 3 contracts to sell
- But only 3 are actually held → attempting to sell 3 of 3 (100%) instead of 65%
- Runner stop is placed for remaining 2 contracts that don't exist

**Recommendation:** After each order placement, poll the order status to get `filled_quantity` vs `requested_quantity`. Update `stateByUserSetup.quantity` to reflect actual fills. Handle partial fills by adjusting downstream quantities proportionally.

---

### FINDING 6: Duplicate Order Race Condition — MEDIUM

**Location:** `executionEngine.ts` `handleTriggeredTransition()`
**Issue:** If the setup transition event fires twice rapidly (WebSocket reconnect, duplicate event), the handler checks `stateByUserSetup` for an existing key. However, two concurrent invocations could both find the key absent and both place entry orders before either writes to the map.

**Impact:** Double entry orders for the same setup, doubling intended position size.

**Recommendation:** Add a mutex/lock per setup key using a simple `Set<string>` of "in-flight" keys checked before processing. Or use Supabase's `INSERT ... ON CONFLICT` for the execution state to guarantee uniqueness at the database level.

---

### FINDING 7: T1 Target Price Inference Is Imprecise — LOW

**Location:** `executionEngine.ts` lines 369-374
**Issue:** The T1 limit exit price is calculated as `entryLimitPrice * 1.35` (hardcoded multiplier). This doesn't account for the actual T1 target from the setup geometry, which varies by strategy type and regime.

**Impact:** The actual T1 exit price may be significantly different from the setup's calculated T1 target, leading to premature exits (if 1.35× is too low for a wide-target strategy) or missed exits (if 1.35× is too high for a tight-target strategy like mean_reversion).

**Recommendation:** Pass the actual `setup.target1.price` through to the execution engine and use it (with the contract's delta/gamma) to calculate the expected option price at T1. Replace the 1.35× hardcode with `optionPriceAtT1 = mid + abs(delta) * moveToT1 + gamma * moveToT1²/2`.

---

## Supabase Tables Involved

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `spx_setup_instances` | Historical setup records | id, type, direction, entry_zone, stop, target1, target2, status, triggered_at, final_outcome, realized_r |
| `spx_setup_transitions` | State change events | event_id, setup_id, from_status, to_status, price, timestamp |
| `spx_setup_execution_fills` | Broker fill records | engine_setup_id, side, phase, fill_price, fill_qty, reference_price, slippage_points, broker_order_id |
| `broker_credentials` | Tradier connection | user_id, broker_name, account_id, access_token_ciphertext, is_active, metadata |
| `ai_coach_positions` | Position ledger | user_id, symbol, quantity, status, entry_price, close_price, pnl |

---

## Recommendations Priority Matrix

| Priority | Finding | Effort | Risk Reduction |
|----------|---------|--------|----------------|
| P0 | Persist execution state to Supabase (Finding 1) | Medium | Eliminates orphaned position risk on restart |
| P0 | Kill switch cancels active orders (Finding 2) | Low | True emergency stop capability |
| P1 | Order status polling loop (Finding 3) | Medium | Confirms fills, detects rejections |
| P1 | Implement 0DTE auto-flatten (Finding 4) | Medium | Prevents holding through close |
| P1 | PDT tracking and gating (Finding 4) | Low | Regulatory compliance |
| P2 | Partial fill handling (Finding 5) | Medium | Correct position sizing downstream |
| P2 | Duplicate order prevention mutex (Finding 6) | Low | Prevents double entries |
| P3 | T1 price inference from actual geometry (Finding 7) | Low | More accurate partial exits |

---

## What's Working Well

1. **Contract selection algorithm** is production-grade. The 9-filter pipeline with strict→relaxed fallback, regime-aware delta targeting, and multi-factor scoring is well-designed and thoroughly tested.

2. **Execution fill recording** with directional slippage computation is excellent for post-trade analysis. The reference price linkage to transition events enables precise slippage measurement.

3. **sell_to_open guard** is a hard block at the client level — this prevents the most dangerous category of execution error (naked selling).

4. **Alternative contract surfacing** with tagged tradeoffs (tighter/safer/higher_conviction) gives users meaningful choices beyond the primary recommendation.

5. **Position sizing** is conservative by default (2% risk, 90% DTBP) with dual constraints (risk AND buying power). This prevents overleveraging.

6. **Broker ledger reconciliation** catches drift between internal records and broker reality, force-closing orphaned positions.
