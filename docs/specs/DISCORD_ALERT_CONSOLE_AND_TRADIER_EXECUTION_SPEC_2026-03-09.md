# Discord Alert Console & Tradier Auto-Execution — Execution Spec

> **Feature:** Admin Alert Console (Discord) + Member Tradier Auto-Execution Bot
> **Author:** Claude (Orchestrator Agent)
> **Date:** 2026-03-09
> **Status:** DRAFT — Awaiting Approval
> **Governs:** EPIC-ALERT — Alert Console & Trade Execution Pipeline
> **Runtime:** Node >= 20.19.5 | pnpm 10+

---

## 1. Objective

Build two interconnected systems that transform how TradeITM delivers and executes trade alerts:

**System A — Admin Alert Console:** A one-click admin interface inside the TradeITM platform where admins (FancyITM, AstarITM) compose structured trade alerts and broadcast them to Discord with a single tap. Replaces manual Discord typing with a stateful trade-session UI that tracks the full alert lifecycle (PREP → FILL → MANAGE → EXIT) and auto-generates daily recaps.

**System B — Tradier Auto-Execution Bot:** An opt-in member feature that connects a Tradier brokerage account to the platform. When structured alerts flow from the Alert Console, the bot interprets them and places real options orders via the Tradier API — with configurable risk guardrails, position-sizing rules, and kill-switch controls.

Both systems consume the same canonical alert event, ensuring Discord messages and brokerage orders are always in sync.

### 1.1 Success Criteria

1. Admin can open a trade session, select ticker/strike/expiration/direction, and send a PREP alert to Discord in ≤2 taps.
2. All subsequent lifecycle alerts (PTF, FILL, TRIM %, STOP, TRAIL, B/E, EXIT, commentary) are one-tap contextual actions against the active session.
3. "Fully Out" auto-closes the active trade and advances the session trade index.
4. "End Session" auto-computes and posts a daily recap message (per-trade P&L %).
5. All alerts are persisted as structured events in the existing `discord_trade_sessions` / `discord_parsed_trades` / `discord_messages` tables.
6. Members can connect a Tradier brokerage account via OAuth 2.0 from `/members/profile/auto-trade`.
7. Members configure risk profiles: max position size ($), max daily loss ($), max contracts, execution mode (Full Auto / Confirm-First / Shadow).
8. PREP alerts → push notification + contract staged in member dashboard (no order placed).
9. FILL alerts → order placed via Tradier API (market or limit), respecting member's size config.
10. TRIM/STOP/TRAIL/B/E/EXIT alerts → corresponding order modifications via Tradier API.
11. Kill switch: admin-level (pauses all member executions) and member-level (pauses own executions).
12. Full audit trail: every alert, every order attempt, every fill confirmation, every rejection.
13. Shadow mode produces paper-trade P&L tracking with no real orders.

### 1.2 Non-Goals (Out of Scope)

- Member-to-member alert sharing (handled by Trade Social).
- Multi-broker support beyond Tradier (v2: TD Ameritrade, Interactive Brokers).
- Automated strategy generation (admin manually creates alerts).
- Voice channel integration (admin manually says "meet me in voice").
- Options chain selection UI with Greeks analysis (use existing SPX Command Center for analysis; Alert Console is for broadcasting decisions).
- Mobile push notifications for alerts (v2 — use existing Supabase Realtime subscription for now).

---

## 2. Constraints

| Constraint | Detail |
|------------|--------|
| Design System | Emerald Standard: dark mode only, `glass-card-heavy`, Playfair/Inter/Geist Mono, emerald-500 primary, champagne accents |
| Market Data Provider | Massive.com ONLY. Never say "Polygon." Use `MASSIVE_API_KEY` env var. |
| Auth | `isAdminUser()` for all admin Alert Console routes. Supabase RLS for member Tradier config. |
| Brokerage API | Tradier API (`api.tradier.com` production, `sandbox.tradier.com` for Shadow mode). |
| Discord | Use existing `discordNotifier.ts` webhook pattern for outbound messages. Extend `discordBroadcaster.ts` for Supabase Realtime fan-out to connected members. |
| Existing Infrastructure | Must integrate with existing `discord/messageParser.ts` signal types, `discordPersistence.ts` session/trade tracking, and `discordBroadcaster.ts` Realtime broadcasting. |
| Validation | Zod schemas on all API boundaries. |
| Icons | Lucide React, stroke width 1.5. |
| Imports | `@/` alias for absolute imports. |
| Secret Storage | Tradier OAuth tokens encrypted at rest in Supabase. Never exposed client-side. |
| Rate Limits | Tradier API: 120 requests/minute. Discord webhook: 30 messages/minute per channel. |
| Financial Regulations | Prominent disclaimers on auto-execution feature. Members accept ToS before enabling. "Not financial advice" on every alert. |

---

## 3. Alert Taxonomy (Canonical Signal Types)

Derived from production Discord transcript analysis (2026-03-05 through 2026-03-09). These align with the existing `DiscordSignalType` in `messageParser.ts`.

