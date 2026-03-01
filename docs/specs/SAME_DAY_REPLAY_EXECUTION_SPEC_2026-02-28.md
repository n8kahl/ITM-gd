# Same-Day Replay — Complete Codex Execution Spec

**Feature:** Same-Day Replay with Discord Integration, Analytical Confluence Overlay, and Multi-Symbol Support
**Status:** Scope Redefined — Pending Approval
**Author:** Claude (Orchestrator Agent)
**Date:** 2026-02-28
**Governing Codex:** CLAUDE.md v2026-02-28

---

## 1. Objective

Transform the existing trade replay feature from a price-action-only playback tool into a comprehensive training and backtesting platform that combines three data layers at every replay moment:

1. **Market Data Layer** — OHLCV bars, levels (PDH/PDL, Opening Range, structural, fibonacci), EMA 8/21, VWAP, volume profile
2. **Analytical Engine Layer** — GEX landscape, options flow, regime classification, multi-timeframe confluence, zone quality, memory edge, R:R/evR, environment gate status
3. **Human Context Layer** — Discord trade calls (entries, trims, stops, exits), caller thesis/reasoning, position sizing notes, session summaries

The system must work live (streaming from Discord + engine in real-time) and historically. For sessions captured after snapshot go-live, replay must include full analytical context. For earlier sessions, replay must run in clearly labeled partial-context mode. It must support SPX as the primary symbol and extend to any optionable symbol via a SymbolProfile abstraction.

### 1.1 Scope Redefinition Decisions (2026-02-28)

1. **Canonical replay identifier:** `session_id` (UUID) is the canonical key for loading replay sessions. Date is a filter only.
2. **Access model (V1):** Admin-only for all Same-Day Replay APIs and UI surfaces.
3. **Learner impact priority:** Optimize for deterministic learning value first:
   - Full three-layer replay context for sessions captured after snapshot go-live.
   - Explicitly labeled partial-context replay for earlier sessions (no fabricated confluence).
   - Drill scoring and lifecycle visibility prioritized over broad symbol expansion.

---

## 2. Constraints

- All new tables require RLS policies. Run `get_advisors(type: "security")` after every DDL migration.
- All Same-Day Replay endpoints and UI are admin-only in V1 (`authenticateToken` + `requireAdmin`).
- Snapshot capture must not degrade live engine latency (< 500ms p95 API response time).
- Discord bot must handle message rates up to 60/minute without dropping signals.
- Replay payload size must stay under 2MB per session (compressed) for fast loading.
- No new `any` types in TypeScript. All new code must pass strict mode.
- The existing `SPXReplayEngine` frame-based architecture is preserved. Extensions happen through new data channels, not engine rewrites.
- The Massive.com WebSocket single-process constraint remains. Snapshot capture runs in the same backend process.
- All work follows the Spec-First Autonomous Delivery process (CLAUDE.md §6).

---

## 3. Scope

### 3.1 In Scope

- **P1: Analytical Snapshot Capture System** — Background service that persists GEX, flow, regime, levels, MTF confluence, environment gate, and decision context at regular intervals during market hours.
- **P2: Replay Levels Fix** — Extend `ReplayPayload` to include historical level data; fix the chart to render levels from replay context instead of live context.
- **P3: Discord Bot + Message Parser** — Bot with `MESSAGE_CONTENT` intent that ingests trade calls from configured channels, parses them into structured `ParsedTrade` objects, and persists them.
- **P4: Replay Session Browser** — Day/trade selection UI: calendar view → session list → trade drill-down → chart jump.
- **P5: Confluence Context Panel** — Sidebar panel that renders the full analytical snapshot at any replay cursor position, synced to chart time.
- **P6: Discord Transcript Sidebar** — Time-synced scrolling transcript alongside the chart, with signal highlighting and thesis extraction.
- **P7: SymbolProfile Abstraction** — Decouple all engines from SPX-only assumptions. Introduce per-symbol configuration for level intervals, GEX scaling, flow thresholds, and MTF weights.
- **P8: Trade Lifecycle Event Rendering** — Render trims, stop adjustments, trail activations, and breakeven stops as distinct markers on the chart (not just entry/exit).
- **P9: Interactive Drill Mode** — Pause replay, hide outcomes, let learner mark their own entry/exit, compare against actual calls and engine evaluation.
- **P10: Session Journal Auto-Generation** — Auto-create journal entries from replay sessions using Discord context + analytical snapshots + trade outcomes.

### 3.2 Out of Scope

