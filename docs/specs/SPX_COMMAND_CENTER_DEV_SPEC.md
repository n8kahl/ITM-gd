**SPX COMMAND CENTER**

Full Development Specification

Autonomous Production Implementation Guide for Codex

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TradeITM \| The Emerald Standard

  --------------- -------------------------------------------------------------------
  **Property**    **Value**
  Version         1.0.0
  Date            2026-02-14
  Status          Spec Complete --- Ready for Implementation
  Route           /members/spx-command-center
  Tab ID          spx-command-center
  Required Tier   pro
  Stack           Next.js 16, TypeScript, Tailwind CSS 4, Supabase, Massive.com API
  --------------- -------------------------------------------------------------------

**Table of Contents**

1\. Executive Summary

2\. Architecture Overview

3\. Route & Navigation Integration

4\. Database Schema (Supabase Migrations)

5\. Backend API Routes

6\. Computation Engine Specifications

7\. AI Prediction Engine

8\. AI Coach Specification

9\. Frontend Component Architecture

10\. UI/UX Design Specification

11\. Brand Compliance Checklist

12\. Testing Strategy

13\. Implementation Order

14\. TypeScript Type Definitions

15\. Environment Variables

16\. Performance Requirements

17\. Error Handling & Resilience

18\. Acceptance Criteria

**1. Executive Summary**

The SPX Command Center is a dedicated real-time trading intelligence tab
within the TradeITM member center. It provides institutional-grade setup
detection, multi-time-frame level analysis, AI-driven predictions, and
real-time coaching for SPX/SPY traders. The system ingests the full
Massive.com data pipeline (options chains, flow, Greeks, OI, IV
surfaces) for both SPX and SPY, computes derived signals (GEX, DEX, Fib
levels, cluster scores), and presents actionable intelligence through a
polished terminal-aesthetic interface.

**1.1 Core Value Propositions**

-   Real-time Multi-Time-Frame Level Matrix with Cluster Scoring across
    5 independent level source categories

-   Automated Fibonacci retracement and extension computation across all
    timeframes with auto-detected swing points

-   SPY/SPX cross-reference engine fusing two independent options
    ecosystems into a unified gamma/level landscape

-   AI Prediction Engine providing continuous regime classification,
    directional probability, and move magnitude forecasting

-   AI Copilot Coach delivering pre-trade briefs, in-trade guidance,
    behavioral coaching, and post-trade reviews

-   Intelligent contract selection recommending optimal strikes/expiries
    based on setup type, GEX landscape, and risk parameters

-   Setup detection with confluence scoring (0-5 scale) fusing price
    action, options microstructure, flow, and levels

**1.2 Architecture Principle**

All Massive.com API calls route through the Express backend
(backend/src/) via NEXT\_PUBLIC\_AI\_COACH\_API\_URL. The Next.js
frontend NEVER calls api.massive.com directly. This ensures centralized
caching, rate limiting, and circuit breaker protection.

**2. Architecture Overview**

**2.1 System Diagram**

The SPX Command Center follows a layered architecture with clear
separation of concerns:

**Data Ingestion Layer (Backend)**

-   Massive.com REST API polling for options chains, aggregates, Greeks,
    IV

-   WebSocket price stream for real-time SPX/SPY tick data (existing
    infrastructure)

-   FRED API integration for macro context (VIX, yields, DXY)

-   Redis caching layer with TTL-based invalidation

**Computation Layer (Backend Services)**

-   GEX Engine: Computes net gamma exposure by strike from full options
    chain

-   MTF Level Engine: Aggregates structural, tactical, intraday, and
    options-derived levels

-   Fibonacci Engine: Auto-detects swing points and computes
    retracement/extension levels

-   SPY/SPX Cross-Reference: Maintains live basis, fuses gamma
    landscapes, correlates flow

-   Cluster Score Algorithm: Identifies level convergence zones and
    scores by source density

-   Setup Detection Engine: Pattern recognition against level zones +
    flow confirmation

-   AI Prediction Model: Regime classification, probability
    distributions, timing windows

**Presentation Layer (Next.js Frontend)**

-   SPX Command Center page component with resizable multi-panel layout

-   TradingView Lightweight Charts with custom level/zone overlays

-   Real-time setup cards with confluence scoring and lifecycle
    management

-   AI Coach sidebar with streaming SSE for live coaching messages

-   Contract selector with Greeks-aware recommendation engine

**2.2 Data Flow**

Massive.com API → Backend Services → Redis Cache → REST API + WebSocket
→ Next.js Frontend → React State → UI Components

**2.3 Key Dependencies**

  ------------------------ ---------------------------------------------- ---------------------------------------
  **Dependency**           **Purpose**                                    **Location**
  Massive.com REST API     Options chains, aggregates, Greeks, IV, flow   backend/src/config/massive.ts
  WebSocket Price Stream   Real-time SPX/SPY prices                       backend/src/services/websocket.ts
  Redis (Upstash)          Caching, rate limiting                         backend/src/config/redis.ts
  OpenAI GPT-4 Turbo       AI Coach reasoning, predictions                backend/src/chatkit/
  Supabase PostgreSQL      User state, tracked setups, alerts             supabase/migrations/
  Lightweight Charts       Charting with custom overlays                  components/ai-coach/trading-chart.tsx
  Framer Motion            Animations, transitions, layout                lib/motion-primitives.ts
  SWR                      Data fetching with revalidation                Frontend hooks
  ------------------------ ---------------------------------------------- ---------------------------------------

**3. Route & Navigation Integration**