| Signal Type | Admin Action | Discord Message Format | Tradier Action | Example |
|-------------|-------------|----------------------|----------------|---------|
| `prep` | Select ticker/strike/exp/direction | `PREP {SYM} {STRIKE}{C\|P} {EXP} @everyone {size_tag}` | Stage contract in member dashboard. No order. | `PREP SPX 6830C 03/06 @everyone (LIGHT SIZED)` |
| `ptf` | "Preparing to fill" button | `PTF @everyone` | Move to "ready" state. No order. | `PTF @everyone` |
| `filled_avg` | Enter fill price | `Filled AVG {price} @everyone Stops {level} or (-{pct}%)` | Place market/limit order + initial stop-loss | `Filled AVG 3.80 @everyone Stops 6845 or (-20%)` |
| `trim` | Enter trim % | `Trim {pct}% here @everyone` | Sell `ceil(position * pct%)` contracts | `Trim 15% here @everyone` |
| `add` | Enter new avg price | `Added to {SYM}, new AVG {price} @everyone` | Buy additional contracts to match new avg | `Added to COIN, new AVG 3.92 @everyone` |
| `stops` | Enter stop level or % | `Stops {level} or (-{pct}%) @everyone` | Place/replace stop-loss order | `Stops 6710 or (-20%)` |
| `breakeven` | "B/E Stops" button | `B/E stops @everyone` | Move stop to entry price | `B/E stops on runners @everyone` |
| `trail` | Enter trail % | `Move trails on runners to +{pct}% @everyone` | Replace stop with trailing stop at +pct% | `Move trails on runners to +10% @everyone` |
| `exit_above` | Enter exit level | `Let's use above {level} as exits @everyone` | Set conditional sell trigger | `Let's use above 6826 as exits @everyone` |
| `exit_below` | Enter exit level | `Let's use below {level} as exits @everyone` | Set conditional sell trigger | `Let's use below 6826 as exits on runners @everyone` |
| `fully_out` | "Fully Out" button | `Fully out @everyone` | Market sell all remaining contracts | `Fully out of SPX @everyone` |
| `commentary` | Free-text input | `{text} @everyone` | No action. Display only. | `@everyone 6830 6810 6800 are your pivot points today.` |
| `session_recap` | Auto-generated on session close | `1st trade {pct}% 2nd trade {pct}%... Solid day @everyone` | No action. Summary only. | `1st trade 42% 2nd trade 138%... Solid day see you tomorrow @everyone` |

### 3.1 Trade Session State Machine

```
                                    ┌──────────────┐
                                    │     IDLE     │
                                    │  (no active  │
                                    │    trade)    │
                                    └──────┬───────┘
                                           │ PREP
                                           ▼
                                    ┌──────────────┐
                              ┌─────│    STAGED    │
                              │     │  (prepped,   │
                              │     │  not filled) │
                              │     └──────┬───────┘
                              │            │ FILL (filled_avg)
                              │            ▼
                              │     ┌──────────────┐
                              │     │    ACTIVE    │◄────────┐
                              │     │  (position   │         │
                              │     │    open)     │─────────┘
                              │     └──────┬───────┘  TRIM / ADD /
                              │            │          STOP / TRAIL /
                              │            │          B/E / EXIT_ABOVE /
                              │            │          EXIT_BELOW
                              │            │ FULLY_OUT
                              │            ▼
                              │     ┌──────────────┐
                              └────▶│    CLOSED    │
                                    │  (flat, P&L  │
                                    │  computed)   │
                                    └──────┬───────┘
                                           │ Next PREP or End Session
                                           ▼
                                    ┌──────────────┐
                                    │  IDLE / END  │
                                    └──────────────┘
```

### 3.2 Size Tags

| Tag | Meaning | Tradier Sizing Rule |
|-----|---------|-------------------|
| (none) | Full size | Member's configured `max_contracts` |
| `LIGHT SIZED` | Reduced risk | `floor(max_contracts * 0.5)`, minimum 1 |
| `EOD LOTTO` | End-of-day speculative | `floor(max_contracts * 0.25)`, minimum 1 |

---

## 4. System A — Admin Alert Console

### 4.1 Route & Page Structure

```
app/admin/alerts/
  page.tsx                          # Alert Console main page
  layout.tsx                        # Admin layout wrapper with sidebar highlight

components/admin/alerts/
  alert-console.tsx                 # Main console orchestrator
  trade-setup-bar.tsx               # Ticker/strike/exp/direction input (Zone 1)
  alert-action-strip.tsx            # Contextual one-click buttons (Zone 2)
  session-log.tsx                   # Running feed of sent alerts (Zone 3)
  active-trade-card.tsx             # Shows current trade state, P&L, contracts remaining
  session-recap-generator.tsx       # Auto-computes daily recap on session close
  quick-ticker-input.tsx            # Smart parser: "SPX 6830C 03/06" → structured fields
  size-tag-selector.tsx             # Full / Light Sized / EOD Lotto toggle
  alert-history-table.tsx           # Historical sessions/alerts browsable table
```

### 4.2 Admin Console UX Flow

**Zone 1 — Trade Setup Bar (persistent top strip)**

A single-line input bar that accepts natural format: `SPX 6830C 03/06`. The parser (reusing logic from existing `messageParser.ts` regex patterns) extracts:
- `symbol`: SPX
- `strike`: 6830
- `optionType`: C (call) → mapped to `'call'`
- `expiration`: 03/06 → resolved to `2026-03-06`

Adjacent to the input: a size-tag toggle (Full / Light / Lotto) and a direction override (auto-detected from C/P but manually overridable).

Below the input: live contract pricing from Massive.com API (bid/ask/last/IV/delta) for the selected contract. This gives the admin real-time context before alerting.

**Zone 2 — Alert Action Strip (contextual buttons)**

Buttons change based on trade state:

| State | Available Actions |
|-------|------------------|
| IDLE | `PREP` · `Commentary` |
| STAGED | `PTF` · `FILL` (with price input) · `Cancel Prep` · `Commentary` |
| ACTIVE | `TRIM` (% input) · `ADD` (price input) · `SET STOPS` (price or % input) · `B/E STOPS` · `MOVE TRAIL` (% input) · `EXIT ABOVE/BELOW` (level input) · `FULLY OUT` · `Commentary` |
| CLOSED | `New PREP` · `End Session` · `Commentary` |

Each button click:
1. Constructs the formatted Discord message from structured fields.
2. Sends via `discordNotifier.ts` webhook to the configured alert channel.
3. Persists the signal event via `discordPersistence.ts`.
4. Broadcasts structured payload via `discordBroadcaster.ts` Supabase Realtime (consumed by member auto-trade clients).
5. Updates the trade state machine.

