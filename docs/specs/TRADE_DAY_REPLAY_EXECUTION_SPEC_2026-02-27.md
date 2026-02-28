# Trade Day Replay — Execution Spec

**Date:** 2026-02-27
**Status:** Approved
**Route:** `/members/trade-day-replay`
**Access:** Admin-only (future: all members)
**Author:** Nate / Claude
**Review:** Codex-audited, Rounds 1–4 resolved (see Appendix A)

---

## 1. Objective

Build a "Trade Day Replay" tab under `/members/trade-day-replay` (admin-gated) that accepts a pasted Discord trading transcript, uses OpenAI to extract structured trades, fetches historical SPX price and options data from Massive.com, and renders an interactive candlestick replay with trade entry/exit/trim/stop overlays plus a session analysis summary.

**Out of scope (deferred):** Auto-journaling, journal draft creation, bias detection, AI Coach integration.

---

## 2. Architecture

```
User pastes Discord transcript into textarea
  → Raw text sent to POST /api/trade-day-replay/build
  → Backend Step 1: OpenAI structured output call → ParsedTrade[]
  → Backend Step 2: Zod validation + sanity checks on parsed trades
  → Backend Step 3: Massive.com → SPX minute bars for session window (I:SPX)
  → Backend Step 4: Massive.com → Options day-level snapshots per trade (Greeks, IV, bid/ask)
  → Backend Step 5: Lightweight retrospective trade scorer (backend-native, not frontend decision engine)
  → Returns: { bars, enrichedTrades, sessionStats }
  → Frontend renders candlestick replay + trade overlays + analysis panel
```

**Key design decision:** All intelligence is server-side. The frontend sends raw text and receives fully enriched replay data. No client-side parsing — OpenAI IS the parser.

**Critical constraint:** The frontend decision engine (`lib/spx/decision-engine.ts`) uses `@/` alias imports and depends on rich ML context (`PredictionState`, `BasisState`, `GEXProfile`, `FlowEvent[]`) that cannot be reconstructed from a transcript + bars alone. A lightweight retrospective scorer is built backend-native instead (see Section 5.2).

---

## 3. Transcript Parsing via OpenAI

### 3.1 Why OpenAI Over Regex

FancyITM's vocabulary is consistent today, but Discord transcripts contain natural language variability — commentary mixed with actionable calls, shorthand, multi-trader channels, and messages like "We need to see us push below 6840 for this to work in our favor" that contain price levels but aren't trade actions. An LLM handles this natively without enumerating edge cases.

### 3.2 Implementation

**Location:** `backend/src/services/trade-day-replay/transcript-parser.ts`

**Model:** `gpt-4o` via existing OpenAI integration (`OPENAI_API_KEY`)

**Approach:** Single structured output call with a system prompt defining:

- The trading vocabulary (PREP, PTF, Filled, Trim, Stops, B/E, Trail, Fully out)
- The output JSON schema matching `ParsedTrade[]`
- Instructions to separate actionable trades from commentary
- Timezone context (input timezone as parameter, default CST → normalize to ET)

**System prompt structure:**

```
You are a trade transcript parser for SPX options day trading.
Given a Discord transcript, extract each distinct trade as a structured object.

A "trade" begins with a PREP or Filled message and ends with "Fully out" / "Fully sold".
Ignore pure commentary, market observations, and re-entry mentions that don't result in fills.

Output timezone: America/New_York (ET).
Input timezone: {provided by caller, default America/Chicago}.

Return JSON matching this schema: [ParsedTrade schema]
```

**Cost:** ~800 tokens per typical session transcript ≈ <$0.01 per replay build.

### 3.3 Post-Parse Validation

**Location:** `backend/src/services/trade-day-replay/trade-validator.ts`

After OpenAI returns, validate with Zod:

- Strikes are reasonable SPX numbers (4000–8000 range for current era)
- Timestamps fall within market hours (9:30 AM – 4:00 PM ET)
- Contract types match (C = call, P = put)
- Entry prices are positive numbers
- Expiry dates are valid and ≥ trade date
- Each trade has at minimum: contract info + entry price + at least one exit event

Reuses patterns from existing `sanitize-entry.ts` and `import-normalization.ts`.

---

## 4. Type Definitions

**Location:** `backend/src/services/trade-day-replay/types.ts`

> **Note:** Backend `tsconfig.json` scopes compilation to `rootDir: ./src` with `include: ["src/**/*"]`.
> Types shared between frontend and backend must be duplicated or re-exported.
> The canonical types live in the backend; the frontend page imports a mirrored
> subset at `lib/trade-day-replay/types.ts` (plain interfaces, no runtime deps).

### 4.1 Parser Output Types

```typescript
export interface ParsedContract {
  symbol: 'SPX'
  strike: number
  type: 'call' | 'put'
  expiry: string                // "2026-02-27"
}

export interface ParsedExitEvent {
  type: 'trim' | 'stop' | 'trail_stop' | 'breakeven_stop' | 'full_exit'
  percentage?: number           // trim 21%, trail -15%, etc.
  timestamp: string             // ISO, ET
}

export interface ParsedStopLevel {
  spxLevel: number              // e.g., 6851
  timestamp: string             // ISO, ET
}

export interface ParsedTrade {
  tradeIndex: number
  contract: ParsedContract
  direction: 'long'             // buying options
  entryPrice: number            // avg fill price
  entryTimestamp: string         // ISO, ET
  exitEvents: ParsedExitEvent[]
  stopLevels: ParsedStopLevel[]
  spxReferences: number[]       // mentioned SPX price levels
  sizing: 'normal' | 'light' | null
  rawMessages: string[]         // original Discord messages for this trade
}
```

### 4.2 Enriched Output Types

