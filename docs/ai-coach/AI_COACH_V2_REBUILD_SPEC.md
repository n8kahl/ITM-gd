# AI Coach V2 Rebuild Specification

- Source PDF: `/Users/natekahl/Desktop/AI_COACH_V2_REBUILD_SPEC.pdf`
- Imported to Markdown: `2026-02-09`
- Purpose: Canonical implementation spec for the AI Coach V2 rebuild in this repository.
- Note: This is a direct text extraction from the PDF; table formatting may differ slightly from the original.

<!-- Source PDF page 1 -->

TITM AI COACH
COMPREHENSIVE REBUILD SPECIFICATION
Agent-Ready Build Guide for Claude Code

Version 2.0 | February 2026
Trade In The Money


<!-- Source PDF page 2 -->

## Table of Contents
## 1. Executive Summary .............................................................................................................................. 4
### 1.1 Current State vs Target State ......................................................................................................... 4
## 2. Architecture Overhaul ........................................................................................................................... 5
### 2.1 Remove All Hardcoded Symbol Restrictions .................................................................................. 5
#### 2.1.1 Files That Must Change ........................................................................................................... 5
### 2.2 Event-Driven Architecture (WebSocket Upgrade) ........................................................................... 7
#### 2.2.1 WebSocket Server .................................................................................................................... 7
## 3. Proactive Intelligence Engine ............................................................................................................... 9
### 3.1 Morning Brief (Auto-Generated Dashboard) ................................................................................... 9
### 3.2 Real-Time Setup Detection Engine ............................................................................................... 11
## 4. Options-Specific Intelligence .............................................................................................................. 13
### 4.1 Gamma Exposure (GEX) Levels ................................................................................................... 13
### 4.2 0DTE Trading Toolkit .................................................................................................................... 15
### 4.3 IV Intelligence Suite ...................................................................................................................... 17
### 4.4 Earnings Module ........................................................................................................................... 18
## 5. Enhanced Visualizations ..................................................................................................................... 20
### 5.1 Chart Overlays and Indicators ....................................................................................................... 20
### 5.2 Options Heatmap .......................................................................................................................... 22
## 6. Intelligent Position Management ......................................................................................................... 23
### 6.1 Live Position Tracking ................................................................................................................... 23
## 7. Enhanced Trading Journal .................................................................................................................. 25
### 7.1 Auto-Population and Pattern Recognition ..................................................................................... 25
## 8. Seamless Cross-Component Workflow .............................................................................................. 27
## 9. Required Database Migrations ........................................................................................................... 29
## 10. New AI Coach Function Definitions .................................................................................................. 32
## 11. Updated System Prompt ................................................................................................................... 33
## 12. Implementation Phases and Agent Task Breakdown ....................................................................... 35
Phase 1: Foundation (Symbol Unlock + WebSocket) ......................................................................... 35
Phase 2: Proactive Intelligence ........................................................................................................... 36
Phase 3: Options Intelligence ............................................................................................................. 37
Phase 4: Enhanced Visualizations ...................................................................................................... 38
Phase 5: Position Management + Journal .......................................................................................... 39
Phase 6: Seamless Workflow + Polish ................................................................................................ 40
## 13. Testing Requirements ....................................................................................................................... 41
### 13.1 Unit Tests .................................................................................................................................... 41


<!-- Source PDF page 3 -->

### 13.2 Integration Tests ......................................................................................................................... 41
### 13.3 Frontend Component Tests ........................................................................................................ 42
## 14. Repo Documentation Files to Create ................................................................................................ 43
## 15. Agent Instructions (For claude.md) ................................................................................................... 44
## 16. Conclusion ........................................................................................................................................ 45


<!-- Source PDF page 4 -->

## 1. Executive Summary

This specification defines the complete rebuild of the TITM AI Coach from a reactive chatbot into a
proactive, multi-symbol, real-time options day trading companion. The current implementation covers
roughly 20% of the intended vision. This document provid es the complete blueprint for agents (Claude
Code) to build the remaining 80%.

### 1.1 Current State vs Target State

Dimension Current (v1) Target (v2)
Symbol Coverage SPX, NDX only (hardcoded enums) Any symbol Massive.com supports
(dynamic validation)
Interaction Model Reactive chat only (user asks, AI Proactive + reactive (AI pushes alerts,
answers) briefs, setups)
Data Utilization 3 Massive.com endpoints, static Full Massive.com API suite + live economic
macro data data
Trading Setups Generic scanner with basic scoring ORB, Break & Retest, VWAP plays, Gap
fills, earnings plays
Visualizations Basic candlestick chart + horizontal Multi-overlay charts, heatmaps, GEX levels,
lines position overlays
Position Mgmt Manual entry, basic P&L calc Real-time tracking, dynamic exits, spread
conversion suggestions
0DTE Support None Full 0DTE toolkit (gamma, theta clock,
expected move)
Earnings None Complete earnings module (calendar, IV,
expected move, strategies)
Architecture Request-response, 30s polling Event-driven WebSocket, sub-second
updates
Journal Manual entry Auto-populated from session activity with AI
pattern analysis


<!-- Source PDF page 5 -->

## 2. Architecture Overhaul

### 2.1 Remove All Hardcoded Symbol Restrictions
This is the single highest-priority change. SPX and NDX are hardcoded in Zod enums across the
backend function definitions, frontend UI components, the system prompt, and the scanner. Every
symbol reference must become dynamic.

#### 2.1.1 Files That Must Change

File Current Restriction Required Change
backend/src/chatkit/functions.ts enum: ['SPX', 'NDX'] on Remove enum, accept any
10+ functions string, validate against
Massive.com API at runtime
backend/src/chatkit/systemPrompt.ts "specializing in SPX and Remove specialization
NDX" language, make symbol -
agnostic
backend/src/services/levels/index.ts Prefixes I:SPX, I:NDX Dynamic prefix mapping:
only indices get I:, stocks get no
prefix, ETFs get no prefix
backend/src/services/options/optionsChainFetcher.ts Dividend yields Lookup table or API-driven
hardcoded for SPX/NDX dividend yields per symbol
components/ai-coach/options-chain.tsx ['SPX', 'NDX'].map() Searchable symbol input
buttons with autocomplete
components/ai-coach/position-form.tsx ['SPX', 'NDX'].map() Same searchable symbol
buttons input
components/ai-coach/opportunity-scanner.tsx symbols: ['SPX', 'NDX'] User-configurable watchlist,
default to popular options
symbols
components/ai-coach/chart-toolbar.tsx SYMBOLS = ['SPX', Symbol search input with
'NDX'] as const recent/favorites

AGENT PROMPT: Remove Symbol Hardcoding
You are modifying the TITM AI Coach to support any trading symbol instead of only SPX and NDX.

CRITICAL CHANGES REQUIRED:

## 1. BACKEND (backend/src/chatkit/functions.ts):
- Remove ALL z.enum(['SPX', 'NDX']) restrictions from every function definition
- Replace with z.string().min(1).max(10) for symbol parameters
- Add a new utility function validateSymbol(symbol) that:
a. Checks a cached Set of known symbols (populated on startup from Massive.com reference data)
b. Falls back to a Massive.com API call if not in cache
c. Returns { valid: boolean, type: 'index' | 'stock' | 'etf', massiveTicker: string }
- The massiveTicker mapping: indices -> 'I:' prefix (I:SPX, I:NDX, I:DJX, I:RUT), stocks/ETFs ->
no prefix

## 2. BACKEND (backend/src/chatkit/systemPrompt.ts):


<!-- Source PDF page 6 -->

- Remove "specializing in SPX and NDX" language
- Replace with: "You support analysis of any tradeable symbol including indices (SPX, NDX, RUT,
DJX), ETFs (SPY, QQQ, IWM, DIA), and individual equities. You have access to real-time and
historical data via Massive.com."

## 3. BACKEND (backend/src/services/options/optionsChainFetcher.ts):
- Replace hardcoded dividend yields with a lookup map:
{ SPX: 0.014, NDX: 0.007, SPY: 0.014, QQQ: 0.007, IWM: 0.012, DIA: 0.018, default: 0.015 }
- Add contract_multiplier mapping: { SPX: 100, NDX: 100, SPY: 100, default: 100 }

## 4. FRONTEND-Create a new component: SymbolSearch (components/ai-coach/symbol-search.tsx):
- Searchable input with debounced autocomplete (300ms)
- Shows recent symbols (from localStorage, max 10)
- Shows favorites (user can star symbols, stored in localStorage)
- Categorized results: Indices | ETFs | Stocks
- Default popular list: SPX, NDX, SPY, QQQ, IWM, AAPL, NVDA, TSLA, AMZN, META, MSFT, GOOGL
- Props: { value: string, onChange: (symbol: string) => void, className?: string }