**% Input UX:** When "TRIM" is tapped, a small number input appears inline. Admin types "15" → button label changes to "Send: Trim 15%" → tap confirms and sends.

**Price Input UX:** When "FILL" is tapped, a price input appears. Admin types "3.80" → optionally adds stop (price or %) in adjacent field → tap confirms and sends fill + stop as one alert.

**Zone 3 — Session Log (scrollable feed)**

Real-time feed of all alerts sent in the current session, styled like Discord messages but within the admin panel. Each entry shows: timestamp, alert type badge (color-coded: green=fill, yellow=trim, red=stop/exit, blue=prep, gray=commentary), formatted message, and a "resend" button for failed webhook deliveries.

At session end: a "Generate Recap" button that computes per-trade P&L from fill/exit prices and formats the summary in FancyITM's established style.

### 4.3 Multiple Simultaneous Trades

The transcript shows overlapping symbols (SPX + COIN + QQQ). The console supports this via a **trade tab strip** below Zone 1. Each active trade gets a tab showing `{SYM} {STRIKE}{C|P} | {state}`. The action strip and session log filter to the selected tab. A "+" tab creates a new trade within the same session.

### 4.4 Alert Console API Routes

```
# Admin API (all require isAdminUser())
POST   /api/admin/alerts/session/start    # Start a new alert session for today
POST   /api/admin/alerts/session/end      # Close session, generate recap
GET    /api/admin/alerts/session/active    # Get current active session + trades
POST   /api/admin/alerts/send             # Send an alert (any signal type)
GET    /api/admin/alerts/history           # Historical sessions with pagination
GET    /api/admin/alerts/history/:id       # Single session detail with all alerts
POST   /api/admin/alerts/resend/:msgId    # Resend a failed webhook message
GET    /api/admin/alerts/pricing           # Get live contract pricing from Massive.com
```

### 4.5 Alert `send` Payload Schema (Zod)

```typescript
const AlertSendSchema = z.object({
  sessionId: z.string().uuid(),
  tradeId: z.string().uuid().optional(),         // omit for new PREP or commentary
  signalType: z.enum([
    'prep', 'ptf', 'filled_avg', 'trim', 'add',
    'stops', 'breakeven', 'trail',
    'exit_above', 'exit_below', 'fully_out',
    'commentary', 'session_recap'
  ]),
  fields: z.object({
    symbol: z.string().optional(),                // SPX, QQQ, COIN, etc.
    strike: z.number().optional(),                // 6830
    optionType: z.enum(['call', 'put']).optional(), // C or P
    expiration: z.string().optional(),            // 2026-03-06
    price: z.number().optional(),                 // fill price, add price
    percent: z.number().optional(),               // trim %, stop %, trail %
    level: z.number().optional(),                 // stop level, exit level
    sizeTag: z.enum(['full', 'light', 'lotto']).optional(),
    commentary: z.string().optional(),            // free text
  }),
  mentionEveryone: z.boolean().default(true),
});
```

---

## 5. System B — Tradier Auto-Execution Bot

### 5.1 Tradier Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN ALERT CONSOLE                          │
│              (sends structured alert event)                     │
└─────────────────┬───────────────────────────┬───────────────────┘
                  │                           │
                  ▼                           ▼
     ┌────────────────────┐      ┌────────────────────────┐
     │  Discord Webhook   │      │  Supabase Realtime     │
     │  (human-readable   │      │  Broadcast Channel     │
     │   alert message)   │      │  (structured payload)  │
     └────────────────────┘      └────────────┬───────────┘
                                              │
                                              ▼
                                 ┌────────────────────────┐
                                 │  Execution Engine      │
                                 │  (backend service)     │
                                 │                        │
                                 │  For each opted-in     │
                                 │  member:               │
                                 │  1. Check kill switch   │
                                 │  2. Check daily loss   │
                                 │  3. Compute position   │
                                 │     size               │
                                 │  4. Place order via    │
                                 │     Tradier API        │
                                 │  5. Log result         │
                                 └────────────┬───────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                     │  Member A    │ │  Member B    │ │  Member C    │
                     │  Full Auto   │ │  Confirm     │ │  Shadow      │
                     │  → Order     │ │  → Push      │ │  → Paper     │
                     │    placed    │ │    confirm   │ │    log only  │
                     └──────────────┘ └──────────────┘ └──────────────┘
```

### 5.2 Member Onboarding Flow

**Route:** `/members/profile/auto-trade`

**Step 1 — Terms & Disclaimer:**
Member reads and accepts auto-trade ToS:
- "TradeITM is not a registered investment advisor."
- "Auto-execution carries risk of loss. Past alert performance does not guarantee future results."
- "You are solely responsible for trades executed in your brokerage account."
- "You can disable auto-execution at any time via the kill switch."
Acceptance stored with timestamp in `member_tradier_config.tos_accepted_at`.

**Step 2 — Connect Tradier:**
OAuth 2.0 flow:
1. Member clicks "Connect Tradier Account."
2. Redirect to `https://api.tradier.com/v1/oauth/authorize?client_id={}&scope=trade,market,account&redirect_uri={callback}`.
3. Tradier redirects back with auth code.
4. Backend exchanges code for access token + refresh token.
5. Tokens encrypted (AES-256-GCM) and stored in `member_tradier_config`.
6. Backend fetches account list via `GET /v1/user/profile` and stores account ID.