```typescript
export interface OptionsContext {
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv: number | null
  bid: number | null
  ask: number | null
}

export interface TradeEvaluation {
  alignmentScore: number
  confidence: number
  confidenceTrend: 'up' | 'flat' | 'down'
  expectedValueR: number
  drivers: string[]
  risks: string[]
}

export interface EnrichedTrade extends ParsedTrade {
  optionsAtEntry: OptionsContext | null
  evaluation: TradeEvaluation | null
  pnlPercent: number | null
  isWinner: boolean | null
  holdDurationMin: number | null
}

export interface SessionStats {
  totalTrades: number
  winners: number
  losers: number
  winRate: number
  bestTrade: { index: number; pctReturn: number } | null
  worstTrade: { index: number; pctReturn: number } | null
  sessionStartET: string
  sessionEndET: string
  sessionDurationMin: number
}

/** ChartBar is defined locally in backend types — NOT imported from lib/api/ai-coach.ts.
 *  The frontend mirror in lib/trade-day-replay/types.ts re-exports the same shape.
 *  This avoids crossing the backend TS boundary (rootDir: ./src). */
export interface ChartBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ReplayPayload {
  bars: ChartBar[]
  trades: EnrichedTrade[]
  stats: SessionStats
}
```

---

## 5. Backend Endpoint

**Location:** `backend/src/routes/trade-day-replay.ts`

### 5.1 `GET /api/trade-day-replay/health`

**Auth:** `authenticateToken` + `requireAdmin` (same chain as `/build`).

**Purpose:** Preflight check used by the page component on load. If the backend returns 403,
the frontend shows "Backend admin access not configured" instead of rendering the transcript
input. This catches auth-layer provisioning drift at the UX layer (see Section 9.2 Step 3).

**Response:** `{ ok: true }` (200) or 403 with error message.

### 5.2 `POST /api/trade-day-replay/build`

**Auth:** `authenticateToken` middleware + `requireAdmin` middleware.
The `requireAdmin` middleware mirrors the pattern in `backend/src/routes/academy-admin.ts`:
queries `profiles.role` via Supabase and returns 403 if not `'admin'`.

```typescript
// Middleware chain (mirrors academy-admin.ts pattern):
router.use(authenticateToken);
router.use(requireAdmin);  // profiles.role === 'admin'
```

**Request body:**

```typescript
{
  transcript: string             // raw Discord text
  inputTimezone?: string         // default "America/Chicago"
  date?: string                  // override date, default: extracted by OpenAI
}
```

**Timeout:** Custom 90-second timeout for this route. The default 30s (`server.ts` L87-98) is
insufficient for OpenAI call + multiple Massive.com options snapshot fetches. Add path check
in the timeout middleware or set per-route via `res.setTimeout(90000)`.

**Processing pipeline:**

1. Call OpenAI structured output → `ParsedTrade[]`
2. Validate with Zod (`trade-validator.ts`)
3. Determine session window from earliest entry to latest exit
4. `getMinuteAggregates("I:SPX", date)` → filter to session window → convert to `ChartBar[]`
   > **Note:** SPX is an index and requires `I:` prefix for Massive.com aggregates API.
   > Use `I:SPX` directly (mirrors `normalizeSymbol()` in `backend/src/routes/chart.ts` L82-86).
5. For each trade: `getOptionsSnapshotAtDate("SPX", date, optionTicker)` → extract Greeks/IV/bid-ask
   > **Limitation:** `getOptionsSnapshotAtDate` uses `as_of` at **day granularity**, not per-timestamp.
   > Greeks represent the day-level snapshot, not the exact moment of entry. This is acceptable
   > for replay analysis; the UI should label this as "Day-of Greeks" not "Entry Greeks."
   > For 0DTE options, snapshot data may be unavailable — graceful fallback to `null`.
6. For each trade: run lightweight retrospective scorer (see 5.2)
7. Calculate P&L % per trade from entry price + exit events
8. Compute session stats (win rate, best/worst, duration)

**Response:** `ReplayPayload`

### 5.3 Lightweight Retrospective Trade Scorer

**Location:** `backend/src/services/trade-day-replay/trade-scorer.ts`

The frontend decision engine (`lib/spx/decision-engine.ts`) cannot be used from backend because:
- It imports via `@/` alias (Next.js path mapping, not available in backend TS)
- `evaluateSPXSetupDecision()` requires `SPXDecisionEngineContext` which extends `FeatureExtractionContext`
  needing `PredictionState`, `BasisState`, `GEXProfile`, `FlowEvent[]`, and ML model state
- These rich context objects cannot be reconstructed from a transcript + historical bars alone

Instead, build a **lightweight backend-native scorer** that evaluates what CAN be derived:
- **Price action context:** Where was SPX relative to session high/low/VWAP at entry?
- **Timing score:** How far into the session? Pre/post-data release?
- **Risk management score:** Were stops set? How did they trail? Was sizing appropriate?
- **Execution quality:** Trim discipline (did they take partials?), hold duration vs. outcome
- **Outcome grade:** P&L %, R:R realized vs. initial stop distance

This produces a `TradeEvaluation` with `drivers` and `risks` arrays — same interface shape as
the frontend decision engine output, but populated from bar-derived + transcript-derived signals
rather than live ML context. Future enhancement: if SPX snapshot cache is available for the date,
hydrate partial context for a richer evaluation.

---

## 6. Frontend — Page Route

**Location:** `app/members/trade-day-replay/page.tsx`

Server component with `isAdminUser()` gate → returns `notFound()` if not admin. Mirrors the admin layout auth pattern but keeps the route under `/members/` for future member access expansion.

### 6.1 Three-State UI

**State 1 — Input:** Textarea for pasting transcript, timezone selector dropdown (default CST), "Build Replay" button. Glass-card-heavy container, centered, clean.

**State 2 — Loading:** Pulsing logo skeleton (`components/ui/skeleton-loader.tsx` variant="screen") with progressive status text ("Parsing transcript…", "Fetching market data…", "Scoring trades…").

**State 3 — Replay:** Full replay view with chart on top + analysis panel below.

---

## 7. Candlestick Replay Chart

**Location:** `components/trade-day-replay/replay-chart.tsx`

### 7.1 Replay Engine Integration

