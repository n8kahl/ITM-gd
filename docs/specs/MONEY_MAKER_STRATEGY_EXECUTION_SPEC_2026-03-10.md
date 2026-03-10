# Money Maker Strategy — Execution Spec V1

> **Feature:** Money Maker Strategy Tab (Members Center)
> **Date:** 2026-03-10
> **Scope:** V1 — Signal Detection Engine + Multi-Symbol Alert Grid
> **Goal:** Deliver precise, fool-proof KCU patience candle detection across 4-5 user-selected symbols with ranked alerts, before building the in-trade experience.

---

## 1. Objective

Build a new `/members/money-maker-strategy` tab that monitors 4-5 symbols in real-time and fires precise alerts when a **patience candle forms at a 2+ level confluence zone** with valid R:R (≥2:1). V1 focuses exclusively on **detection accuracy** — getting the signals right before layering on the immersive trading experience.

### V1 Delivers:
- Multi-symbol grid (4-5 user-selected symbols with smart defaults)
- Real-time indicator computation per symbol (VWAP, 8 EMA, 21 EMA, 200 SMA, ORB, open price, hourly levels, Fibonacci)
- Patience candle detection algorithm with configurable thresholds
- Confluence zone detection (King & Queen + all KCU strategies)
- ORB trend/chop regime classification
- Time-of-day strategy gating
- R:R calculation with 2:1 minimum filter
- Ranked signal alerts with full "WHY" transparency
- Signal history logging to Supabase

### V2 (Future):
- Immersive in-trade experience with live P&L
- Options chain integration with contract recommendations
- Rolling/partial profit management
- AI Coach integration
- Backtesting module

---

## 2. Architecture

### 2.1 Reuse from SPX Command Center

| Component | SPX CC Source | Money Maker Usage |
|-----------|-------------|-------------------|
| Context pattern | `SPXCommandCenterContext.tsx` (5 sub-contexts) | Same pattern: 4 sub-contexts (SymbolGrid, Indicators, Signals, UI) |
| WebSocket stream | `massiveTickStream.ts` → `tickCache.ts` | Subscribe additional symbols to existing stream |
| Confluence scoring | `lib/spx/engine.ts` → `buildClusterZones()` | Adapt for KCU level sources (VWAP, EMA, ORB, etc.) |
| Setup lifecycle | `setupDetector.ts` (forming → ready → triggered) | Adapt for patience candle lifecycle |
| Shell pattern | `spx-command-center-shell-containers.tsx` | Replicate for desktop/mobile containers |
| Design system | glass-card-heavy, Emerald/Champagne, dark mode | Identical |
| Auth | `MemberAuthProvider` wrapper | Identical |
| Telemetry | `lib/spx/telemetry.ts` | Reuse for signal event tracking |

### 2.2 Net-New

| Component | Purpose |
|-----------|---------|
| Patience candle detector | Algorithmic hammer/inverted-hammer detection with strict thresholds |
| Per-symbol indicator engine | Compute all KCU indicators independently per watched symbol |
| KCU strategy router | Time-of-day gating, regime filtering, strategy classification |
| ORB calculator | First 15-min range per symbol, trend/chop classification |
| Multi-symbol grid UI | 4-5 card layout with real-time updates and alert states |
| Signal ranker | Rank alerts by confluence strength + R:R quality |
| Watchlist management | User-selected symbols with Supabase persistence |

---

## 3. Data Flow

```
Massive.com WebSocket
  │
  ▼
massiveTickStream.ts ─── subscribes to user's 4-5 symbols
  │
  ▼
tickCache.ts ─── stores latest bars per symbol
  │
  ▼
GET /api/money-maker/snapshot (polled every 5s)
  │
  ├─► symbolIndicatorEngine.ts ─── computes per-symbol:
  │     VWAP + band, 8 EMA, 21 EMA, 200 SMA, ORB, open price,
  │     hourly levels, Fibonacci (0.236, 0.382)
  │
  ├─► orbCalculator.ts ─── per-symbol regime: 'trending' | 'choppy'
  │
  ├─► confluenceDetector.ts ─── clusters levels within tolerance,
  │     scores confluence 0-5, filters minimum 2 levels
  │
  ├─► patienceCandleDetector.ts ─── on each completed bar:
  │     detects hammer/inverted-hammer at confluence zones
  │
  ├─► kcuStrategyGate.ts ─── filters by time-of-day + regime
  │
  └─► signalRanker.ts ─── ranks valid signals, returns top alerts
  │
  ▼
Frontend MoneyMakerContext
  │
  ├─► SymbolGridContext ─── 4-5 symbols, prices, regimes
  ├─► IndicatorContext ─── per-symbol indicator values
  ├─► SignalContext ─── ranked alerts, forming setups
  └─► UIContext ─── selected symbol, overlay prefs
  │
  ▼
Symbol Grid Cards ─── real-time price, regime badge, forming/alert state
```