**Step 3 — Configure Risk Profile:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `execution_mode` | enum | `shadow` | `full_auto` / `confirm_first` / `shadow` |
| `max_position_dollars` | number | 500 | Max $ per trade (contracts = floor(max_$ / (fill_price * 100))) |
| `max_contracts` | number | 5 | Hard cap on contracts per trade |
| `max_daily_loss_dollars` | number | 1000 | Daily loss limit — bot stops opening new positions after this |
| `slippage_tolerance_pct` | number | 10 | Max % deviation from alert price before order pauses for confirmation |
| `enabled_symbols` | string[] | ['SPX','QQQ'] | Only execute alerts for these symbols |
| `kill_switch` | boolean | false | Emergency stop — no orders placed when true |

**Step 4 — Verification Trade:**
Before going live, member must complete one Shadow-mode trade cycle to confirm the pipeline works end-to-end. UI shows a "verification complete" badge after first full PREP→FILL→EXIT cycle in shadow mode.

### 5.3 Execution Engine — Signal Processing Rules

**Backend Service:** `backend/src/services/tradier/executionEngine.ts`

For each incoming alert broadcast, the engine processes all opted-in members in parallel:

```
For each member with auto-trade enabled:
  1. PRE-FLIGHT CHECKS:
     ├─ Is admin kill switch OFF?
     ├─ Is member kill switch OFF?
     ├─ Is member's execution_mode != 'shadow' (for real orders)?
     ├─ Is symbol in member's enabled_symbols?
     ├─ Is daily_loss < max_daily_loss_dollars?
     └─ Is Tradier token valid (not expired)?
         └─ If expired, attempt token refresh. If refresh fails, skip + notify.

  2. SIGNAL-SPECIFIC LOGIC:
     See §5.4 for per-signal execution rules.

  3. ORDER PLACEMENT:
     ├─ Full Auto → place order immediately
     ├─ Confirm First → create pending_order record + push notification
     │   └─ Member has 60 seconds to confirm or dismiss
     │   └─ If no response, order expires (fail-safe: no order placed)
     └─ Shadow → log virtual order with current market price

  4. AUDIT:
     └─ Write to trade_execution_log: alert_id, member_id, order_type,
        contracts, price, tradier_order_id, status, error (if any)
```

### 5.4 Per-Signal Execution Rules

**`prep`** — No order. Update member's staged_contract in auto-trade dashboard. Push notification: "FancyITM prepping {SYM} {STRIKE}{C|P} — {size_tag}."

**`ptf`** — No order. Update UI state to "ready." Push notification: "Preparing to fill."

**`filled_avg`** — Core execution:
```
fill_price = alert.fields.price           # e.g., 3.80
stop_pct = alert.fields.percent           # e.g., 20 (means -20%)
stop_level = alert.fields.level           # e.g., 6845 (underlying price stop)

# Position sizing
if size_tag == 'light':
  effective_max = floor(member.max_contracts * 0.5)
elif size_tag == 'lotto':
  effective_max = floor(member.max_contracts * 0.25)
else:
  effective_max = member.max_contracts

dollar_contracts = floor(member.max_position_dollars / (fill_price * 100))
contracts = min(dollar_contracts, effective_max, member.max_contracts)
contracts = max(contracts, 1)  # minimum 1 contract

# Slippage check
current_ask = get_quote(symbol, strike, exp, option_type).ask
if abs(current_ask - fill_price) / fill_price > member.slippage_tolerance_pct / 100:
  → pause, request confirmation regardless of mode

# Place order
tradier_order = POST /v1/accounts/{acct}/orders
  class: option
  symbol: {OCC symbol}  # e.g., SPX260306C06830
  side: buy_to_open
  quantity: {contracts}
  type: market  (or limit at fill_price if slippage low)
  duration: day

# Place initial stop (if stop_pct provided)
tradier_stop = POST /v1/accounts/{acct}/orders
  class: option
  symbol: {OCC symbol}
  side: sell_to_close
  quantity: {contracts}
  type: stop
  stop: fill_price * (1 - stop_pct/100)
  duration: day
```

**`trim`** — Partial exit:
```
trim_pct = alert.fields.percent           # e.g., 15
current_position = get_position(member, trade)
trim_contracts = ceil(current_position.total_contracts * trim_pct / 100)
trim_contracts = min(trim_contracts, current_position.remaining_contracts)

POST /v1/accounts/{acct}/orders
  side: sell_to_close
  quantity: {trim_contracts}
  type: market
  duration: day

# Update stop order quantity to match remaining contracts
PATCH stop_order → new quantity = remaining - trim_contracts
```

**`add`** — Average down/up:
```
new_avg = alert.fields.price
# Compute additional contracts to approximate the new average
# This may require buying more contracts at current market price
additional = compute_add_contracts(member, trade, new_avg)

POST /v1/accounts/{acct}/orders
  side: buy_to_open
  quantity: {additional}
  type: market
  duration: day

# Update stop order quantity to include new contracts
```

**`stops`** — Set/replace stop:
```
# Cancel existing stop order if any
DELETE /v1/accounts/{acct}/orders/{existing_stop_id}

# Place new stop
stop_price = alert.fields.level
  OR fill_price * (1 - alert.fields.percent/100)

POST /v1/accounts/{acct}/orders
  side: sell_to_close
  quantity: {remaining_contracts}
  type: stop
  stop: {stop_price}
  duration: day
```

**`breakeven`** — Move stop to entry:
```
# Cancel existing stop
# Place new stop at original fill price
stop_price = trade.entry_price

POST /v1/accounts/{acct}/orders
  side: sell_to_close
  quantity: {remaining_contracts}
  type: stop
  stop: {stop_price}
  duration: day
```

**`trail`** — Trailing stop:
```
trail_pct = alert.fields.percent          # e.g., 10 (means +10% from entry)
trail_price = trade.entry_price * (1 + trail_pct/100)

# Cancel existing stop, place new one
POST /v1/accounts/{acct}/orders
  side: sell_to_close
  quantity: {remaining_contracts}
  type: stop
  stop: {trail_price}
  duration: day
```