Uses existing `createSPXReplayEngine(bars, { windowMinutes: 60 })` from `lib/spx/replay-engine.ts`. Feeds it the Massive minute bars, gets frame-by-frame playback with configurable speed.

### 7.2 Chart Rendering

Candlestick chart (lightweight-charts or recharts, whichever is already used in SPX Command Center) with volume bars. Dark mode, Emerald Standard styling.

### 7.3 Trade Overlays

**Location:** `components/trade-day-replay/trade-marker-overlay.tsx`

- **Emerald green triangle ▲** at entry timestamps (fills)
- **Red triangle ▼** at full exit timestamps
- **Champagne diamond ◆** at trim points
- **Red dashed horizontal line** for stop levels (updates as stops trail)
- **Tooltip on hover** showing trade details (contract, price, % gain/loss)

### 7.4 Playback Controls

**Location:** `components/trade-day-replay/replay-controls.tsx`

- Play / Pause button
- Speed selector: 1x, 2x, 4x (maps to `getSPXReplayIntervalMs`)
- Progress scrubber bar
- Current timestamp display (ET)
- "Jump to Trade" dropdown (Trade 1: 6750P, Trade 2: 6770P, etc.)

---

## 8. Session Analysis Panel

**Location:** `components/trade-day-replay/session-analysis.tsx`

### 8.1 Session Summary Card

Glass-card-heavy surface at top of panel:

- Win rate ring/badge (e.g., "75% — 3W / 1L")
- Session duration (67 min)
- Trade count (4)
- Best and worst trade highlights

### 8.2 Per-Trade Cards

**Location:** `components/trade-day-replay/trade-card.tsx`

Expandable cards, one per trade:

- **Header:** Contract name in Geist Mono (e.g., "SPX 6900C 02/27"), P&L badge (emerald/red)
- **Pricing section:** Entry avg → trim breakdown → exit, all in Geist Mono
- **Day-of Greeks:** Delta, Theta, IV, Bid/Ask from day-level Massive snapshot (not exact entry moment)
- **Trade score:** Price action context, risk management, execution quality, drivers, risks (from backend `trade-scorer.ts`)
- **Stop management timeline:** Visual showing stop updates (6851 → 6855 → 6859 → B/E)
- **Raw messages:** Collapsible section showing original Discord text for that trade

---

## 9. Navigation

### 9.1 Modified Files

**`lib/member-navigation.ts`:**
- Add `'trade-day-replay': Play` to `TAB_ID_ICON_MAP` (Lucide `Play` icon)
- Add fallback title: `if (pathname.startsWith('/members/trade-day-replay')) return 'Trade Day Replay'`

**`backend/src/server.ts`** (L123 area, route mount section):
- Import and mount: `app.use('/api/trade-day-replay', tradeDayReplayRouter);`
- Add custom timeout for this path in the timeout middleware block (L87-98):
  `req.path.startsWith('/api/trade-day-replay') ? 90000 :`

### 9.2 Sidebar Visibility

Tabs are driven by the `tab_configurations` Supabase table, fetched via `/api/config/tabs`
and filtered by `MemberAuthContext.getVisibleTabs()` based on `required_tier`.

**DB constraint issue:** The `tab_configurations.required_tier` column has a CHECK constraint
limiting values to `'core' | 'pro' | 'executive'` (see `20260209000001_tab_configurations.sql` L11-12).
Inserting `'admin'` would violate this constraint. The `TabConfig` TypeScript interface
(`MemberAuthContext.tsx` L51) mirrors this: `required_tier: 'core' | 'pro' | 'executive'`.
The `MemberProfile` interface (L30-39) has no `role` field.

**Approach: Four-step migration + context update.**

**Step 1 — DB migration:** Alter the CHECK constraint to add `'admin'`, then insert the row.

```sql
-- Migration: add_trade_day_replay_tab
ALTER TABLE tab_configurations
  DROP CONSTRAINT IF EXISTS tab_configurations_required_tier_check;

ALTER TABLE tab_configurations
  ADD CONSTRAINT tab_configurations_required_tier_check
  CHECK (required_tier IN ('core', 'pro', 'executive', 'admin'));

INSERT INTO tab_configurations (tab_id, label, icon, path, required_tier, sort_order, is_required, mobile_visible, is_active)
VALUES ('trade-day-replay', 'Trade Day Replay', 'Play', '/members/trade-day-replay', 'admin', 8, false, false, true);
```

**Step 2 — TypeScript type updates (3 files):**

Update `TabConfig.required_tier` in `MemberAuthContext.tsx` (L51):
```typescript
// Before:
required_tier: 'core' | 'pro' | 'executive'
// After:
required_tier: 'core' | 'pro' | 'executive' | 'admin'
```

Update `MembershipTier` type in `app/admin/tabs/page.tsx` (L18):
```typescript
// Before:
type MembershipTier = 'core' | 'pro' | 'executive'
// After:
type MembershipTier = 'core' | 'pro' | 'executive' | 'admin'
```

Update admin tabs editor select options in `app/admin/tabs/page.tsx` (L341-343):
```html
<!-- Add after existing options: -->
<option value="admin">Admin</option>
```

**Step 3 — Unified admin detection (page layer + MemberAuthContext):**