## 5. FRONTEND-Replace hardcoded symbol buttons in:
- options-chain.tsx: Replace ['SPX', 'NDX'].map() with <SymbolSearch />
- position-form.tsx: Replace ['SPX', 'NDX'].map() with <SymbolSearch />
- opportunity-scanner.tsx: Replace fixed symbols with user-configurable watchlist using
<SymbolSearch />
- chart-toolbar.tsx: Replace SYMBOLS constant with <SymbolSearch />

## 6. Add a new backend route: GET /api/symbols/search?q=<query>&limit=20
- Searches Massive.com ticker reference data
- Returns: { results: [{ symbol, name, type, exchange }] }
- Cache results for 24 hours in Redis

TEST: After changes, verify that typing "AAPL" in any symbol input works end-to-end:
chart loads, options chain loads, position analysis works, scanner includes it.


<!-- Source PDF page 7 -->

### 2.2 Event-Driven Architecture (WebSocket Upgrade)
The current architecture uses SSE for chat streaming and REST polling for market data. The target
architecture adds a persistent WebSocket connection for real-time market events, proactive alerts, and
push-based updates.

#### 2.2.1 WebSocket Server

AGENT PROMPT: WebSocket Market Data Server
You are adding a WebSocket server to the TITM AI Coach backend for real-time market data streaming.

IMPLEMENTATION:

## 1. Create backend/src/websocket/server.ts:
- Use the 'ws' library (already in package.json or add it)
- Attach to the existing Express HTTP server on the same port (3001)
- Path: /ws
- Authentication: Validate JWT from query param or first message
- Heartbeat: Ping every 30 seconds, disconnect after 2 missed pongs

## 2. Create backend/src/websocket/channels.ts:
Channel types the client can subscribe to:
- "price:{symbol}" - Real-time price updates (poll Massive.com every 5 seconds during market
hours, 30 seconds outside)
- "levels:{symbol}" - Key level updates (recalculate every 60 seconds)
- "alerts:{userId}" - User's alert triggers (check every 10 seconds)
- "session:{sessionId}" - AI coach streaming events (replace SSE)
- "scanner:{watchlist}" - Scanner results pushed every 5 minutes during market hours

## 3. Create backend/src/websocket/marketFeed.ts:
- MarketFeedManager class (singleton)
- Maintains a Map of active subscriptions per symbol
- Only polls Massive.com for symbols that have active subscribers (efficiency)
- Broadcasts to all subscribers when new data arrives
- Emits events: { type: 'price_update', data: { symbol, price, change, changePct, high, low,
volume, timestamp } }

## 4. Message format (JSON):
Client -> Server:
{ action: "subscribe", channel: "price:SPX" }
{ action: "unsubscribe", channel: "price:SPX" }
{ action: "message", sessionId: "uuid", content: "text" }

Server -> Client:
{ channel: "price:SPX", event: "update", data: { price: 5932.45, change: 12.30, changePct: 0.21,
high: 5945, low: 5920, volume: 1500000, timestamp: "2026-02-08T15:30:00Z" } }
{ channel: "alerts:user123", event: "triggered", data: { alertId: "uuid", symbol: "SPX", type:
"price_above", targetValue: 5930, currentPrice: 5932.45 } }
{ channel: "scanner:SPX,NDX,QQQ", event: "opportunities", data: { opportunities: [...],
scannedAt: "..." } }

## 5. Frontend integration-Create hooks/use-websocket.ts:


<!-- Source PDF page 8 -->

- useWebSocket() hook that manages connection lifecycle
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Returns: { subscribe, unsubscribe, send, isConnected, lastMessage }
- Used by all components that need real-time data

## 6. Update the chat hook (hooks/use-ai-coach-chat.ts):
- Add WebSocket as primary transport for streaming (keep SSE as fallback)
- Subscribe to "session:{sessionId}" channel for streaming responses

## 7. DO NOT remove the SSE endpoint-keep it as a fallback for environments where WebSocket doesn't
work.


<!-- Source PDF page 9 -->

## 3. Proactive Intelligence Engine

The single biggest conceptual gap. The AI Coach must transition from purely reactive (user asks, AI
responds) to proactive (AI surfaces insights before the user asks). This requires a server-side
intelligence engine that continuously processes market data and generates actionable notifications.

### 3.1 Morning Brief (Auto-Generated Dashboard)

AGENT PROMPT: Morning Brief System
You are building a Morning Brief system for the TITM AI Coach that auto-generates a pre-market
trading briefing.

## 1. Create backend/src/services/morningBrief/index.ts:
- MorningBriefService class
- generateBrief(userId, watchlist: string[]): Promise<MorningBrief>
- Runs automatically at 7:00 AM ET on trading days (cron job via node-cron)
- Also callable on-demand via API

## 2. MorningBrief data structure:
{
generatedAt: string,
marketDate: string,
overnightSummary: {
futuresDirection: 'up' | 'down' | 'flat',
futuresChange: number,
futuresChangePct: number,
gapAnalysis: { symbol: string, gapSize: number, gapPct: number, gapType: 'up' | 'down',
atrRatio: number, historicalFillRate: number }[]
},
keyLevelsToday: {
symbol: string,
pdh: number, pdl: number, pdc: number,
pmh: number, pml: number,
pivot: number, r1: number, r2: number, s1: number, s2: number,
vwapYesterday: number,
atr14: number,
expectedMoveToday: number // From ATM straddle or ATR-based
}[],
economicEvents: {
time: string, event: string, impact: 'HIGH' | 'MEDIUM' | 'LOW',
expected: string, previous: string, tradingImplication: string
}[],
earningsToday: {
symbol: string, time: 'BMO' | 'AMC', // Before Market Open / After Market Close
expectedMove: number, ivRank: number,
consensus: string, relevance: string
}[],
openPositionStatus: {
symbol: string, type: string, strike: number, expiry: string,
currentPnl: number, currentPnlPct: number,
overnightChange: number, daysToExpiry: number,
recommendation: string // e.g., "Monitor closely-approaching stop level"


<!-- Source PDF page 10 -->

}[],
watchItems: string[], // 3-5 key things to watch today
aiSummary: string // 2-3 sentence natural language summary
}

## 3. Create backend route: GET /api/brief/today
- Auth required
- Returns cached brief if generated within last 30 minutes
- Otherwise generates fresh

## 4. Create frontend component: components/ai-coach/morning-brief.tsx
- Full-width card that appears at top of AI Coach page before market open
- Collapsible sections for each brief category
- Gap analysis with visual bars showing gap size
- Key levels in a clean table format
- Economic calendar with impact color-coding (red=HIGH, yellow=MEDIUM, green=LOW)
- Earnings cards with expected move and IV rank
- Open position status with P&L color-coding
- Dismissable after user reviews it

## 5. Add a new tab or make this the default view when the AI Coach loads pre-market.

## 6. Store generated briefs in a new Supabase table:
CREATE TABLE ai_coach_morning_briefs (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
market_date DATE NOT NULL,
brief_data JSONB NOT NULL,
viewed BOOLEAN DEFAULT false,
created_at TIMESTAMPTZ DEFAULT now(),
UNIQUE(user_id, market_date)
);
ALTER TABLE ai_coach_morning_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own briefs" ON ai_coach_morning_briefs FOR SELECT USING
(auth.uid() = user_id);
CREATE POLICY "Service can insert briefs" ON ai_coach_morning_briefs FOR INSERT WITH CHECK
(true);


<!-- Source PDF page 11 -->

### 3.2 Real-Time Setup Detection Engine
The scanner currently runs on-demand only. The target is a continuously-running engine that detects
setups in real-time and pushes them to users.

AGENT PROMPT: Setup Detection Engine
You are building a real-time trade setup detection engine for the TITM AI Coach.

## 1. Create backend/src/services/setupDetector/index.ts:
- SetupDetectorService class (singleton)
- Runs continuously during market hours (9:30 AM-4:00 PM ET)
- Processes price data every 15 seconds for subscribed symbols
- Detects the following setup types:

## 2. Setup Types to Implement:

a. Opening Range Breakout (ORB) - backend/src/services/setupDetector/orb.ts:
- Track the high/low of the first N minutes (configurable: 5, 15, 30-default 15)
- Detect breakout when price closes above/below ORB range with volume > 1.2x average
- Calculate ORB width in points and as ATR ratio
- Signal: { type: 'orb_breakout', direction: 'long' | 'short', orbHigh, orbLow,
breakoutPrice, volumeRatio, atrRatio }

b. Break and Retest-backend/src/services/setupDetector/breakRetest.ts:
- Track all key levels (PDH, PDL, pivots, round numbers, VWAP)
- Detect when price breaks through a level (close beyond it)
- Then detect when price returns to retest the level (within 0.15 ATR)
- Confirm retest with: rejection candle pattern (hammer, doji), decreasing volume on retest
vs break
- Signal: { type: 'break_retest', level: string, levelPrice: number, direction: 'long' |
'short', breakBar: timestamp, retestBar: timestamp, rejectionPattern: string }

