# Discord Alert Console — Execution Spec

> **Feature:** Admin Alert Console for Discord Trade Alerts
> **Author:** Claude (Orchestrator Agent)
> **Date:** 2026-03-09
> **Status:** DRAFT — Awaiting Approval
> **Governs:** EPIC-ALERT — Discord Alert Console
> **Runtime:** Node >= 20.19.5 | pnpm 10+
> **Companion Spec:** Auto-Trader (separate, TBD) — consumes alert events produced by this system

---

## 1. Objective

Build a one-click admin interface inside the TradeITM platform that replaces manual Discord typing with a stateful, speed-optimized trade alert console. The admin selects a contract visually (ticker → expiration → strike from a live chain), then sends lifecycle alerts (PREP → FILL → TRIM → STOP → EXIT) to Discord with a single tap at each stage.

The console produces structured alert events stored in Supabase. These events are the canonical data source for: (a) the Discord webhook message, (b) Supabase Realtime broadcast to in-app listeners, and (c) future consumption by the separate Auto-Trader system.

### 1.1 Design Principles

1. **Speed under pressure.** The admin is watching a 1-minute candle. Price is moving. Every interaction must be completable in one tap or less after the initial contract setup.
2. **State-driven simplicity.** Show only what's relevant right now. If there's no position, don't show TRIM. If the trade is closed, don't show STOPS.
3. **Mobile-first.** The admin will frequently alert from a phone. Every element must be thumb-reachable, tap-sized, and readable on a 390px viewport.
4. **Contract selection is visual.** No raw text input. Ticker search → expiration strip → strike chain grid → tap to select.
5. **One canonical event, many consumers.** The alert event is the single source of truth. Discord message formatting, Realtime broadcasting, and future Auto-Trader execution all derive from the same structured payload.

### 1.2 Success Criteria

1. Admin can go from opening the console to sending a PREP alert in ≤5 taps / ≤5 seconds.
2. All lifecycle alerts after PREP are single-tap (update %, trim %, B/E, fully out) or tap + one input (custom %, stop price).
3. The action strip shows only actions valid for the current trade state.
4. Trim percentages are one-tap buttons (15%, 25%, 50%), not a two-step "click TRIM then enter %."
5. "Fully Out" auto-closes the active trade and advances the session trade index.
6. "End Session" auto-computes and posts a daily recap message with per-trade P&L %.
7. All alerts persist as structured events in the existing `discord_trade_sessions` / `discord_parsed_trades` / `discord_messages` tables.
8. All alerts broadcast via Supabase Realtime for downstream consumers.
9. The console is fully functional on mobile (390px viewport) with no horizontal scrolling.
10. Multiple simultaneous trades supported via compact tabs.

### 1.3 Non-Goals (Out of Scope)

- Auto-execution / Tradier integration (separate Auto-Trader spec).
- Member-facing features (members see alerts in Discord; in-app alert feed is v2).
- Options analysis (Greeks, probability, risk graphs — use SPX Command Center for that).
- Voice channel integration (admin manually manages voice).
- Push notifications for alerts (v2).
- Alert templates or scheduling (v2).

---

## 2. Constraints

| Constraint | Detail |
|------------|--------|
| Design System | Emerald Standard: dark mode only, `glass-card-heavy`, Playfair/Inter/Geist Mono, emerald-500 primary, champagne accents |
| Market Data | Massive.com ONLY for options chain, quotes, underlying price. Never say "Polygon." |
| Auth | `isAdminUser()` for all routes. No member access. |
| Discord | Use existing `discordBot.ts` (discord.js) for outbound via `channel.send()` — more reliable than webhooks. Extend `discordBroadcaster.ts` for Realtime. Add `discord_update` broadcast event kind for `update` signal. All Discord config (bot token, guild IDs, channel IDs) stored in DB and managed via admin settings UI — NOT environment variables. |
| Existing DB | Integrate with existing `discord_trade_sessions`, `discord_parsed_trades`, `discord_messages` tables via `discordPersistence.ts`. |
| Validation | Zod schemas on all API boundaries. |
| Icons | Lucide React, stroke width 1.5. |
| Imports | `@/` alias for absolute imports. |
| Mobile | Must be fully functional at 390px width. Thumb zone optimization. |

---

## 3. Alert Taxonomy

Derived from production Discord transcript analysis (2026-03-05 through 2026-03-09). Aligned with existing `DiscordSignalType` in `messageParser.ts`.

| Signal | Admin Action | Discord Message | When Available |
|--------|-------------|----------------|----------------|
| `prep` | Tap PREP after selecting contract | `PREP {SYM} {STRIKE}{C\|P} {EXP} @everyone {size}` | IDLE state |
| `ptf` | Tap PTF | `PTF @everyone` | STAGED state |
| `filled_avg` | Enter price → tap FILL | `Filled AVG {price} @everyone Stops {stop}` | STAGED state |
| `update` | Tap UPDATE on P&L bar | `+{pnl}% here @everyone` | ACTIVE state |
| `trim` | Tap a % button (15/25/50/custom) | `+{pnl}% here trim @everyone` | ACTIVE state |
| `add` | Enter new avg → tap ADD | `Added to {SYM}, new AVG {price} @everyone` | ACTIVE state |
| `stops` | Enter level or % → tap SET | `Stops {level} or (-{pct}%) @everyone` | ACTIVE state |
| `breakeven` | Tap B/E | `B/E stops @everyone` | ACTIVE state |
| `trail` | Tap trail % button (+10/+20/+30/custom) | `Move trails on runners to +{pct}% @everyone` | ACTIVE state |
| `exit_level` | Enter level → tap SET | `Use {above\|below} {level} as exits @everyone` | ACTIVE state |
| `fully_out` | Tap FULLY OUT | `Fully out @everyone` | ACTIVE state |
| `commentary` | Type text → tap send | `{text} @everyone` | Any state |
| `recap` | Auto-generated on End Session | `1st trade {pct}%... Solid day @everyone` | Session end |