- Multi-caller concurrent parsing (V1 supports one active caller per channel)
- Voice channel transcription (text channels only)
- Automated trade execution from Discord calls
- Mobile-native replay UI (responsive web only)
- Backtesting optimizer integration (uses replay data but not this spec's concern)
- Discord bot admin panel (V1 uses env vars for channel/guild config)

---

## 4. Architecture

### 4.1 New Database Tables

All tables in `public` schema with RLS enabled.

#### `replay_snapshots`

Captures the full analytical state at a point in time during a trading session.

```sql
CREATE TABLE replay_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date    DATE NOT NULL,
  symbol          TEXT NOT NULL DEFAULT 'SPX',
  captured_at     TIMESTAMPTZ NOT NULL,

  -- GEX Landscape
  gex_net_gamma       NUMERIC,
  gex_call_wall       NUMERIC,
  gex_put_wall        NUMERIC,
  gex_flip_point      NUMERIC,
  gex_key_levels      JSONB,         -- Array of {strike, gex, type}
  gex_expiry_breakdown JSONB,        -- Per-expiry netGex, callWall, putWall

  -- Flow Window
  flow_bias_5m        TEXT,          -- 'bullish' | 'bearish' | 'neutral'
  flow_bias_15m       TEXT,
  flow_bias_30m       TEXT,
  flow_event_count    INTEGER,
  flow_sweep_count    INTEGER,
  flow_bullish_premium NUMERIC,
  flow_bearish_premium NUMERIC,
  flow_events         JSONB,         -- Array of recent SPXFlowEvent

  -- Regime
  regime              TEXT,          -- 'trending' | 'ranging' | 'compression' | 'breakout'
  regime_direction    TEXT,          -- 'bullish' | 'bearish'
  regime_probability  NUMERIC,
  regime_confidence   NUMERIC,
  regime_volume_trend TEXT,          -- 'rising' | 'flat' | 'falling'

  -- Levels
  levels              JSONB,         -- Array of SPXLevel at this moment
  cluster_zones       JSONB,         -- Array of ClusterZone at this moment

  -- Multi-TF Confluence
  mtf_1h_trend        TEXT,          -- 'up' | 'down' | 'flat'
  mtf_15m_trend       TEXT,
  mtf_5m_trend        TEXT,
  mtf_1m_trend        TEXT,
  mtf_composite       NUMERIC,       -- 0-1 weighted alignment
  mtf_aligned         BOOLEAN,

  -- Environment Gate
  vix_value           NUMERIC,
  vix_regime          TEXT,          -- 'normal' | 'elevated' | 'extreme'
  env_gate_passed     BOOLEAN,
  env_gate_reasons    JSONB,         -- Array of blocking reasons
  macro_next_event    JSONB,         -- {event, at, minutesUntil}
  session_minute_et   INTEGER,

  -- Basis State
  basis_value         NUMERIC,       -- SPX - SPY*10
  spx_price           NUMERIC,
  spy_price           NUMERIC,

  -- Confluence + Learning Metrics (for confluence panel and drill scoring)
  rr_ratio            NUMERIC,       -- Risk/reward ratio at setup snapshot
  ev_r                NUMERIC,       -- Expected value in R units
  memory_setup_type   TEXT,
  memory_test_count   INTEGER,
  memory_win_rate     NUMERIC,
  memory_hold_rate    NUMERIC,
  memory_confidence   NUMERIC,
  memory_score        NUMERIC,

  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_replay_snapshots_session ON replay_snapshots (session_date, symbol, captured_at);
```

#### `discord_trade_sessions`

One row per trading day per Discord channel.

```sql
CREATE TABLE discord_trade_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date    DATE NOT NULL,
  channel_id      TEXT NOT NULL,
  channel_name    TEXT,
  guild_id        TEXT NOT NULL,
  caller_name     TEXT,            -- Primary caller (e.g., 'FancyITM')
  trade_count     INTEGER DEFAULT 0,
  net_pnl_pct     NUMERIC,
  session_start   TIMESTAMPTZ,
  session_end     TIMESTAMPTZ,
  session_summary TEXT,            -- End-of-day summary message if posted
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_date, channel_id)
);
```

#### `discord_messages`

Raw message archive for full transcript replay.

```sql
CREATE TABLE discord_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES discord_trade_sessions(id),
  discord_msg_id  TEXT NOT NULL UNIQUE,
  author_name     TEXT NOT NULL,
  author_id       TEXT NOT NULL,
  content         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL,
  is_signal       BOOLEAN DEFAULT false,  -- Parsed as a trade signal
  signal_type     TEXT,                   -- 'prep' | 'fill' | 'trim' | 'stop' | 'trail' | 'exit' | 'commentary'
  parsed_trade_id UUID,                   -- Links to the trade this message belongs to
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_discord_messages_session ON discord_messages (session_id, sent_at);
```

#### `discord_parsed_trades`

Structured trade objects extracted from Discord messages.

```sql
CREATE TABLE discord_parsed_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES discord_trade_sessions(id),
  trade_index     INTEGER NOT NULL,       -- Order within session (1, 2, 3...)

  -- Contract
  symbol          TEXT NOT NULL,           -- 'SPX', 'QQQ', 'NVDA', etc.
  strike          NUMERIC NOT NULL,
  contract_type   TEXT NOT NULL,           -- 'call' | 'put'
  expiry          TEXT,                    -- ISO date or '0DTE'

  -- Entry
  direction       TEXT DEFAULT 'long',
  entry_price     NUMERIC,
  entry_timestamp TIMESTAMPTZ,
  sizing          TEXT,                    -- 'normal' | 'light' | 'heavy' | condition text

  -- Stop/Target
  initial_stop    NUMERIC,
  target_1        NUMERIC,
  target_2        NUMERIC,

  -- Thesis
  thesis_text     TEXT,                    -- Extracted reasoning from surrounding messages
  entry_condition TEXT,                    -- e.g., "looking to fill below 6850"

  -- Lifecycle (JSONB array of events)
  lifecycle_events JSONB DEFAULT '[]',     -- [{type, value, timestamp, message_ref}]

  -- Outcome
  final_pnl_pct   NUMERIC,
  is_winner        BOOLEAN,
  fully_exited     BOOLEAN DEFAULT false,
  exit_timestamp   TIMESTAMPTZ,

  -- Snapshot link
  entry_snapshot_id UUID REFERENCES replay_snapshots(id),

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_discord_parsed_trades_session ON discord_parsed_trades (session_id, trade_index);
```

#### `symbol_profiles`

Per-symbol configuration for engine generalization.

```sql
CREATE TABLE symbol_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,

  -- Level Engine Config
  round_number_interval  NUMERIC DEFAULT 50,   -- SPX=50, QQQ=5, NVDA=5
  opening_range_minutes  INTEGER DEFAULT 30,
  level_cluster_radius   NUMERIC DEFAULT 3.0,

  -- GEX Config
  gex_scaling_factor     NUMERIC DEFAULT 1.0,  -- SPY→SPX uses 0.1
  gex_cross_symbol       TEXT,                  -- e.g., 'SPY' for SPX profiles
  gex_strike_window      NUMERIC DEFAULT 220,

  -- Flow Config
  flow_min_premium       NUMERIC DEFAULT 10000,
  flow_min_volume        INTEGER DEFAULT 10,
  flow_directional_min   NUMERIC DEFAULT 50000,

  -- MTF Config
  mtf_ema_fast           INTEGER DEFAULT 21,
  mtf_ema_slow           INTEGER DEFAULT 55,
  mtf_1h_weight          NUMERIC DEFAULT 0.55,
  mtf_15m_weight         NUMERIC DEFAULT 0.20,
  mtf_5m_weight          NUMERIC DEFAULT 0.15,
  mtf_1m_weight          NUMERIC DEFAULT 0.10,

  -- Regime Config
  regime_breakout_threshold    NUMERIC DEFAULT 0.7,
  regime_compression_threshold NUMERIC DEFAULT 0.65,

  -- Massive.com Ticker
  massive_ticker         TEXT NOT NULL,         -- 'I:SPX', 'QQQ', 'NVDA'
  massive_options_ticker TEXT,                  -- 'O:SPX*', 'O:QQQ*'

  is_active              BOOLEAN DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
```

#### `replay_drill_results`

Stores learner drill attempts for replay coaching progress over time.

```sql
CREATE TABLE replay_drill_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  session_id         UUID NOT NULL REFERENCES discord_trade_sessions(id),
  parsed_trade_id    UUID REFERENCES discord_parsed_trades(id),
  decision_at        TIMESTAMPTZ NOT NULL,
  direction          TEXT NOT NULL,         -- 'long' | 'short' | 'flat'
  strike             NUMERIC,
  stop_level         NUMERIC,
  target_level       NUMERIC,
  learner_rr         NUMERIC,
  learner_pnl_pct    NUMERIC,
  actual_pnl_pct     NUMERIC,
  engine_direction   TEXT,                  -- 'bullish' | 'bearish' | 'neutral'
  direction_match    BOOLEAN,
  score              NUMERIC,               -- 0-100
  feedback_summary   TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_replay_drill_results_user_time
  ON replay_drill_results (user_id, decision_at DESC);
CREATE INDEX idx_replay_drill_results_session
  ON replay_drill_results (session_id, created_at);
```

### 4.1.1 RLS Policy Contract (Admin-Only V1)

RLS is mandatory for every new table in this spec. Policy intent:

- `replay_snapshots`: read allowed for admins; writes restricted to service role via backend.
- `discord_trade_sessions`, `discord_messages`, `discord_parsed_trades`: read allowed for admins; writes restricted to service role via backend ingest pipeline.
- `symbol_profiles`: read allowed for admins; writes restricted to admins.
- `replay_drill_results`: read/write only for the owning user (`auth.uid() = user_id`) and admins; admin auditing allowed across all rows.

Every migration slice that creates/modifies these tables must include:

1. `ENABLE ROW LEVEL SECURITY`
2. Explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies per table
3. Post-migration advisor checks: `get_advisors(type: "security")` and `get_advisors(type: "performance")`

### 4.2 New Backend Services

#### Replay Snapshot Writer — `backend/src/services/spx/replaySnapshotWriter.ts`

**Responsibility:** Captures analytical state at 60-second intervals during market hours and on every setup status change.

**Integration point:** Called from the existing SPX engine cycle (the same loop that runs setup detection). After the engine computes GEX, flow, regime, levels, and MTF, the snapshot writer serializes and persists the current state.

**Key behavior:**
- Runs only during market hours (9:30 AM – 4:00 PM ET)
- Captures on a 60-second interval AND on setup status transitions (forming → ready → triggered)
- Batches writes to Supabase (up to 5 snapshots per insert to reduce round-trips)
- Stores the snapshot ID so that setup trigger events can reference it
- Graceful degradation: if Supabase write fails, logs error and continues (never blocks the engine)

**Data flow:**
```
SPX Engine Cycle
  → computeUnifiedGEXLandscape() → result cached
  → getFlowEvents() → result cached
  → classifyRegime() → result cached
  → getMergedLevels() → result cached
  → computeMultiTFConfluence() → result cached
  → evaluateEnvironmentGate() → result cached
  → *** NEW: replaySnapshotWriter.capture(allResults) ***
  → setupDetector.detect(allResults)
  → decisionEngine.evaluate(setups, allResults)
```

#### Discord Bot Service — `backend/src/services/discord/discordBot.ts`

**Responsibility:** Connects to Discord via `discord.js`, listens to configured channels, classifies messages, and routes them through the parser.

**Key behavior:**
- Uses `discord.js` v14+ with `GatewayIntentBits.MessageContent`
- Connects to guild(s) specified by `DISCORD_BOT_GUILD_IDS` env var
- Listens to channels specified by `DISCORD_BOT_CHANNEL_IDS` env var
- On each message: classify → parse → persist → broadcast

**Env vars:**
```
DISCORD_BOT_TOKEN=        # Bot token (server-side only)
DISCORD_BOT_GUILD_IDS=    # Comma-separated guild IDs
DISCORD_BOT_CHANNEL_IDS=  # Comma-separated channel IDs to monitor
DISCORD_BOT_ENABLED=false # Feature flag
```

#### Discord Message Parser — `backend/src/services/discord/messageParser.ts`

**Responsibility:** Converts raw Discord messages into structured trade signals using pattern matching with LLM fallback.

**Pattern grammar (covers ~95% of FancyITM-style calls):**

```
PREP SPX {strike}{C|P} {expiry?} {sizing_note?}
PTF|PFT {contract?}
Filled AVG {price} {stop_note?}
Trim {pct}%
Stops {level} | (-{pct}%)
B/E stops on runners
Put trail on for -{pct}%
Exit above|below {level}
Fully out | Fully sold runners
```

**State machine per trade lifecycle:**
```
IDLE → [PREP message] → STAGED
STAGED → [Filled message] → ACTIVE
ACTIVE → [Trim message] → ACTIVE (partial exit logged)
ACTIVE → [Stops message] → ACTIVE (stop adjusted)
ACTIVE → [Fully out message] → CLOSED
ACTIVE → [new PREP message] → CLOSED (implicit exit) + new STAGED
```

**LLM fallback:** Messages that don't match any pattern are sent to OpenAI (existing integration) with a structured extraction prompt. Response is validated against the ParsedTrade schema before persistence.

#### Discord Realtime Broadcaster — `backend/src/services/discord/discordBroadcaster.ts`

**Responsibility:** Publishes parsed Discord signals to Supabase Realtime channels for live consumption by the Command Center frontend.

**Channel pattern:** `discord_calls:{channel_id}`

**Event schema extends existing `SPXRealtimeEvent`:**
```typescript
export type DiscordRealtimeEventKind =
  | 'discord_prep'
  | 'discord_fill'
  | 'discord_trim'
  | 'discord_stop'
  | 'discord_exit'
  | 'discord_commentary'
```

### 4.3 Extended Replay Types

#### `lib/trade-day-replay/types.ts` — Extensions

```typescript
// NEW: Analytical snapshot at a point in time
export interface ReplayAnalyticalSnapshot {
  capturedAt: string  // ISO timestamp

  // GEX
  gexNetGamma: number | null
  gexCallWall: number | null
  gexPutWall: number | null
  gexFlipPoint: number | null
  gexKeyLevels: Array<{ strike: number; gex: number; type: string }> | null
  gexExpiryBreakdown: Record<string, { netGex: number; callWall: number; putWall: number }> | null

  // Flow
  flowBias5m: 'bullish' | 'bearish' | 'neutral' | null
  flowBias15m: 'bullish' | 'bearish' | 'neutral' | null
  flowBias30m: 'bullish' | 'bearish' | 'neutral' | null
  flowEventCount: number
  flowSweepCount: number
  flowBullishPremium: number
  flowBearishPremium: number
  flowEvents: FlowEvent[] | null

  // Regime
  regime: 'trending' | 'ranging' | 'compression' | 'breakout' | null
  regimeDirection: 'bullish' | 'bearish' | null
  regimeProbability: number | null
  regimeConfidence: number | null

  // MTF Confluence
  mtf1hTrend: 'up' | 'down' | 'flat' | null
  mtf15mTrend: 'up' | 'down' | 'flat' | null
  mtf5mTrend: 'up' | 'down' | 'flat' | null
  mtf1mTrend: 'up' | 'down' | 'flat' | null
  mtfComposite: number | null
  mtfAligned: boolean | null

  // Environment
  vixValue: number | null
  vixRegime: 'normal' | 'elevated' | 'extreme' | null
  envGatePassed: boolean | null
  envGateReasons: string[]
  macroNextEvent: { event: string; at: string; minutesUntil: number } | null
  sessionMinuteEt: number | null

  // Levels
  levels: SPXLevel[] | null
  clusterZones: ClusterZone[] | null

  // Basis
  basisValue: number | null
  spxPrice: number | null
  spyPrice: number | null

  // Learning context
  rrRatio: number | null
  evR: number | null
  memoryEdge: {
    setupType: string | null
    testCount: number | null
    winRate: number | null
    holdRate: number | null
    confidence: number | null
    score: number | null
  } | null
}

// NEW: Discord transcript message for replay
export interface ReplayDiscordMessage {
  id: string
  authorName: string
  content: string
  sentAt: string          // ISO timestamp
  isSignal: boolean
  signalType: string | null
  parsedTradeId: string | null
}

// NEW: Discord trade with full lifecycle
export interface ReplayDiscordTrade {
  id: string
  tradeIndex: number
  symbol: string
  strike: number
  contractType: 'call' | 'put'
  expiry: string | null
  direction: 'long' | 'short'
  entryPrice: number | null
  entryTimestamp: string | null
  sizing: string | null
  initialStop: number | null
  thesisText: string | null
  entryCondition: string | null
  lifecycleEvents: Array<{
    type: 'trim' | 'stop_adjust' | 'trail' | 'breakeven' | 'exit'
    value: number | null
    timestamp: string
    messageRef: string | null
  }>
  finalPnlPct: number | null
  isWinner: boolean | null
  fullyExited: boolean
  exitTimestamp: string | null
  entrySnapshot: ReplayAnalyticalSnapshot | null
}

// EXTENDED: Full replay payload with all three layers
export interface EnrichedReplayPayload extends ReplayPayload {
  // Analytical snapshots (time-series, one per ~60s)
  snapshots: ReplayAnalyticalSnapshot[]

  // Discord context
  discordMessages: ReplayDiscordMessage[] | null
  discordTrades: ReplayDiscordTrade[] | null
  callerName: string | null
  sessionSummary: string | null

  // Symbol profile for multi-symbol support
  symbolProfile: {
    symbol: string
    displayName: string
    massiveTicker: string
  } | null
}
```

#### `lib/spx/replay-engine.ts` — Extensions

```typescript
// EXTENDED: Replay frame now includes analytical context
export interface SPXReplayFrame {
  cursorIndex: number
  progress: number
  currentBar: ChartBar | null
  visibleBars: ChartBar[]

  // NEW: Nearest analytical snapshot to current cursor time
  snapshot: ReplayAnalyticalSnapshot | null

  // NEW: Discord messages within the visible time window
  visibleDiscordMessages: ReplayDiscordMessage[] | null

  // NEW: Active discord trade at cursor time (if any)
  activeDiscordTrade: ReplayDiscordTrade | null
}
```

### 4.4 New Frontend Components

#### Replay Session Browser — `components/spx-command-center/replay-session-browser.tsx`

**Panel structure:**
- Calendar grid showing days with recorded sessions (dot indicators for trade count)
- Session list per day: caller name, symbol(s), trade count, net P&L, duration
- Trade cards within a session: contract label, P&L %, time range, mini sparkline
- "Play Full Session" and "Jump to Trade" actions

**Data source:** New API endpoint `GET /api/spx/replay-sessions` returns sessions grouped by date with summary stats.

#### Confluence Context Panel — `components/spx-command-center/replay-confluence-panel.tsx`

**Six collapsible sections rendered from the nearest `ReplayAnalyticalSnapshot`:**

1. **R:R & Expected Value** — Entry zone, stop, T1/T2, R:R ratio, evR from snapshot. If unavailable, render explicit `Not captured for this timestamp`.
2. **Multi-TF Alignment** — Four-row display (1h/15m/5m/1m) with trend arrows, EMA status, composite score bar
3. **GEX Context** — Price position vs. call wall/put wall/flip point, net gamma sign, key levels within ±20 points
4. **Flow Confirmation** — 5m/15m window bias badges, premium bars, sweep/block counts, directional signal strength
5. **Regime + Environment** — Regime badge, VIX regime, macro calendar proximity, session time context
6. **Memory Edge** — Test count, win rate, hold rate, confidence, score at this zone/setup type. If unavailable, render explicit partial-context label.

**Sync mechanism:** Panel reads from `replayFrame.snapshot` which updates as the cursor advances.

#### Discord Transcript Sidebar — `components/spx-command-center/replay-transcript-sidebar.tsx`

**Behavior:**
- Scrolling list of Discord messages, time-synced to the replay cursor
- As cursor advances, sidebar auto-scrolls to the corresponding time position
- Signal messages highlighted: green (entry), amber (trim/stop), red (exit), blue (prep)
- Commentary messages rendered at reduced opacity
- Each trade marker on the chart is clickable and jumps the transcript to that moment
- Thesis messages get a special "Caller's Thesis" card treatment

#### Trade Lifecycle Markers — Extension to `components/spx-command-center/spx-chart.tsx`

**New marker types beyond entry/exit:**
- **Trim marker** — Partial exit, shows percentage trimmed and remaining position
- **Stop adjustment marker** — Shows old stop → new stop with directional arrow
- **Trail activation marker** — Shows trail percentage and activation level
- **Breakeven marker** — Shows B/E level set on runners
- **Thesis marker** — Subtle annotation at moments where caller stated reasoning

Each marker type gets a distinct icon and color from the Emerald Standard palette.

#### Interactive Drill Mode — `components/spx-command-center/replay-drill-mode.tsx`

**Flow:**
1. Replay reaches a configurable "decision point" (approaching a level, post-news spike, VWAP test, etc.)
2. Chart pauses. Future bars and trade outcomes are hidden.
3. Learner sees the analytical snapshot (GEX, flow, regime, MTF) but NOT the Discord call
4. UI prompts: "What would you do?" → Enter long / Enter short / Stay flat
5. If entering, learner picks: strike, stop level, target level
6. Chart reveals the actual outcome: what the caller did, what the engine evaluated, what happened next
7. Comparison scorecard: learner's R:R vs. actual R:R, learner's direction vs. engine's direction, P&L comparison

**Scoring stored in Supabase for progress tracking over time.**

### 4.5 New API Endpoints

All endpoints require `authenticateToken` + `requireAdmin` in V1.
`session_id` is the canonical identifier for replay retrieval APIs.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/spx/replay-sessions` | List sessions by date range with summary stats |
| GET | `/api/spx/replay-sessions/:sessionId` | Get full session by `session_id` (bars + snapshots + Discord) |
| GET | `/api/spx/replay-sessions/:sessionId/trades` | Get parsed trades for a session |
| GET | `/api/spx/replay-sessions/:sessionId/snapshots` | Get analytical snapshots for a session |
| GET | `/api/spx/discord/channels` | List configured Discord channels |
| POST | `/api/spx/drill-results` | Submit drill mode comparison result |
| GET | `/api/spx/drill-results/history` | Get learner's drill history and scores |
| GET | `/api/spx/symbol-profiles` | List available symbol profiles |
| GET | `/api/spx/symbol-profiles/:symbol` | Get profile for a specific symbol |

Implementation notes:
- `GET /api/spx/replay-sessions` supports filters (`from`, `to`, optional `channelId`, optional `symbol`) and returns `session_id` in every row.
- Route params must be Zod-validated UUIDs; non-UUID values return `400`.
- Missing `session_id` returns `404`, not a silent fallback to date lookup.

### 4.6 SymbolProfile Engine Integration

**How each engine consumes the profile:**

| Engine | Current Hardcoded Value | SymbolProfile Field |
|--------|------------------------|-------------------|
| levelEngine.ts | Cluster radius = 3 points | `level_cluster_radius` |
| levelEngine.ts | Opening Range = 30 min | `opening_range_minutes` |
| gexEngine.ts | SPY scale = 0.1 | `gex_scaling_factor` |
| gexEngine.ts | Strike window = ±220 | `gex_strike_window` |
| flowEngine.ts | Min premium = $10,000 | `flow_min_premium` |
| flowEngine.ts | Min volume = 10 | `flow_min_volume` |
| flowEngine.ts | Directional min = $50,000 | `flow_directional_min` |
| multiTFConfluence.ts | EMA fast = 21, slow = 55 | `mtf_ema_fast`, `mtf_ema_slow` |
| multiTFConfluence.ts | 1h weight = 0.55 | `mtf_1h_weight` (etc.) |
| regimeClassifier.ts | Breakout threshold = 0.7 | `regime_breakout_threshold` |
| Massive config | Ticker = 'I:SPX' | `massive_ticker` |

**Implementation approach:** Each engine's entry function gains an optional `profile?: SymbolProfile` parameter. When provided, it overrides the hardcoded defaults. When absent, existing behavior is preserved (backward compatible).

---

## 5. Phase/Slice Plan

### Phase 1: Data Foundation (Slices 1.1–1.6)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 1.1 | Create `replay_snapshots` table + RLS | `supabase/migrations/` | Low — additive DDL |
| 1.2 | Create Discord tables (`discord_trade_sessions`, `discord_messages`, `discord_parsed_trades`) + RLS | `supabase/migrations/` | Low — additive DDL |
| 1.3 | Create `symbol_profiles` table + seed SPX profile + RLS | `supabase/migrations/` | Low — additive DDL |
| 1.4 | Create `replay_drill_results` table + RLS + indexes | `supabase/migrations/` | Low — additive DDL |
| 1.5 | Extend `ReplayPayload` and `SPXReplayFrame` types | `lib/trade-day-replay/types.ts`, `lib/spx/replay-engine.ts` | Medium — touches shared types |
| 1.6 | Add env schema entries for replay/discord flags | `backend/src/config/env.ts`, `.env.example` | Low |

### Phase 2: Snapshot Capture + Service Bootstrap (Slices 2.1–2.4)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 2.1 | Build `replaySnapshotWriter.ts` service | `backend/src/services/spx/replaySnapshotWriter.ts` | Medium — new service in engine loop |
| 2.2 | Integrate writer into SPX engine cycle | `backend/src/services/spx/index.ts` (or wherever the cycle runs) | High — touches live engine path |
| 2.3 | Add snapshot fetch API endpoints | `backend/src/routes/spx.ts` | Low — additive routes |
| 2.4 | Wire startup/shutdown bootstrap for snapshot writer and Discord bot behind env flags | `backend/src/server.ts` | Medium |

### Phase 3: Replay Levels Fix (Slices 3.1–3.2)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 3.1 | Load historical levels into `EnrichedReplayPayload` when building replay data | `backend/src/routes/spx.ts`, `lib/trade-day-replay/` | Medium |
| 3.2 | Chart reads `replayFrame.snapshot.levels` instead of live context when in replay mode | `components/spx-command-center/spx-chart.tsx` | High — touches core chart rendering |

### Phase 4: Discord Integration (Slices 4.1–4.4)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 4.1 | Discord bot connection + message listener | `backend/src/services/discord/discordBot.ts` | Medium — new external dependency |
| 4.2 | Message parser with pattern matching + state machine | `backend/src/services/discord/messageParser.ts` | Medium — parsing logic complexity |
| 4.3 | LLM fallback parser for unstructured messages | `backend/src/services/discord/messageParser.ts` | Low — uses existing OpenAI integration |
| 4.4 | Realtime broadcaster for live Discord calls | `backend/src/services/discord/discordBroadcaster.ts` | Low — follows existing Supabase Realtime patterns |

### Phase 5: Replay UI — Session Browser + Confluence Panel (Slices 5.1–5.4)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 5.1 | Replay session browser component | `components/spx-command-center/replay-session-browser.tsx` | Low — new component |
| 5.2 | Session browser API endpoints | `backend/src/routes/spx.ts` | Low — additive |
| 5.3 | Confluence context panel component | `components/spx-command-center/replay-confluence-panel.tsx` | Medium — dense data display |
| 5.4 | Wire confluence panel to replay frame snapshot | `components/spx-command-center/spx-chart.tsx`, context files | Medium |

### Phase 6: Discord Transcript UI + Lifecycle Markers (Slices 6.1–6.3)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 6.1 | Transcript sidebar component | `components/spx-command-center/replay-transcript-sidebar.tsx` | Low — new component |
| 6.2 | Time-sync mechanism between chart cursor and transcript scroll | Context/hook integration | Medium |
| 6.3 | Trade lifecycle markers (trim, stop, trail, B/E) on chart | `components/spx-command-center/spx-chart.tsx` | Medium — new marker rendering |

### Phase 7: SymbolProfile Abstraction (Slices 7.1–7.3)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 7.1 | SymbolProfile type + loader utility | `lib/types/spx-command-center.ts`, `backend/src/services/spx/symbolProfile.ts` | Low |
| 7.2 | Refactor engines to accept optional SymbolProfile | `levelEngine.ts`, `gexEngine.ts`, `flowEngine.ts`, `multiTFConfluence.ts`, `regimeClassifier.ts` | High — touches all engines |
| 7.3 | Symbol profile management API + UI in settings | `backend/src/routes/spx.ts`, `components/spx-command-center/spx-settings-sheet.tsx` | Low |

### Phase 8: Interactive Drill Mode (Slices 8.1–8.3)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 8.1 | Drill mode pause/reveal UI | `components/spx-command-center/replay-drill-mode.tsx` | Medium |
| 8.2 | Decision input form (direction, strike, stop, target) | Same component | Low |
| 8.3 | Comparison scorecard + persistence | Same component + `backend/src/routes/spx.ts` + Supabase table | Medium |

### Phase 9: Journal Auto-Generation (Slices 9.1–9.2)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 9.1 | Journal entry builder from replay session data | `lib/journal/` | Medium — integrates with existing journal system |
| 9.2 | "Save to Journal" action in replay UI | `components/spx-command-center/` + journal API | Low |

### Phase 10: Test Hardening + Release (Slices 10.1–10.3)

| Slice | Scope | Target Files | Risk |
|-------|-------|-------------|------|
| 10.1 | Unit tests for snapshot writer, message parser, replay engine extensions | `__tests__/`, `lib/spx/__tests__/` | Low |
| 10.2 | E2E tests for session browser, confluence panel, transcript sidebar | `e2e/spx-*.spec.ts` | Medium |
| 10.3 | Release gates, documentation, runbook | `docs/specs/` | Low |

---

## 6. Acceptance Criteria

### Cross-Cutting: Access Control
- [ ] All Same-Day Replay API routes enforce `authenticateToken` + `requireAdmin`
- [ ] Non-admin authenticated users receive deterministic `403` with no replay data leakage
- [ ] Replay UI route shows admin-only access state when backend gate denies access

### P1: Snapshot Capture
- [ ] Snapshots are written to `replay_snapshots` every 60 seconds during market hours
- [ ] Snapshots are written on every setup status transition
- [ ] Snapshot write failure does not block the engine cycle
- [ ] Snapshots contain all fields: GEX, flow, regime, levels, MTF, environment, basis
- [ ] Historical snapshots are queryable by date and symbol

### P2: Replay Levels Fix
- [ ] PDH/PDL render correctly during historical replay
- [ ] Opening Range box renders correctly during historical replay
- [ ] Structural and fibonacci levels render from snapshot data, not live context
- [ ] GEX-derived levels render when snapshot data is available
- [ ] Levels update as replay cursor passes through different snapshots

### P3: Discord Integration
- [ ] Bot connects to configured guild(s) and channel(s) on startup
- [ ] Messages are classified with >95% accuracy on FancyITM-style calls
- [ ] Trade lifecycle state machine correctly tracks: PREP → FILL → TRIM/STOP → EXIT
- [ ] Parsed trades are persisted with all fields populated
- [ ] Raw messages are archived for transcript replay
- [ ] Live calls are broadcast via Supabase Realtime within 500ms of Discord delivery

### P4: Session Browser
- [ ] Calendar shows days with sessions (trade count indicator)
- [ ] Session list shows caller, symbols, trade count, net P&L, duration
- [ ] Selecting a session always resolves by `session_id` (no same-date channel ambiguity)
- [ ] Trade cards show contract, P&L, time range
- [ ] Clicking a trade jumps the chart to that time window
- [ ] "Play Full Session" starts replay from session start

### P5: Confluence Panel
- [ ] All six sections render from snapshot data
- [ ] Panel updates in sync with replay cursor advancement
- [ ] R:R and evR display correctly for each trade entry
- [ ] GEX context shows relative position to call wall/put wall
- [ ] MTF alignment shows per-timeframe trend with composite score
- [ ] Memory edge shows historical win rate at the zone

### P6: Transcript Sidebar
- [ ] Full transcript renders with time-synced auto-scroll
- [ ] Signal messages are color-coded by type
- [ ] Commentary messages render at reduced opacity
- [ ] Clicking a chart trade marker jumps the transcript
- [ ] Thesis messages get special card treatment

### P7: SymbolProfile
- [ ] SPX profile seeds with current hardcoded values (zero behavioral change)
- [ ] All engines accept optional SymbolProfile parameter
- [ ] Adding a new symbol profile + Massive ticker enables replay for that symbol
- [ ] Profile changes take effect on next engine cycle without restart

### P8: Trade Lifecycle Event Rendering
- [ ] Trim markers render with percent trimmed and timestamp
- [ ] Stop-adjustment markers render old stop → new stop
- [ ] Trail activation markers render trail value and activation timestamp
- [ ] Breakeven markers render at correct price/time
- [ ] Thesis markers render only for thesis-tagged messages and do not clutter chart

### P9: Drill Mode
- [ ] Replay pauses at decision points with future bars hidden
- [ ] Learner can input direction, strike, stop, target
- [ ] Reveal shows actual outcome + engine evaluation + Discord call
- [ ] Comparison scorecard displays learner vs. actual vs. engine
- [ ] Drill results persist to Supabase for progress tracking

### P10: Journal Auto-Generation
- [ ] "Save to Journal" creates one entry per trade with: contract, entry/exit, P&L, thesis, confluence snapshot summary
- [ ] Generated entries use the existing journal schema and grading system
- [ ] Entries link back to the replay session for re-viewing

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Discord API rate limiting under high message volume | Medium | Medium | Implement exponential backoff; batch non-critical writes |
| Snapshot storage grows beyond expected size | Low | Low | 60s interval = ~400 snapshots/day ≈ 1.2MB. Monitor and adjust interval if needed |
| GEX/Flow data unavailable for historical dates before snapshot system | Certain | Medium | Force partial-context mode with explicit labels. Never fabricate confluence or memory metrics |
| Message parser accuracy on non-standard call formats | Medium | Medium | LLM fallback covers edge cases. Manual correction UI for admin (future) |
| Chart rendering performance with additional overlay layers | Medium | High | Use overlay priority budgeting (existing `overlay-priority.ts`). Lazy-load confluence panel |
| SymbolProfile refactor introduces regressions in SPX engine | Medium | High | SPX profile seeds with exact current values. Existing tests must pass unchanged |
| Discord bot token compromise | Low | Critical | Token stored server-side only. Bot has minimal permissions (read messages only) |
| Massive.com historical bar gaps for non-SPX symbols | Medium | Medium | Validate bar coverage before enabling replay. Show gap indicators on chart |
| Admin auth drift between frontend and backend gates | Low | High | Enforce `requireAdmin` on every replay route and add 403 E2E coverage |

---

## 8. Rollback Plan

Each phase is independently deployable and reversible:

- **Phase 1 (DDL):** Drop tables via reverse migration. No data dependencies on existing tables.
- **Phase 2 (Snapshot Writer):** Disable via `REPLAY_SNAPSHOT_ENABLED=false` env var. Engine continues without captures.
- **Phase 3 (Levels Fix):** Revert chart to reading from live context (single line change in `spx-chart.tsx`).
- **Phase 4 (Discord Bot):** Disable via `DISCORD_BOT_ENABLED=false`. Bot disconnects; existing functionality unaffected.
- **Phase 5-6 (UI):** New components behind feature flag `REPLAY_V2_ENABLED`. Toggle off to restore current UI.
- **Phase 7 (SymbolProfile):** All engines fall back to hardcoded values when no profile is provided. Remove profile parameter calls.
- **Phase 8-9 (Drill/Journal):** Purely additive features behind feature flags.

---

## 9. Dependencies and Sequencing

```
Phase 1 ──→ Phase 2 ──→ Phase 3
   │              │
   └──→ Phase 4   └──→ Phase 5 ──→ Phase 6
                            │
                            └──→ Phase 7
                                    │
                            Phase 8 ←┘
                              │
                            Phase 9
                              │
                            Phase 10
```

- Phase 2 depends on Phase 1 (tables must exist for snapshot writes)
- Phase 2.4 depends on Phase 1.6 (env schema must include replay/discord flags before bootstrap wiring)
- Phase 3 depends on Phase 2 (uses snapshot data for levels)
- Phase 4 depends on Phase 1 (Discord tables must exist)
- Phase 5 depends on Phase 2 (confluence panel reads snapshots)
- Phase 6 depends on Phase 4 (transcript sidebar reads Discord messages)
- Phase 7 can run in parallel with Phases 5-6 (engine refactor is independent of UI)
- Phase 8 depends on Phase 5 + Phase 7 (drill mode uses confluence panel + symbol profiles)
- Phase 9 depends on Phase 5 + Phase 6 (journal builder needs both data layers)
- Phase 10 follows all implementation phases

**Parallelizable work:**
- Phase 4 (Discord) and Phase 2 (Snapshots) can run in parallel after Phase 1
- Phase 7 (SymbolProfile) can run in parallel with Phase 5-6
- Frontend Agent (Phases 5, 6, 8) and Backend Agent (Phases 2, 4) can work simultaneously per CLAUDE.md §7 multi-agent orchestration

---

## 10. Validation Gates

### Slice-Level Gates
```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

### Phase-Level Gates
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run lib/spx/__tests__
pnpm vitest run lib/trade-day-replay/__tests__
```

### Release Gates
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1
```

All gates must pass under Node >= 20.19.5.

---

## 11. New Package Dependencies

| Package | Version | Purpose | Phase |
|---------|---------|---------|-------|
| `discord.js` | ^14.x | Discord bot client | Phase 4 |

No other new external dependencies. All other functionality uses existing integrations (Supabase, OpenAI, Massive.com, Redis).

---

## 12. Env Var Additions

```env
# Replay Snapshot System
REPLAY_SNAPSHOT_ENABLED=true
REPLAY_SNAPSHOT_INTERVAL_MS=60000

# Discord Bot
DISCORD_BOT_ENABLED=false
DISCORD_BOT_TOKEN=
DISCORD_BOT_GUILD_IDS=
DISCORD_BOT_CHANNEL_IDS=

# Feature Flags
REPLAY_V2_ENABLED=false
DRILL_MODE_ENABLED=false
```

Access control note: replay/admin gating is enforced by middleware (`requireAdmin`) and is not controlled by a runtime feature flag in V1.

---

## 13. Autonomous Control Packet

This spec is governed with a dedicated autonomous packet:

- `docs/specs/same-day-replay-autonomous-2026-02-28/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
- `docs/specs/same-day-replay-autonomous-2026-02-28/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
- `docs/specs/same-day-replay-autonomous-2026-02-28/08_AUTONOMOUS_EXECUTION_TRACKER.md`

These files are mandatory and must be updated at every completed slice.

---

## 14. File Ownership (Per CLAUDE.md §7.2)

| New File/Dir | Owner Agent |
|-------------|-------------|
| `supabase/migrations/*replay*`, `*discord*`, `*symbol_profile*` | Database Agent |
| `backend/src/services/spx/replaySnapshotWriter.ts` | Backend Agent |
| `backend/src/services/discord/*` | Backend Agent |
| `backend/src/config/env.ts`, `backend/src/server.ts` (replay bootstrap wiring) | Backend Agent |
| `lib/trade-day-replay/types.ts` (extensions) | SPX Engine Agent (shared file, coordinate) |
| `lib/spx/replay-engine.ts` (extensions) | SPX Engine Agent |
| `lib/types/spx-command-center.ts` (SymbolProfile type) | SPX Engine Agent (shared file, coordinate) |
| `components/spx-command-center/replay-*` | Frontend Agent |
| `components/spx-command-center/spx-chart.tsx` (level fix + lifecycle markers) | Frontend Agent |
| `e2e/spx-*.spec.ts`, replay-specific spec additions | QA Agent |
| `docs/specs/SAME_DAY_REPLAY_*` | Docs Agent |

---

## 15. Estimated Effort

| Phase | Slices | Estimated Sessions | Complexity |
|-------|--------|-------------------|------------|
| Phase 1: Data Foundation | 6 | 2 sessions | Low |
| Phase 2: Snapshot Capture + Bootstrap | 4 | 2 sessions | Medium |
| Phase 3: Levels Fix | 2 | 1 session | Medium |
| Phase 4: Discord Integration | 4 | 3 sessions | Medium-High |
| Phase 5: Session Browser + Confluence | 4 | 3 sessions | Medium |
| Phase 6: Transcript + Lifecycle | 3 | 2 sessions | Medium |
| Phase 7: SymbolProfile | 3 | 2 sessions | High |
| Phase 8: Drill Mode | 3 | 2 sessions | Medium |
| Phase 9: Journal Auto-Gen | 2 | 1 session | Low |
| Phase 10: Test Hardening | 3 | 2 sessions | Medium |
| **Total** | **34 slices** | **~21 sessions** | |

---

*This spec follows the Spec-First Autonomous Delivery process defined in CLAUDE.md §6. Implementation does not begin until this spec is approved.*