**`exit_above` / `exit_below`** — Conditional exit on underlying price:
```
# Tradier doesn't natively support "sell options when underlying hits X"
# Implementation: backend monitors underlying price via Massive.com WebSocket
# When condition met, place market sell

Register price_alert:
  symbol: {underlying}  # SPX
  condition: above|below
  level: alert.fields.level
  action: sell_to_close all remaining contracts for this trade
```

**`fully_out`** — Emergency exit:
```
# Cancel ALL open orders for this trade (stops, conditionals)
# Market sell all remaining contracts

POST /v1/accounts/{acct}/orders
  side: sell_to_close
  quantity: {remaining_contracts}
  type: market
  duration: day

# Mark trade closed, compute P&L
```

### 5.5 OCC Symbol Construction

Tradier uses OCC option symbols:
```
{ROOT}{YYMMDD}{C|P}{STRIKE*1000, 8 digits}

Examples:
SPX 6830C 03/06/2026 → SPX   260306C06830000
COIN 212.50C 03/13/2026 → COIN  260313C00212500
QQQ puts → QQQ   260306P00XXX000
```

Builder function: `backend/src/services/tradier/occSymbol.ts`

### 5.6 Tradier API Integration

**Backend Config:** `backend/src/config/tradier.ts`

```
TRADIER_CLIENT_ID       # OAuth app client ID
TRADIER_CLIENT_SECRET   # OAuth app client secret
TRADIER_REDIRECT_URI    # OAuth callback URL
TRADIER_API_BASE        # https://api.tradier.com (prod) or sandbox.tradier.com
```

**Key Endpoints Used:**

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/user/profile` | Fetch account list after OAuth |
| `GET /v1/accounts/{id}/positions` | Current holdings |
| `GET /v1/accounts/{id}/orders` | Open orders |
| `POST /v1/accounts/{id}/orders` | Place new order |
| `PUT /v1/accounts/{id}/orders/{oid}` | Modify existing order |
| `DELETE /v1/accounts/{id}/orders/{oid}` | Cancel order |
| `GET /v1/markets/quotes` | Real-time quotes for slippage check |
| `GET /v1/markets/options/chains` | Options chain for contract validation |
| `POST /v1/oauth/accesstoken` | Exchange auth code for tokens |
| `POST /v1/oauth/accesstoken` (grant_type=refresh) | Refresh expired tokens |

### 5.7 Member Auto-Trade Dashboard

**Route:** `/members/profile/auto-trade`

**Sections:**

1. **Connection Status:** Tradier account connected/disconnected, last token refresh, account balance.
2. **Risk Configuration:** All settings from §5.2 in an editable form.
3. **Kill Switch:** Giant red toggle. When ON, no orders execute. Confirmation required to turn OFF.
4. **Active Trades:** Live view of trades being managed by the bot. Shows: symbol, contracts, entry price, current P&L, stop price, status.
5. **Execution Log:** Scrollable table of all order attempts with: timestamp, alert type, action taken, contracts, price, Tradier order ID, status (filled/rejected/expired/shadow).
6. **Daily P&L:** Running total of realized + unrealized P&L for the day. Turns red and shows warning when approaching daily loss limit.
7. **Shadow Mode Results:** Paper trade log with hypothetical P&L.

---

## 6. Database Schema

### 6.1 New Tables

```sql
-- Admin alert sessions (extends existing discord_trade_sessions)
-- No new table needed; reuse discord_trade_sessions with new source='admin_console' column

-- Member Tradier configuration
CREATE TABLE member_tradier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tradier_account_id TEXT,
  access_token_encrypted TEXT,           -- AES-256-GCM encrypted
  refresh_token_encrypted TEXT,          -- AES-256-GCM encrypted
  token_expires_at TIMESTAMPTZ,
  execution_mode TEXT NOT NULL DEFAULT 'shadow'
    CHECK (execution_mode IN ('full_auto', 'confirm_first', 'shadow')),
  max_position_dollars NUMERIC NOT NULL DEFAULT 500,
  max_contracts INTEGER NOT NULL DEFAULT 5,
  max_daily_loss_dollars NUMERIC NOT NULL DEFAULT 1000,
  slippage_tolerance_pct NUMERIC NOT NULL DEFAULT 10,
  enabled_symbols TEXT[] NOT NULL DEFAULT ARRAY['SPX'],
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  tos_accepted_at TIMESTAMPTZ,
  verification_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Global admin kill switch
CREATE TABLE admin_execution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  max_members_per_alert INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Trade execution audit log
CREATE TABLE trade_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  alert_id UUID,                          -- FK to discord_messages.id
  session_id UUID,                        -- FK to discord_trade_sessions.id
  trade_id UUID,                          -- FK to discord_parsed_trades.id
  signal_type TEXT NOT NULL,
  execution_mode TEXT NOT NULL,           -- full_auto / confirm_first / shadow
  action TEXT NOT NULL,                   -- buy_to_open / sell_to_close / cancel / modify
  symbol TEXT NOT NULL,
  occ_symbol TEXT,
  contracts INTEGER NOT NULL,
  intended_price NUMERIC,
  fill_price NUMERIC,
  tradier_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'filled', 'partially_filled',
                      'rejected', 'cancelled', 'expired', 'shadow_logged',
                      'confirmation_pending', 'confirmation_expired')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pending confirmations (for confirm_first mode)
CREATE TABLE pending_trade_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  execution_log_id UUID NOT NULL REFERENCES trade_execution_log(id),
  alert_payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,        -- 60 seconds from creation
  confirmed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price alert monitors (for exit_above/exit_below signals)
CREATE TABLE trade_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trade_id UUID NOT NULL,
  underlying_symbol TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  trigger_level NUMERIC NOT NULL,
  occ_symbol TEXT NOT NULL,
  contracts INTEGER NOT NULL,
  triggered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.2 Schema Modifications to Existing Tables