### 3.1 Trade State Machine

```
IDLE ──PREP──▶ STAGED ──FILL──▶ ACTIVE ──FULLY OUT──▶ CLOSED
                 │                  │                     │
                 │                  ◄── TRIM/ADD/STOP ────┘ (loops)
                 │                  │   B/E/TRAIL/EXIT
                 │                  │
                 ▼                  ▼
           (Cancel Prep)     (FULLY OUT → CLOSED)
                 │                  │
                 ▼                  ▼
               IDLE         IDLE (New PREP) or END SESSION
```

Actions available per state:

| State | Primary Action | Secondary Actions | Hidden |
|-------|---------------|-------------------|--------|
| **IDLE** | PREP (big, prominent) | Commentary | Everything else |
| **STAGED** | FILL (price input + button) | PTF, Cancel Prep, Commentary | Trim, Stop, Trail, Exit |
| **ACTIVE** | UPDATE (P&L broadcast), Trim % quick-buttons | Stop group (Set/B/E/Trail), Exit Level, Add, FULLY OUT, Commentary | PREP, FILL |
| **CLOSED** | New Trade (returns to IDLE) | End Session, Commentary | Trim, Stop, Trail |

> **Note:** The Alert Console never references contract counts. Alerts deal only in prices, percentages, and levels. Contract sizing is entirely the concern of the separate Auto-Trader system.

### 3.2 Size Tags

| Tag | Label | Sizing Hint | Default |
|-----|-------|-------------|---------|
| `full` | Full | Standard position | ✓ |
| `light` | Light | ~50% of standard | |
| `lotto` | Lotto | ~25%, EOD speculative | |

---

## 4. UX Flow — Contract Selection (The "Funnel")

The contract selection is a linear funnel: each step narrows the choice until the contract is fully specified. On desktop this can be a single panel; on mobile it's a stacked flow.

### Step 1 — Ticker

**Desktop:** A search input with auto-complete + a row of ticker chips below. Tapping a chip selects immediately.

**Chip management (hybrid: pinned + recents):** The admin can pin favorite tickers (SPX is pinned by default and always appears first). Pinned tickers never disappear. The remaining chip slots auto-fill from the most recently alerted tickers. If you alert COIN on Monday, it shows up as a chip. If you don't alert it again for a week, it drops off as newer tickers take its slot. A small settings icon on the ticker row lets the admin manage pins (add/remove/reorder). Max 8 chips visible (scrollable on mobile if more).

**Mobile:** Same layout, stacked. Chips are large tap targets (44px height minimum). The search input has a large font for quick thumb typing.

**After selection:** Ticker locks in at the top of the funnel as a breadcrumb. The next step appears.

### Step 2 — Expiration

**Desktop:** A horizontal strip of expiration dates. Today is pre-selected for SPX (0DTE default). This week's dates shown first, then next week, then monthlies. Each date shows day-of-week abbreviation.

**Mobile:** Same horizontal strip, scrollable. Today prominently highlighted. Swipe to see more dates.

**After selection:** Expiration locks in the breadcrumb: `SPX · Mar 9`.

### Step 3 — Strike & Direction

**Desktop:** A full options chain centered on ATM (at-the-money). Two sides: Calls (left) and Puts (right), strikes in the middle. Each cell shows Last price, Delta, IV, and OI so the admin can assess liquidity and Greeks at a glance. The ATM strike is highlighted in champagne. Tapping a call cell selects that strike + call direction. Tapping a put cell selects strike + put.

Layout (desktop):
```
  CALLS                              STRIKE       PUTS
  Last   Delta   IV     OI                        Last   Delta   IV     OI
  3.40   .38    24.1%   1,820        5780         1.20   -.62   25.3%   940
  2.70   .42    23.8%   2,340   >>>  5760  <<<    1.85   -.58   24.9%   1,120
  2.10   .35    24.5%   1,650        5740         2.60   -.65   25.8%   780
```

**Default: 10 strikes above ATM + 10 below ATM (20 total).** This gives enough range for both 0DTE scalps near the money and swing entries further OTM. A "Load More" button at the top and bottom of the chain expands by 10 additional strikes in that direction. This supports swing traders who need strikes well away from ATM.

**Mobile:** Call/Put toggle at the top (large segmented control). Then a single column of strikes. Each row shows: strike, last price, delta, and OI (IV hidden on mobile to save horizontal space — available on long-press or tap-to-expand). Tap a strike to select. "Load More" buttons at top and bottom of the list.

**After selection:** Breadcrumb: `SPX · Mar 9 · 5760C @ 2.70 · Δ.42`. The funnel collapses and the trade setup is complete.

### Step 4 — Size Tag + PREP

A three-way toggle (Full / Light / Lotto) and the PREP button. On mobile, the size toggle is above the PREP button. PREP is a full-width emerald button: "PREP SPX 6760C 03/09."

**After PREP:** The funnel collapses to a compact header showing the active contract. The action strip appears below.

### Rapid Re-PREP (Same Symbol)

After a trade closes, if you want to re-enter the same symbol with a different strike, the funnel re-opens with ticker + expiration already selected (from the previous trade). You jump straight to Step 3 (strike selection). This handles the common pattern in the transcript: exit SPX, immediately prep a new SPX strike.

---

## 5. UX Flow — Trade Management (Action Strip)

The action strip is state-driven. It replaces itself entirely when the trade state changes.

### 5.1 STAGED State (After PREP, Before FILL)