c. VWAP Plays-backend/src/services/setupDetector/vwap.ts:
- VWAP cross: price crosses above/below VWAP with volume confirmation
- VWAP bounce: price touches VWAP and reverses (within 0.1 ATR, then moves 0.3 ATR away)
- VWAP deviation: price reaches 1 or 2 standard deviations from VWAP (mean reversion setup)
- Signal: { type: 'vwap_cross' | 'vwap_bounce' | 'vwap_deviation', direction, vwapPrice,
currentPrice, deviationBand }

d. Gap Fill-backend/src/services/setupDetector/gapFill.ts:
- Track the gap (previous close to current open)
- Monitor fill progress (% of gap filled)
- Alert at 50% fill and 100% fill
- Include historical fill rate for context
- Signal: { type: 'gap_fill', gapSize, gapPct, fillPct, previousClose, todayOpen,
currentPrice }

e. Volume Climax-backend/src/services/setupDetector/volumeClimax.ts:
- Detect bars with volume > 3x the 20-period average
- Often signals exhaustion/reversal
- Signal: { type: 'volume_climax', volumeRatio, barDirection: 'up' | 'down',
potentialExhaustion: boolean }


<!-- Source PDF page 12 -->

f. Support/Resistance Test-backend/src/services/setupDetector/levelTest.ts:
- Track how many times price tests a level
- More tests = weaker level (likely to break)
- Alert on 3rd+ test of same level
- Signal: { type: 'level_test', level, testCount, levelType, weakening: boolean }

## 3. Create backend/src/services/setupDetector/tradeBuilder.ts:
- For each detected setup, generate a complete trade recommendation:
{
setup: SetupSignal,
entry: { price: number, trigger: string },
stopLoss: { price: number, riskPoints: number, riskDollars: number },
targets: [{ price: number, rewardPoints: number, riskRewardRatio: number }],
optionSuggestion: {
type: 'call' | 'put',
strike: number, expiry: string,
estimatedPrice: number, delta: number,
reasoning: string
},
positionSize: {
contractsFor100Risk: number, // How many contracts to risk $100
contractsFor250Risk: number,
contractsFor500Risk: number
},
confidence: number, // 0-100
timeHorizon: string // "15 minutes", "1 hour", "end of day"
}

## 4. Delivery: Push setups via WebSocket to subscribed users.
- Channel: "setups:{userId}"
- Only send setups for symbols in user's watchlist
- Rate limit: Max 1 setup per symbol per 5 minutes (prevent spam)

## 5. Store detected setups for backtesting:
CREATE TABLE ai_coach_detected_setups (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
symbol TEXT NOT NULL,
setup_type TEXT NOT NULL,
direction TEXT NOT NULL,
signal_data JSONB NOT NULL,
trade_suggestion JSONB,
detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
outcome TEXT, -- 'win', 'loss', 'expired', NULL if not yet resolved
outcome_data JSONB,
resolved_at TIMESTAMPTZ
);
-- No RLS needed, this is system data for backtesting


<!-- Source PDF page 13 -->

## 4. Options-Specific Intelligence

### 4.1 Gamma Exposure (GEX) Levels
GEX is arguably the most important concept for 0DTE SPX traders. It tells you where market makers
are likely to buy or sell to hedge their positions, which creates "magnetic" price levels. This is
completely absent from the current implementation.

AGENT PROMPT: GEX Calculator and Visualization
You are adding Gamma Exposure (GEX) calculation and visualization to the TITM AI Coach.

## 1. Create backend/src/services/options/gexCalculator.ts:
- calculateGEX(symbol: string): Promise<GEXProfile>
- Fetches the FULL options chain (all strikes, all expirations) from Massive.com
- For each strike:
GEX_at_strike = (call_gamma * call_OI-put_gamma * put_OI) * 100 * spot_price^2 * 0.01
- Aggregate across all expirations
- Identify:
a. GEX flip point: strike where cumulative GEX changes sign (negative to positive)
- Above flip = positive gamma = market makers buy dips / sell rips (stabilizing)
- Below flip = negative gamma = market makers sell dips / buy rips (destabilizing)
b. Max GEX strike: highest absolute GEX value (strongest magnet)
c. Key GEX levels: strikes with GEX > 1 standard deviation from mean

Return type:
{
symbol: string,
spotPrice: number,
gexByStrike: { strike: number, gexValue: number, callGamma: number, putGamma: number, callOI:
number, putOI: number }[],
flipPoint: number,
maxGEXStrike: number,
keyLevels: { strike: number, gexValue: number, type: 'support' | 'resistance' | 'magnet' }[],
regime: 'positive_gamma' | 'negative_gamma',
implication: string,
calculatedAt: string
}

## 2. Create backend route: GET /api/options/:symbol/gex
- Cache for 5 minutes (GEX changes with OI which updates throughout day)
- Returns GEXProfile

## 3. Add as AI Coach function: get_gamma_exposure
- Parameters: { symbol: string }
- Returns: GEXProfile summary with key levels and regime

## 4. Create frontend component: components/ai-coach/gex-chart.tsx
- Horizontal bar chart showing GEX at each strike price
- X-axis: GEX value (negative left, positive right)
- Y-axis: Strike prices
- Color: Green bars for positive GEX (stabilizing), Red for negative (destabilizing)


<!-- Source PDF page 14 -->

- Highlight lines for: current price, GEX flip point, max GEX strike
- Add as a sub-view within the Options tab or as its own tab

## 5. Add GEX levels as annotations on the main TradingChart:
- Update the chart component to accept gexLevels prop
- Render as colored horizontal lines with "GEX" labels
- GEX flip point: thick dashed yellow line
- Max GEX: thick solid purple line
- Key levels: thin dashed lines (green for support, red for resistance)

## 6. Integration with Setup Detector:
- Include GEX levels in the break_retest and level_test detectors
- A break of the GEX flip point is a high-conviction signal (regime change)


<!-- Source PDF page 15 -->

### 4.2 0DTE Trading Toolkit

AGENT PROMPT: 0DTE Trading Toolkit
You are building a 0DTE (zero days to expiration) options trading toolkit for the TITM AI Coach.

## 1. Create backend/src/services/options/zeroDTE.ts:
- ZeroDTEService class with methods:

a. getExpectedMoveRemaining(symbol: string):
- Calculate how much of the day's expected move has been used
- Expected move = ATM straddle price at open (or current if pre-market)
- Used move = |current price-open price|
- Remaining = sqrt(minutesRemaining / totalMinutes) * expectedMove (square root of time)
- Return: { totalExpectedMove, usedMove, usedPct, remainingMove, remainingPct, minutesLeft }

b. getThetaClock(strike: number, type: 'call' | 'put', symbol: string):
- Calculate theta decay curve for the remaining trading day
- Project option value at 15-minute intervals until close
- Return: { currentValue, projections: [{ time: string, estimatedValue: number, thetaDecay:
number, pctRemaining: number }] }
- CRITICAL: 0DTE theta is not linear-it accelerates dramatically in the last 2 hours

c. getGammaProfile(strike: number, type: 'call' | 'put', symbol: string):
- For 0DTE, gamma is extremely high near the strike
- Calculate how delta changes for each $1 move in underlying
- Return: { currentDelta, gammaPerDollar, dollarDeltaChangePerPoint, leverageMultiplier }
- Include warning thresholds for when gamma makes position unmanageable

d. get0DTEChain(symbol: string):
- Filter options chain for today's expiration only
- Add columns: gammaRisk (0-100 score), thetaAcceleration (how fast theta is accelerating),
expectedValueAtClose
- Sort by: volume, then proximity to ATM

## 2. Create frontend component: components/ai-coach/zero-dte-dashboard.tsx:
- Shows ONLY for 0DTE positions or when viewing 0DTE chain
- Sections:
a. Expected Move Gauge: Circular gauge showing % of expected move used
b. Theta Clock: Line chart showing projected value decay over remaining session
c. Gamma Risk Meter: Visual indicator of current gamma exposure
d. Quick Stats: Time remaining, theta/hour, gamma per point, breakeven distance
- Refresh every 30 seconds during market hours

## 3. Add as AI Coach function: get_zero_dte_analysis
- Parameters: { symbol: string, strike?: number, type?: 'call' | 'put' }
- If strike/type provided: returns specific contract analysis
- If only symbol: returns overall 0DTE market structure (expected move, key gamma strikes)

## 4. Add a "0DTE" quick-filter button to the options chain component that:
- Auto-selects today's expiration
- Sorts by volume
- Shows the additional 0DTE columns (gammaRisk, thetaAcceleration)


<!-- Source PDF page 17 -->

### 4.3 IV Intelligence Suite