---

## 4. Patience Candle Detection — Precise Specification

### 4.1 Candle Anatomy

```
         ┌─── Upper Wick ───┐
    high ─┤                  │
         │                  │
         ├─── Body Top ─────┤ ← max(open, close)
         │    (body)        │
         ├─── Body Bottom ──┤ ← min(open, close)
         │                  │
    low  ─┤                  │
         └─── Lower Wick ───┘
```

### 4.2 Detection Rules

**Bullish Patience Candle (Hammer) — for CALL setups:**

| Metric | Rule | Rationale |
|--------|------|-----------|
| Body-to-Range Ratio | `bodySize / range ≤ 0.35` | Small body = indecision resolved |
| Lower Wick | `lowerWick ≥ range × 0.50` | Buyers rejected lower prices aggressively |
| Upper Wick | `upperWick ≤ range × 0.15` | Minimal selling pressure at top |
| At Level | Candle low within band tolerance of a confluence zone | Must be AT a key level |
| Volume | `volume ≥ avgVolume × 0.5` | Not a ghost candle |

**Bearish Patience Candle (Inverted Hammer) — for PUT setups:**

| Metric | Rule | Rationale |
|--------|------|-----------|
| Body-to-Range Ratio | `bodySize / range ≤ 0.35` | Small body = indecision resolved |
| Upper Wick | `upperWick ≥ range × 0.50` | Sellers rejected higher prices aggressively |
| Lower Wick | `lowerWick ≤ range × 0.15` | Minimal buying pressure at bottom |
| At Level | Candle high within band tolerance of a confluence zone | Must be AT a key level |
| Volume | `volume ≥ avgVolume × 0.5` | Not a ghost candle |

**Additional Context Rules:**

| Rule | Description |
|------|-------------|
| Preceding Trend | ≥3 candles in one direction before the patience candle (trend must exist) |
| Relative Size | Patience candle range ≤ 75% of the average range of the preceding 5 candles |
| Structure Intact | Higher lows still intact (uptrend) or lower highs intact (downtrend) |
| Not Exhaustion | Don't fire on the 1st candle of the day (need context) |

### 4.3 VWAP Band Tolerance (Dynamic by Price)

| Symbol Price Range | Band Tolerance |
|-------------------|----------------|
| $20–$80 | ±$0.10 |
| $80–$100 | ±$0.20 |
| $100–$300 | ±$0.30 |
| $300–$500 | ±$0.50 |
| $500–$2,000 | ±$1.00 |
| $2,000+ (SPX) | ±$2.00 |

### 4.4 Level Proximity Tolerance (for confluence detection)

| Timeframe | Tolerance |
|-----------|-----------|
| 2-min bars | ±0.15% of price |
| 5-min bars | ±0.20% of price |
| 10-min bars | ±0.25% of price |

This scales with stock price automatically — $0.20 tolerance on a $100 stock, $1.00 on a $500 stock.

### 4.5 Configurable Thresholds

All detection thresholds are stored in a configuration object (not hardcoded) so we can tune via backtesting:

```typescript
export interface PatienceCandleConfig {
  maxBodyToRangeRatio: number      // default: 0.35
  minDominantWickRatio: number     // default: 0.50
  maxOpposingWickRatio: number     // default: 0.15
  minVolumeRatio: number           // default: 0.50
  minPrecedingTrendBars: number    // default: 3
  maxRelativeRangeRatio: number    // default: 0.75
  levelProximityPercent: number    // default: 0.20 (0.20% of price)
}

export const DEFAULT_CONFIG: PatienceCandleConfig = {
  maxBodyToRangeRatio: 0.35,
  minDominantWickRatio: 0.50,
  maxOpposingWickRatio: 0.15,
  minVolumeRatio: 0.50,
  minPrecedingTrendBars: 3,
  maxRelativeRangeRatio: 0.75,
  levelProximityPercent: 0.20,
}
```

