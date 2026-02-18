# SPX Setup Detection Production Spec

**Date:** February 18, 2026  
**Branch:** `codex/spx-setup-detection-spec`  
**Scope:** Setup relevance, invalidation, ranking, tick-aware triggering, contract quality, SPY impact clarity, and production monitoring.

## 1. Executive Decisions

1. Surface a maximum of **2 sniper setups** at once by default.
2. Default chart timeframe to **1-minute** on every load.
3. Use a strict lifecycle state machine so stale setups auto-expire.
4. Rank by **Expected Value (EV)** and calibrated probability, not raw confidence only.
5. Add explicit **In-Trade Hyper Focus** mode to narrow feed, coach, and metrics to the entered setup.
6. Add contract health score and top alternatives so contract quality is transparent.
7. Add SPY-to-SPX impact conversion in points so SPY levels become actionable.

## 2. Detection Objectives

- Prevent setup feed bloat and stale signal accumulation.
- Keep bullish/bearish setup counts regime-aware and practical.
- Align chart, setup card, and trigger state off one realtime source of truth.
- Deliver TradingView-like responsiveness without sacrificing determinism.

## 3. Data Inputs (Massive + Existing Stack)

- Tick stream for SPX and SPY (`trade/quote` normalized).
- 1m/5m historical bars for structure and features.
- Options flow aggregates (premium, side, strike, recency).
- GEX surfaces and key walls/flip estimates.
- Existing internal setup context (confluence, levels, probabilities, coach context).

## 4. Setup Lifecycle State Machine

States:
- `forming`
- `ready`
- `triggered`
- `in_trade`
- `closed`
- `invalidated`

Transition gates:
- `forming -> ready`
  - Confluence score >= 3/5
  - Entry distance <= `0.35 * ATR(1m,14)`
  - Regime alignment >= 0.55
- `ready -> triggered`
  - Price enters entry zone
  - Tick confirmer passes: either `2 of last 3 one-second bars` in setup direction or `3 aligned ticks within 2s`
- `triggered -> in_trade`
  - User selects `Enter Trade Focus` (manual execution intent)
- `ready|triggered -> invalidated`
  - Stop breached with confirmation (`2 consecutive 1s closes` beyond stop buffer)
  - Regime confidence falls below 0.45 for setup direction
  - Opposing flow premium share > 65% over rolling 5m
  - Setup TTL exceeded

TTL defaults:
- `forming`: 20 minutes max
- `ready`: 25 minutes max
- `triggered`: 90 minutes max unless in-trade

## 5. Regime-Aware Detection and Scoring

### 5.1 Feature Buckets

- `structure_quality` (level quality, compression/trend structure, rejection quality)
- `flow_alignment` (premium-weighted directional support)
- `gex_alignment` (supportive vs unstable context and wall proximity)
- `regime_alignment` (setup family fit to active regime)
- `proximity_urgency` (distance to entry and velocity into zone)
- `micro_trigger_quality` (tick-level confirmation quality)

### 5.2 Balanced Weights by Regime

Compression:
- structure 0.24
- flow 0.22
- gex 0.18
- regime 0.16
- proximity 0.12
- micro-trigger 0.08

Trending:
- structure 0.30
- flow 0.24
- regime 0.20
- gex 0.08
- proximity 0.10
- micro-trigger 0.08

Reversal:
- structure 0.22
- flow 0.20
- gex 0.20
- regime 0.18
- proximity 0.12
- micro-trigger 0.08

Raw score:

`score_raw = sum(weight_i * feature_i)`

Penalties:
- stale penalty (max -12)
- contradiction penalty (max -15)
- liquidity penalty (max -10 via contract health)

Final score:

`score = clamp(100 * score_raw - penalties, 0, 100)`

## 6. Actionability Tiers (Sniper Policy)

- `sniper_primary`:
  - score >= 78
  - calibrated win probability >= 0.58
  - EV >= +0.35R
- `sniper_secondary`:
  - score >= 72
  - calibrated win probability >= 0.54
  - EV >= +0.20R
- `watchlist`:
  - score 60-71
- `hidden`:
  - score < 60

UI policy:
- Show only top 2 (`sniper_primary` + `sniper_secondary`) by default.
- Everything else moves behind a collapsed queue.
- On compression regimes, hide opposite-direction setups unless they exceed score >= 82 with divergence override.