```sql
-- Add source column to discord_trade_sessions
ALTER TABLE discord_trade_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'discord_bot'
  CHECK (source IN ('discord_bot', 'admin_console'));

-- Add admin_alert_id to discord_messages for linking console alerts
ALTER TABLE discord_messages
  ADD COLUMN IF NOT EXISTS admin_alert_id UUID;
```

### 6.3 RLS Policies

```sql
-- member_tradier_config: members can only see/edit their own
ALTER TABLE member_tradier_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_config" ON member_tradier_config
  FOR ALL USING (auth.uid() = user_id);

-- trade_execution_log: members see own, admins see all
ALTER TABLE trade_execution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_log" ON trade_execution_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_all_logs" ON trade_execution_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND permission = 'admin')
  );

-- admin_execution_config: admins only
ALTER TABLE admin_execution_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_only" ON admin_execution_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND permission = 'admin')
  );

-- pending_trade_confirmations: members own
ALTER TABLE pending_trade_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_confirmations" ON pending_trade_confirmations
  FOR ALL USING (auth.uid() = user_id);

-- trade_price_alerts: members own
ALTER TABLE trade_price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_alerts" ON trade_price_alerts
  FOR ALL USING (auth.uid() = user_id);
```

---

## 7. In-Scope / Out-of-Scope Files

### 7.1 New Files (Create)

```
# Database Migrations
supabase/migrations/2026MMDD000000_alert_console_schema.sql
supabase/migrations/2026MMDD000001_tradier_config_schema.sql
supabase/migrations/2026MMDD000002_execution_log_schema.sql
supabase/migrations/2026MMDD000003_rls_policies.sql

# Admin Alert Console — Pages
app/admin/alerts/page.tsx
app/admin/alerts/layout.tsx

# Admin Alert Console — Components
components/admin/alerts/alert-console.tsx
components/admin/alerts/trade-setup-bar.tsx
components/admin/alerts/alert-action-strip.tsx
components/admin/alerts/session-log.tsx
components/admin/alerts/active-trade-card.tsx
components/admin/alerts/session-recap-generator.tsx
components/admin/alerts/quick-ticker-input.tsx
components/admin/alerts/size-tag-selector.tsx
components/admin/alerts/alert-history-table.tsx

# Admin Alert Console — API Routes
app/api/admin/alerts/session/route.ts
app/api/admin/alerts/send/route.ts
app/api/admin/alerts/history/route.ts
app/api/admin/alerts/pricing/route.ts
app/api/admin/alerts/resend/[msgId]/route.ts

# Tradier Integration — Backend Services
backend/src/config/tradier.ts
backend/src/services/tradier/tradierClient.ts
backend/src/services/tradier/executionEngine.ts
backend/src/services/tradier/occSymbol.ts
backend/src/services/tradier/orderManager.ts
backend/src/services/tradier/positionTracker.ts
backend/src/services/tradier/tokenManager.ts
backend/src/services/tradier/priceAlertMonitor.ts
backend/src/services/tradier/__tests__/occSymbol.test.ts
backend/src/services/tradier/__tests__/executionEngine.test.ts
backend/src/services/tradier/__tests__/orderManager.test.ts

# Tradier Integration — Backend Routes
backend/src/routes/tradier.ts
backend/src/routes/__tests__/tradier.test.ts

# Tradier Integration — API Routes (Next.js proxy)
app/api/members/auto-trade/config/route.ts
app/api/members/auto-trade/oauth/callback/route.ts
app/api/members/auto-trade/confirm/[id]/route.ts
app/api/members/auto-trade/kill-switch/route.ts
app/api/members/auto-trade/execution-log/route.ts

# Member Auto-Trade — Pages
app/members/profile/auto-trade/page.tsx

# Member Auto-Trade — Components
components/members/auto-trade/tradier-connect.tsx
components/members/auto-trade/risk-config-form.tsx
components/members/auto-trade/kill-switch-toggle.tsx
components/members/auto-trade/active-trades-panel.tsx
components/members/auto-trade/execution-log-table.tsx
components/members/auto-trade/daily-pnl-bar.tsx
components/members/auto-trade/shadow-results.tsx
components/members/auto-trade/confirmation-modal.tsx
components/members/auto-trade/tos-acceptance.tsx
components/members/auto-trade/verification-badge.tsx

# Shared Types
lib/types/alerts.ts
lib/types/tradier.ts

# E2E Tests
e2e/specs/admin/alert-console.spec.ts
e2e/specs/admin/alert-console-test-helpers.ts
e2e/specs/members/auto-trade.spec.ts
e2e/specs/members/auto-trade-test-helpers.ts
```

### 7.2 Modified Files (Edit)

```
# Extend existing Discord infrastructure
backend/src/services/discord/discordBroadcaster.ts    # Add admin_console source handling
backend/src/services/discord/discordPersistence.ts     # Add source column support
backend/src/services/discord/messageParser.ts          # Add 'add' signal type
backend/src/services/discordNotifier.ts                # Add rich embed formatting support

# Admin sidebar navigation
components/admin/admin-sidebar.tsx                     # Add "Alert Console" nav item
app/admin/layout.tsx                                   # Ensure alerts route is recognized

# Member profile navigation
app/members/profile/page.tsx                           # Add "Auto-Trade" section/link
components/members/profile/profile-nav.tsx             # Add auto-trade nav item

# Environment documentation
.env.example                                           # Add TRADIER_* env vars
```

### 7.3 Out-of-Scope Files (Do Not Touch)

```
lib/spx/**                          # SPX engine — no changes
backend/src/services/massiveTickStream.ts  # WebSocket ingest — no changes
supabase/migrations/*existing*      # Existing migrations — no modifications
app/members/ai-coach/**             # AI Coach — no changes
app/members/journal/**              # Trade Journal — no changes
```