```
┌─────────────────────────────────────────────┐
│  SPX 6760C 03/09 · STAGED                  │
│  Bid: 2.65  Ask: 2.75  Last: 2.70          │
│                                             │
│  ┌─────────┐  ┌────────────────────────┐    │
│  │   PTF   │  │  FILL  [$___] [SEND]  │    │
│  └─────────┘  └────────────────────────┘    │
│                                             │
│  Stop with fill: [___%] or [$___]           │
│                                             │
│  [Cancel Prep]              [Commentary...] │
└─────────────────────────────────────────────┘
```

The fill price input is pre-populated with the current ask. Admin can adjust and tap SEND. The stop field below is optional — if filled, it appends "Stops {value}" to the Discord message.

**Mobile:** Stacked vertically. PTF is a secondary button above the FILL row. Fill price input is large (Geist Mono, 18px). SEND button is full-width emerald.

### 5.2 ACTIVE State (Position Open)

This is where the admin spends most of their time. The layout prioritizes the most frequent actions.

```
┌─────────────────────────────────────────────┐
│  SPX 6760C · Entry: $2.70 · Now: $4.54     │
│  P&L: +68% · Stop: B/E     [ 📢 UPDATE ]   │
├─────────────────────────────────────────────┤
│  TRIM                                       │
│  [15%] [25%] [50%] [___% →]                │
├─────────────────────────────────────────────┤
│  STOPS                                      │
│  [Set -___%] [B/E] [Trail +10] [+20] [+30] │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │          FULLY OUT                  │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  [Add to position...]  [Exit at level...]   │
│  [Commentary: ________________________ ▶]   │
└─────────────────────────────────────────────┘
```

**P&L header + UPDATE button:** Shows entry price, current mark, P&L %, and current stop level. No contract counts — the admin doesn't know how many contracts members are trading. The **UPDATE** button broadcasts the current live P&L as a pure informational update: `+68% here @everyone`. This mimics FancyITM's pattern of announcing "72% here" — just telling members where the trade is at without explicitly saying "trim." One tap, the current percentage gets broadcast. The admin doesn't type the number; the console already knows it from the entry vs current price.

**Trim row:** One-tap percentage buttons. Tapping "25%" immediately sends `+68% here trim @everyone` — the live P&L plus the trim instruction. This mimics FancyITM's "47% here trim" pattern. No confirmation modal — speed matters. The custom input (___% →) lets you type a custom percentage and tap the arrow to send.

**Key distinction:** UPDATE = "here's where we are" (informational). TRIM = "here's where we are, take some off" (actionable). Both include the live P&L automatically. The admin never types the percentage — they just tap when the number on screen looks right.

**Stops row:** "Set -___%" opens a small input for a custom stop. "B/E" is one tap — sends "B/E stops @everyone." Trail buttons (+10, +20, +30) are one-tap — sends "Move trails on runners to +10% @everyone." These are the most common trail values from the transcript.

**Fully Out:** Always visible, always red, full-width. One tap. Sends "Fully out @everyone" and transitions to CLOSED state.

**Secondary actions (bottom row):** "Add to position" expands an inline input for new average price. "Exit at level" expands an input for above/below price trigger. These are less common and tucked away.

**Mobile:** Same layout but stacked. Trim buttons wrap to two rows if needed (2×2 grid). Stop buttons wrap similarly. FULLY OUT remains full-width and prominent. The live P&L header is sticky at the top of the scroll.

### 5.3 CLOSED State (After Fully Out)

```
┌─────────────────────────────────────────────┐
│  SPX 6760C · CLOSED · +68%                 │
│  Entry: $2.70 → Exit: $4.54                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         NEW TRADE                   │    │
│  └─────────────────────────────────────┘    │
│  [End Session & Post Recap]                 │
│  [Commentary: ________________________ ▶]   │
└─────────────────────────────────────────────┘
```

"New Trade" returns to ticker selection (with previous ticker + expiration pre-filled for rapid re-PREP). "End Session" generates the recap.

---

## 6. Session Management

### 6.1 Session Lifecycle

A session starts when the admin opens the Alert Console for the day (or taps "Start Session"). It tracks all trades and alerts for that day.

A session ends when the admin taps "End Session." This:
1. Computes per-trade P&L from fill/exit prices.
2. Generates a recap message in FancyITM's format: "1st trade 42% 2nd trade 138%... Solid day see you tomorrow @everyone"
3. Shows a preview modal so the admin can edit the recap text before posting.
4. Posts to Discord on confirmation.

### 6.2 Multiple Simultaneous Trades

When the admin preps a second contract while one is active, a compact tab strip appears:

```
[SPX 6750C +35% ✓] [SPX 6760C ACTIVE ●] [+]
```

Tabs show: symbol/strike, state (or P&L if closed), and an indicator dot. Tapping switches the action strip context. The [+] button opens the contract selection funnel for a new trade.

On mobile, tabs are horizontally scrollable chips above the action strip.

### 6.3 Session Log

A collapsible section below the action strip showing all alerts sent. Each entry has: timestamp, type badge (color-coded), and the message text. Collapsed by default on mobile to maximize action strip space. Expandable with a "Show log (14 alerts)" tap.

Desktop shows the log in a sidebar or below the action strip, always visible.

### 6.4 Daily Recap Auto-Generation

The recap computation:
```
For each trade in session:
  pnl_pct = ((exit_price - entry_price) / entry_price) * 100
  Format: "{ordinal} trade {pnl_pct}%"

Join all: "1st trade 42% 2nd trade 138% 3rd trade 13%..."
Append: "Solid day see you {tomorrow|Monday} @everyone"
```

The admin can edit this before posting. Common edits: adding "(EOD LOTTOS)" tags, changing the sign-off.

---

## 7. UX Flow — Discord Settings (Admin Configuration)

The Alert Console requires a working Discord connection before it can send alerts. Instead of configuring this in Railway environment variables, all Discord settings are managed from a settings panel within the admin UI.

### 7.1 Settings Panel Location