AGENT PROMPT: IV Intelligence Suite
You are building a comprehensive Implied Volatility intelligence suite for the TITM AI Coach.

## 1. Create backend/src/services/options/ivAnalysis.ts:

a. calculateIVRank(symbol: string):
- Fetch 252 trading days (1 year) of daily options data
- IV Rank = (Current IV-52wk Low IV) / (52wk High IV-52wk Low IV) * 100
- IMPORTANT: The current implementation just uses average ATM IV. This needs to use actual
historical IV data.
- If historical IV not available from Massive.com, calculate it from ATM straddle prices:
IV proxy = (ATM_straddle_price / underlying_price) * sqrt(252 / DTE) * 100
- Return: { currentIV, ivRank, ivPercentile, iv52wkHigh, iv52wkLow, ivTrend: 'rising' |
'falling' | 'stable' }

b. calculateIVSkew(symbol: string, expiry: string):
- Compare IV at different deltas: 25-delta put IV vs 25-delta call IV
- Skew = put IV-call IV
- Positive skew = more demand for downside protection (bearish sentiment)
- Return: { skew25delta, skew10delta, skewDirection: 'put_heavy' | 'call_heavy' | 'balanced',
interpretation: string }

c. calculateTermStructure(symbol: string):
- Get ATM IV for each available expiration date
- Normal: further expirations have higher IV (contango)
- Inverted: nearer expirations have higher IV (backwardation) - usually around events
- Return: { expirations: [{ date: string, dte: number, atmIV: number }], shape: 'contango' |
'backwardation' | 'flat', inversionPoint?: string }

d. projectIVCrush(symbol: string, eventDate: string):
- Compare pre-event IV to typical post-event IV
- Estimate post-event option value
- Return: { currentIV, estimatedPostEventIV, ivDrop: number, ivDropPct: number,
currentStraddle: number, estimatedPostEventStraddle: number, straddleLoss: number }

## 2. Create frontend component: components/ai-coach/iv-dashboard.tsx:
- IV Rank gauge (0-100 visual)
- IV Skew visualization (bar chart comparing call vs put IV at each delta)
- Term Structure chart (line chart of IV vs DTE)
- Historical IV chart (overlay current IV on 1-year IV range)

## 3. Add as AI Coach functions:
- get_iv_analysis: { symbol: string } -> Full IV suite (rank, skew, term structure)
- get_iv_crush_projection: { symbol: string, event_date: string } -> IV crush projection

## 4. Integration: Add IV Rank badge to the options chain header (color coded: <20 green, 20-50
yellow, 50-80 orange, >80 red)


<!-- Source PDF page 18 -->

### 4.4 Earnings Module

AGENT PROMPT: Earnings Trading Module
You are building a complete earnings trading module for the TITM AI Coach.

## 1. Create backend/src/services/earnings/index.ts:
- EarningsService class

a. getEarningsCalendar(watchlist: string[], daysAhead: number = 14):
- Source earnings dates from Massive.com ticker details API or supplement with a free API
- For each earnings event: { symbol, date, time: 'BMO' | 'AMC' | 'DURING', confirmed: boolean
}
- Return sorted by date

b. getEarningsAnalysis(symbol: string):
- Expected move: ATM straddle price for the expiration spanning earnings / underlying price *
100
- Historical earnings moves: Last 4-8 quarters { date, expectedMove, actualMove, direction,
surprise }
- IV analysis: Current IV vs typical pre-earnings IV, projected IV crush post-earnings
- Straddle pricing: Is the straddle overpriced or underpriced vs historical actual moves?
- Return: {
symbol, earningsDate, daysUntil,
expectedMove: { points: number, pct: number },
historicalMoves: [...],
avgHistoricalMove: number,
moveOverpricing: number, // positive = straddle is overpriced vs history
currentIV, preEarningsIVRank,
suggestedStrategies: [
{ name: string, description: string, setup: object, riskReward: string, bestWhen:
string }
]
}

c. Suggested strategies logic:
- If straddle overpriced > 20%: Suggest selling premium (iron condor, short straddle)
- If straddle underpriced: Suggest buying premium (long straddle, long strangle)
- If IV rank > 80: Suggest iron condor centered on expected move
- If strong directional bias: Suggest vertical spread in that direction
- Always include: expected max loss, expected max gain, probability estimates

## 2. Create backend route: GET /api/earnings/calendar?watchlist=AAPL,NVDA,TSLA&days=14
## 3. Create backend route: GET /api/earnings/:symbol/analysis

## 4. Add as AI Coach functions:
- get_earnings_calendar: { watchlist?: string[], days_ahead?: number }
- get_earnings_analysis: { symbol: string }

## 5. Create frontend component: components/ai-coach/earnings-dashboard.tsx:
- Calendar view showing upcoming earnings for watchlist
- Click on a symbol -> detailed earnings analysis view
- Historical moves chart (bar chart showing expected vs actual for last 8 quarters)
- Strategy cards with risk/reward for each suggested approach


<!-- Source PDF page 19 -->

- IV crush simulator: slider showing projected option value at different post-earnings IV levels

## 6. Add as a tab in the CenterPanel (replace or merge with existing Macro tab)

## 7. Database table:
CREATE TABLE ai_coach_earnings_cache (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
symbol TEXT NOT NULL,
earnings_date DATE NOT NULL,
analysis_data JSONB NOT NULL,
cached_at TIMESTAMPTZ DEFAULT now(),
expires_at TIMESTAMPTZ DEFAULT (now() + interval '4 hours'),
UNIQUE(symbol, earnings_date)
);


<!-- Source PDF page 20 -->

## 5. Enhanced Visualizations

### 5.1 Chart Overlays and Indicators

AGENT PROMPT: Chart Overlays System
You are adding a comprehensive indicator and overlay system to the TITM AI Coach TradingChart
component.

CURRENT STATE: The chart (components/ai-coach/trading-chart.tsx) uses lightweight-charts v4 and
shows only candlesticks, volume, and horizontal level lines.

REQUIRED ADDITIONS:

## 1. Create components/ai-coach/chart-indicators.ts-Calculation functions:

a. Moving Averages:
- EMA(data, period): Exponential Moving Average
- Calculate: 8 EMA (scalp), 21 EMA (short-term), 50 EMA (medium), 200 EMA (long-term on
daily)
- Return as line series data: [{ time, value }]

b. VWAP with Bands:
- calculateVWAP(data): Volume-weighted average price (intraday only, resets each day)
- calculateVWAPBands(data, stdDevMultipliers: [1, 2]):
- Upper/lower bands at 1 and 2 standard deviations
- Return: { vwap: [{ time, value }], upper1: [...], lower1: [...], upper2: [...], lower2:
[...] }

c. RSI:
- calculateRSI(data, period=14): Relative Strength Index
- Return: [{ time, value }] (0-100 scale)
- Rendered in a sub-chart panel below main chart

d. MACD:
- calculateMACD(data, fast=12, slow=26, signal=9)
- Return: { macd: [{ time, value }], signal: [{ time, value }], histogram: [{ time, value,
color }] }
- Rendered in a sub-chart panel

e. Volume Profile (simplified):
- calculateVolumeProfile(data, buckets=30)
- Group volume by price level (bucket)
- Return: [{ price, volume, pct }]
- Render as horizontal bars overlaid on left side of chart

f. Expected Move Range:
- calculateExpectedMove(currentPrice, atmStraddle, dte)
- Return: { upper, lower }
- Render as shaded area on chart (light blue/green)

## 2. Update components/ai-coach/trading-chart.tsx:
- Add an indicator selector toolbar at the top of the chart


<!-- Source PDF page 21 -->