---

## 5. Confluence Detection — Precise Specification

### 5.1 Level Sources (computed per symbol)

| Source | Computation | Strength Weight |
|--------|-------------|-----------------|
| VWAP | Cumulative (P×V)/V, resets daily | 1.5× (King) |
| 8 EMA | EMA(close, 8) on current timeframe | 1.2× |
| 21 EMA | EMA(close, 21) on current timeframe | 1.0× |
| 200 SMA | SMA(close, 200) on current timeframe | 1.3× |
| ORB High | Max high of first 3 five-min bars | 1.2× |
| ORB Low | Min low of first 3 five-min bars | 1.2× |
| Open Price | First trade price of session | 1.0× |
| Hourly S/R | Swing highs/lows on 1-hour chart (last 5 days) | 1.4× |
| Fib 0.236 | 23.6% retracement of previous day range | 1.1× |
| Fib 0.382 | 38.2% retracement of previous day range | 1.1× |

### 5.2 Confluence Scoring

Levels within the proximity tolerance are clustered into zones:

```
Confluence Score = Σ(weight) for all levels in the zone

Score < 2.0  →  NO SIGNAL (filtered out)
Score 2.0–2.9  →  "Moderate" confluence (2 standard levels)
Score 3.0–3.9  →  "Strong" confluence (VWAP + 1-2 levels, or 3 standard)
Score 4.0–5.0  →  "Fortress" confluence (VWAP + 2+ strong levels)
```

**Minimum for signal: Score ≥ 2.0 (at least 2 levels overlapping)**

### 5.3 King & Queen Detection

A specific sub-check: if VWAP is one of the levels in the confluence zone, the signal is classified as "King & Queen" setup (highest confidence strategy).

---

## 6. Strategy Classification & Time Gating

### 6.1 Strategy Assignment

| If Confluence Contains... | And Time Is... | And Regime Is... | → Strategy |
|--------------------------|----------------|------------------|------------|
| VWAP + any other level | 9:40+ ET | Any | **King & Queen** |
| 8 EMA (steep trend) | 9:30+ ET | Trending | **EMA Bounce** |
| VWAP zone (no other level) | 10:00+ ET | Trending | **VWAP Strategy** |
| VWAP cross from below | 10:00+ ET | Any | **Advanced VWAP** |
| Ripster Cloud zone | 1:00–3:00 PM ET | Trending (morning) | **Cloud Strategy** |
| Fib level + hourly/EMA | 9:30+ ET | Trending (prev day) | **Fib Bounce/Reject** |

### 6.2 Hard Blocks

- **Before 9:35 ET:** No signals (ORB still forming)
- **After 3:00 PM ET:** All signals blocked
- **Choppy regime + no VWAP in confluence:** Signal suppressed (only K&Q works in chop)
- **R:R < 2.0:** Signal filtered regardless of confluence

### 6.3 ORB Regime Classification

```
orbHigh = max(high) of bars from 9:30:00 to 9:44:59 ET
orbLow  = min(low) of bars from 9:30:00 to 9:44:59 ET
orbRange = orbHigh - orbLow

If currentPrice > orbHigh:  regime = 'trending_up'
If currentPrice < orbLow:   regime = 'trending_down'
Otherwise:                  regime = 'choppy'

// Regime re-evaluated on every bar close (not cached)
```

---

## 7. Signal Output Format

Each fired signal contains full transparency — the user sees exactly WHY:

```typescript
interface MoneyMakerSignal {
  id: string
  symbol: string
  timestamp: number

  // What strategy?
  strategyType: KCUStrategyType
  strategyLabel: string          // "King & Queen", "EMA Bounce", etc.

  // What's the setup?
  direction: 'long' | 'short'
  patienceCandle: {
    pattern: 'hammer' | 'inverted_hammer'
    bar: CandleBar               // The actual candle
    bodyToRangeRatio: number
    dominantWickRatio: number
    timeframe: '2m' | '5m' | '10m'
  }

  // Where are the levels?
  confluenceZone: {
    priceLow: number
    priceHigh: number
    score: number                // 2.0–5.0
    label: 'moderate' | 'strong' | 'fortress'
    levels: Array<{
      source: string             // "VWAP", "8 EMA", "Hourly 242.50", etc.
      price: number
      weight: number
    }>
    isKingQueen: boolean         // VWAP present in zone?
  }

  // What's the trade?
  entry: number                  // Break of patience candle in trend direction
  stop: number                   // Other side of patience candle
  target: number                 // Next hourly level
  riskRewardRatio: number        // Must be ≥ 2.0

  // What's the context?
  orbRegime: 'trending_up' | 'trending_down' | 'choppy'
  trendStrength: number          // 0-100 based on preceding trend bars
  signalRank: number             // 1 = best signal across all symbols

  // Lifecycle
  status: 'forming' | 'ready' | 'expired'
  ttlSeconds: number             // Auto-expire after N seconds
  expiresAt: number
}
```

---

## 8. R:R Calculation

```
For LONG (call) setups:
  entry  = patienceCandle.high + tick    (break above patience candle)
  stop   = patienceCandle.low - tick     (below patience candle low)
  target = nextHourlyResistance          (next level above entry)

For SHORT (put) setups:
  entry  = patienceCandle.low - tick     (break below patience candle)
  stop   = patienceCandle.high + tick    (above patience candle high)
  target = nextHourlySupport             (next level below entry)

risk   = |entry - stop|
reward = |target - entry|
R:R    = reward / risk

If R:R < 2.0 → signal NOT fired
```

"tick" = minimum price increment ($0.01 for stocks, $0.25 for SPX)

---

## 9. Database Schema

### 9.1 Tables

```sql
-- User watchlists (4-5 symbols per user)
CREATE TABLE money_maker_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol varchar(10) NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- Signal history (every fired signal, for audit & backtesting)
CREATE TABLE money_maker_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol varchar(10) NOT NULL,
  strategy_type varchar(30) NOT NULL,
  direction varchar(5) NOT NULL,
  patience_candle_pattern varchar(20) NOT NULL,
  patience_candle_timeframe varchar(5) NOT NULL,
  confluence_score numeric(3,1) NOT NULL,
  confluence_levels jsonb NOT NULL,       -- [{source, price, weight}]
  is_king_queen boolean NOT NULL DEFAULT false,
  entry_price numeric(10,2) NOT NULL,
  stop_price numeric(10,2) NOT NULL,
  target_price numeric(10,2) NOT NULL,
  risk_reward_ratio numeric(4,2) NOT NULL,
  orb_regime varchar(20) NOT NULL,
  signal_rank smallint,
  status varchar(15) NOT NULL DEFAULT 'ready',
  triggered_at timestamptz DEFAULT now(),
  expired_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Default watchlist symbols (smart defaults)
CREATE TABLE money_maker_default_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol varchar(10) NOT NULL UNIQUE,
  display_name varchar(50) NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Seed smart defaults
INSERT INTO money_maker_default_symbols (symbol, display_name, display_order) VALUES
  ('SPY', 'S&P 500 ETF', 1),
  ('TSLA', 'Tesla', 2),
  ('AAPL', 'Apple', 3),
  ('NVDA', 'NVIDIA', 4),
  ('META', 'Meta Platforms', 5);
```

### 9.2 RLS Policies

```sql
ALTER TABLE money_maker_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_maker_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist"
  ON money_maker_watchlists FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own signals"
  ON money_maker_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts signals"
  ON money_maker_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Default symbols readable by all authenticated users
ALTER TABLE money_maker_default_symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read defaults"
  ON money_maker_default_symbols FOR SELECT
  USING (auth.role() = 'authenticated');
```

### 9.3 Indexes

```sql
CREATE INDEX idx_mm_watchlists_user ON money_maker_watchlists(user_id) WHERE is_active = true;
CREATE INDEX idx_mm_signals_user_time ON money_maker_signals(user_id, triggered_at DESC);
CREATE INDEX idx_mm_signals_symbol_time ON money_maker_signals(symbol, triggered_at DESC);
```