**3.1 Route Configuration**

  ---------------- -------------------------------------------------------------------------------
  **Property**     **Value**
  Route Path       /members/spx-command-center
  Page File        app/members/spx-command-center/page.tsx
  Layout File      app/members/spx-command-center/layout.tsx (optional, inherits members layout)
  Tab ID           spx-command-center
  Tab Label        SPX Command Center
  Lucide Icon      Target (from lucide-react)
  Required Tier    pro
  Badge            { text: \"LIVE\", variant: \"emerald\" }
  Mobile Visible   true
  Sort Order       3 (after journal, before ai-coach)
  ---------------- -------------------------------------------------------------------------------

**3.2 Tab Configuration Migration**

Add entry to tab\_configurations table via Supabase migration:

> INSERT INTO tab\_configurations (
>
> tab\_id, label, icon, path, required\_tier,
>
> badge\_text, badge\_variant, description,
>
> mobile\_visible, sort\_order, is\_required, is\_active
>
> ) VALUES (
>
> \'spx-command-center\',
>
> \'SPX Command Center\',
>
> \'Target\',
>
> \'/members/spx-command-center\',
>
> \'pro\',
>
> \'LIVE\',
>
> \'emerald\',
>
> \'Real-time SPX trading intelligence with AI coaching\',
>
> true,
>
> 3,
>
> false,
>
> true
>
> );

**3.3 Navigation Integration**

Update lib/member-navigation.ts to include the new icon mapping:

> // Add to TAB\_ID\_ICON\_MAP
>
> \'spx-command-center\': Target, // from lucide-react

**4. Database Schema (Supabase Migrations)**

**4.1 spx\_levels Table**

Stores computed level data for caching and historical tracking.

  -------------- ---------------------------------------- --------------------------------------------------------------
  **Column**     **Type**                                 **Description**
  id             uuid (PK, default gen\_random\_uuid())   Primary key
  symbol         text NOT NULL                            SPX or SPY
  level\_type    text NOT NULL                            structural \| tactical \| intraday \| options \| fibonacci
  source         text NOT NULL                            e.g., weekly\_vwap, gex\_wall, fib\_618, pdh, spy\_gex\_wall
  price          numeric(12,2) NOT NULL                   Level price value
  strength       text                                     strong \| moderate \| weak \| dynamic \| critical
  timeframe      text                                     monthly \| weekly \| daily \| intraday \| 0dte
  metadata       jsonb DEFAULT \'{}\'                     Source-specific data (GEX value, fib ratio, OI, etc.)
  valid\_from    timestamptz NOT NULL DEFAULT now()       When this level became active
  valid\_until   timestamptz                              When this level expired (null = active)
  created\_at    timestamptz DEFAULT now()                Record creation time
  -------------- ---------------------------------------- --------------------------------------------------------------

**4.2 spx\_cluster\_zones Table**

Stores identified cluster zones where multiple independent levels
converge.

  ------------------- ------------------------------------- ----------------------------------------------
  **Column**          **Type**                              **Description**
  id                  uuid (PK)                             Primary key
  price\_low          numeric(12,2) NOT NULL                Zone lower bound
  price\_high         numeric(12,2) NOT NULL                Zone upper bound
  cluster\_score      integer NOT NULL                      Number of independent sources (1-7+)
  source\_breakdown   jsonb NOT NULL                        Array of { source, type, price, instrument }
  zone\_type          text                                  fortress \| defended \| moderate \| minor
  test\_count         integer DEFAULT 0                     Times price has tested this zone today
  last\_test\_at      timestamptz                           Most recent test timestamp
  held                boolean                               Whether zone held on last test
  hold\_rate          numeric(5,2)                          Historical hold percentage
  is\_active          boolean DEFAULT true                  Currently active zone
  session\_date       date NOT NULL DEFAULT CURRENT\_DATE   Trading session date
  created\_at         timestamptz DEFAULT now()             Record creation time
  ------------------- ------------------------------------- ----------------------------------------------

**4.3 spx\_setups Table**

Stores detected trade setups with confluence scoring and lifecycle
state.

  ----------------------- ----------------------------------------- ------------------------------------------------------------------------------
  **Column**              **Type**                                  **Description**
  id                      uuid (PK)                                 Primary key
  setup\_type             text NOT NULL                             fade\_at\_wall \| breakout\_vacuum \| mean\_reversion \| trend\_continuation
  direction               text NOT NULL                             bullish \| bearish
  entry\_zone\_low        numeric(12,2)                             Suggested entry zone lower bound
  entry\_zone\_high       numeric(12,2)                             Suggested entry zone upper bound
  stop\_price             numeric(12,2)                             Suggested stop loss
  target\_1\_price        numeric(12,2)                             First profit target
  target\_2\_price        numeric(12,2)                             Runner target
  confluence\_score       integer NOT NULL                          0-5 score
  confluence\_sources     jsonb NOT NULL                            Array of contributing signals
  cluster\_zone\_id       uuid REFERENCES spx\_cluster\_zones(id)   Associated cluster zone
  regime                  text                                      trending \| ranging \| compression \| breakout
  status                  text DEFAULT \'forming\'                  forming \| ready \| triggered \| invalidated \| expired
  probability             numeric(5,2)                              AI-computed win probability
  recommended\_contract   jsonb                                     Strike, expiry, greeks, R:R calculation
  session\_date           date DEFAULT CURRENT\_DATE                Trading session
  created\_at             timestamptz DEFAULT now()                 Created timestamp
  triggered\_at           timestamptz                               When setup triggered
  invalidated\_at         timestamptz                               When setup invalidated
  ----------------------- ----------------------------------------- ------------------------------------------------------------------------------

**4.4 spx\_ai\_coaching\_log Table**

Stores AI coaching messages for each user session for behavioral
analysis.

  ------------------- --------------------------------- ---------------------------------------------------------------
  **Column**          **Type**                          **Description**
  id                  uuid (PK)                         Primary key
  user\_id            uuid REFERENCES auth.users(id)    Trader receiving coaching
  session\_date       date NOT NULL                     Trading session
  coaching\_type      text NOT NULL                     pre\_trade \| in\_trade \| behavioral \| post\_trade \| alert
  setup\_id           uuid REFERENCES spx\_setups(id)   Related setup (if applicable)
  message             text NOT NULL                     Coaching message content
  context\_snapshot   jsonb                             Market state at time of message
  trader\_action      text                              What the trader did after receiving coaching
  created\_at         timestamptz DEFAULT now()         Message timestamp
  ------------------- --------------------------------- ---------------------------------------------------------------

**4.5 spx\_gex\_snapshots Table**

Time-series GEX data for historical analysis and pattern training.

  ----------------- --------------------------- -------------------------------------------
  **Column**        **Type**                    **Description**
  id                uuid (PK)                   Primary key
  symbol            text NOT NULL               SPX or SPY
  snapshot\_time    timestamptz NOT NULL        Capture timestamp
  net\_gex          numeric(18,2)               Total net gamma exposure
  flip\_point       numeric(12,2)               Price where gamma flips positive/negative
  gex\_by\_strike   jsonb NOT NULL              { strike: gex\_value } map
  call\_wall        numeric(12,2)               Highest positive gamma strike
  put\_wall         numeric(12,2)               Highest negative gamma strike
  zero\_gamma       numeric(12,2)               Zero gamma line
  key\_levels       jsonb                       Top 10 GEX levels with values
  expiration\_mix   jsonb                       GEX breakdown by expiration cycle
  created\_at       timestamptz DEFAULT now()   Record creation
  ----------------- --------------------------- -------------------------------------------

**4.6 Indexes & RLS**

> \-- Performance indexes
>
> CREATE INDEX idx\_spx\_levels\_symbol\_active ON spx\_levels(symbol)
> WHERE valid\_until IS NULL;
>
> CREATE INDEX idx\_spx\_clusters\_active ON
> spx\_cluster\_zones(session\_date, is\_active);
>
> CREATE INDEX idx\_spx\_setups\_status ON spx\_setups(session\_date,
> status);
>
> CREATE INDEX idx\_spx\_gex\_time ON spx\_gex\_snapshots(symbol,
> snapshot\_time DESC);
>
> CREATE INDEX idx\_spx\_coaching\_user ON
> spx\_ai\_coaching\_log(user\_id, session\_date);
>
> \-- RLS Policies
>
> ALTER TABLE spx\_levels ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE spx\_cluster\_zones ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE spx\_setups ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE spx\_gex\_snapshots ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE spx\_ai\_coaching\_log ENABLE ROW LEVEL SECURITY;
>
> \-- Read access for authenticated members (market data is shared)
>
> CREATE POLICY select\_spx\_levels ON spx\_levels FOR SELECT TO
> authenticated USING (true);
>
> CREATE POLICY select\_spx\_clusters ON spx\_cluster\_zones FOR SELECT
> TO authenticated USING (true);
>
> CREATE POLICY select\_spx\_setups ON spx\_setups FOR SELECT TO
> authenticated USING (true);
>
> CREATE POLICY select\_spx\_gex ON spx\_gex\_snapshots FOR SELECT TO
> authenticated USING (true);
>
> \-- Coaching log: users see only their own
>
> CREATE POLICY select\_own\_coaching ON spx\_ai\_coaching\_log FOR
> SELECT TO authenticated
>
> USING (user\_id = auth.uid());
>
> CREATE POLICY insert\_own\_coaching ON spx\_ai\_coaching\_log FOR
> INSERT TO authenticated
>
> WITH CHECK (user\_id = auth.uid());

**5. Backend API Routes**

**5.1 SPX Data API**

All routes are prefixed with /api/spx/ and proxied through the Next.js
API layer to the Express backend.

  ------------ -------------------------- ----------------------------------------------- ---------------
  **Method**   **Endpoint**               **Description**                                 **Cache TTL**
  GET          /api/spx/levels            All active MTF levels for SPX + SPY-derived     30s
  GET          /api/spx/clusters          Active cluster zones with scores                30s
  GET          /api/spx/gex               Current GEX landscape (SPX + SPY)               15s
  GET          /api/spx/gex/history       GEX snapshots for time-series analysis          60s
  GET          /api/spx/setups            Active trade setups with confluence             10s
  GET          /api/spx/setups/:id        Single setup detail with full context           10s
  GET          /api/spx/fibonacci         All active Fibonacci levels (all TFs)           30s
  GET          /api/spx/flow              Recent options flow (sweeps, blocks)            5s
  GET          /api/spx/regime            Current regime classification + probabilities   5s
  GET          /api/spx/basis             SPX/SPY basis with trend analysis               5s
  GET          /api/spx/contract-select   AI contract recommendation for a setup          10s
  POST         /api/spx/coach/message     AI coaching message (SSE stream)                none
  GET          /api/spx/coach/state       Current AI coach state snapshot                 5s
  ------------ -------------------------- ----------------------------------------------- ---------------

**5.2 WebSocket Channels**

Extend the existing WebSocket infrastructure to support SPX Command
Center real-time updates:

  ----------------- --------------------------------------------------------------- -----------------------
  **Channel**       **Payload**                                                     **Update Frequency**
  price:SPX         { price, change, changePct, volume, timestamp }                 Every tick (30s poll)
  price:SPY         { price, change, changePct, volume, timestamp }                 Every tick (30s poll)
  gex:SPX           { netGex, flipPoint, callWall, putWall, topLevels }             Every 60s
  gex:SPY           { netGex, flipPoint, callWall, putWall, topLevels }             Every 60s
  levels:update     { added: Level\[\], removed: Level\[\], modified: Level\[\] }   On change
  clusters:update   { zones: ClusterZone\[\] }                                      On change
  setups:update     { setup: Setup, action: created\|updated\|expired }             On change
  regime:update     { regime, direction, probability, magnitude }                   Every 30s
  flow:alert        { type, symbol, strike, expiry, size, direction }               On significant flow
  coach:message     { type, content, setupId, priority }                            On AI coaching event
  basis:update      { basis, trend, leading }                                       Every 30s
  ----------------- --------------------------------------------------------------- -----------------------

**5.3 Backend Service Files to Create**

  ---------------------------------------------- ---------------------------------------------------------
  **File Path**                                  **Purpose**
  backend/src/services/spx/gexEngine.ts          Compute GEX from full options chain (SPX + SPY)
  backend/src/services/spx/levelEngine.ts        MTF level aggregation and cluster scoring
  backend/src/services/spx/fibEngine.ts          Fibonacci swing detection and retracement computation
  backend/src/services/spx/crossReference.ts     SPY/SPX basis tracking, level fusion, flow correlation
  backend/src/services/spx/setupDetector.ts      Pattern recognition, confluence scoring, lifecycle
  backend/src/services/spx/regimeClassifier.ts   Real-time regime classification from multi-signal input
  backend/src/services/spx/aiPredictor.ts        Probability distributions, move forecasting, timing
  backend/src/services/spx/aiCoach.ts            Coaching message generation, behavioral analysis
  backend/src/services/spx/contractSelector.ts   Optimal strike/expiry recommendation engine
  backend/src/routes/spx.ts                      Express route definitions for all /api/spx/\* endpoints
  backend/src/workers/spxDataLoop.ts             Background worker polling Massive.com on intervals
  ---------------------------------------------- ---------------------------------------------------------

**6. Computation Engine Specifications**

**6.1 GEX (Gamma Exposure) Engine**

The GEX Engine computes dealer gamma exposure from the full options
chain, providing the foundation for options-derived levels.

**6.1.1 Data Sources**

-   SPX full options chain via getOptionsSnapshot(\'SPX\') from
    Massive.com

-   SPY full options chain via getOptionsSnapshot(\'SPY\') from
    Massive.com

-   Both 0DTE and monthly expirations processed independently

**6.1.2 Computation Logic**

> // For each strike in the chain:
>
> // GEX = OI \* gamma \* contractMultiplier \* spotPrice\^2 \* 0.01
>
> // Call GEX is positive (dealers long gamma), Put GEX is negative
>
> // Net GEX at strike = Call GEX + Put GEX
>
> interface GEXProfile {
>
> netGex: number; // Total net gamma across all strikes
>
> flipPoint: number; // Price where net GEX crosses zero
>
> callWall: number; // Strike with highest positive GEX
>
> putWall: number; // Strike with most negative GEX
>
> zeroGamma: number; // Zero gamma crossover price
>
> gexByStrike: Map\<number, number\>; // Strike -\> net GEX value
>
> keyLevels: GEXLevel\[\]; // Top 10 levels by absolute GEX value
>
> expirationBreakdown: Map\<string, GEXProfile\>; // GEX by expiry cycle
>
> }

**6.1.3 Update Frequency**

-   Full recomputation: Every 60 seconds during market hours

-   Key level extraction: Every 30 seconds (delta from cached full
    chain)

-   Off-hours: Every 5 minutes (pre-market), disabled after close

**6.2 Multi-Time-Frame Level Engine**

Aggregates price levels from five independent source categories and
identifies convergence zones.

**6.2.1 Level Source Categories**

**Structural (Monthly/Weekly):** Prior month H/L/C, current month open,
weekly O/H/L/C, monthly VWAP, monthly volume profile POC/VAH/VAL.
Weight: 1.5x

**Tactical (Daily):** Prior day H/L/C, overnight (Globex) H/L, daily
VWAP, daily volume profile POC/VAH/VAL, settlement price. Weight: 1.2x

**Intraday:** Developing VWAP, developing POC, opening range H/L (15/30
min), initial balance H/L (first hour), half-day VWAP. Weight: 1.0x

**Options-Derived:** GEX walls (SPX-native), put wall, call wall, max
pain, zero gamma line. Per-expiration and combined. Weight: 1.3x

**SPY-Derived:** All SPY options-derived levels converted to
SPX-equivalent price via live basis. Weight: 1.1x

**Fibonacci:** Retracement (23.6%, 38.2%, 50%, 61.8%, 78.6%) and
extension (127.2%, 161.8%, 200%) levels from auto-detected swings across
all timeframes. Weight: 1.2x

**6.2.2 Cluster Score Algorithm**

> interface ClusterZone {
>
> priceLow: number;
>
> priceHigh: number;
>
> score: number; // Weighted count of sources
>
> sources: LevelSource\[\]; // Contributing levels
>
> type: \'fortress\' \| \'defended\' \| \'moderate\' \| \'minor\';
>
> testCount: number;
>
> holdRate: number;
>
> }
>
> // Algorithm:
>
> // 1. Collect all active levels across all categories
>
> // 2. Sort by price ascending
>
> // 3. Sliding window: group levels within CLUSTER\_RADIUS (3 points
> for SPX)
>
> // 4. For each group, compute weighted score:
>
> // score = sum(source.weight \* source.categoryWeight)
>
> // 5. Classify zone type by score threshold:
>
> // fortress: score \>= 5.0 \| defended: score \>= 3.5
>
> // moderate: score \>= 2.0 \| minor: score \>= 1.0
>
> // 6. Merge overlapping zones, take highest score
>
> // 7. Track test count and hold rate from intraday price action

**6.3 Fibonacci Engine**

**6.3.1 Swing Point Detection**

Uses fractal-based pivot detection with confirmation bars scaled by
timeframe:

  --------------- ----------------------- ---------------------------------------- ----------------------
  **Timeframe**   **Confirmation Bars**   **Source Data**                          **Update Frequency**
  Monthly         3 monthly bars          getDailyAggregates (rolling 12 months)   Daily
  Weekly          2 weekly bars           getDailyAggregates (rolling 13 weeks)    Daily
  Daily           2 daily bars            getDailyAggregates (rolling 30 days)     On new bar
  Intraday        5 bars (5m chart)       getMinuteAggregates (current session)    On new bar
  --------------- ----------------------- ---------------------------------------- ----------------------

**6.3.2 Retracement Levels Computed**

-   Standard retracements: 23.6%, 38.2%, 50.0%, 61.8%, 78.6%

-   Extensions: 100%, 127.2%, 161.8%, 200%, 261.8%

-   Computed from both swing high-to-low AND low-to-high depending on
    trend direction

-   Multiple concurrent fib sets: one per timeframe swing, all active
    simultaneously

**6.3.3 Cross-Validation with SPY**

Fibonacci levels computed independently on both SPX and SPY. When the
same ratio (e.g., 61.8%) from both instruments maps to the same
SPX-equivalent price zone (within CLUSTER\_RADIUS), the fib level
receives a cross-instrument confirmation bonus of 0.5 to its cluster
weight.

**6.4 SPY/SPX Cross-Reference Engine**

**6.4.1 Live Basis Calculation**

> // Basis = SPX\_price - (SPY\_price \* 10)
>
> // Updated every tick from WebSocket
>
> interface BasisState {
>
> current: number; // Current basis spread
>
> trend: \'expanding\' \| \'contracting\' \| \'stable\';
>
> leading: \'SPX\' \| \'SPY\' \| \'neutral\'; // Which is leading
>
> ema5: number; // 5-period EMA of basis
>
> ema20: number; // 20-period EMA of basis
>
> zscore: number; // How unusual current basis is
>
> }

**6.4.2 Unified GEX Landscape**

The engine converts all SPY GEX levels to SPX-equivalent using the live
basis, then overlays them on the SPX GEX map. Levels from both
instruments that fall within CLUSTER\_RADIUS are merged into combined
zones with a \"dual-instrument\" tag and elevated weight.

**6.4.3 Flow Correlation**

When significant flow (sweeps \> \$500K, blocks) appears in SPX, the
engine checks for correlated flow in SPY within a 30-second window.
Correlated flow receives a confirmation multiplier of 1.5x in the
confluence score. Divergent flow (opposite direction) triggers a \"flow
divergence\" warning in the AI Coach.

**6.5 Setup Detection Engine**

**6.5.1 Setup Types**

  --------------------- ----------------------------------------------------------------------------------------- --------------------------------------------------------------------
  **Setup Type**        **Trigger Conditions**                                                                    **Typical Confluence Sources**
  fade\_at\_wall        Price approaches Fortress/Defended zone + declining volume + positive GEX regime          Cluster zone + GEX wall + declining momentum + fib level
  breakout\_vacuum      Price breaks through cluster zone + volume surge + negative GEX ahead + confirming flow   Broken zone + gamma vacuum + sweep flow + fib extension target
  mean\_reversion       Price extended from VWAP + approaching fib retracement + flow exhaustion                  VWAP deviation + fib level + flow reversal + volume climax
  trend\_continuation   Price pulls back to support in trend + holds cluster zone + GEX supports direction        Trend structure + cluster support + positive GEX + fib retracement
  --------------------- ----------------------------------------------------------------------------------------- --------------------------------------------------------------------

**6.5.2 Confluence Score Calculation**

> // Each signal layer contributes 0 or 1 point to confluence:
>
> // 1. Level Quality: cluster\_score \>= \'defended\' -\> +1
>
> // 2. GEX Alignment: GEX structure supports direction -\> +1
>
> // 3. Flow Confirmation: sweep/block in direction within 2 min -\> +1
>
> // 4. Fibonacci Touch: price within 0.5 pts of fib level -\> +1
>
> // 5. Regime Alignment: setup type matches current regime -\> +1
>
> //
>
> // Total: 0-5 (displayed as stars or filled dots)
>
> // Historical win rate by confluence (back-tested):
>
> // 1/5: \~35% \| 2/5: \~45% \| 3/5: \~58%
>
> // 4/5: \~71% \| 5/5: \~82%

**6.5.3 Setup Lifecycle**

-   FORMING: Conditions beginning to align (1-2 signals present)

-   READY: Full confluence achieved, entry zone defined (displayed to
    trader)

-   TRIGGERED: Price enters the entry zone (alerts fire, timer starts)

-   INVALIDATED: Key level breaks, regime changes, or flow reverses

-   EXPIRED: Time decay (setup older than 30 minutes without trigger)

**7. AI Prediction Engine**

**7.1 Regime Classification**

The AI maintains a continuous regime classification updated every 30
seconds:

  ------------- ---------------------------------------------------------------- --------------------------------------------
  **Regime**    **Characteristics**                                              **Trading Implication**
  trending      Directional momentum, negative GEX, expanding volume             Favor continuation setups, avoid fading
  ranging       Price between two Fortress zones, positive GEX, mean-reverting   Favor fade setups at zone boundaries
  compression   Narrowing range, building GEX, declining volume                  Prepare for breakout, reduce position size
  breakout      Transition from compression, GEX flip, volume surge              Aggressive entries in breakout direction
  ------------- ---------------------------------------------------------------- --------------------------------------------

**7.2 Directional Probability Model**

Outputs a probability distribution for price direction over the next 5,
15, and 30 minutes:

> interface PredictionState {
>
> regime: \'trending\' \| \'ranging\' \| \'compression\' \|
> \'breakout\';
>
> direction: {
>
> bullish: number; // 0-100 probability
>
> bearish: number; // 0-100 probability
>
> neutral: number; // 0-100 probability (chop)
>
> };
>
> magnitude: {
>
> small: number; // \< 5 pts expected move
>
> medium: number; // 5-15 pts
>
> large: number; // \> 15 pts
>
> };
>
> timingWindow: {
>
> description: string; // e.g., \'0DTE gamma peak at 2pm\'
>
> actionable: boolean; // Should trader act now?
>
> };
>
> nextTarget: {
>
> upside: { price: number; clusterZone: string };
>
> downside: { price: number; clusterZone: string };
>
> };
>
> confidence: number; // Model confidence 0-100
>
> }

**7.3 Input Signals**

-   GEX regime (net positive/negative, flip proximity, wall proximity)

-   Volume profile (developing POC position, value area extremes)

-   Options flow sentiment (net premium direction, sweep/block ratio)

-   IV surface dynamics (term structure slope change, skew shift)

-   Fibonacci level proximity and reaction history

-   SPY/SPX basis trend and leading indicator

-   Cluster zone proximity and historical hold rates

-   Time-of-day patterns (opening drive, VWAP test, power hour)

**7.4 Probability Cone Visualization**

The prediction model outputs a forward-looking probability cone rendered
on the chart as a semi-transparent shaded area. The cone width reflects
uncertainty (wider = more volatile expected), and the center line shows
the most probable path. The cone shape adapts in real-time:

-   Approaching Fortress Zone: cone flattens and reverses direction

-   Entering gamma vacuum: cone widens in the expected acceleration
    direction

-   Compression regime: cone narrows symmetrically (breakout direction
    unknown)

-   Post-breakout: cone extends in breakout direction with widening
    uncertainty

**8. AI Coach Specification**

**8.1 Coaching Types**

**8.1.1 Pre-Trade Coaching**

Triggered when a setup reaches READY status with confluence \>= 3/5.
Delivers a structured brief:

> // Example coaching message structure:
>
> {
>
> type: \'pre\_trade\',
>
> setupId: \'uuid\',
>
> content: {
>
> headline: \'Fade Setup at 5905 Fortress Zone\',
>
> confluence: \'5/5 --- 61.8% Weekly Fib + Call Wall + PDH + Weekly VWAP
> + GEX Wall\',
>
> regime: \'Range-bound (supports fade thesis)\',
>
> entry: { low: 5903, high: 5905 },
>
> stop: 5909,
>
> target1: { price: 5892, label: \'Daily POC\' },
>
> target2: { price: 5880, label: \'Next Fortress Zone (through gamma
> vacuum)\' },
>
> contract: {
>
> description: \'5900P 0DTE\',
>
> delta: -0.142, gamma: 0.008, theta: -0.45,
>
> bid: 3.70, ask: 3.80,
>
> riskReward: 3.2
>
> },
>
> historicalWinRate: \'82% at 5/5 confluence\'
>
> }
>
> }

**8.1.2 In-Trade Coaching**

Activated when a trader enters a position (detected via position tracker
integration). Monitors price relative to the setup targets and provides
contextual guidance:

-   Approaching target zones: profit-taking suggestions with partial
    exit percentages

-   Entering gamma vacuums: hold guidance (\"price will move fast
    through here\")

-   Flow reversals: early warning when flow shifts against position

-   Stop proximity: reassurance if level structure is intact, or early
    exit warning if structure breaking

-   Time-based: theta decay warnings for 0DTE positions, pinning risk
    near expiry

**8.1.3 Behavioral Coaching**

Analyzes the trader\'s behavior patterns over time using the
coaching\_log and journal entries:

-   Counter-trend trade frequency detection (warns when trading against
    regime)

-   Early exit pattern recognition (quantifies missed gains from
    premature runner exits)

-   Confluence threshold enforcement (warns when entering below
    historical profitable threshold)

-   Tilt detection (rapid sequence of losses triggering increased
    position sizing or frequency)

-   Session performance tracking (warns when daily loss limit
    approaches)

**8.1.4 Post-Trade Review**

Automatic analysis after each trade closes:

-   Entry quality score (distance from optimal entry within setup zone)

-   Exit quality score (percentage of available move captured)

-   Confluence adherence (did confluence at entry match minimum
    threshold?)

-   Regime alignment (was setup type appropriate for active regime?)

-   Contract selection efficiency (was the recommended contract optimal
    vs. what was traded?)

**8.2 Coach UI Integration**

The AI Coach renders as a collapsible sidebar panel on the right side of
the SPX Command Center (desktop) or as a pull-up sheet (mobile).
Messages appear in a streaming feed with priority-based visual
treatment:

-   ALERT (red glow): Immediate action needed (stop approaching, flow
    reversal)

-   SETUP (emerald glow): New high-confluence setup detected

-   GUIDANCE (neutral): In-trade suggestions, informational updates

-   BEHAVIORAL (champagne): Longer-term pattern coaching, session
    reviews

**9. Frontend Component Architecture**

**9.1 Page Layout**

> // app/members/spx-command-center/page.tsx
>
> // Desktop: 3-panel resizable layout
>
> // Mobile: Single panel with tab switching
>
> \<PanelGroup direction=\'horizontal\'\>
>
> {/\* Left Panel: Setup Feed + Level Matrix (25%) \*/}
>
> \<Panel defaultSize={25} minSize={20}\>
>
> \<SetupFeed /\>
>
> \<LevelMatrix /\>
>
> \</Panel\>
>
> \<PanelResizeHandle /\>
>
> {/\* Center Panel: Chart + Overlays (50%) \*/}
>
> \<Panel defaultSize={50} minSize={35}\>
>
> \<SPXChart /\>
>
> \<RegimeBar /\>
>
> \<FlowTicker /\>
>
> \</Panel\>
>
> \<PanelResizeHandle /\>
>
> {/\* Right Panel: AI Coach + Contract Selector (25%) \*/}
>
> \<Panel defaultSize={25} minSize={20}\>
>
> \<AICoachFeed /\>
>
> \<ContractSelector /\>
>
> \</Panel\>
>
> \</PanelGroup\>

**9.2 Component File Manifest**

  ----------------------------------------------------- ------------------ -------------------------------------------------------------
  **File Path**                                         **Component**      **Description**
  components/spx-command-center/spx-chart.tsx           SPXChart           TradingView chart with level/zone/fib/GEX overlays
  components/spx-command-center/setup-feed.tsx          SetupFeed          Live setup cards with confluence scores and lifecycle
  components/spx-command-center/setup-card.tsx          SetupCard          Individual setup with entry/stop/target visualization
  components/spx-command-center/level-matrix.tsx        LevelMatrix        Sorted list of all active levels with cluster highlights
  components/spx-command-center/cluster-zone-bar.tsx    ClusterZoneBar     Horizontal cluster zone visualization with source breakdown
  components/spx-command-center/gex-landscape.tsx       GEXLandscape       GEX profile chart (bar chart by strike)
  components/spx-command-center/gex-heatmap.tsx         GEXHeatmap         Combined SPX+SPY GEX heatmap overlay
  components/spx-command-center/fib-overlay.tsx         FibOverlay         Chart overlay rendering fib levels with timeframe colors
  components/spx-command-center/regime-bar.tsx          RegimeBar          Current regime classification with visual indicator
  components/spx-command-center/probability-cone.tsx    ProbabilityCone    Forward-looking probability visualization on chart
  components/spx-command-center/flow-ticker.tsx         FlowTicker         Bottom ticker showing real-time options flow
  components/spx-command-center/ai-coach-feed.tsx       AICoachFeed        Streaming AI coaching messages with priority styling
  components/spx-command-center/coach-message.tsx       CoachMessage       Individual coaching message with context expansion
  components/spx-command-center/contract-selector.tsx   ContractSelector   Strike/expiry grid with AI recommendations
  components/spx-command-center/contract-card.tsx       ContractCard       Single contract with Greeks, P&L scenario, R:R
  components/spx-command-center/basis-indicator.tsx     BasisIndicator     SPX/SPY basis display with trend arrow
  components/spx-command-center/spx-header.tsx          SPXHeader          Page header with live price, regime badge, market status
  components/spx-command-center/mobile-panel-tabs.tsx   MobilePanelTabs    Mobile tab switcher for Chart/Setups/Coach/Levels
  components/spx-command-center/spx-skeleton.tsx        SPXSkeleton        Full-page skeleton loader (pulsing logo variant)
  ----------------------------------------------------- ------------------ -------------------------------------------------------------

**9.3 Custom Hooks**

  ---------------------------- ----------------- -----------------------------------------------------
  **Hook File**                **Hook Name**     **Purpose**
  hooks/use-spx-levels.ts      useSPXLevels      Fetch and subscribe to MTF levels + cluster zones
  hooks/use-spx-gex.ts         useSPXGEX         Fetch and subscribe to GEX landscape (SPX + SPY)
  hooks/use-spx-setups.ts      useSPXSetups      Fetch and subscribe to active setups with lifecycle
  hooks/use-spx-regime.ts      useSPXRegime      Regime classification and prediction state
  hooks/use-spx-flow.ts        useSPXFlow        Options flow stream with filtering
  hooks/use-spx-coach.ts       useSPXCoach       AI coaching messages with SSE streaming
  hooks/use-spx-fibonacci.ts   useSPXFibonacci   Fibonacci levels across all timeframes
  hooks/use-spx-basis.ts       useSPXBasis       SPY/SPX basis tracking and correlation
  hooks/use-spx-contract.ts    useSPXContract    Contract selection with AI recommendation
  ---------------------------- ----------------- -----------------------------------------------------

**9.4 Context Provider**

> // contexts/SPXCommandCenterContext.tsx
>
> interface SPXCommandCenterState {
>
> // Real-time data
>
> spxPrice: number;
>
> spyPrice: number;
>
> basis: BasisState;
>
> regime: RegimeState;
>
> prediction: PredictionState;
>
> // Level data
>
> levels: SPXLevel\[\];
>
> clusterZones: ClusterZone\[\];
>
> fibLevels: FibLevel\[\];
>
> gexProfile: { spx: GEXProfile; spy: GEXProfile; combined: GEXProfile
> };
>
> // Setups & coaching
>
> activeSetups: Setup\[\];
>
> coachMessages: CoachMessage\[\];
>
> selectedSetup: Setup \| null;
>
> // UI state
>
> selectedTimeframe: ChartTimeframe;
>
> visibleLevelCategories: Set\<LevelCategory\>;
>
> showSPYDerived: boolean;
>
> chartAnnotations: ChartAnnotation\[\];
>
> // Actions
>
> selectSetup: (setup: Setup) =\> void;
>
> toggleLevelCategory: (category: LevelCategory) =\> void;
>
> toggleSPYDerived: () =\> void;
>
> requestContractRecommendation: (setupId: string) =\>
> Promise\<ContractRec\>;
>
> }

**10. UI/UX Design Specification**

**10.1 Chart Overlays**

**10.1.1 Level Rendering**

  ----------------------------- ----------------- ----------------------------------------- ----------------------------------
  **Level Category**            **Line Style**    **Color**                                 **Label Format**
  Structural (Weekly/Monthly)   Solid, 2px        rgba(96, 165, 250, 0.7) (blue)            \"Weekly VWAP\", \"PDH\"
  Tactical (Daily)              Solid, 1.5px      rgba(255, 255, 255, 0.6) (white)          \"PDH\", \"ONH\", \"Settlement\"
  Intraday                      Dotted, 1px       rgba(156, 163, 175, 0.5) (gray)           \"dVWAP\", \"OR-H\", \"IB-L\"
  Options-Derived (SPX)         Solid, 2px        rgba(16, 185, 129, 0.8) (emerald)         \"GEX Wall\", \"Call Wall\"
  Options-Derived (SPY)         Dot-dash, 1.5px   rgba(16, 185, 129, 0.5) (emerald muted)   \"SPY GEX Wall\*\"
  Fibonacci                     Dashed, 1.5px     rgba(245, 237, 204, 0.6) (champagne)      \"61.8% Weekly\", \"50% PD\"
  ----------------------------- ----------------- ----------------------------------------- ----------------------------------

**10.1.2 Cluster Zone Rendering**

Cluster zones render as semi-transparent horizontal bands on the chart.
Opacity and visual intensity scale with cluster score:

-   Fortress (score \>= 5): Full emerald band, high opacity (0.15),
    pulsing border, label visible

-   Defended (score \>= 3.5): Medium emerald band, moderate opacity
    (0.10), static border

-   Moderate (score \>= 2): Subtle band, low opacity (0.06), border on
    hover only

-   Minor (score \>= 1): Hairline indicator, very low opacity (0.03)

**10.1.3 Setup Card Visual Design**

Setup cards in the left panel use glass-card-heavy styling with
status-dependent visual treatment:

> // FORMING: glass-card-heavy with white/5 border, muted text
>
> // READY: glass-card-heavy with emerald/30 border, full brightness,
>
> // confluence dots filled (emerald for active, white/20 for inactive)
>
> // TRIGGERED: animated emerald glow border (animate-pulse-emerald),
>
> // setup type icon pulses
>
> // INVALIDATED: glass-card with red/20 border, crossed-out text,
> fade-out
>
> // EXPIRED: opacity 0.4, slide-out animation, removed after 5s

**10.2 Animations & Transitions**

**10.2.1 Entry Animations**

-   Page load: Pulsing Logo skeleton (variant=\"screen\") during initial
    data fetch

-   Panel reveal: FADE\_UP\_VARIANT with STAGGER\_CHILDREN (0.08s
    stagger) for each panel

-   Level lines: Draw-in animation (width: 0 to 100% over 0.4s, easeOut)

-   Cluster zones: Fade-in with subtle scale (0.98 to 1.0) over 0.6s

-   Setup cards: Slide-in from left with LUXURY\_SPRING transition

**10.2.2 Real-Time Update Animations**

-   Price changes: counter-flash-up (green) / counter-flash-down (red)
    on price displays

-   New setup detected: Card slides in from left with emerald glow pulse
    (2 cycles)

-   Setup status change: Border color morph (0.4s ease), confluence dots
    animate in/out

-   Level added/removed: Fade in/out (0.3s) with subtle line extension
    animation

-   GEX update: Smooth bar height transition (0.5s ease-in-out) on GEX
    chart

-   Coach message: Slide-in from right with priority-colored left border
    glow

-   Probability cone: Smooth morph on each update (0.8s bezier
    transition)

**10.2.3 Interaction Animations**

-   Setup card click: Card expands, chart zooms to context, levels
    highlight (0.4s spring)

-   Level category toggle: Lines fade in/out (0.3s) with stagger by
    price proximity

-   Panel resize: Smooth content reflow with Framer Motion layoutId

-   Contract card hover: Subtle lift (2px), border brightens to
    emerald/50, P&L scenario reveals

**10.3 Responsive Design**

**10.3.1 Desktop (\>= 1024px)**

Three-panel resizable layout as described in Section 9.1. All panels
visible simultaneously. Level matrix and setup feed share the left panel
with a collapsible divider.

**10.3.2 Tablet (768px - 1023px)**

Two-panel layout: Chart (70%) + collapsible sidebar (30%) with tab
switching between Setups/Coach/Levels. Contract selector in a bottom
sheet.

**10.3.3 Mobile (\< 768px)**

Single-panel with bottom tab bar for switching views:

-   Chart tab: Full-width chart with simplified overlays (fewer level
    labels)

-   Setups tab: Full-width setup feed with swipe-to-expand cards

-   Coach tab: Full-width AI coaching feed

-   Levels tab: Full-width level matrix with cluster zone highlights

All mobile views use reduced backdrop blur (20px) for performance per
existing pattern. Touch targets minimum 44px. Bottom tab bar uses
glass-card-heavy with safe area insets.

**11. Brand Compliance Checklist**

Every component in the SPX Command Center MUST adhere to The Emerald
Standard:

  ---------------------------------- -------------------------------------------------------------------- ----------------------------------------------
  **Requirement**                    **Implementation**                                                   **Validation**
  Primary color: Emerald \#10B981    All active states, CTAs, positive values use var(\--emerald-elite)   No other green hex values in component files
  Accent color: Champagne \#F5EDCC   Fib levels, premium badges, subtle borders use var(\--champagne)     No gold \#D4AF37 anywhere
  Background: Onyx \#0A0A0B          Page background via body styles, never pure black                    Check computed background-color
  Containers: glass-card-heavy       All card/panel containers use glass-card-heavy utility               Grep for raw background: rgba patterns
  Typography: Playfair (headings)    Section headers use Playfair Display                                 Verify font-family on h1-h3 elements
  Typography: Inter (body)           All body text uses Inter 300 weight                                  Verify font-family on p elements
  Typography: Geist Mono (data)      Prices, levels, P&L use Geist Mono with tnum                         Verify font-feature-settings
  Icons: Lucide React only           All icons from lucide-react package                                  No other icon imports
  Images: next/image only            All images use next/image component                                  No raw \<img\> tags
  Loading: Pulsing Logo              Full-page load uses SkeletonLoader variant=\"screen\"                No generic spinners
  Dark mode only                     No light mode styles, no theme toggle                                No prefers-color-scheme: light
  Animations: Emerald Standard       Use motion-primitives.ts (FADE\_UP\_VARIANT, etc.)                   No raw CSS animation definitions
  Branding: Logo                     \<Image src=\"/logo.png\" /\> for all brand marks                    No Sparkles icon as placeholder
  ---------------------------------- -------------------------------------------------------------------- ----------------------------------------------

**12. Testing Strategy**

**12.1 Unit Tests (Vitest - Frontend)**

  -------------------------------------------- ----------------------------------------------------------------------------
  **Test File**                                **Coverage Target**
  \_\_tests\_\_/spx/clusterScore.test.ts       Cluster scoring algorithm: zone detection, score calculation, merge logic
  \_\_tests\_\_/spx/fibEngine.test.ts          Swing detection, retracement computation, cross-validation
  \_\_tests\_\_/spx/basisCalc.test.ts          SPY-to-SPX conversion, basis tracking, trend detection
  \_\_tests\_\_/spx/confluenceScore.test.ts    Score calculation across all signal layers
  \_\_tests\_\_/spx/setupLifecycle.test.ts     State transitions: forming -\> ready -\> triggered -\> invalidated/expired
  \_\_tests\_\_/spx/regimeClassifier.test.ts   Regime detection from multi-signal input
  \_\_tests\_\_/spx/contractSelector.test.ts   Strike/expiry selection logic, R:R calculations
  -------------------------------------------- ----------------------------------------------------------------------------

**12.2 Unit Tests (Jest - Backend)**

  --------------------------------------------------------------- -----------------------------------------------------------
  **Test File**                                                   **Coverage Target**
  backend/src/services/spx/\_\_tests\_\_/gexEngine.test.ts        GEX computation from mock options chain, wall detection
  backend/src/services/spx/\_\_tests\_\_/levelEngine.test.ts      Level aggregation, cluster zone identification
  backend/src/services/spx/\_\_tests\_\_/fibEngine.test.ts        Pivot detection with varying confirmation bars
  backend/src/services/spx/\_\_tests\_\_/crossReference.test.ts   Basis calculation, SPY level conversion accuracy
  backend/src/services/spx/\_\_tests\_\_/setupDetector.test.ts    Setup detection trigger conditions, lifecycle transitions
  backend/src/services/spx/\_\_tests\_\_/aiPredictor.test.ts      Prediction output format, regime classification accuracy
  --------------------------------------------------------------- -----------------------------------------------------------

**12.3 Integration Tests**

  ---------------------------------------------------- --------------------------------------------------
  **Test File**                                        **Coverage Target**
  \_\_tests\_\_/integration/spx-api.test.ts            All /api/spx/\* endpoints return correct schema
  \_\_tests\_\_/integration/spx-websocket.test.ts      WebSocket channels deliver expected payloads
  \_\_tests\_\_/integration/spx-coach-stream.test.ts   SSE coaching stream delivers structured messages
  ---------------------------------------------------- --------------------------------------------------

**12.4 E2E Tests (Playwright)**

  ----------------------------------- ------------------------------------------------------------------------
  **Test File**                       **Coverage Target**
  e2e/spx-command-center.spec.ts      Page loads with skeleton, panels render, levels appear on chart
  e2e/spx-setup-interaction.spec.ts   Click setup card -\> chart zooms, levels highlight, contract populates
  e2e/spx-responsive.spec.ts          Mobile tab switching, panel collapse, touch targets \>= 44px
  e2e/spx-coach-messages.spec.ts      Coach messages stream in, priority styling correct, expandable
  ----------------------------------- ------------------------------------------------------------------------

**12.5 Mock Data Requirements**

All unit and integration tests must use deterministic mock data. Create
fixtures at:

-   \_\_tests\_\_/fixtures/spx-options-chain.json: Full SPX options
    chain snapshot (50 strikes, 3 expirations)

-   \_\_tests\_\_/fixtures/spy-options-chain.json: Corresponding SPY
    options chain

-   \_\_tests\_\_/fixtures/spx-aggregates.json: 30-day daily bars +
    intraday minute bars

-   \_\_tests\_\_/fixtures/spx-flow.json: Sample options flow events
    (sweeps, blocks)

**13. Implementation Order**

Phases are ordered by dependency chain. Each phase must be complete and
tested before proceeding.

**Phase 1: Foundation (Days 1-3)**

1.  Database migrations: Create all 5 tables + indexes + RLS policies

2.  Tab configuration: Add spx-command-center to tab\_configurations

3.  Navigation integration: Update member-navigation.ts icon map

4.  Page skeleton: Create app/members/spx-command-center/page.tsx with
    SkeletonLoader

5.  Context provider: SPXCommandCenterContext with initial state shape

6.  Backend route shell: backend/src/routes/spx.ts with placeholder
    endpoints

**Phase 2: Data Pipeline (Days 4-7)**

7.  GEX Engine: Full implementation with SPX + SPY computation

8.  MTF Level Engine: Structural, tactical, intraday, and
    options-derived levels

9.  Fibonacci Engine: Swing detection + retracement/extension
    computation

10. SPY/SPX Cross-Reference: Basis tracking, level fusion, unified GEX

11. Cluster Score Algorithm: Zone detection, scoring, classification

12. Data loop worker: Background polling with Redis caching

13. WebSocket channels: Extend existing WS for SPX-specific channels

14. Unit tests for all computation engines

**Phase 3: Frontend Core (Days 8-12)**

15. SPXChart component with TradingView Lightweight Charts integration

16. Level overlays: All 6 categories with correct line styles and colors

17. Cluster zone bands with opacity scaling

18. GEX landscape visualization (bar chart by strike)

19. Level matrix sidebar with sorting and filtering

20. Fibonacci overlay with timeframe-specific rendering

21. Basis indicator component

22. Regime bar with real-time classification display

23. Three-panel resizable layout with mobile responsive design

**Phase 4: Setup Detection + AI (Days 13-17)**

24. Setup detection engine with all 4 setup types

25. Confluence scoring across 5 signal layers

26. Setup feed component with lifecycle animations

27. Setup card component with entry/stop/target visualization

28. AI regime classifier integration

29. AI prediction model with probability output

30. Probability cone chart overlay

**Phase 5: AI Coach + Contract Selection (Days 18-22)**

31. AI Coach service with pre-trade, in-trade, behavioral, post-trade
    messaging

32. Coach feed component with streaming SSE and priority styling

33. Contract selector engine with Greeks-aware recommendations

34. Contract selector UI with P&L scenarios and R:R display

35. Flow ticker component with real-time options flow

36. Integration testing for full data flow

**Phase 6: Polish + Testing (Days 23-26)**

37. All animations implemented per Section 10.2

38. Brand compliance audit per Section 11 checklist

39. Mobile responsive testing across all breakpoints

40. Performance optimization: memoization, virtualized lists, canvas
    rendering

41. E2E test suite completion

42. Accessibility: reduced-motion support, keyboard navigation, ARIA
    labels

43. Error boundary wrappers for all data-dependent components

44. Graceful degradation when Massive.com API is unavailable

**14. TypeScript Type Definitions**

Create at lib/types/spx-command-center.ts:

> // ─── Level Types ───
>
> export type LevelCategory = \'structural\' \| \'tactical\' \|
> \'intraday\' \| \'options\' \| \'spy\_derived\' \| \'fibonacci\';
>
> export type LevelStrength = \'strong\' \| \'moderate\' \| \'weak\' \|
> \'dynamic\' \| \'critical\';
>
> export type ZoneType = \'fortress\' \| \'defended\' \| \'moderate\' \|
> \'minor\';
>
> export interface SPXLevel {
>
> id: string;
>
> symbol: \'SPX\' \| \'SPY\';
>
> category: LevelCategory;
>
> source: string;
>
> price: number;
>
> strength: LevelStrength;
>
> timeframe: string;
>
> metadata: Record\<string, unknown\>;
>
> chartStyle: {
>
> color: string;
>
> lineStyle: \'solid\' \| \'dashed\' \| \'dotted\' \| \'dot-dash\';
>
> lineWidth: number;
>
> labelFormat: string;
>
> };
>
> }
>
> export interface ClusterZone {
>
> id: string;
>
> priceLow: number;
>
> priceHigh: number;
>
> clusterScore: number;
>
> type: ZoneType;
>
> sources: Array\<{ source: string; category: LevelCategory; price:
> number; instrument: \'SPX\' \| \'SPY\' }\>;
>
> testCount: number;
>
> lastTestAt: string \| null;
>
> held: boolean \| null;
>
> holdRate: number \| null;
>
> }
>
> // ─── Fibonacci Types ───
>
> export interface FibLevel {
>
> ratio: number; // 0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2.0
>
> price: number;
>
> timeframe: \'monthly\' \| \'weekly\' \| \'daily\' \| \'intraday\';
>
> direction: \'retracement\' \| \'extension\';
>
> swingHigh: number;
>
> swingLow: number;
>
> crossValidated: boolean; // Confirmed by SPY equivalent
>
> }
>
> // ─── GEX Types ───
>
> export interface GEXProfile {
>
> netGex: number;
>
> flipPoint: number;
>
> callWall: number;
>
> putWall: number;
>
> zeroGamma: number;
>
> gexByStrike: Array\<{ strike: number; gex: number }\>;
>
> keyLevels: Array\<{ strike: number; gex: number; type: \'call\_wall\'
> \| \'put\_wall\' \| \'high\_oi\' }\>;
>
> expirationBreakdown: Record\<string, { netGex: number; callWall:
> number; putWall: number }\>;
>
> timestamp: string;
>
> }
>
> // ─── Setup Types ───
>
> export type SetupType = \'fade\_at\_wall\' \| \'breakout\_vacuum\' \|
> \'mean\_reversion\' \| \'trend\_continuation\';
>
> export type SetupStatus = \'forming\' \| \'ready\' \| \'triggered\' \|
> \'invalidated\' \| \'expired\';
>
> export type Regime = \'trending\' \| \'ranging\' \| \'compression\' \|
> \'breakout\';
>
> export interface Setup {
>
> id: string;
>
> type: SetupType;
>
> direction: \'bullish\' \| \'bearish\';
>
> entryZone: { low: number; high: number };
>
> stop: number;
>
> target1: { price: number; label: string };
>
> target2: { price: number; label: string };
>
> confluenceScore: number; // 0-5
>
> confluenceSources: string\[\];
>
> clusterZone: ClusterZone;
>
> regime: Regime;
>
> status: SetupStatus;
>
> probability: number;
>
> recommendedContract: ContractRecommendation \| null;
>
> createdAt: string;
>
> triggeredAt: string \| null;
>
> }
>
> // ─── Prediction Types ───
>
> export interface PredictionState {
>
> regime: Regime;
>
> direction: { bullish: number; bearish: number; neutral: number };
>
> magnitude: { small: number; medium: number; large: number };
>
> timingWindow: { description: string; actionable: boolean };
>
> nextTarget: {
>
> upside: { price: number; zone: string };
>
> downside: { price: number; zone: string };
>
> };
>
> probabilityCone: Array\<{
>
> minutesForward: number;
>
> high: number;
>
> low: number;
>
> center: number;
>
> confidence: number;
>
> }\>;
>
> confidence: number;
>
> }
>
> // ─── Coaching Types ───
>
> export type CoachingType = \'pre\_trade\' \| \'in\_trade\' \|
> \'behavioral\' \| \'post\_trade\' \| \'alert\';
>
> export type CoachingPriority = \'alert\' \| \'setup\' \| \'guidance\'
> \| \'behavioral\';
>
> export interface CoachMessage {
>
> id: string;
>
> type: CoachingType;
>
> priority: CoachingPriority;
>
> setupId: string \| null;
>
> content: string;
>
> structuredData: Record\<string, unknown\>;
>
> timestamp: string;
>
> }
>
> // ─── Contract Types ───
>
> export interface ContractRecommendation {
>
> description: string; // e.g., \'5900P 0DTE\'
>
> strike: number;
>
> expiry: string;
>
> type: \'call\' \| \'put\';
>
> delta: number;
>
> gamma: number;
>
> theta: number;
>
> vega: number;
>
> bid: number;
>
> ask: number;
>
> riskReward: number;
>
> expectedPnlAtTarget1: number;
>
> expectedPnlAtTarget2: number;
>
> maxLoss: number;
>
> reasoning: string;
>
> }
>
> // ─── Basis Types ───
>
> export interface BasisState {
>
> current: number;
>
> trend: \'expanding\' \| \'contracting\' \| \'stable\';
>
> leading: \'SPX\' \| \'SPY\' \| \'neutral\';
>
> ema5: number;
>
> ema20: number;
>
> zscore: number;
>
> }

**15. Environment Variables**

No new environment variables required. The SPX Command Center uses the
existing Massive.com API key and backend infrastructure:

  ----------------------------------- -------------- -------------------------------------------
  **Variable**                        **Location**   **Purpose**
  MASSIVE\_API\_KEY                   Backend only   Massive.com API authentication (existing)
  NEXT\_PUBLIC\_AI\_COACH\_API\_URL   Frontend       Backend proxy URL (existing)
  REDIS\_URL                          Backend        Upstash Redis for caching (existing)
  OPENAI\_API\_KEY                    Backend        AI Coach and prediction model (existing)
  ----------------------------------- -------------- -------------------------------------------

**16. Performance Requirements**

  ------------------------------ ------------------ ---------------------------------------------------
  **Metric**                     **Target**         **Measurement**
  Initial page load (skeleton)   \< 200ms           Time to first meaningful paint (skeleton visible)
  Full data render               \< 2 seconds       All levels, GEX, setups visible on chart
  Level update latency           \< 500ms           WebSocket event to chart overlay update
  Setup detection latency        \< 2 seconds       From trigger conditions met to card appearing
  AI coaching message            \< 3 seconds       From trigger event to coaching message visible
  Chart FPS                      \>= 30fps          During real-time updates with all overlays active
  Memory footprint               \< 150MB           Total heap size after 1 hour of active use
  Mobile LCP                     \< 3 seconds       Largest Contentful Paint on mobile
  Bundle size (route)            \< 250KB gzipped   Total JS for SPX command center route
  ------------------------------ ------------------ ---------------------------------------------------

**17. Error Handling & Resilience**

**17.1 Graceful Degradation**

-   Massive.com API down: Display cached levels (up to 5 min stale) with
    \"stale data\" indicator

-   WebSocket disconnected: Fall back to polling (30s intervals), show
    reconnecting badge

-   AI model error: Coach panel shows \"AI temporarily unavailable\"
    with manual level analysis still functional

-   Partial data: If SPY data fails but SPX works, show SPX-only levels
    with SPY toggle disabled

**17.2 Error Boundaries**

Every major component wrapped in React Error Boundary:

-   SPXChart: Falls back to simplified chart without overlays

-   SetupFeed: Falls back to static level list

-   AICoachFeed: Falls back to manual analysis prompt

-   ContractSelector: Falls back to raw options chain display

**17.3 Circuit Breaker**

Backend services use circuit breaker pattern (3 failures = open, 30s
recovery):

-   Massive.com API calls: Per-endpoint circuit breakers

-   OpenAI calls: Shared circuit breaker for AI Coach + Predictor

-   GEX computation: Falls back to last known state on failure

**18. Acceptance Criteria**

The SPX Command Center is considered production-ready when ALL of the
following criteria are met:

**18.1 Functional**

45. Page loads at /members/spx-command-center with pulsing logo
    skeleton, then renders full UI

46. Tab appears in member sidebar with Target icon and LIVE badge for
    pro+ tier members

47. Chart displays real-time SPX price with all 6 level categories as
    overlays

48. Cluster zones render as bands with opacity scaled by cluster score

49. Fibonacci levels auto-compute from detected swing points across 4
    timeframes

50. SPY-derived levels display with correct conversion via live basis

51. GEX landscape updates every 60 seconds with wall/flip detection

52. Setup cards appear with correct lifecycle (forming -\> ready -\>
    triggered/invalidated/expired)

53. Confluence score accurately reflects 5 independent signal layers

54. AI Coach delivers pre-trade briefs when setup reaches READY with
    confluence \>= 3

55. Contract selector recommends strike/expiry with computed R:R and P&L
    scenarios

56. Regime bar shows correct classification with real-time updates

**18.2 Design**

57. 100% brand compliance per Section 11 checklist

58. All animations implemented per Section 10.2 specification

59. Responsive design works at desktop (1024+), tablet (768-1023), and
    mobile (\<768)

60. No horizontal scroll on any viewport width

61. All touch targets \>= 44px on mobile

62. Reduced motion support (prefers-reduced-motion: reduce)

**18.3 Quality**

63. All unit tests pass (Vitest frontend + Jest backend)

64. All E2E tests pass (Playwright)

65. No TypeScript errors (strict mode)

66. No ESLint warnings

67. Performance targets met per Section 16

68. Error boundaries prevent cascading failures

69. Graceful degradation when external services unavailable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*End of Specification*

TradeITM --- The Emerald Standard --- Built by AI, Refined by Traders