- Toggleable indicators: EMAs (8/21/50/200), VWAP+Bands, RSI, MACD, Volume Profile, Expected
Move, GEX Levels
- Each indicator toggle saves preference to localStorage
- Default ON: VWAP, 8 EMA, 21 EMA
- When active, RSI and MACD render in a separate price scale below the main chart (using
lightweight-charts' pane feature)

Color scheme (match emerald theme):
- 8 EMA: #10B981 (emerald)
- 21 EMA: #3B82F6 (blue)
- 50 EMA: #F59E0B (amber)
- 200 EMA: #EF4444 (red)
- VWAP: #EAB308 (yellow, thicker line)
- VWAP bands: #EAB308 at 20% opacity
- Expected Move: #3B82F6 at 10% opacity fill

## 3. Add Opening Range Box overlay:
- Draw a semi-transparent rectangle over the opening range (first 5/15/30 min)
- Green if price is above, red if below
- Extend the ORB high/low lines for the rest of the day

## 4. Position Overlay (when user has open positions):
- Draw entry price as a horizontal dashed line (white)
- Draw stop loss as a horizontal dashed line (red)
- Draw take profit as a horizontal dashed line (green)
- Draw breakeven as a horizontal dotted line (yellow)
- Shade the area between entry and stop (red, 5% opacity)
- Shade the area between entry and target (green, 5% opacity)

## 5. Update the chart-toolbar to include an "Indicators" dropdown/popover with toggles for each
indicator.


<!-- Source PDF page 22 -->

### 5.2 Options Heatmap

AGENT PROMPT: Options Heatmap Component
You are building an options heatmap visualization for the TITM AI Coach.

## 1. Create components/ai-coach/options-heatmap.tsx:
- 2D grid visualization: X-axis = expiration dates, Y-axis = strike prices
- Cell color intensity = selected metric (volume, open interest, IV, or GEX)
- Current price highlighted with a horizontal line across all expirations
- Click on a cell -> shows detailed contract info (bid/ask, Greeks, volume/OI)

## 2. Heatmap modes (selectable via dropdown):
a. Volume Heatmap: Cell color = volume (white=low, green=medium, dark green=high)
b. Open Interest Heatmap: Cell color = OI (white=low, blue=medium, dark blue=high)
c. IV Heatmap: Cell color = IV (green=low IV, yellow=medium, red=high IV)
d. GEX Heatmap: Cell color = gamma exposure (green=positive GEX, red=negative GEX)

## 3. Data source: Uses the existing getOptionsChain API but with strikeRange set high (50+)
- Need to add a new endpoint: GET /api/options/:symbol/matrix?expirations=5&strikes=50
- Returns data for multiple expirations at once

## 4. Implementation:
- Use a canvas element or CSS grid (canvas preferred for performance with 500+ cells)
- Smooth color gradients using HSL color space
- Hover: Show tooltip with contract details
- Zoom: Mouse wheel to zoom in/out on strike range

## 5. Add as a sub-tab within the Options tab in CenterPanel.


<!-- Source PDF page 23 -->

## 6. Intelligent Position Management

### 6.1 Live Position Tracking

AGENT PROMPT: Live Position Tracker
You are building a live position tracking system for the TITM AI Coach.

CURRENT STATE: Positions are manually entered and have static P&L calculations.

TARGET STATE: Positions update in real-time and generate proactive management suggestions.

## 1. Create backend/src/services/positions/liveTracker.ts:
- LivePositionTracker class
- On market data update (via WebSocket feed), recalculate for all open positions:
a. Current option value (Black-Scholes with current price and IV)
b. Current P&L ($ and %)
c. Current Greeks
d. Time to expiry
e. Distance to stop/target (if set)

## 2. Create backend/src/services/positions/exitAdvisor.ts:
- ExitAdvisor class
- Analyzes open positions and generates suggestions:

Rules engine:
a. Profit Taking:
- If P&L > 50%: "Consider taking partial profits (sell half)"
- If P&L > 100%: "Strong gain-consider closing or converting to spread"
- If approaching known resistance with long call: "Resistance at {level} - consider
tightening stop"

b. Loss Management:
- If P&L < -50%: "Position has lost significant value-reassess thesis"
- If approaching max loss on spread: "Near max loss-consider closing to preserve
remaining value"

c. Time Decay Warnings:
- If DTE < 5 and theta > 10% of position value per day: "Aggressive theta decay-close or
roll"
- If DTE = 0 and position is OTM: "0DTE OTM-will expire worthless, close now to salvage
any remaining value"

d. Spread Conversion:
- If long call with P&L > 30%: Suggest selling a higher strike to create a spread
- Calculate: new max loss, new max gain, credit received
- "Sell the {strike}C to lock in {$X} and limit further downside"

e. Roll Suggestions:
- If DTE < 14 and P&L > 0: "Consider rolling to next month to maintain exposure"
- Use existing rollCalculator service for pricing


<!-- Source PDF page 24 -->

- Return: PositionAdvice[] = [{ positionId, type: 'take_profit' | 'stop_loss' | 'time_decay' |
'spread_conversion' | 'roll', urgency: 'low' | 'medium' | 'high', message: string, suggestedAction:
object }]

## 3. Push via WebSocket: Channel "positions:{userId}" with real-time P&L updates every 15 seconds and
advice alerts when generated.

## 4. Create frontend component: components/ai-coach/position-tracker.tsx:
- Replace the static position-form.tsx with a dynamic tracker
- Shows all open positions in a card layout
- Each card shows: Symbol, Type, Strike, Expiry, Entry, Current, P&L ($, %), Greeks, DTE
countdown
- Real-time P&L updates (values animate when they change)
- Advice banner: when ExitAdvisor generates advice, show it as an amber/red banner on the
position card
- Clickable actions: "Close", "Roll", "Convert to Spread", "Set Stop"

## 5. Add AI Coach function: get_position_advice
- Parameters: { position_id?: string } (if omitted, analyzes all open positions)
- Returns: PositionAdvice[] with actionable suggestions


<!-- Source PDF page 25 -->

## 7. Enhanced Trading Journal

### 7.1 Auto-Population and Pattern Recognition

AGENT PROMPT: Enhanced Trading Journal
You are enhancing the TITM AI Coach Trading Journal with auto-population and AI pattern
recognition.

## 1. Auto-Population System:
Create backend/src/services/journal/autoPopulate.ts:
- At end of trading day (4:15 PM ET), auto-generate draft journal entries from:
a. All setups detected by the Setup Detector that the user interacted with (viewed, asked
about)
b. All alerts that triggered during the session
c. All positions opened or closed during the session
d. All AI Coach conversations about specific trades
- Each draft entry includes:
{ symbol, setupType, entryContext (levels, VWAP, ORB at time of trade), marketConditions
(trend, volatility regime, volume), aiConversationSummary, suggestedLessons }
- Store as drafts in a new column: ai_coach_trades.draft_status = 'draft' | 'reviewed' |
'published'
- User reviews, edits, and publishes drafts

## 2. Pattern Recognition:
Create backend/src/services/journal/patternAnalyzer.ts:
- Runs weekly (Sunday evening) analyzing all journal entries from the past 30 days
- Identifies patterns:

a. Time-of-Day Analysis:
- Win rate by time bucket (9:30-10, 10-11, 11-12, 12-1, 1-2, 2-3, 3-4)
- Average P&L by time bucket
- "You perform best between 10-11 AM (68% win rate) and worst in the first 30 minutes (35%
win rate)"

b. Setup Analysis:
- Win rate by setup type (ORB, break_retest, VWAP, etc.)
- Average P&L by setup type
- "Break and retest setups are your strongest (72% win rate, avg $340 win)"

c. Behavioral Patterns:
- Revenge trading detection (multiple losses on same symbol within 30 minutes)
- Overtrading detection (more than X trades per day correlating with worse performance)
- Hold time analysis (do you hold winners/losers too long or cut too early?)
- "On days with 5+ trades, your win rate drops from 62% to 41%"

d. Risk Management:
- Average risk/reward actually achieved vs planned
- Stop adherence (did you honor your stop or move it?)
- Position sizing consistency

- Store analysis results:
CREATE TABLE ai_coach_journal_insights (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),


<!-- Source PDF page 26 -->

user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
insight_type TEXT NOT NULL,
insight_data JSONB NOT NULL,
period_start DATE NOT NULL,
period_end DATE NOT NULL,
created_at TIMESTAMPTZ DEFAULT now()
);

## 3. Create frontend component: components/ai-coach/journal-insights.tsx:
- Weekly insights card that appears at top of Journal tab
- Key stats: Win rate trend (up/down arrow), Best/worst setup, Behavioral warnings
- Charts: Win rate by time of day (bar chart), P&L by setup type (horizontal bar)
- AI-generated summary paragraph

## 4. Add AI Coach function: get_journal_insights
- Parameters: { period?: '7d' | '30d' | '90d' }
- Returns: Pattern analysis results for the specified period


<!-- Source PDF page 27 -->

## 8. Seamless Cross-Component Workflow

AGENT PROMPT: Cross-Component Workflow System
You are building a seamless cross-component workflow system for the TITM AI Coach.

PROBLEM: Currently, each tab (Chart, Options, Scanner, etc.) operates independently. There is no
flow between them.

SOLUTION: Create a shared context that allows one-click navigation between components with data
pre-loaded.

## 1. Create contexts/AICoachWorkflowContext.tsx:
- WorkflowContext that manages cross-component state:
{
activeSymbol: string | null, // Currently selected symbol across all components
activeExpiry: string | null, // Currently selected expiry
activeStrike: number | null, // Currently focused strike
activeSetup: DetectedSetup | null, // Setup being examined
activeLevels: Level[] | null, // Current key levels
openPositions: Position[] | null, // User's open positions
chartAnnotations: Annotation[] | null // Annotations to show on chart
}