Accessible via the gear icon (⚙) in the Alert Console header, or directly at `/admin/alerts/settings`. This is a slide-over panel on desktop and a full-page view on mobile.

### 7.2 Settings Layout

```
┌─────────────────────────────────────────────┐
│  Discord Connection                         │
│  ─────────────────────────────────────────  │
│                                             │
│  Status: ● Connected                        │
│  Bot: TradeITM Alerts #alerts-channel       │
│  Last connected: 2 min ago                  │
│                                             │
│  BOT TOKEN                                  │
│  [••••••••••••••••••••] [Update]            │
│  ⓘ Token is encrypted and never displayed   │
│                                             │
│  ALERT CHANNEL                              │
│  [#spx-alerts          ▾]                   │
│  Channel where alerts are posted            │
│                                             │
│  GUILD                                      │
│  [TradeITM Community   ▾]                   │
│  Server the bot is connected to             │
│                                             │
│  DELIVERY METHOD                            │
│  (●) Bot (recommended — reliable delivery)  │
│  ( ) Webhook (fallback)                     │
│  [Webhook URL: ________________________]    │
│                                             │
│  [Test Connection]  [Save]                  │
│                                             │
│  ─────────────────────────────────────────  │
│  Alert Preferences                          │
│  ─────────────────────────────────────────  │
│                                             │
│  DEFAULT SIZE TAG: [Full ▾]                 │
│  DEFAULT STOP %:   [20  ]                   │
│  STRIKES PER SIDE: [10  ]                   │
│  @EVERYONE:        [✓]                      │
│                                             │
│  [Save Preferences]                         │
└─────────────────────────────────────────────┘
```

### 7.3 Connection Flow

1. Admin enters bot token → taps "Save" → backend encrypts and stores in `discord_config`.
2. Backend attempts bot login with the new token.
3. On success: fetches guild list → populates Guild dropdown. Fetches channel list for selected guild → populates Channel dropdown.
4. Admin selects the target alert channel → taps "Save."
5. Status indicator updates to "● Connected" with the channel name.
6. "Test Connection" sends a test message to the selected channel: "✅ TradeITM Alert Console connected."

### 7.4 Connection Status Indicator

The session pill in the Alert Console header reflects bot status:
- `● Connected` (green) — bot is online, ready to send
- `● Reconnecting` (yellow) — bot lost connection, auto-reconnecting
- `● Disconnected` (gray) — bot not configured or explicitly disabled
- `● Error` (red) — bot failed to connect, with error message

If the bot is disconnected, the Alert Console shows a banner: "Discord not connected. [Configure →]" linking to settings.

### 7.5 Backend Config Resolution

The backend reads Discord config from the database, not environment variables:

```
1. On startup: query discord_config for active config
2. If bot_enabled=true and bot_token present: start discord.js client
3. On config update via admin API: gracefully restart bot with new credentials
4. Fallback: if bot unavailable and webhook_url is set, use webhook delivery
5. Env vars (DISCORD_BOT_TOKEN etc.) serve ONLY as initial seed for first-time setup
```

The existing `DISCORD_BOT_TOKEN`, `DISCORD_BOT_GUILD_IDS`, `DISCORD_BOT_CHANNEL_IDS` env vars become optional bootstrap values. On first startup, if `discord_config` is empty but env vars are set, the backend seeds the table from env vars. After that, the database is the source of truth.

---

## 8. API Routes

All routes require `isAdminUser()`.

```
POST   /api/admin/alerts/session/start     # Start new session for today
POST   /api/admin/alerts/session/end       # Close session, generate recap
GET    /api/admin/alerts/session/active     # Get current session + trades + state
POST   /api/admin/alerts/send              # Send any alert signal
POST   /api/admin/alerts/resend/:msgId     # Resend a failed webhook delivery
GET    /api/admin/alerts/history            # Past sessions, paginated
GET    /api/admin/alerts/history/:id        # Single session detail
GET    /api/admin/alerts/chain              # Options chain from Massive.com
GET    /api/admin/alerts/quote              # Live quote for selected contract
GET    /api/admin/alerts/favorites          # Admin's favorite tickers
PUT    /api/admin/alerts/favorites          # Update favorite tickers

# Discord Settings (configuration from admin UI, not env vars)
GET    /api/admin/alerts/discord/config     # Get current config (token masked)
PUT    /api/admin/alerts/discord/config     # Update bot token, channel, guild, delivery method
POST   /api/admin/alerts/discord/test       # Send test message to configured channel
GET    /api/admin/alerts/discord/guilds     # List guilds bot has access to (requires valid token)
GET    /api/admin/alerts/discord/channels   # List channels for selected guild
POST   /api/admin/alerts/discord/restart    # Force bot reconnect with current config
```

### 7.1 `POST /api/admin/alerts/send` — Payload Schema

```typescript
const AlertSendSchema = z.object({
  sessionId: z.string().uuid(),
  tradeId: z.string().uuid().optional(),
  signalType: z.enum([
    'prep', 'ptf', 'filled_avg', 'update', 'trim', 'add',
    'stops', 'breakeven', 'trail',
    'exit_above', 'exit_below', 'fully_out',
    'commentary', 'session_recap'
  ]),
  fields: z.object({
    symbol: z.string().optional(),
    strike: z.number().optional(),
    optionType: z.enum(['call', 'put']).optional(),
    expiration: z.string().optional(),
    price: z.number().optional(),
    percent: z.number().optional(),
    level: z.number().optional(),
    sizeTag: z.enum(['full', 'light', 'lotto']).optional(),
    commentary: z.string().optional(),
  }),
  mentionEveryone: z.boolean().default(true),
});
```

### 7.2 Processing Pipeline (per alert)