---

## 8. Phase / Slice Plan

### Phase 1: Foundation (Slices 1-3) — Week 1

**Slice 1 — Database Schema & Types**
- Create all migration files (§6.1, §6.2, §6.3).
- Create `lib/types/alerts.ts` and `lib/types/tradier.ts`.
- Run `npx supabase db push` and `get_advisors(type: "security")`.
- Gate: Migrations apply cleanly. RLS policies verified.

**Slice 2 — Alert Console API (Backend)**
- Create admin alert API routes (§4.4).
- Extend `discordPersistence.ts` with `source` column support.
- Extend `discordNotifier.ts` with rich embed formatting.
- Add `add` signal type to `messageParser.ts`.
- Gate: All API routes respond correctly to curl tests. Auth verified.

**Slice 3 — Alert Console UI (Frontend)**
- Create `app/admin/alerts/page.tsx` and all components (§4.1).
- Implement Zone 1 (trade setup), Zone 2 (action strip), Zone 3 (session log).
- Add admin sidebar nav item.
- Gate: Admin can send a PREP → FILL → TRIM → FULLY OUT sequence; Discord receives formatted messages.

### Phase 2: Tradier Core (Slices 4-6) — Week 2

**Slice 4 — Tradier Client & OAuth**
- Create `backend/src/config/tradier.ts`.
- Create `tradierClient.ts` with token management, rate limiting, error handling.
- Create `tokenManager.ts` for OAuth flow and token refresh.
- Create OAuth callback route.
- Gate: OAuth flow completes end-to-end with Tradier sandbox.

**Slice 5 — OCC Symbol Builder & Order Manager**
- Create `occSymbol.ts` with full test coverage.
- Create `orderManager.ts` (place, modify, cancel orders via Tradier API).
- Create `positionTracker.ts` (fetch and track current positions).
- Gate: Unit tests pass for OCC symbol construction. Order placement works in sandbox.

**Slice 6 — Execution Engine**
- Create `executionEngine.ts` (§5.3, §5.4 — all signal processing rules).
- Wire to Supabase Realtime broadcast channel.
- Implement pre-flight checks, position sizing, slippage detection.
- Gate: Shadow-mode execution logs correct virtual orders for a full alert sequence.

### Phase 3: Member Experience (Slices 7-9) — Week 3

**Slice 7 — Member Config & ToS**
- Create `/members/profile/auto-trade/page.tsx` and config components.
- Implement risk configuration form, ToS acceptance, Tradier connect button.
- Gate: Member can connect Tradier, configure risk profile, accept ToS.

**Slice 8 — Kill Switch & Confirmation Flow**
- Implement admin global kill switch in Alert Console.
- Implement member kill switch toggle.
- Create `pending_trade_confirmations` flow for confirm-first mode.
- Create `confirmation-modal.tsx` with 60-second timeout.
- Gate: Kill switch prevents order execution. Confirmation modal works with timeout.

**Slice 9 — Member Dashboard & Execution Log**
- Create active trades panel, execution log table, daily P&L bar.
- Create shadow results view.
- Wire Supabase Realtime for live trade status updates.
- Gate: Member sees real-time trade status, execution history, and P&L.

### Phase 4: Price Alerts & Hardening (Slices 10-12) — Week 4

**Slice 10 — Price Alert Monitor**
- Create `priceAlertMonitor.ts` for exit_above/exit_below conditions.
- Wire to Massive.com WebSocket for underlying price monitoring.
- Gate: Price alert triggers sell order when underlying crosses level.

**Slice 11 — Session Recap & History**
- Implement `session-recap-generator.tsx` auto-computation.
- Create alert history browsable table in admin.
- Gate: "End Session" generates correct per-trade P&L recap message.

**Slice 12 — E2E Tests & Hardening**
- Write E2E tests for admin alert console flow.
- Write E2E tests for member auto-trade configuration.
- Run full validation gates.
- Gate: All E2E specs green. Security advisors clean.

---

## 9. Environment Variables (New)

```env
# Tradier Brokerage API
TRADIER_CLIENT_ID=                      # OAuth app client ID
TRADIER_CLIENT_SECRET=                  # OAuth app client secret
TRADIER_REDIRECT_URI=                   # OAuth callback URL
TRADIER_API_BASE=https://sandbox.tradier.com  # sandbox for dev, api.tradier.com for prod
TRADIER_ENCRYPTION_KEY=                 # AES-256 key for token encryption (32 bytes, hex)

# Admin Alert Console
DISCORD_ALERT_CHANNEL_WEBHOOK_URL=      # Webhook URL for the alert channel
DISCORD_ALERT_CHANNEL_ID=              # Channel ID for Realtime broadcast

# Execution Engine
EXECUTION_ENGINE_ENABLED=false          # Master feature flag
EXECUTION_MAX_CONCURRENT_ORDERS=10      # Max parallel order placements
```

---

## 10. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tradier API outage during active trade | HIGH | Execution engine retries 3x with exponential backoff. If all fail, push emergency notification to member. Kill switch auto-engages after 3 consecutive API failures. |
| Token expiry mid-session | MEDIUM | Token refresh runs 5 minutes before expiry. If refresh fails, member notified and execution paused until re-auth. |
| Slippage on market orders | HIGH | Slippage tolerance check before every order. If exceeded, order pauses for confirmation regardless of mode. |
| Member exceeds daily loss limit | HIGH | Pre-flight check on every fill. If cumulative loss >= limit, no new buy orders. Exit orders still execute. |
| Admin sends duplicate alert | LOW | Deduplication by message content + timestamp within 5-second window. UI shows "sending..." state to prevent double-tap. |
| Discord webhook rate limit (30/min) | LOW | Alert queue with rate-limit awareness. If rate-limited, alerts queue and send on next available slot. UI shows queue depth. |
| Tradier rate limit (120/min) | MEDIUM | Order queue with per-member fairness. If near limit, defer lower-priority orders (shadow mode first to defer). |
| Malicious access to encrypted tokens | HIGH | AES-256-GCM encryption at rest. Encryption key in env var (not DB). Token never exposed to frontend. Service-role-only access. |
| Regulatory risk (auto-trading) | HIGH | Prominent disclaimers. ToS acceptance required. "Not financial advice" on every alert. Members must explicitly opt-in. Shadow mode default. |
| Partial fill creates orphaned position | MEDIUM | Position tracker reconciles with Tradier positions every 30 seconds. Orphaned positions flagged for member attention. |