> **Inconsistency risk:** The page-layer `isAdminUser()` (`supabase-server.ts` L73) checks
> **two** paths: `app_metadata.is_admin === true` OR Discord admin role via `hasAdminRoleAccess(roleIds)`.
> The backend `requireAdmin` middleware (`academy-admin.ts` L46) checks **only**
> `profiles.role === 'admin'`. If an admin is granted via JWT `is_admin` or Discord role but
> lacks `profiles.role === 'admin'`, they see the page (via `isAdminUser()`) but get 403 from
> the backend API — a "visible but broken" state.
>
> **Resolution:** The backend is the source of truth. Ensure all admin users also have
> `profiles.role = 'admin'` in the database. The page-layer `isAdminUser()` check is
> intentionally broader (JWT + Discord roles) as a convenience layer, but the **authoritative
> gate** is the backend `requireAdmin` middleware reading `profiles.role`. This spec treats
> `profiles.role === 'admin'` as the canonical admin check and requires that any user who
> needs Trade Day Replay access has this set.
>
> **Operational requirement:** Add to the runbook: when granting admin access, always set
> `profiles.role = 'admin'` in addition to any JWT/Discord role grants.
>
> **Technical mitigation (recommended for Phase 2):** To eliminate divergence risk at runtime,
> update `isAdminUser()` in `supabase-server.ts` to add a `profiles.role === 'admin'` check
> as a **third** admin path (alongside JWT `is_admin` and Discord role). This makes page-layer
> auth a strict superset of backend auth, so any user who passes backend `requireAdmin` also
> passes page `isAdminUser()`. The reverse (page-visible but API-blocked) can still occur for
> JWT/Discord-only admins, but the page can detect this and show a degraded state ("admin
> access pending — contact support") rather than a raw 403.
>
> **Phase 1 scope:** For this feature, the page component (`page.tsx`) should make a
> preflight call to the backend (e.g. `GET /api/trade-day-replay/health` with auth) during
> load. If the backend returns 403, show an explicit "Backend admin access not configured"
> message instead of rendering the transcript input. This catches provisioning drift at the
> UX layer rather than letting users hit a 403 mid-flow.

**MemberAuthContext admin detection:** Add a separate lightweight query for admin status.
After the Discord profile fetch (L641), add:

> **Policy: fail closed.** The `profiles` table has historically only been queried server-side
> (e.g. `academy-admin.ts` L40 using `supabase` service client). Client-side reads go through
> RLS. If the `profiles` table lacks a `SELECT` RLS policy for authenticated users reading their
> own row, this query will return `null` — which is the correct fail-closed behavior (no admin
> access granted). However, to ensure the query works as intended:
>
> **Pre-requisite:** Verify (or add) an RLS policy on `profiles` that allows
> `auth.uid() = id` for `SELECT`. If adding a new policy, include it in the migration
> (Step 1). If the policy already exists, document it in the runbook.
>
> **Alternative approach:** If client-side `profiles` access is undesirable for policy reasons,
> replace with a lightweight server endpoint (e.g. `GET /api/members/admin-status`) that
> returns `{ isAdmin: boolean }` using the service-role client. The frontend calls this
> endpoint instead of querying `profiles` directly. This aligns with the existing pattern where
> admin checks live server-side.

```typescript
// Check admin status from profiles table (separate from Discord profile)
// This aligns with backend requireAdmin which checks profiles.role === 'admin'
// Fail-closed: if query fails (RLS, network, etc.), isAdmin defaults to false
let isAdmin = false
try {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.warn('[MemberAuth] profiles.role lookup failed, defaulting isAdmin=false:', profileError.message)
    // Telemetry: track admin-check failures for monitoring
  }
  isAdmin = profileRow?.role === 'admin'
} catch (err) {
  console.warn('[MemberAuth] profiles.role lookup threw, defaulting isAdmin=false:', err)
  isAdmin = false
}
```

Then add `role` to `MemberProfile` interface (L30-39):
```typescript
export interface MemberProfile {
  id: string
  email: string | null
  discord_user_id: string | null
  discord_username: string | null
  discord_avatar: string | null
  discord_roles: string[]
  discord_role_titles: Record<string, string>
  membership_tier: 'core' | 'pro' | 'executive' | null
  role?: 'admin' | null  // From profiles table, NOT user_discord_profiles
}
```

And populate it in the profile construction (L692-701):
```typescript
const profile: MemberProfile = {
  // ... existing fields ...
  role: isAdmin ? 'admin' : null,
}
```

**Step 4 — Update BOTH tab filtering functions:**

There are **two** functions that filter tabs by tier. Both must handle `'admin'`:

**4a. `getVisibleTabs()`** (L1063-1076):
```typescript
const getVisibleTabs = useCallback((): TabConfig[] => {
  if (!allTabConfigs.length) return []
  const tierHierarchy: Record<string, number> = { core: 1, pro: 2, executive: 3 }
  const userTierLevel = state.profile?.membership_tier
    ? tierHierarchy[state.profile.membership_tier] || 0
    : 0
  const isAdmin = state.profile?.role === 'admin'

  return allTabConfigs.filter(tab => {
    if (!tab.is_active) return false
    if (tab.is_required) return true
    // Admin-only tabs: only visible to admin users
    if (tab.required_tier === 'admin') return isAdmin
    const requiredLevel = tierHierarchy[tab.required_tier] || 0
    return userTierLevel >= requiredLevel
  })
}, [allTabConfigs, state.profile?.membership_tier, state.profile?.role])
```

**4b. `getAllowedTabsForTier()`** (L375-389):

This is a second filtering function that also uses `tierHierarchy` and would treat
`required_tier: 'admin'` as level 0 (unknown key), unintentionally including admin tabs
for all users. Must add the same guard.

> **Initialization coupling fix:** `getAllowedTabsForTier()` is called at L711 (`fetchAllowedTabs`)
> during auth initialization — **before** `setState` commits the profile with `role`. Reading
> `state.profile?.role` from here would always be `undefined` on first load, silently omitting
> admin tabs. **Solution:** Accept `isAdmin` as a parameter instead of reading from stale state.

```typescript
const getAllowedTabsForTier = useCallback((
  tier: 'core' | 'pro' | 'executive' | null,
  isAdmin?: boolean  // Passed explicitly to avoid reading stale state during init
): string[] => {
  if (allTabConfigs.length > 0) {
    const tierHierarchy: Record<string, number> = { core: 1, pro: 2, executive: 3 }
    const userTierLevel = tier ? tierHierarchy[tier] || 0 : 0

    return allTabConfigs
      .filter(tab => {
        if (!tab.is_active) return false
        if (tab.is_required) return true
        // Admin-only tabs: exclude unless admin
        if (tab.required_tier === 'admin') return !!isAdmin
        const requiredLevel = tierHierarchy[tab.required_tier] || 0
        return userTierLevel >= requiredLevel
      })
      .map(tab => tab.tab_id)
  }
  // ... existing fallback logic ...
}, [allTabConfigs])
```

**Update `fetchAllowedTabs` signature to accept and pass through `isAdmin`:**

```typescript
const fetchAllowedTabs = useCallback(async (
  userId: string,
  tier?: 'core' | 'pro' | 'executive' | null,
  isAdmin?: boolean
): Promise<string[]> => {
  if (tier !== undefined) {
    return getAllowedTabsForTier(tier, isAdmin)
  }
  // ... existing fallback ...
```

**Update ALL three callsites to pass `isAdmin`:**

There are **three** places `fetchAllowedTabs` is called. All must pass `isAdmin`.

**Callsite 1 — Primary auth init (L711):** `isAdmin` is available locally from the
profiles query (Step 3 above):
```typescript
const allowedTabs = await fetchAllowedTabsRef.current(user.id, profile.membership_tier, isAdmin)
```

**Callsite 2 — Discord re-sync (L510):** After a Discord re-sync completes, tabs are
recalculated. Here `isAdmin` is not locally available — read from the existing profile
state (which IS committed at this point, unlike init):
```typescript
const isAdmin = state.profile?.role === 'admin'
const allowedTabs = await fetchAllowedTabsRef.current(userRef.current?.id || '', profile.membership_tier, isAdmin)
```
> **Why `state.profile?.role` is safe here:** This callsite runs during a user-triggered
> re-sync, well after the initial `setState` that committed the profile with `role`.
> Unlike the init path (Callsite 1), state is not stale here.

**Callsite 3 — Background role sync (L776):** After the edge function refreshes roles,
tabs are recalculated. Same pattern as Callsite 2 — profile state is committed:
```typescript
const isAdmin = state.profile?.role === 'admin'
const allowedTabs = await fetchAllowedTabsRef.current(user.id, profile.membership_tier, isAdmin)
```

> **Why this matters:** Without the parameter, `state.profile?.role` is `undefined` during
> the first `fetchAllowedTabs` call (L711) because `setState` at L713 hasn't committed yet.
> The admin tab would be silently excluded from `allowedTabs` on initial load, causing a
> flash-of-missing-tab or requiring a second render cycle.

**4c. `app/api/admin/members/access/route.ts`** (L305-312):

A third tier-hierarchy filter exists in the admin members access API. This endpoint computes
`allowed_tabs` for a member using the same `tierHierarchy` pattern without `admin`:

```typescript
// Before (L305):
const tierHierarchy: Record<MembershipTier, number> = { core: 1, pro: 2, executive: 3 }

// After:
const tierHierarchy: Record<string, number> = { core: 1, pro: 2, executive: 3 }
// ... and add admin guard in the filter (L309-314):
.filter((tab: any) => {
  if (tab.is_required) return true
  const required = String(tab.required_tier || '')
  if (required === 'admin') return false // Admin tabs not reported via this endpoint
  const requiredLevel = tierHierarchy[required] || 0
  return userTierLevel >= requiredLevel
})
```

> **Context:** This is an admin-only endpoint that reports a member's access, not a member-facing
> leak. However, without the guard it would incorrectly include admin-only tabs in the
> `allowed_tabs` response for any member (since `tierHierarchy['admin']` is `undefined`, falling
> back to `0`, which every user's tier level exceeds).

**Fallback:** The `DEFAULT_TABS` array in `app/api/config/tabs/route.ts` does NOT include
this tab — admin-only tabs are DB-only by design. No fallback entry needed.

### 9.3 Frontend → Backend Routing Strategy

The frontend does NOT call the Express backend directly. All backend requests go through
a **Next.js proxy route**. The existing pattern is `app/api/spx/[...path]/route.ts` which
proxies `/api/spx/*` to `http://localhost:3001/api/spx/*` (or the Railway production URL).

**For Trade Day Replay, create a matching proxy route:**

**New file:** `app/api/trade-day-replay/[...path]/route.ts`

This proxy:
- Forwards `GET /api/trade-day-replay/health` → Express backend (preflight admin check)
- Forwards `POST /api/trade-day-replay/build` → Express backend `/api/trade-day-replay/build`
- Passes the Supabase auth token from the browser session
- Sets an 90-second proxy timeout (matching the backend route timeout)
- Uses the same env var priority as the SPX proxy: `SPX_BACKEND_URL` → `AI_COACH_API_URL` → `NEXT_PUBLIC_AI_COACH_API_URL` → localhost/remote defaults (see `app/api/spx/[...path]/route.ts` L70-74)

The frontend page component calls `/api/trade-day-replay/build` via `fetch()` — the Next.js
proxy handles forwarding transparently.

---

## 10. File Inventory

### 10.1 New Files

| File | Layer | Purpose |
|------|-------|---------|
| `backend/src/services/trade-day-replay/types.ts` | Backend | Canonical type definitions |
| `backend/src/services/trade-day-replay/transcript-parser.ts` | Backend | OpenAI structured output call |
| `backend/src/services/trade-day-replay/trade-validator.ts` | Backend | Zod post-parse validation |
| `backend/src/services/trade-day-replay/trade-scorer.ts` | Backend | Lightweight retrospective trade scorer |
| `backend/src/routes/trade-day-replay.ts` | Backend | POST endpoint, orchestrates pipeline |
| `lib/trade-day-replay/types.ts` | Frontend | Mirrored type subset (plain interfaces, no runtime deps) |
| `app/api/trade-day-replay/[...path]/route.ts` | Frontend | Next.js proxy route → Express backend |
| `app/members/trade-day-replay/page.tsx` | Frontend | Page route with admin gate |
| `components/trade-day-replay/replay-chart.tsx` | Frontend | Candlestick chart with replay engine |
| `components/trade-day-replay/replay-controls.tsx` | Frontend | Playback controls (play/pause/speed/scrub) |
| `components/trade-day-replay/trade-marker-overlay.tsx` | Frontend | Entry/exit/trim/stop markers on chart |
| `components/trade-day-replay/session-analysis.tsx` | Frontend | Session stats + summary card |
| `components/trade-day-replay/trade-card.tsx` | Frontend | Per-trade breakdown card |

### 10.2 Modified Files

| File | Change |
|------|--------|
| `lib/member-navigation.ts` | Add tab icon + fallback title |
| `backend/src/server.ts` | Mount `/api/trade-day-replay` route + add 90s timeout for path |
| `supabase/migrations/` | New migration: ALTER CHECK constraint + insert `tab_configurations` row |
| `contexts/MemberAuthContext.tsx` | Add `role` to `MemberProfile`, add `profiles` query for admin status, update `TabConfig.required_tier` union, add admin guard to BOTH `getVisibleTabs()` AND `getAllowedTabsForTier()` |
| `app/admin/tabs/page.tsx` | Add `'admin'` to `MembershipTier` type (L18), add `<option value="admin">Admin</option>` to tier select (L341-343) |
| `app/api/admin/members/access/route.ts` | Add admin guard to `tierHierarchy` filter (L305-312): skip `required_tier === 'admin'` tabs from `allowed_tabs` computation |

---

## 11. Implementation Phases

| Phase | Scope | Depends On | Parallelizable |
|-------|-------|------------|----------------|
| **1** | Types — backend canonical + frontend mirror (`backend/src/services/trade-day-replay/types.ts` + `lib/trade-day-replay/types.ts`) | Nothing | — |
| **2** | OpenAI parser + Zod validator + trade scorer (backend services) | Types | — |
| **3** | Backend endpoint (wire Massive with `I:SPX`, options snapshots, scorer) | Parser + validator + scorer | — |
| **4** | Page route with input UI + `isAdminUser()` gate | Nothing | Yes (with 2-3) |
| **5** | Candlestick chart + replay engine integration | Backend endpoint | — |
| **6** | Trade marker overlays on chart | Chart | — |
| **7** | Session analysis panel + trade cards | Backend endpoint | Yes (with 5-6) |
| **8** | Navigation: DB migration + `getVisibleTabs()` admin tier + `server.ts` mount + timeout | Page route | — |
| **9** | Emerald Standard polish, loading states, error handling | All above | — |
| **10** | Validation gates (see Section 15 for split frontend/backend gates) | All above | — |

---

## 12. Design Tokens (Emerald Standard)

| Token | Usage |
|-------|-------|
| `glass-card-heavy` | All card/container surfaces |
| `var(--emerald-elite)` / `#10B981` | Winner trades, primary actions |
| `#EF4444` | Loser trades, stop lines |
| `var(--champagne)` / `#F3E5AB` | Trim markers, subtle accents |
| Geist Mono | Prices, contracts, P&L numbers |
| Playfair Display | Section headings |
| Inter | Body text |
| Pulsing logo skeleton | Loading state (`variant="screen"`) |
| Dark mode only | No light theme |

---

## 13. Existing Infrastructure Reused

| Component | Location | Reuse | Notes |
|-----------|----------|-------|-------|
| Replay Engine | `lib/spx/replay-engine.ts` | Direct — `createSPXReplayEngine(bars)` | Frontend only, valid |
| Replay Intervals | `lib/spx/replay-engine.ts` | Direct — `getSPXReplayIntervalMs(speed)` | Frontend only, valid |
| ~~Decision Engine~~ | ~~`lib/spx/decision-engine.ts`~~ | **NOT usable** — `@/` imports, needs ML context | Replaced by backend-native `trade-scorer.ts` |
| Massive Minute Bars | `backend/src/config/massive.ts` | Direct — `getMinuteAggregates("I:SPX", date)` | Must use `I:` prefix for index symbols |
| Massive Options | `backend/src/config/massive.ts` | Direct — `getOptionsSnapshotAtDate()` | Day-level `as_of` only, not per-timestamp |
| ChartBar Type | `lib/api/ai-coach.ts` (frontend) | **NOT imported by backend** — redefined locally in `backend/src/services/trade-day-replay/types.ts` | Same shape, separate declaration to respect backend TS boundary |
| Admin Auth (frontend) | `lib/supabase-server.ts` | Direct — `isAdminUser()` | For page route server component |
| Admin Auth (backend) | `backend/src/routes/academy-admin.ts` | Pattern — `requireAdmin` middleware | Queries `profiles.role === 'admin'` |
| Entry Sanitization | `lib/journal/sanitize-entry.ts` | Patterns — Zod validation approach | |
| Import Normalization | `lib/journal/import-normalization.ts` | Patterns — OCC symbol parsing | |
| OpenAI Integration | `backend/src/config/openai.ts` | Direct — `gpt-4o` via env config | Model configured in `backend/src/config/env.ts` |
| Symbol Normalization | `backend/src/routes/chart.ts` L82-86 | Pattern — `normalizeSymbol()` adds `I:` prefix | |

---

## 14. Reference Transcript (Test Fixture)

The following FancyITM transcript from 2026-02-27 serves as the canonical test fixture for parser validation. Expected output: **4 trades**.

```
AstarITM — 8:25 AM
PREP means prepare the option chain and contract for a potential trade...

1. FancyITM — 8:43 AM
PREP SPX 6750P 02/27 @everyone
2. Filled AVG 2.60 @everyone
3. Trim 21% @everyone
4. B/E stops on runners
5. Fully out of SPX @everyone

6. Will look for a re entry @everyone
7. PREP SPX 6770P 02/27 @everyone
8. PTF @everyone
9. Sized light looking to fill below 6850
10. FancyITM — 8:50 AM
Filled AVG 3.90 @everyone Stops 6851
11. Will alert exit here
12. Preparing to exit @everyone
13. We need to see us push below 6840 for this to work in our favor @everyone
14. FancyITM — 8:59 AM
Put trail on for -15% @everyone
15. Data in 30 seconds
16. Fully out -15% @everyone

17. PREP SPX 6900C 02/27 @everyone
18. Filled AVG 3.60 @everyone Stops 6845
19. Trim 23% @everyone
20. Stops 6851
21. Trim if you haven't @everyone
22. FancyITM — 9:06 AM
43% here
23. Stops 6855
24. 72% Trim here @everyone
25. Stops 6859
26. Or B/E on runners @everyone
27. Take trims hold runners let's see if we can push past 6870 Target 6880 if we do @everyone
28. FancyITM — 9:14 AM
Fully out of SPX @everyone

29. FancyITM — 9:23 AM
PREP SPX 6895C 02/27 @everyone (LIGHT SIZED)
30. Filled AVG 4.80 @everyone
31. Stops 6855 or (-20%)
32. Trim 14% @everyone
33. Stops 6859
34. I'm green for today so I'll alert my exit here @everyone
35. Looks good here let's see if we can push @everyone
36. FancyITM — 9:32 AM
Fully sold runners on SPX @everyone
```

### Expected Parse Output

| Trade | Contract | Entry | Exit | Result |
|-------|----------|-------|------|--------|
| 1 | SPX 6750P 02/27 | Avg 2.60 | Trim 21% → B/E stops → fully out | Winner |
| 2 | SPX 6770P 02/27 | Avg 3.90 | Trail -15% → fully out -15% | Loser (-15%) |
| 3 | SPX 6900C 02/27 | Avg 3.60 | Trims 23%, 43%, 72% → fully out | Winner |
| 4 | SPX 6895C 02/27 | Avg 4.80 | Trim 14% → fully sold runners | Winner |

---

## 15. Validation Gates

> **Important:** Root-level lint, tsc, and vitest configs all **exclude `backend/`**.
> Backend changes require separate validation commands.

### Slice-Level (Frontend)

```bash
pnpm exec eslint lib/trade-day-replay/ components/trade-day-replay/ app/members/trade-day-replay/
pnpm exec tsc --noEmit
pnpm vitest run lib/trade-day-replay/
```

### Slice-Level (Backend)

```bash
cd backend && npx tsc --noEmit
```

> **ESLint for backend:** There is **no ESLint config** in the `backend/` directory, and
> root `eslint.config.mjs` explicitly ignores `backend/` (L11). Backend lint is not currently
> enforced. For this feature, rely on `tsc --noEmit` (strict mode, no unused locals/params,
> no implicit returns, no fallthrough cases — see `backend/tsconfig.json` L8-20) as the
> primary code quality gate. If backend ESLint is established later, add it to the gates.
>
> Root `vitest.config.ts` excludes `backend/**` (L16). Root `tsconfig.json` excludes `backend` (L41).
> All backend validation must run from the `backend/` directory.

### Release-Level

```bash
# Frontend
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run

# Backend (separate)
cd backend && npx tsc --noEmit
```

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI returns malformed JSON | Build fails | Zod validation catches; retry with temperature=0 |
| Options snapshot not available for 0DTE | Missing Greeks | Graceful fallback: show "N/A" for Greeks, P&L still calculated from fill prices. `getOptionsSnapshotAtDate` documents this limitation. |
| Options snapshot is day-level only | Greeks not at exact entry moment | UI labels as "Day-of Greeks." Acceptable for replay analysis. |
| Multi-trader transcripts | Crossed trades | System prompt instructs: group by trader username, separate trade streams |
| Timezone ambiguity | Wrong market data window | Explicit timezone selector in UI, default CST |
| Massive rate limits | Slow build | `MASSIVE_RATE_LIMIT` constant is defined (10 req/sec, 50 burst) in `massive.ts` L10-13, but this is a **config constant only — no enforcing middleware or queue exists**. For v1, serialize options snapshot calls sequentially. If performance is an issue, implement a simple request queue with delay (100ms between calls) to stay under Massive's tier limit. |
| Pipeline timeout | 408 on default 30s | Custom 90s timeout for `/api/trade-day-replay` path in `server.ts` timeout middleware |
| Backend types import from `lib/` | tsc compilation failure | Types duplicated: canonical in `backend/src/`, mirror in `lib/` |
| Frontend decision engine reuse | `@/` imports + missing ML context | Not used. Replaced by backend-native `trade-scorer.ts` |
| `getMinuteAggregates("SPX")` without `I:` prefix | Empty bar results | Always pass `"I:SPX"` — mirrors `normalizeSymbol()` from chart route |
| Admin auth layer mismatch | Page visible but API 403 | Phase 1: page calls `GET /health` preflight on load; 403 → show "admin access not configured" instead of transcript input. Phase 2: align `isAdminUser()` to also check `profiles.role`. Runbook: always set `profiles.role` when granting admin. |

---

## Appendix A: Codex Review Resolution Log

### Round 1 (Initial Codex Review)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| H1 | High | Shared types path `lib/trade-day-replay/types.ts` not backend-compatible (`rootDir: ./src`) | Canonical types moved to `backend/src/services/trade-day-replay/types.ts`; frontend gets mirrored subset |
| H2 | High | Decision engine uses `@/` imports + requires `FeatureExtractionContext` with ML state | Replaced with backend-native `trade-scorer.ts` (Section 5.2) |
| H3 | High | `getOptionsSnapshotAtDate` is day-level `as_of`, not per-timestamp | Documented limitation; UI labels "Day-of Greeks" |
| H4 | High | Backend admin gating underspecified (`authenticateToken` only sets id/email) | Added `requireAdmin` middleware mirroring `academy-admin.ts` pattern (Section 5.1) |
| H5 | High | Mount file listed as `index.ts` but actual is `server.ts` | Corrected to `backend/src/server.ts` throughout |
| M1 | Medium | Sidebar tabs driven by `tab_configurations` DB table, not code | Added DB migration + `getVisibleTabs()` admin tier handling (Section 9.2) |
| M2 | Medium | Root lint/tsc/vitest exclude `backend/` | Added separate backend validation commands (Section 15) |
| M3 | Medium | `getMinuteAggregates("SPX")` needs `I:` prefix | Corrected to `"I:SPX"` throughout (Section 5.1) |
| M4 | Medium | Default 30s timeout insufficient for pipeline | Added 90s custom timeout for route path (Section 5.1, 9.1) |

### Round 2 (Follow-up Review)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| R2-1 | Blocker | `required_tier: 'admin'` violates DB CHECK constraint (only `core\|pro\|executive` allowed) | Migration now ALTERs the CHECK constraint to add `'admin'` before inserting row (Section 9.2) |
| R2-2 | Blocker | `TabConfig.required_tier` TS type and `MemberProfile` lack admin support | Added `'admin'` to `TabConfig.required_tier` union; added `role` field to `MemberProfile`; updated `getVisibleTabs()` with admin branch (Section 9.2) |
| R2-3 | Medium | `MASSIVE_RATE_LIMIT` is a config constant, not an enforcing limiter | Corrected: serialize options calls sequentially for v1; noted no enforcing queue exists (Section 16) |
| R2-4 | Medium | No ESLint config in `backend/` — `cd backend && npx eslint` may fail | Removed backend ESLint from gates; rely on `tsc --noEmit` with strict settings (Section 15) |
| R2-5 | Medium | Frontend → backend routing strategy undefined (direct call vs. Next.js proxy) | Added Section 9.3: New proxy route at `app/api/trade-day-replay/[...path]/route.ts` mirroring SPX proxy pattern |

### Round 3 (Third Codex Review)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| R3-1 | High | `getAllowedTabsForTier()` (L375) also filters tabs — unknown tier defaults to level 0, leaking admin tabs to all users | Added Step 4b in Section 9.2: admin guard in `getAllowedTabsForTier()` that returns empty array for non-admin users when tab has `required_tier: 'admin'` |
| R3-2 | Medium | `MemberAuthContext` reads `user_discord_profiles` not `profiles` table — `role` field not available from Discord profile | Step 3 in Section 9.2 now specifies a **separate query** against `profiles` table (`supabase.from('profiles').select('role').eq('id', userId).maybeSingle()`) to detect admin role, independent of the Discord profile fetch |
| R3-3 | Medium | `ReplayPayload.bars` references `ChartBar` "from `ai-coach.ts`" — backend cannot import from `lib/api/ai-coach.ts` | `ChartBar` interface defined locally in `backend/src/services/trade-day-replay/types.ts` with identical shape (`time, open, high, low, close, volume`). Infrastructure reuse table updated to clarify "NOT imported by backend" |
| R3-4 | Low | Admin tabs editor UI (`app/admin/tabs/page.tsx`) tier select only lists `core/pro/executive` — admin cannot create admin-tier tabs via UI | Added to modified files: update `MembershipTier` type (L18) and tier `<select>` options (L341-343) to include `'admin'` |

### Round 4 (Fourth Codex Review)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| R4-1 | High | Admin auth inconsistent: page `isAdminUser()` checks JWT `is_admin` + Discord role; backend `requireAdmin` checks only `profiles.role === 'admin'` — can produce "page visible but API 403" | Documented in Step 3 (Section 9.2): backend `profiles.role === 'admin'` is the **canonical gate**. Page-layer `isAdminUser()` is intentionally broader as convenience. Operational requirement added: always set `profiles.role = 'admin'` when granting admin access. Future: align `isAdminUser()` to also check `profiles.role`. |
| R4-2 | Medium | `getAllowedTabsForTier()` reads `state.profile?.role` but is called at L711 before `setState` commits — `isAdmin` is always `undefined` on first load, silently omitting admin tabs | Changed `getAllowedTabsForTier` signature to accept `isAdmin?: boolean` as an explicit parameter. Updated `fetchAllowedTabs` to pass `isAdmin` through. Caller at L711 passes the locally-computed `isAdmin` from the profiles query (Step 3). |
| R4-3 | Medium | `app/api/admin/members/access/route.ts` (L305-312) has its own `tierHierarchy` without `admin` — reports incorrect `allowed_tabs` for members with admin-tier tabs | Added Step 4c in Section 9.2: admin guard in filter skips `required_tier === 'admin'` tabs. Added file to modified files table (Section 10.2). |
| R4-4 | Low | Proxy env var naming inaccurate: spec referenced `NEXT_PUBLIC_API_URL` but SPX proxy actually prioritizes `SPX_BACKEND_URL` → `AI_COACH_API_URL` → `NEXT_PUBLIC_AI_COACH_API_URL` | Corrected Section 9.3 to reference actual env var priority chain with source reference (`route.ts` L70-74). |

### Round 5 (Fifth Codex Review)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| R5-1 | Medium | `fetchAllowedTabs` callsite coverage incomplete — only L711 updated to pass `isAdmin`, but L510 (Discord re-sync) and L776 (background role sync) also call it | Added all three callsites explicitly in Step 4b (Section 9.2): L711 passes locally-computed `isAdmin`, L510 and L776 read `state.profile?.role` (safe — state is committed at those points). |
| R5-2 | Medium | Client-side `profiles.role` query is a policy risk — `profiles` only queried server-side historically; RLS may block client reads; no error handling specified | Added fail-closed policy in Step 3 (Section 9.2): try/catch with `console.warn` + telemetry on failure, `isAdmin` defaults to `false`. Documented RLS prerequisite. Added alternative approach (server endpoint `GET /api/members/admin-status`) if client-side `profiles` access is undesirable. |
| R5-3 | Low | Auth-layer mismatch documented as operational only — no technical mitigation for runtime divergence between `isAdminUser()` and `requireAdmin` | Added Phase 1 technical mitigation: page calls `GET /api/trade-day-replay/health` preflight on load; 403 → show "admin access not configured" message. Added Phase 2 recommendation: align `isAdminUser()` to also check `profiles.role`. Added health endpoint to Section 5.1 and proxy spec (Section 9.3). Updated Risks table. |