```
1. Validate payload (Zod)
2. Check session exists and is active
3. Update trade state machine (reject invalid transitions)
4. Format Discord message string
5. Read discord_config from DB
6. Send via discordBot channel.send() (primary) or discordNotifier webhook (fallback)
7. Persist via discordPersistence (source='admin_console')
8. Broadcast structured payload via discordBroadcaster (Supabase Realtime)
9. Return: { messageId, discordStatus, tradeState }
```

### 7.3 `GET /api/admin/alerts/chain` — Options Chain

Proxies to Massive.com options chain endpoint. Returns strikes near ATM with bid/ask/last for the selected ticker + expiration. Used to populate the strike selection grid.

```typescript
const ChainQuerySchema = z.object({
  symbol: z.string(),                    // SPX, QQQ, COIN
  expiration: z.string(),                // 2026-03-09
  strikesPerSide: z.number().default(10), // strikes above + below ATM (default 10 each = 20 total)
  offsetAbove: z.number().default(0),     // for "Load More" — skip N strikes above current top
  offsetBelow: z.number().default(0),     // for "Load More" — skip N strikes below current bottom
});

// Response shape
interface ChainResponse {
  underlying: { symbol: string; last: number; change: number; changePct: number };
  expiration: string;
  strikes: {
    strike: number;
    call: { bid: number; ask: number; last: number; delta: number; iv: number; volume: number; oi: number } | null;
    put: { bid: number; ask: number; last: number; delta: number; iv: number; volume: number; oi: number } | null;
  }[];
  atmStrike: number;       // nearest strike to underlying price
  hasMoreAbove: boolean;   // true if more strikes available above current range
  hasMoreBelow: boolean;   // true if more strikes available below current range
}
```

---

## 8. Database

### 8.1 Schema Modifications (Existing Tables)

```sql
-- Add source column to discord_trade_sessions
ALTER TABLE discord_trade_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'discord_bot'
  CHECK (source IN ('discord_bot', 'admin_console'));

-- Add admin metadata to discord_messages
ALTER TABLE discord_messages
  ADD COLUMN IF NOT EXISTS admin_alert_id UUID,
  ADD COLUMN IF NOT EXISTS webhook_status TEXT DEFAULT 'sent'
    CHECK (webhook_status IN ('sent', 'failed', 'resent'));
```

### 8.2 New Tables

```sql
-- Discord bot & channel configuration (admin-managed, NOT env vars)
-- Singleton row pattern: one active config at a time
CREATE TABLE discord_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Bot credentials
  bot_token TEXT,                               -- encrypted at rest via pgcrypto
  bot_enabled BOOLEAN NOT NULL DEFAULT FALSE,   -- master on/off switch in UI
  -- Guild & channel targeting
  guild_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],     -- guilds the bot monitors
  alert_channel_id TEXT,                        -- channel for outbound alerts
  alert_channel_name TEXT,                      -- display name (fetched on save)
  -- Delivery method
  delivery_method TEXT NOT NULL DEFAULT 'bot'   -- 'bot' (channel.send) or 'webhook' (fallback)
    CHECK (delivery_method IN ('bot', 'webhook')),
  webhook_url TEXT,                             -- fallback webhook if bot unavailable
  -- Connection status (updated by backend)
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'error', 'reconnecting')),
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  -- Metadata
  configured_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin alert console preferences (per-admin)
CREATE TABLE admin_alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_tickers TEXT[] NOT NULL DEFAULT ARRAY['SPX'],  -- always visible, admin-ordered
  recent_tickers TEXT[] NOT NULL DEFAULT ARRAY[],        -- auto-populated from alert history
  max_recent_tickers INTEGER NOT NULL DEFAULT 5,         -- remaining chip slots after pins
  default_size_tag TEXT NOT NULL DEFAULT 'full'
    CHECK (default_size_tag IN ('full', 'light', 'lotto')),
  default_stop_pct NUMERIC DEFAULT 20,
  default_strikes_per_side INTEGER NOT NULL DEFAULT 10,  -- chain depth (10 above + 10 below ATM)
  default_mention_everyone BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
```

### 8.3 RLS Policies

```sql
-- discord_config: admin users only
ALTER TABLE discord_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_only_discord_config" ON discord_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND permission = 'admin')
  );

-- admin_alert_preferences: admin users only, own row
ALTER TABLE admin_alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_own_prefs" ON admin_alert_preferences
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND permission = 'admin')
  );
```

### 8.4 Bot Token Security

The `discord_config.bot_token` column stores a sensitive credential. Security measures:

1. **Encryption at rest:** Use `pgcrypto` extension. Token is encrypted with a server-side key before INSERT/UPDATE and decrypted only when the backend reads it.
2. **Never exposed to frontend:** The admin settings API returns `bot_token_set: true/false` — never the actual token. To update, the admin submits a new token which overwrites the old one.
3. **RLS:** Only admin users can read/write `discord_config`.
4. **Audit:** `configured_by` + `updated_at` track who last changed the config.

---

## 9. In-Scope / Out-of-Scope Files

### 9.1 New Files