---

## 11. Rollback Plan

| Slice | Rollback |
|-------|----------|
| Database migrations | Reverse migrations drop new tables/columns. Existing data untouched. |
| Alert Console UI | Remove admin sidebar link. Pages are isolated; no impact on other admin surfaces. |
| Tradier execution engine | Set `EXECUTION_ENGINE_ENABLED=false`. All order processing stops immediately. |
| Member auto-trade page | Remove profile nav link. Existing profile functionality unchanged. |
| Discord message format changes | Revert `discordNotifier.ts` to pre-change. Webhook format reverts. |

---

## 12. Validation Gates

### Slice-Level

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
```

### Release-Level

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run backend/src/services/tradier/__tests__
pnpm vitest run backend/src/services/discord/__tests__
pnpm exec playwright test e2e/specs/admin/alert-console*.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/specs/members/auto-trade*.spec.ts --project=chromium --workers=1
```

### Security Audit (Post-Migration)

```bash
# Run Supabase security advisors
get_advisors(type: "security")
get_advisors(type: "performance")
```

---

## 13. Acceptance Criteria Checklist

### System A — Alert Console
- [ ] Admin can start a trade session from `/admin/alerts`
- [ ] Quick ticker input parses "SPX 6830C 03/06" into structured fields
- [ ] Live contract pricing displays from Massive.com
- [ ] PREP button sends formatted message to Discord webhook
- [ ] FILL button accepts price + optional stop, sends to Discord
- [ ] TRIM button accepts %, computes message, sends to Discord
- [ ] All lifecycle actions (STOP, B/E, TRAIL, EXIT ABOVE/BELOW, FULLY OUT) work as one-click
- [ ] Commentary free-text sends to Discord
- [ ] Multiple simultaneous trades supported via tab strip
- [ ] Session log shows real-time feed of sent alerts
- [ ] "End Session" auto-generates per-trade P&L recap
- [ ] Alert history shows past sessions with full detail
- [ ] Failed webhook deliveries can be resent
- [ ] All alerts persist to existing discord_* tables with source='admin_console'
- [ ] All alerts broadcast via Supabase Realtime for member consumption

### System B — Tradier Auto-Execution
- [ ] Member can connect Tradier account via OAuth
- [ ] Member must accept ToS before enabling
- [ ] Member can configure risk profile (all settings in §5.2)
- [ ] Shadow mode logs virtual trades with no real orders
- [ ] Verification badge appears after first shadow cycle
- [ ] Full Auto mode places orders immediately on FILL alerts
- [ ] Confirm-First mode shows 60-second confirmation modal
- [ ] Position sizing respects max_contracts, max_position_dollars, and size tags
- [ ] TRIM alerts sell correct number of contracts
- [ ] STOP/B/E/TRAIL alerts place/replace stop orders correctly
- [ ] EXIT ABOVE/BELOW monitors underlying price and triggers sell
- [ ] FULLY OUT cancels all open orders and market-sells remaining
- [ ] Kill switch (admin and member) immediately stops all order execution
- [ ] Daily loss limit prevents new buy orders when exceeded
- [ ] Slippage detection pauses orders exceeding tolerance
- [ ] Token refresh handles expired Tradier tokens transparently
- [ ] Execution log shows complete audit trail
- [ ] Daily P&L display updates in real-time

---

## 14. Agent Assignment (Multi-Agent Orchestration)

| Slice | Agent Role | Model |
|-------|-----------|-------|
| 1 — Database Schema | Database Agent | sonnet |
| 2 — Alert Console API | Backend Agent | sonnet |
| 3 — Alert Console UI | Frontend Agent | sonnet |
| 4 — Tradier Client & OAuth | Backend Agent | sonnet |
| 5 — OCC Symbol & Orders | Backend Agent | sonnet |
| 6 — Execution Engine | Backend Agent (complex logic) | opus |
| 7 — Member Config UI | Frontend Agent | sonnet |
| 8 — Kill Switch & Confirmation | Frontend + Backend (sequential) | sonnet |
| 9 — Member Dashboard | Frontend Agent | sonnet |
| 10 — Price Alert Monitor | Backend Agent (WebSocket integration) | opus |
| 11 — Session Recap | Frontend + Backend | sonnet |
| 12 — E2E Tests | QA Agent | sonnet |

**Parallel opportunities:** Slices 2+3 (API + UI) can proceed in parallel. Slices 4+5 can proceed in parallel. Slices 7+8+9 can proceed in parallel after Slice 6.

---

## 15. Update Log

### 2026-03-09: Initial Spec
- Created execution spec for Discord Alert Console and Tradier Auto-Execution Bot.
- Alert taxonomy derived from production Discord transcript analysis (2026-03-05 through 2026-03-09).
- Integrated with existing Discord infrastructure: messageParser, discordBroadcaster, discordPersistence, discordNotifier.
- 12-slice phased delivery plan across 4 weeks.
- Full database schema with RLS policies.
- Tradier API integration with OAuth, order management, and position tracking.
- Risk register covering API outages, slippage, rate limits, security, and regulatory compliance.