---

## 10. File Structure

### New Files

```
lib/money-maker/
  types.ts                           # All TypeScript interfaces
  patience-candle-detector.ts        # Core detection algorithm
  confluence-detector.ts             # Level clustering + scoring
  kcu-strategy-router.ts             # Strategy classification + time gating
  orb-calculator.ts                  # ORB high/low + regime
  signal-ranker.ts                   # Rank + quality gate filtering
  indicator-computer.ts              # Compute all indicators from bars
  rr-calculator.ts                   # Entry/stop/target + R:R
  __tests__/
    patience-candle-detector.test.ts # 50+ test cases
    confluence-detector.test.ts      # Clustering + scoring tests
    kcu-strategy-router.test.ts      # Time gating + regime tests
    orb-calculator.test.ts           # ORB computation tests
    signal-ranker.test.ts            # Ranking + filtering tests
    rr-calculator.test.ts            # R:R edge cases

backend/src/routes/
  money-maker.ts                     # REST endpoints

backend/src/services/money-maker/
  snapshotBuilder.ts                 # Assembles full snapshot per user
  symbolDataFetcher.ts               # Fetches bars from Massive.com per symbol
  index.ts                           # Service barrel export

contexts/
  MoneyMakerContext.tsx              # Root provider (4 sub-contexts)
  money-maker/
    SymbolGridContext.tsx            # Symbols, prices, regimes
    IndicatorContext.tsx             # Per-symbol indicator values
    SignalContext.tsx                # Alerts, forming setups
    UIContext.tsx                    # View mode, overlay preferences

app/members/money-maker-strategy/
  page.tsx                          # Route entry point
  loading.tsx                       # Skeleton loader

components/money-maker-strategy/
  money-maker-shell.tsx             # Desktop/mobile container
  symbol-grid.tsx                   # 4-5 card grid layout
  symbol-card.tsx                   # Individual symbol card
  signal-alert-overlay.tsx          # Alert detail panel
  regime-badge.tsx                  # ORB trending/choppy indicator
  confluence-indicator.tsx          # Visual confluence score
  strategy-badge.tsx                # "King & Queen", "EMA Bounce", etc.
  rr-display.tsx                    # Risk:reward ratio display
  signal-why-panel.tsx              # Full "WHY" transparency panel
  watchlist-manager.tsx             # Add/remove/reorder symbols
  active-strategies-clock.tsx       # Which strategies are live now

hooks/
  use-money-maker-controller.ts     # Main orchestrator
  use-money-maker-snapshot.ts       # Polls backend snapshot
  use-watchlist.ts                  # Watchlist CRUD

e2e/specs/members/
  money-maker-strategy-grid.spec.ts
  money-maker-strategy-signals.spec.ts
  money-maker-strategy-test-helpers.ts

supabase/migrations/
  YYYYMMDD_create_money_maker_tables.sql
```

### Files to Modify

```
backend/src/routes/index.ts          # Register money-maker routes
app/members/layout.tsx               # (if tab registration needed)
```

---

## 11. Phased Delivery Plan

### Phase 1: Detection Engine Core (Pure Logic + Tests)

All `lib/money-maker/` files — pure TypeScript functions with zero dependencies on React, Express, or Supabase. Fully unit-testable in isolation.

**Slice 1.1:** Types + Patience Candle Detector + 50 unit tests
**Slice 1.2:** Indicator Computer (VWAP, EMAs, SMA from bar arrays)
**Slice 1.3:** ORB Calculator + regime classification + tests
**Slice 1.4:** Confluence Detector (clustering, scoring, minimum filter) + tests
**Slice 1.5:** KCU Strategy Router (time gating, regime checks) + tests
**Slice 1.6:** R:R Calculator + Signal Ranker + quality gates + tests

**Gate:** `pnpm vitest run lib/money-maker/__tests__/` — all green, 100% coverage on core algorithms.

### Phase 2: Database + Backend API

**Slice 2.1:** Supabase migration (tables, RLS, indexes, seed data)
**Slice 2.2:** Backend symbol data fetcher (Massive.com bars per symbol)
**Slice 2.3:** Backend snapshot builder (assembles indicators + signals)
**Slice 2.4:** REST routes (GET /snapshot, GET/POST /watchlist)
**Slice 2.5:** Backend integration tests