```
# Database
supabase/migrations/2026MMDD000000_alert_console_schema.sql

# Admin Pages
app/admin/alerts/page.tsx
app/admin/alerts/layout.tsx
app/admin/alerts/settings/page.tsx               # Discord settings page (mobile full-page)

# Components — Contract Selection Funnel
components/admin/alerts/alert-console.tsx            # Main orchestrator
components/admin/alerts/ticker-selector.tsx           # Search + favorite chips
components/admin/alerts/expiration-strip.tsx          # Horizontal date selector
components/admin/alerts/strike-chain.tsx              # Options chain grid
components/admin/alerts/size-tag-toggle.tsx           # Full / Light / Lotto
components/admin/alerts/contract-breadcrumb.tsx       # Locked selections display

# Components — Action Strip (state-driven)
components/admin/alerts/action-strip.tsx              # State router
components/admin/alerts/actions/staged-actions.tsx    # PTF + FILL + stop input
components/admin/alerts/actions/active-actions.tsx    # Trim/Stop/Trail/Exit
components/admin/alerts/actions/closed-actions.tsx    # New Trade / End Session
components/admin/alerts/actions/trim-buttons.tsx      # Quick-tap % buttons
components/admin/alerts/actions/stop-controls.tsx     # Set/B/E/Trail group
components/admin/alerts/actions/commentary-input.tsx  # Free-text + send

# Components — Session Management
components/admin/alerts/session-header.tsx            # Session badge + status
components/admin/alerts/trade-tabs.tsx                # Multi-trade tab strip
components/admin/alerts/session-log.tsx               # Collapsible alert feed
components/admin/alerts/recap-preview-modal.tsx       # Edit + confirm recap
components/admin/alerts/trade-pnl-header.tsx          # Live P&L display

# Components — Discord Settings
components/admin/alerts/settings/discord-settings-panel.tsx  # Main settings panel
components/admin/alerts/settings/connection-status.tsx        # Status indicator + banner
components/admin/alerts/settings/bot-token-input.tsx          # Masked token input
components/admin/alerts/settings/channel-selector.tsx         # Guild/channel dropdowns
components/admin/alerts/settings/alert-preferences-form.tsx   # Default size, stop, etc.

# API Routes
app/api/admin/alerts/session/route.ts                # start, end, active
app/api/admin/alerts/send/route.ts                   # send alert
app/api/admin/alerts/resend/[msgId]/route.ts         # resend failed
app/api/admin/alerts/history/route.ts                # session history
app/api/admin/alerts/history/[id]/route.ts           # session detail
app/api/admin/alerts/chain/route.ts                  # options chain proxy
app/api/admin/alerts/quote/route.ts                  # live quote proxy
app/api/admin/alerts/favorites/route.ts              # ticker favorites CRUD
app/api/admin/alerts/discord/config/route.ts         # Discord config CRUD
app/api/admin/alerts/discord/test/route.ts           # Test connection
app/api/admin/alerts/discord/guilds/route.ts         # List guilds
app/api/admin/alerts/discord/channels/route.ts       # List channels
app/api/admin/alerts/discord/restart/route.ts        # Force reconnect

# Types
lib/types/alerts.ts                                  # Alert event types, state machine

# Tests
e2e/specs/admin/alert-console.spec.ts
e2e/specs/admin/alert-console-test-helpers.ts
```

### 9.2 Modified Files

```
backend/src/services/discord/discordBot.ts           # Add sendMessage(channelId, content) method for outbound
backend/src/services/discord/discordBroadcaster.ts   # Add admin_console source + discord_update event
backend/src/services/discord/discordPersistence.ts    # Source column + webhook_status
backend/src/services/discord/messageParser.ts         # Add 'add' and 'update' signal types
backend/src/services/discordNotifier.ts               # Webhook fallback (kept for degraded mode)
backend/src/config/env.ts                             # Make DISCORD_BOT_* vars optional (DB is source of truth)
backend/src/server.ts                                 # Read discord_config from DB on startup, seed from env if empty
components/admin/admin-sidebar.tsx                    # Add Alert Console nav item
app/admin/layout.tsx                                  # Register alerts route
```

### 9.3 Out-of-Scope

```
# Auto-Trader (separate spec entirely)
backend/src/services/tradier/**
app/admin/auto-trader/**
app/members/**

# Existing features
lib/spx/**
app/members/ai-coach/**
app/members/journal/**
backend/src/services/massiveTickStream.ts
```

---

## 10. Phase / Slice Plan

### Phase 1: Foundation (Week 1)

**Slice 1 — Types, Schema, Discord Config Table**
- Create `lib/types/alerts.ts` (signal types, trade state machine, alert payloads, discord config types).
- Create migration: `discord_config` table, `admin_alert_preferences` table, `source` column on `discord_trade_sessions`, `webhook_status` on `discord_messages`.
- Implement env-var-to-DB seed logic in `server.ts` startup (reads existing DISCORD_BOT_* env vars → inserts into `discord_config` if table is empty).
- Run migrations + security advisors.
- Gate: Migrations clean. Types compile. Existing bot startup reads from `discord_config` instead of env vars.

**Slice 2 — Discord Settings API + Admin UI**
- Create Discord settings API routes (config CRUD, test connection, list guilds/channels, restart bot).
- Create `discord-settings-panel.tsx` and sub-components (token input, channel selector, connection status).
- Add `sendMessage(channelId, content)` method to `discordBot.ts` for outbound delivery.
- Wire bot restart on config change (graceful disconnect → reconnect with new token/guild).
- Gate: Admin can enter bot token, select guild/channel, test connection, and see "● Connected" status.

**Slice 3 — Alert Send API + Discord Integration**
- Create `/api/admin/alerts/send` route with Zod validation.
- Wire to `discordBot.channel.send()` for primary delivery (reads config from `discord_config`).
- Fallback to `discordNotifier.ts` webhook if bot unavailable and webhook_url is set.
- Wire to `discordPersistence.ts` with `source='admin_console'`.
- Wire to `discordBroadcaster.ts` for Realtime broadcast.
- Extend `messageParser.ts` with `'add'` and `'update'` signal types.
- Gate: curl POST sends formatted message to Discord via bot. Fallback to webhook confirmed.

**Slice 4 — Session API**
- Create session start/end/active routes.
- Implement session state tracking (create, add trades, close).
- Implement recap auto-generation logic.
- Gate: Session lifecycle works end-to-end via curl.

### Phase 2: Contract Selection UI (Week 2)

**Slice 5 — Ticker + Expiration Selection**
- Create `alert-console.tsx` orchestrator.
- Create `ticker-selector.tsx` with search + favorites.
- Create `expiration-strip.tsx` with horizontal date selector.
- Create `contract-breadcrumb.tsx`.
- Add admin sidebar nav item.
- Gate: Admin can select ticker + expiration. Mobile responsive.