## 7. Probability and EV Model

### 7.1 Outcomes

Label each historical setup as:
- `T1_before_stop`
- `stop_before_T1`
- `timeout`
- `invalidated`

### 7.2 Calibrated Probability

- Train base classifier (gradient boosted trees or equivalent) on rolling history.
- Calibrate with isotonic regression by regime.
- Store `p_win_calibrated`.

### 7.3 Expected Value in R Units

`R_T1 = reward_to_T1 / risk_to_stop`  
`R_T2 = reward_to_T2 / risk_to_stop`  
`R_blended = 0.65 * R_T1 + 0.35 * R_T2`  
`EV_R = p_win_calibrated * R_blended - (1 - p_win_calibrated) * 1.0 - cost_R`

Promote setups by `EV_R` first, then by score.

## 8. Contract Quality and Alternatives

For each recommended contract and alternatives, compute:
- spread %
- mid quality score
- open interest/liquidity tier
- delta suitability for setup horizon
- theta burn risk (per 15m)
- IV sanity (relative to recent realized vol)

Contract Health Score (0-100):

`health = 100 - spread_penalty - liquidity_penalty - theta_penalty - iv_penalty`

Default thresholds:
- Green: >= 75
- Amber: 55-74
- Red: < 55

Return:
- best contract
- 2 alternatives (`tighter`, `safer`, `higher_conviction`) with explicit tradeoffs.

## 9. SPY to SPX Impact Model

For each relevant SPY level:

`beta_t = cov(ret_spx_1m, ret_spy_1m, 30m) / var(ret_spy_1m, 30m)`  
`delta_spy = spy_level - spy_last`  
`impact_spx_pts = beta_t * (delta_spy / spy_last) * spx_last`  
`projected_spx = spx_last + impact_spx_pts`

Display:
- SPY level
- projected SPX level
- impact in SPX points
- confidence band from rolling correlation stability

This replaces ambiguous “derived levels” messaging with point-impact language.

## 10. Realtime Consistency Contract

- Single price authority: tick-normalized last trade.
- Microbar aggregator builds 1s/5s bars from ticks.
- 1m chart bars roll from microbars and remain default view.
- Setup transitions consume same normalized stream as chart overlays.

Consistency SLO:
- absolute mismatch between chart last price and setup engine price <= 0.25 SPX points (p95).

## 11. Hyper Focus Mode (User “Take Setup”)

When user enters a setup:
- Feed locks to that setup + one hedge candidate max.
- Coach auto-scopes to that setup context.
- Dashboard shows live trade scorecard:
  - entry
  - live PnL (points and estimated contract PnL)
  - stop distance
  - target progress
  - exit playbook state

Exit conditions:
- user exits focus
- setup closed
- setup invalidated

## 12. Monitoring, Drift, and Retraining

Primary KPIs:
- Precision@1 (top setup outcome)
- EV realized per focused trade
- Trigger-to-price lag (ms)
- Invalidation correctness rate
- Coach action acknowledgment rate
- Contract fill-quality proxy (spread at signal vs subsequent)

Reliability SLOs:
- tick-or-fallback feed availability >= 99.5% during session
- p95 tick-to-client latency < 500ms
- p95 setup transition publish < 1s from confirming tick

Drift monitors:
- live win-rate deviation vs expected (by regime)
- calibration error (ECE) weekly
- feature drift on flow and microstructure distributions

Retraining cadence:
- nightly incremental refresh
- weekly full recalibration
- emergency retrain on drift breach

## 13. Rollout Plan

Phase 1:
- Outcome labeling pipeline + EV calculation + top-2 surfacing.

Phase 2:
- Lifecycle invalidation + regime-specific weighting rollout.

Phase 3:
- Tick confirmer for `ready -> triggered` and realtime alignment checks.

Phase 4:
- Contract health + alternatives + SPY point-impact panel.

Phase 5:
- Drift dashboard and automated recalibration jobs.

## 14. Acceptance Criteria

- Setup list remains concise (max 2 surfaced by default).
- Stale setups auto-drop without manual refresh.
- Triggered setup aligns with chart price and updates in realtime.
- Coach gives setup-scoped guidance in hyper focus.
- Contract recommendation explains cost/health and alternatives clearly.
- SPY influence is shown in projected SPX points with confidence.