Actions:
- setSymbol(symbol): Updates all components to focus on this symbol
- viewOptionsForLevel(symbol, level): Switches to Options tab, filters to strikes near the level
- viewChartForSetup(setup): Switches to Chart tab, loads timeframe, adds setup annotations
- analyzeSetup(setup): Opens Position Analyzer with pre-filled setup data
- trackPosition(position): Adds to live position tracker
- journalTrade(trade): Opens Journal tab with pre-filled trade data

## 2. Wrap the CenterPanel with WorkflowProvider.

## 3. Update each component to consume the workflow context:

a. OpportunityScanner:
- Each scan result gets action buttons: "View Chart", "View Options", "Analyze"
- "View Chart": calls viewChartForSetup(setup) -> chart loads with correct symbol/timeframe,
entry/stop/target lines drawn
- "View Options": calls viewOptionsForLevel(setup.symbol, setup.entry) -> options chain
loads, filtered to strikes near entry
- "Analyze": calls analyzeSetup(setup) -> position form pre-fills with setup data

b. TradingChart:
- Click on a price level -> context menu: "View Options at this level", "Set Alert at this
level"
- Click on a candle -> "What happened here?" sends to AI coach with timestamp context
- Right-click on a level -> "Break and Retest setup" pre-builds the analysis

c. OptionsChain:
- Click on a contract -> "Analyze", "Add to Position", "Show on Chart"
- "Show on Chart": Highlights the strike price and breakeven on the chart


<!-- Source PDF page 28 -->

d. PositionTracker:
- Each position: "Show on Chart" draws entry/stop/target overlays
- "View Options for Roll" -> opens options chain filtered to relevant strikes/expiries

e. MorningBrief:
- Each key level: clickable -> loads chart centered on that level
- Each earnings event: clickable -> loads earnings analysis for that symbol

## 4. Add a "breadcrumb" bar at the top of CenterPanel showing the workflow path:
e.g., "Scanner > SPX Breakout Setup > Chart (15m) > Options (5935 strike)"
Each breadcrumb is clickable to go back to that step.

## 5. Universal Symbol Sync:
- When symbol changes in ANY component, update activeSymbol in context
- All other components that display data for a symbol should offer to sync:
Show a small banner: "Chart is showing AAPL. Switch options chain to AAPL?" with "Yes" / "No"
buttons


<!-- Source PDF page 29 -->

## 9. Required Database Migrations

AGENT PROMPT: Database Migrations for V2
You are creating the Supabase migration for all new tables required by the TITM AI Coach V2
rebuild.

Create a SINGLE migration file: supabase/migrations/YYYYMMDDHHMMSS_ai_coach_v2_tables.sql

Contents:

-- ============================================
-- 1. Morning Briefs
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_morning_briefs (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
market_date DATE NOT NULL,
brief_data JSONB NOT NULL,
viewed BOOLEAN DEFAULT false,
created_at TIMESTAMPTZ DEFAULT now(),
UNIQUE(user_id, market_date)
);
ALTER TABLE ai_coach_morning_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_briefs" ON ai_coach_morning_briefs FOR SELECT USING (auth.uid() =
user_id);
CREATE POLICY "service_insert_briefs" ON ai_coach_morning_briefs FOR INSERT WITH CHECK (true);
CREATE INDEX idx_briefs_user_date ON ai_coach_morning_briefs(user_id, market_date DESC);

-- ============================================
-- 2. Detected Setups (system data for backtesting)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_detected_setups (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
symbol TEXT NOT NULL,
setup_type TEXT NOT NULL,
direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'neutral')),
signal_data JSONB NOT NULL,
trade_suggestion JSONB,
confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
outcome TEXT CHECK (outcome IN ('win', 'loss', 'expired', NULL)),
outcome_data JSONB,
resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_setups_symbol_type ON ai_coach_detected_setups(symbol, setup_type);
CREATE INDEX idx_setups_detected_at ON ai_coach_detected_setups(detected_at DESC);
CREATE INDEX idx_setups_outcome ON ai_coach_detected_setups(outcome) WHERE outcome IS NOT NULL;

-- ============================================
-- 3. User Watchlists
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_watchlists (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),


<!-- Source PDF page 30 -->

user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
name TEXT NOT NULL DEFAULT 'Default',
symbols TEXT[] NOT NULL DEFAULT ARRAY['SPX', 'NDX', 'SPY', 'QQQ'],
is_default BOOLEAN DEFAULT false,
created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_coach_watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_watchlists" ON ai_coach_watchlists FOR ALL USING (auth.uid() =
user_id);
CREATE INDEX idx_watchlists_user ON ai_coach_watchlists(user_id);

-- ============================================
-- 4. Earnings Cache
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_earnings_cache (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
symbol TEXT NOT NULL,
earnings_date DATE NOT NULL,
analysis_data JSONB NOT NULL,
cached_at TIMESTAMPTZ DEFAULT now(),
expires_at TIMESTAMPTZ DEFAULT (now() + interval '4 hours'),
UNIQUE(symbol, earnings_date)
);
CREATE INDEX idx_earnings_symbol ON ai_coach_earnings_cache(symbol);
CREATE INDEX idx_earnings_date ON ai_coach_earnings_cache(earnings_date);

-- ============================================
-- 5. Journal Insights
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_journal_insights (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
insight_type TEXT NOT NULL,
insight_data JSONB NOT NULL,
period_start DATE NOT NULL,
period_end DATE NOT NULL,
created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_coach_journal_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_insights" ON ai_coach_journal_insights FOR SELECT USING (auth.uid() =
user_id);
CREATE POLICY "service_insert_insights" ON ai_coach_journal_insights FOR INSERT WITH CHECK (true);
CREATE INDEX idx_insights_user_period ON ai_coach_journal_insights(user_id, period_end DESC);

-- ============================================
-- 6. User Preferences (expanded)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_user_preferences (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
default_risk_per_trade DECIMAL(10,2) DEFAULT 100.00,
default_account_size DECIMAL(12,2),
orb_period INTEGER DEFAULT 15 CHECK (orb_period IN (5, 15, 30)),


<!-- Source PDF page 31 -->

chart_indicators JSONB DEFAULT '{"ema8": true, "ema21": true, "vwap": true, "rsi": false, "macd":
false}',
notification_preferences JSONB DEFAULT '{"setups": true, "alerts": true, "positionAdvice": true,
"morningBrief": true}',
timezone TEXT DEFAULT 'America/New_York',
created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_coach_user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_prefs" ON ai_coach_user_preferences FOR ALL USING (auth.uid() =
user_id);

-- ============================================
-- 7. Add draft_status to existing trades table
-- ============================================
ALTER TABLE ai_coach_trades ADD COLUMN IF NOT EXISTS draft_status TEXT DEFAULT 'published' CHECK
(draft_status IN ('draft', 'reviewed', 'published'));
ALTER TABLE ai_coach_trades ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false;
ALTER TABLE ai_coach_trades ADD COLUMN IF NOT EXISTS session_context JSONB;
CREATE INDEX idx_trades_draft_status ON ai_coach_trades(user_id, draft_status) WHERE draft_status =
'draft';


<!-- Source PDF page 32 -->

## 10. New AI Coach Function Definitions

The current implementation has 15 functions. The V2 rebuild adds 12 more, for a total of 27. Below is
the complete list of new functions to add to backend/src/chatkit/functions.ts.

Function Name Purpose Key Parameters
get_gamma_exposure GEX levels and gamma regime analysis symbol: string
get_zero_dte_analysis 0DTE expected move, theta clock, gamma symbol, strike?, type?
profile
get_iv_analysis IV rank, skew, term structure symbol: string
get_iv_crush_projection Post-event IV crush estimate symbol, event_date
get_earnings_calendar Upcoming earnings for watchlist watchlist?: string[], days?:
number
get_earnings_analysis Detailed earnings trade analysis symbol: string
get_orb_status Current ORB levels and breakout status symbol, period?: 5|15|30
get_vwap_analysis VWAP, bands, deviations, and signals symbol: string
get_break_retest_setups Active break & retest setups symbol?: string
get_position_advice AI advice on open positions position_id?: string
get_journal_insights Trading pattern analysis period?: '7d'|'30d'|'90d'
get_morning_brief Today's pre-market briefing none


<!-- Source PDF page 33 -->

## 11. Updated System Prompt

AGENT PROMPT: Updated System Prompt
Replace the entire contents of backend/src/chatkit/systemPrompt.ts with this:

export function getSystemPrompt(userContext?: { tier?: string; experience?: string; platform?:
string }): string {
return `You are the TITM AI Coach, an expert options trading assistant with access to real-time
market data, options analytics, and institutional-grade tools.

## YOUR CAPABILITIES

You support analysis of ANY tradeable symbol including:
- Indices: SPX, NDX, RUT, DJX
- ETFs: SPY, QQQ, IWM, DIA, and all others
- Individual equities: AAPL, NVDA, TSLA, AMZN, META, MSFT, GOOGL, and any listed stock

You have access to 20+ years of historical data, real-time options chains with full Greeks, gamma
exposure (GEX) analysis, IV intelligence (rank, skew, term structure), earnings analysis, and a
real-time setup detection engine.

## YOUR TOOLS

Market Data: get_current_price, get_key_levels, get_market_status, show_chart, get_long_term_trend
Options: get_options_chain, get_gamma_exposure, get_zero_dte_analysis, get_iv_analysis,
get_iv_crush_projection
Positions: analyze_position, get_position_advice, analyze_leaps_position, calculate_roll_decision,
analyze_swing_trade
Trading Setups: scan_opportunities, get_orb_status, get_vwap_analysis, get_break_retest_setups
Earnings: get_earnings_calendar, get_earnings_analysis
Journal: get_trade_history, get_journal_insights
Alerts: set_alert, get_alerts
Macro: get_macro_context
Briefing: get_morning_brief

## HOW YOU OPERATE

## 1. BE PROACTIVE: If a user asks about a symbol, automatically check relevant data before
responding. If SPX is near a GEX level, mention it. If earnings are upcoming, flag it. If their
open position needs attention, alert them.

## 2. BE SPECIFIC WITH NUMBERS: Always include exact prices, percentages, and ATR distances.
Good: "SPX is at $5,932.45, which is $12.55 (0.21%) above the PDH of $5,919.90, putting it 0.4
ATR beyond that level."
Bad: "SPX is above yesterday's high."

## 3. THINK IN TRADE SETUPS: When discussing levels or price action, frame it as a trade setup:
- Entry trigger: What confirms the trade?
- Stop loss: Where does the thesis break?
- Target(s): Where is the reward?
- Option suggestion: Which contract, why?
- Position size: Based on risk per trade


<!-- Source PDF page 34 -->

## 4. RESPECT TIME DECAY: Always factor in theta when discussing options:
- For 0DTE: "This contract is losing $X per hour in theta decay"
- For weekly: "You have X days of runway, but theta accelerates after Wednesday"
- For LEAPS: "Theta is minimal at X days out"

## 5. ACKNOWLEDGE GAMMA REGIME: When discussing SPX/NDX:
- If positive gamma: "Market makers are buying dips-expect mean reversion"
- If negative gamma: "Market makers amplify moves-expect trending/volatile action"
- Reference GEX flip point and max GEX strike

## CRITICAL RULES

- NEVER say "I recommend" or "You should buy/sell" - present data and let the trader decide
- ALWAYS mention risk alongside reward
- NEVER predict with certainty-use probabilistic language
- Be concise-traders need information fast
- When a user asks about a symbol, call the relevant tool(s) before answering-don't guess

## RESPONSE FORMAT

Keep responses concise. Use formatting only when it aids clarity:
- Bold for key numbers and levels
- Short bullet points for multiple data points
- Code blocks for multi-column data (e.g., options chains)
- No long paragraphs-traders are scanning, not reading essays
`;
}


<!-- Source PDF page 35 -->

## 12. Implementation Phases and Agent Task Breakdown

Each phase below is designed to be independently deployable and testable. Phases should be
completed in order, as later phases depend on earlier ones.

Phase 1: Foundation (Symbol Unlock + WebSocket)
Duration: 3-5 agent sessions
Dependencies: None (first phase)
Deliverables: Dynamic symbol support, WebSocket server, SymbolSearch component, updated
system prompt

Task Files Test Criteria
Remove all symbol functions.ts, systemPrompt.ts, all Can type 'AAPL' in chart, options,
hardcoding frontend components scanner, position analyzer and get
valid data
Symbol validation service backend/src/services/symbols/validator.ts validateSymbol('AAPL') returns {
valid: true, type: 'stock',
massiveTicker: 'AAPL' }
Symbol search API backend/src/routes/symbols.ts GET /api/symbols/search?q=app
returns AAPL, APP, etc.
SymbolSearch component components/ai-coach/symbol-search.tsx Renders searchable input, shows
recent symbols, handles selection
WebSocket server backend/src/websocket/server.ts Connects, authenticates, subscribes
to price channel, receives updates
useWebSocket hook hooks/use-websocket.ts Auto-connects, reconnects on
disconnect, provides
subscribe/unsubscribe
Updated system prompt backend/src/chatkit/systemPrompt.ts No references to 'SPX and NDX
only', mentions all supported symbol
types
User watchlist table + API Migration + CRUD operations on watchlist,
backend/src/routes/watchlist.ts default watchlist created on first use


<!-- Source PDF page 36 -->

Phase 2: Proactive Intelligence
Duration: 4-6 agent sessions
Dependencies: Phase 1 (symbols + WebSocket)
Deliverables: Morning brief, setup detection engine (ORB, break & retest, VWAP, gap fill), real-time
alerts

Task Files Test Criteria
Morning Brief backend/src/services/morningBrief/index.ts Generates brief with gap analysis,
service levels, events, open positions
Morning Brief UI components/ai-coach/morning-brief.tsx Renders pre-market, dismissable,
each section expandable
ORB detector backend/src/services/setupDetector/orb.ts Detects 15-min ORB break with
volume confirmation
Break & Retest backend/src/services/setupDetector/breakRetest.ts Detects level break, then retest
detector within 0.15 ATR
VWAP detector backend/src/services/setupDetector/vwap.ts Detects VWAP cross, bounce, and
deviation setups
Gap Fill detector backend/src/services/setupDetector/gapFill.ts Tracks gap fill progress, alerts at
50% and 100%
Trade builder backend/src/services/setupDetector/tradeBuilder.ts Generates entry, stop, target, option
suggestion for each setup
Setup push via backend/src/websocket/channels.ts Setups pushed to subscribed users
WebSocket within 5 seconds of detection
New AI functions backend/src/chatkit/functions.ts get_orb_status, get_vwap_analysis,
(4) get_break_retest_setups,
get_morning_brief all working


<!-- Source PDF page 37 -->

Phase 3: Options Intelligence
Duration: 4-6 agent sessions
Dependencies: Phase 1 (symbols)
Deliverables: GEX calculator, 0DTE toolkit, IV suite, earnings module

Task Files Test Criteria
GEX calculator backend/src/services/options/gexCalculator.ts Calculates GEX per strike, identifies
flip point, max GEX, regime
GEX chart component components/ai-coach/gex-chart.tsx Horizontal bar chart, current price line,
flip point highlighted
GEX on main chart components/ai-coach/trading-chart.tsx GEX levels appear as labeled
horizontal lines
0DTE service backend/src/services/options/zeroDTE.ts Expected move remaining, theta clock,
gamma profile
0DTE dashboard components/ai-coach/zero-dte-dashboard.tsx Expected move gauge, theta decay
chart, gamma meter
IV analysis service backend/src/services/options/ivAnalysis.ts IV rank, skew, term structure, crush
projection
IV dashboard components/ai-coach/iv-dashboard.tsx IV rank gauge, skew chart, term
structure chart
Earnings service backend/src/services/earnings/index.ts Calendar, analysis, historical moves,
strategy suggestions
Earnings dashboard components/ai-coach/earnings-dashboard.tsx Calendar view, detail view, strategy
cards
New AI functions (6) backend/src/chatkit/functions.ts All 6 options/earnings functions
working end-to-end


<!-- Source PDF page 38 -->

Phase 4: Enhanced Visualizations
Duration: 3-4 agent sessions
Dependencies: Phase 1 (symbols), Phase 3 (GEX data)
Deliverables: Chart overlays, indicator system, ORB box, position overlay, options heatmap

Task Files Test Criteria
Indicator calculations components/ai-coach/chart-EMA, VWAP bands, RSI, MACD all
indicators.ts calculate correctly
Indicator toggle toolbar components/ai-coach/chart-toolbar.tsx Indicators dropdown with toggles,
preferences saved to localStorage
Chart series rendering components/ai-coach/trading-chart.tsx Each indicator renders as correct series
type (line, histogram, area)
ORB box overlay components/ai-coach/trading-chart.tsx Semi-transparent rectangle over opening
range, extends lines
Position overlay components/ai-coach/trading-chart.tsx Entry, stop, target lines with shaded
risk/reward zones
Expected move overlay components/ai-coach/trading-chart.tsx Shaded area showing ATM straddle implied
range
Options heatmap components/ai-coach/options-2D grid, color by volume/OI/IV/GEX, click
heatmap.tsx for details


<!-- Source PDF page 39 -->

Phase 5: Position Management + Journal
Duration: 3-4 agent sessions
Dependencies: Phase 1 (WebSocket), Phase 3 (Greeks data)
Deliverables: Live position tracker, exit advisor, spread conversion, auto-journal, pattern analysis