**Slice 6 — Options Chain + Strike Selection**
- Create `/api/admin/alerts/chain` route (Massive.com proxy).
- Create `strike-chain.tsx` with ATM-centered grid.
- Desktop: two-column (calls/puts). Mobile: toggle + single column.
- Gate: Chain loads from Massive.com. Admin can tap a strike.

**Slice 7 — Size Tag + PREP Flow**
- Create `size-tag-toggle.tsx`.
- Wire full funnel: ticker → exp → strike → size → PREP.
- PREP button sends to Discord and transitions to STAGED state.
- Gate: Full PREP flow works in ≤5 taps. Mobile verified.

### Phase 3: Trade Actions (Week 3)

**Slice 8 — STAGED Actions (PTF + FILL)**
- Create `staged-actions.tsx` with PTF button, FILL input + stop field.
- Live quote display for selected contract.
- Gate: Fill alert sends to Discord with stop. Trade transitions to ACTIVE.

**Slice 9 — ACTIVE Actions (Trim + Stops + Exit)**
- Create `active-actions.tsx`, `trim-buttons.tsx`, `stop-controls.tsx`.
- One-tap trim buttons (15/25/50/custom).
- Stop controls (Set/B/E/Trail +10/+20/+30).
- FULLY OUT button.
- Gate: Full lifecycle PREP → FILL → TRIM → B/E → FULLY OUT works.

**Slice 10 — Commentary + Add + Exit Level**
- Create `commentary-input.tsx`.
- Add "Add to position" expandable input.
- Add "Exit at level" expandable input.
- Gate: All secondary actions work. Messages format correctly.

### Phase 4: Session & Polish (Week 4)

**Slice 11 — Multi-Trade Tabs**
- Create `trade-tabs.tsx` with compact tab strip.
- Support simultaneous trades with independent state machines.
- Rapid re-PREP (pre-fill ticker + expiration from last trade).
- Gate: Can manage 2+ trades simultaneously.

**Slice 12 — Session Log + Recap**
- Create `session-log.tsx` (collapsible on mobile).
- Create `recap-preview-modal.tsx` with editable recap text.
- Implement "End Session" flow with preview → confirm → post.
- Gate: Recap auto-generates correct P&L. Admin can edit before posting.

**Slice 13 — E2E Tests + Mobile Hardening**
- Write E2E tests for full alert lifecycle.
- Mobile-specific testing (390px viewport, touch targets, scroll behavior).
- Accessibility audit (keyboard navigation, screen reader).
- Gate: All E2E green. Mobile fully functional.

---

## 11. Environment Variables

No new Discord environment variables required. All Discord configuration is stored in `discord_config` table and managed via the admin settings UI.

Existing env vars (`DISCORD_BOT_TOKEN`, `DISCORD_BOT_GUILD_IDS`, `DISCORD_BOT_CHANNEL_IDS`) become optional bootstrap seeds. On first startup, if `discord_config` is empty, the backend auto-seeds from env vars. After that, the database is the sole source of truth — changes are made in the admin UI, not Railway.

---

## 12. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Discord bot token exposed | HIGH | Encrypted at rest via pgcrypto. Never returned to frontend (only `bot_token_set: boolean`). RLS restricts to admin users. |
| Bot disconnects mid-session | MEDIUM | discord.js auto-reconnects. Connection status shown in UI. Webhook fallback if bot down for >10s. Admin can force reconnect from settings. |
| Discord API rate limit (50 req/s per bot) | LOW | discord.js handles rate limiting internally with queue. Visual indicator when queue depth > 5. |
| Massive.com chain API latency | MEDIUM | Cache chain data for 5 seconds. Show stale indicator if cache > 10s. Pre-fetch chain on ticker selection. |
| Admin accidentally sends wrong strike | MEDIUM | Contract breadcrumb shows full selection before PREP. No auto-send — always requires explicit tap. |
| Double-tap sends duplicate alert | LOW | Debounce all send buttons (500ms). Show "Sending..." state. Dedup by content + timestamp within 5s window. |
| Webhook delivery failure | LOW | Persist with `webhook_status='failed'`. Show retry button in session log. |
| Mobile keyboard covers action strip | MEDIUM | Sticky action strip above keyboard. Input fields scroll into view on focus. |
| State machine desync | LOW | Server-authoritative state. Client polls active session every 10s as fallback. |

---

## 13. Rollback Plan

| Slice | Rollback |
|-------|----------|
| Database migrations | Reverse migration drops new columns/table. Existing data untouched. |
| Alert Console UI | Remove admin sidebar link. Pages isolated — no impact on other admin surfaces. |
| Discord webhook changes | Revert `discordNotifier.ts`. Existing manual Discord workflow continues. |
| Massive.com chain proxy | New route only; removal has zero impact on existing SPX Command Center. |

---

## 14. Acceptance Criteria Checklist