**Gate:** `npm --prefix backend test -- --runInBand money-maker` — all green.

### Phase 3: Frontend Shell + Grid

**Slice 3.1:** MoneyMakerContext + 4 sub-contexts
**Slice 3.2:** Page route + shell containers + skeleton loader
**Slice 3.3:** Symbol grid layout (4-5 cards, responsive)
**Slice 3.4:** Symbol card (price, regime badge, indicator summary)
**Slice 3.5:** Watchlist manager (search, add, remove, reorder, smart defaults)
**Slice 3.6:** Snapshot polling hook + context hydration

**Gate:** `pnpm exec tsc --noEmit && pnpm exec eslint app/members/money-maker-strategy/ components/money-maker-strategy/ contexts/money-maker/`

### Phase 4: Signal Alerts + WHY Panel

**Slice 4.1:** Signal alert overlay (emerald pulse/glow on card)
**Slice 4.2:** Strategy badge + confluence indicator + R:R display
**Slice 4.3:** Signal WHY panel (full transparency: levels, candle metrics, strategy)
**Slice 4.4:** Active strategies clock (what's live now)
**Slice 4.5:** Signal history logging to Supabase

**Gate:** Full E2E: `pnpm exec playwright test e2e/specs/members/money-maker-strategy-*.spec.ts --project=chromium --workers=1`

### Phase 5: Polish + Hardening

**Slice 5.1:** Sound/visual notification on new signal
**Slice 5.2:** Mobile responsive layout
**Slice 5.3:** Performance audit (bundle size, render perf)
**Slice 5.4:** A11y audit
**Slice 5.5:** Documentation (runbook, release notes)

---

## 12. Acceptance Criteria

### Detection Precision
- [ ] Patience candle fires ONLY when all metrics pass (body ratio, wick ratios, volume, level proximity)
- [ ] No signal without ≥2 levels in confluence (minimum score 2.0)
- [ ] No signal with R:R < 2.0
- [ ] No signal before 9:35 ET or after 3:00 PM ET
- [ ] ORB regime recalculated on every bar (not cached)
- [ ] VWAP band tolerance scales dynamically with stock price
- [ ] King & Queen correctly identified when VWAP is in the confluence zone

### Grid Experience
- [ ] 4-5 symbols display simultaneously with real-time price updates
- [ ] User can add/remove/reorder symbols (persisted to Supabase)
- [ ] Smart defaults populated for new users (SPY, TSLA, AAPL, NVDA, META)
- [ ] Regime badge shows trending/choppy per symbol
- [ ] Cards pulse emerald when a signal fires
- [ ] Signal WHY panel shows every level, the candle pattern, strategy type, R:R

### Quality Gates
- [ ] 100% unit test coverage on all `lib/money-maker/` modules
- [ ] TypeScript strict: zero `any` types
- [ ] ESLint: zero warnings in touched files
- [ ] Build passes: `pnpm run build`
- [ ] E2E: all targeted specs pass
- [ ] A11y: no critical axe-core violations
- [ ] Bundle increase < 30KB gzipped

---

## 13. Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Patience candle thresholds too loose → false signals | High | Start conservative (strict thresholds), tune with backtest data |
| Patience candle thresholds too strict → no signals | Medium | Configurable thresholds, A/B test multiple configs |
| Massive.com rate limits with 5 symbols | Medium | Batch bar requests, cache aggressively (10s TTL) |
| WebSocket subscription limit for multi-symbol | Low | Existing stream supports multi-symbol; test with 5 concurrent |
| ORB calculation wrong on early close / holiday | Low | Check market calendar, skip ORB on shortened days |
| Hourly levels stale or missing | Medium | Fall back to daily levels if hourly unavailable |
| Time zone bugs (DST transitions) | Medium | Use `America/New_York` explicitly everywhere, test DST edge |

---

## 14. Out of Scope (V1)

- In-trade immersive experience
- Options chain / contract recommendations
- Live P&L tracking
- Rolling / partial profit management
- AI Coach integration
- Backtesting / optimizer
- Level 2 / order book data
- Time & Sales analysis
- Chart with indicator overlays (V1 is grid-only, no embedded chart)