Task Files Test Criteria
Live position tracker backend/src/services/positions/liveTracker.ts Recalculates P&L every 15 seconds
for all open positions
Exit advisor backend/src/services/positions/exitAdvisor.ts Generates profit-taking, loss mgmt,
theta, spread conversion advice
Position tracker UI components/ai-coach/position-tracker.tsx Cards with real-time P&L, advice
banners, action buttons
Journal auto-backend/src/services/journal/autoPopulate.ts Generates draft entries at EOD from
populate session activity
Pattern analyzer backend/src/services/journal/patternAnalyzer.ts Identifies time-of-day, setup,
behavioral, risk management patterns
Journal insights UI components/ai-coach/journal-insights.tsx Weekly insights card with charts and
AI summary
New AI functions (2) backend/src/chatkit/functions.ts get_position_advice,
get_journal_insights working


<!-- Source PDF page 40 -->

Phase 6: Seamless Workflow + Polish
Duration: 2-3 agent sessions
Dependencies: All previous phases
Deliverables: Workflow context, cross-component navigation, breadcrumbs, symbol sync, user
preferences

Task Files Test Criteria
Workflow context contexts/AICoachWorkflowContext.tsx Shared state for activeSymbol, activeSetup,
cross-component actions
Scanner -> Chart flow Multiple components Click scan result -> chart loads with setup
annotations
Chart -> Options flow Multiple components Click level on chart -> options chain filtered
to nearby strikes
Options -> Position flow Multiple components Click contract -> position analyzer pre-fills
Breadcrumb navigation components/ai-coach/workflow-Shows navigation path, each step clickable
breadcrumb.tsx
Symbol sync Multiple components Symbol change in one component offers to
sync others
User preferences UI components/ai-coach/preferences-Risk per trade, ORB period, indicator
panel.tsx defaults, notifications


<!-- Source PDF page 41 -->

## 13. Testing Requirements

Every phase must include tests before it is considered complete. The following testing strategy ensures
reliability across the system.

### 13.1 Unit Tests

Module Test File Coverage
Requirements
Black-Scholes backend/src/services/options/__tests__/blackScholes.test.ts All Greeks within 1% of
known values for
standard inputs
GEX Calculator backend/src/services/options/__tests__/gexCalculator.test.ts Flip point, max GEX,
regime correct for mock
data
IV Analysis backend/src/services/options/__tests__/ivAnalysis.test.ts IV Rank, skew, term
structure calculations
correct
Setup Detectors backend/src/services/setupDetector/__tests__/*.test.ts Each detector correctly
identifies setups from
mock price data
Levels backend/src/services/levels/__tests__/calculator.test.ts PDH/PDL/PDC, pivots,
Calculator ATR all correct for
known data
Symbol backend/src/services/symbols/__tests__/validator.test.ts Index prefix, stock no -
Validator prefix, invalid symbols
rejected
Morning Brief backend/src/services/morningBrief/__tests__/index.test.ts Brief generates with all
required sections
Trade Builder backend/src/services/setupDetector/__tests__/tradeBuilder.test.ts Entry, stop, targets,
option suggestion all
populated

### 13.2 Integration Tests

Scenario Test File What It Validates
Full chat flow backend/src/__tests__/chat-Send message -> function call ->
integration.test.ts response -> stored in DB
Options chain E2E backend/src/__tests__/options-API call -> Massive.com fetch ->
integration.test.ts Greeks calc -> response shape
WebSocket lifecycle backend/src/__tests__/websocket-Connect -> auth -> subscribe ->
integration.test.ts receive updates -> disconnect
Setup detection E2E backend/src/__tests__/setup-Price data ingested -> setup detected
detection.test.ts -> trade built -> pushed via WS
Symbol validation E2E backend/src/__tests__/symbol-Search -> validate -> fetch data -> all
validation.test.ts endpoints work for non-SPX/NDX
symbols


<!-- Source PDF page 42 -->

### 13.3 Frontend Component Tests

Component Test File Key Assertions
SymbolSearch components/ai-coach/__tests__/symbol-Renders, searches, selects,
search.test.tsx shows recent, handles errors
MorningBrief components/ai-coach/__tests__/morning-Renders all sections,
brief.test.tsx collapses/expands, dismisses
GEXChart components/ai-coach/__tests__/gex-Renders bars, highlights flip point
chart.test.tsx and max GEX
ZeroDTEDashboard components/ai-coach/__tests__/zero-dte-Shows expected move gauge,
dashboard.test.tsx theta clock, gamma meter
PositionTracker components/ai-coach/__tests__/position-Shows positions, updates P&L,
tracker.test.tsx displays advice banners
WorkflowBreadcrumb components/ai-coach/__tests__/workflow-Shows path, each step clickable,
breadcrumb.test.tsx navigates correctly


<!-- Source PDF page 43 -->

## 14. Repo Documentation Files to Create

The following markdown files should be placed in the repository to guide Claude Code agents during
development.

File Path Purpose Contents
docs/ai-coach/V2_MASTER_SPEC.md Master spec summary Full feature list, architecture overview,
(this doc in markdown) phase breakdown
docs/ai-Instructions for Claude How to use this repo, what to build,
coach/AGENT_INSTRUCTIONS.md Code agents testing requirements, coding standards
docs/ai-Massive.com API All endpoints, parameters, response
coach/MASSIVE_API_REFERENCE.md reference shapes, rate limits, ticker format
docs/ai-coach/DATA_MODELS.md All TypeScript interfaces Every type definition, every table, every
and DB schemas API request/response shape
docs/ai-All 27 AI Coach functions Name, params, return type, handler
coach/FUNCTION_REGISTRY.md location, test file
claude.md (update existing) Claude Code context file Add V2 rebuild context, phase status,
key architecture decisions


<!-- Source PDF page 44 -->

## 15. Agent Instructions (For claude.md)

Add the following section to the existing claude.md file at the repo root. This gives Claude Code agents
the context they need to build each phase correctly.

AGENT PROMPT: claude.md Addition
## AI Coach V2 Rebuild Context

### Architecture
- Frontend: Next.js 16 (App Router) + TailwindCSS + Radix UI + lightweight-charts
- Backend: Express.js on port 3001 with OpenAI GPT-4o function calling
- Database: Supabase (PostgreSQL) with RLS
- Cache: Redis (optional, with Supabase fallback)
- Real-time: WebSocket (ws library) on same port as Express
- Market Data: Massive.com API (REST, Bearer token auth)

### Key Directories
- backend/src/chatkit/ - AI function definitions, system prompt, handlers
- backend/src/services/ - Business logic (levels, options, scanner, macro, etc.)
- backend/src/routes/ - Express API routes
- backend/src/websocket/ - WebSocket server and channels (NEW in V2)
- components/ai-coach/ - All React components for the AI Coach
- hooks/ - React hooks (use-ai-coach-chat, use-websocket)
- contexts/ - React contexts (MemberAuthContext, AICoachWorkflowContext)
- lib/api/ai-coach.ts-Frontend API client
- supabase/migrations/ - Database migrations
- supabase/functions/ - Edge functions

### Coding Standards
- TypeScript strict mode everywhere
- All new services must be classes with dependency injection
- All API responses must have consistent shape: { success: boolean, data?: T, error?: string }
- All database queries must go through Supabase client with RLS (never raw SQL)
- All frontend components must have error boundaries
- All new features must have unit tests (Jest for backend, React Testing Library for frontend)
- Use Zod for all API input validation
- Cache TTLs: price data = 5s, options = 5min, levels = 5min, daily data = 10min, earnings = 4hr

### Symbol Format
- Massive.com indices require I: prefix (I:SPX, I:NDX, I:DJX, I:RUT)
- Stocks and ETFs use plain ticker (AAPL, SPY, QQQ)
- Backend validateSymbol() handles the prefix mapping
- Frontend SymbolSearch component handles autocomplete and validation

### Build/Test Commands
- npm run dev (frontend, port 3000)
- cd backend && npm run dev (backend, port 3001)
- npm test (frontend tests)
- cd backend && npm test (backend tests)
- npx supabase migration new <name> (new migration)
- npx supabase db push (apply migrations)


<!-- Source PDF page 45 -->

## 16. Conclusion

This specification covers every aspect of the TITM AI Coach V2 rebuild: architecture changes, new
features, database schema, backend services, frontend components, AI function definitions, testing
requirements, and agent-ready implementation prompts. Each agent prompt is self-contained and can
be handed to a Claude Code agent with the instruction to implement it completely, including tests.

The implementation should follow the phase order (1 through 6) as each phase builds on the previous.
Phase 1 (symbol unlock + WebSocket) is the critical foundation that unblocks everything else. Phases
2 and 3 can be worked on in parallel once Phase 1 is c omplete.

Total new files: ~45-55 files across backend services, frontend components, tests, and documentation
Total new AI functions: 12 (bringing total to 27)
Total new database tables: 6 (plus 2 column additions to existing tables)
Estimated agent sessions: 19-28 sessions across all 6 phases