- [ ] DISCORD SETTINGS: bot token configurable from admin UI (not env vars)
- [ ] DISCORD SETTINGS: guild and channel selectable via dropdowns (populated from bot)
- [ ] DISCORD SETTINGS: "Test Connection" sends test message to channel
- [ ] DISCORD SETTINGS: connection status indicator (connected/disconnected/error)
- [ ] DISCORD SETTINGS: bot restarts gracefully on config change
- [ ] DISCORD SETTINGS: webhook fallback when bot unavailable
- [ ] DISCORD SETTINGS: bot token encrypted at rest, never returned to frontend
- [ ] Contract selection: ticker search + favorites work
- [ ] Contract selection: expiration strip with today pre-selected
- [ ] Contract selection: options chain loads from Massive.com, centered on ATM
- [ ] Contract selection: tap strike selects contract + direction
- [ ] Contract selection: full funnel completes in ≤5 taps
- [ ] PREP: sends formatted message to Discord
- [ ] PTF: sends "PTF @everyone" from STAGED state
- [ ] FILL: accepts price + optional stop, sends to Discord, transitions to ACTIVE
- [ ] UPDATE: one-tap on P&L bar broadcasts current % as informational update
- [ ] TRIM: one-tap % buttons (15/25/50) send P&L + "trim" immediately
- [ ] TRIM: custom % input works
- [ ] STOPS: set custom stop by % or price
- [ ] B/E: one-tap sends "B/E stops @everyone"
- [ ] TRAIL: one-tap +10/+20/+30 buttons send immediately
- [ ] TRAIL: custom % input works
- [ ] ADD: enter new avg price, sends to Discord
- [ ] EXIT LEVEL: enter above/below price, sends to Discord
- [ ] FULLY OUT: one-tap sends "Fully out @everyone", transitions to CLOSED
- [ ] COMMENTARY: free-text sends to Discord from any state
- [ ] MULTI-TRADE: tab strip supports 2+ simultaneous trades
- [ ] RAPID RE-PREP: pre-fills ticker + expiration after close
- [ ] SESSION LOG: shows all alerts with timestamps and type badges
- [ ] RECAP: auto-generates per-trade P&L on End Session
- [ ] RECAP: admin can preview and edit before posting
- [ ] MOBILE: fully functional at 390px viewport
- [ ] MOBILE: all tap targets ≥44px
- [ ] MOBILE: no horizontal scrolling
- [ ] PERSISTENCE: all alerts in discord_messages with source='admin_console'
- [ ] REALTIME: all alerts broadcast via Supabase Realtime
- [ ] AUTH: all routes require isAdminUser()
- [ ] WEBHOOK: failed deliveries shown with retry option

---

## 15. Agent Assignment

| Slice | Agent | Model |
|-------|-------|-------|
| 1 — Types + Schema + Discord Config | Database Agent | sonnet |
| 2 — Discord Settings API + UI | Frontend + Backend | sonnet |
| 3 — Alert Send API | Backend Agent | sonnet |
| 4 — Session API | Backend Agent | sonnet |
| 5 — Ticker + Expiration UI | Frontend Agent | sonnet |
| 6 — Options Chain + Strike | Frontend + Backend | sonnet |
| 7 — Size Tag + PREP | Frontend Agent | sonnet |
| 8 — STAGED Actions | Frontend Agent | sonnet |
| 9 — ACTIVE Actions | Frontend Agent | sonnet |
| 10 — Commentary + Secondary | Frontend Agent | sonnet |
| 11 — Multi-Trade Tabs | Frontend Agent | sonnet |
| 12 — Session Log + Recap | Frontend + Backend | sonnet |
| 13 — E2E + Mobile Hardening | QA Agent | sonnet |

Parallel opportunities: Slices 3+4 parallel after Slice 2. Slices 5+6 parallel after Slice 1. Slices 8+9+10 parallel after Slice 7.

---

## 16. Relationship to Auto-Trader (Separate Spec)

The Alert Console produces structured alert events stored in `discord_messages` and `discord_parsed_trades` with `source='admin_console'`. It also broadcasts these events via Supabase Realtime on channel `discord_calls:{channelId}`.

The future Auto-Trader system (spec TBD, route `/admin/auto-trader`) will:
- Subscribe to these same Realtime events.
- Consume the structured alert payloads.
- Execute trades on the admin's connected Tradier account based on configurable rules.

The Alert Console has **zero knowledge** of the Auto-Trader. It simply produces events. This clean separation means the Alert Console works standalone, and the Auto-Trader can be built, tested, and deployed independently.

---

## 17. Update Log

### 2026-03-10: Admin-Managed Discord Config (v4)
- All Discord configuration (bot token, guild IDs, channel IDs, delivery method) moved from Railway env vars to `discord_config` database table.
- New admin settings panel accessible via ⚙ icon or `/admin/alerts/settings`.
- Bot token encrypted at rest, never exposed to frontend.
- Guild/channel selection via live dropdowns (populated from bot's connected servers).
- Connection status indicator in Alert Console header (connected/disconnected/error/reconnecting).
- Primary delivery via discord.js `channel.send()` instead of webhook — more reliable with built-in reconnection and rate limit handling.
- Webhook kept as fallback delivery method when bot is unavailable.
- Existing env vars (`DISCORD_BOT_TOKEN` etc.) become optional bootstrap seeds for first-time setup only.
- Added 6 new API routes for Discord settings management.
- Slice plan expanded from 12 to 13 slices (new Slice 2: Discord Settings API + UI).

### 2026-03-09: P&L Broadcast UX (v3)
- Added `update` signal type for pure P&L broadcast ("68% here @everyone").
- P&L bar now includes a prominent UPDATE button for one-tap informational broadcasts.
- Trim buttons now include live P&L context: "+68% here trim @everyone" (mimics FancyITM "47% here trim" pattern).
- Key UX distinction: UPDATE = informational ("here's where we are"), TRIM = actionable ("take some off here").
- Admin never types the P&L percentage — the console computes it from entry vs current price.

### 2026-03-09: Initial Spec (v2)
- Rewrote spec to focus exclusively on Alert Console (removed all Tradier/Auto-Execution).
- Redesigned contract selection as visual funnel (ticker → expiration → strike chain → PREP).
- Redesigned action strip as state-driven (show only valid actions per trade state).
- Trim/Trail actions are now one-tap buttons, not two-step flows.
- Added mobile-first design principle and 390px viewport requirement.
- Added rapid re-PREP flow for common same-symbol re-entry pattern.
- Separated Auto-Trader as future companion spec.
- Aligned with existing Discord infrastructure (messageParser, discordBroadcaster, discordPersistence).
