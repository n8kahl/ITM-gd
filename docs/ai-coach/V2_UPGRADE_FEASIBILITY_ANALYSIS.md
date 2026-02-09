# V2 Upgrade Feasibility Analysis

## AI Coach ↔ Member/Admin Redesign Integration Assessment

**Document Version:** 1.0
**Date:** February 8, 2026
**Classification:** CTO / Sr. Engineer — Plan Only (No Implementation)

---

## 1. Executive Summary

This document compares the **TITM Member/Admin Redesign Spec v2** (134KB, 22 sections, 14-week roadmap) against the **current production AI Coach implementation** (43 backend files, 80+ frontend components, 15 AI functions, 34 REST endpoints, 13 database tables) to determine upgrade feasibility.

### Bottom Line

The V2 spec and AI Coach are **complementary but architecturally distinct**. The AI Coach is a deep vertical feature (conversational AI with function calling, market data, charts). The V2 spec is a broad horizontal platform redesign (dashboard, journal, social, admin). They share significant overlap in three areas — **Trade Journal, Massive.com Integration, and AI Analysis** — where careful merge planning is essential to avoid redundancy and regressions.

**Estimated Total Upgrade Effort:** 12–16 weeks (with 2 engineers), assuming AI Coach Phase 2 work packages are completed first or in parallel.

### Risk Rating: MODERATE

The upgrade is feasible but requires disciplined execution. The primary risks are:

- **Journal schema divergence** — V2 adds 10+ columns to `trading_journal_entries` that must coexist with AI Coach's existing journal queries
- **Massive.com integration duplication** — Both systems call Massive.com independently; must consolidate into a single service layer
- **Frontend state management conflict** — V2 assumes fresh MemberAuthContext; AI Coach has its own auth/state patterns
- **Design system migration** — V2's "Quiet Luxury" theme (glassmorphism, Playfair Display, emerald/champagne palette) will touch every existing component

---

## 2. Feature Overlap Matrix

### Legend
- ✅ **Fully Implemented** in current AI Coach
- 🔶 **Partially Implemented** — exists but needs enhancement for V2
- ❌ **Not Implemented** — new work required
- ⚠️ **Conflict** — V2 spec contradicts or duplicates existing implementation

| Feature Area | AI Coach Status | V2 Spec Requirement | Gap Assessment |
|---|---|---|---|
| **AI Chat Interface** | ✅ Full (multi-panel, function calling, 15 functions) | Integration points only (Section 10) | No gap — V2 defers to AI Coach |
| **Trade Journal — CRUD** | ✅ 6 endpoints (create, read, update, delete, list, stats) | Complete rewrite with filter bar, pagination, card/table views | 🔶 Backend exists, frontend needs major redesign |
| **Trade Journal — AI Analysis** | ✅ Screenshot Vision + structured analysis | Enhanced: market-context-enriched prompts, AI Grade system | 🔶 Existing analysis needs market context injection |
| **Trade Journal — Auto-Enrichment** | ❌ Not implemented | Full MarketContextSnapshot via Massive.com on every save | ❌ New backend service required |
| **Trade Journal — Trade Replay** | ❌ Not implemented | TradingView Lightweight Charts + 1-min bars + overlays | ❌ New component + API endpoint |
| **Trade Journal — One-Click Logging** | ❌ Not implemented | Live price feed → tap to record entry/exit | ❌ Requires SSE/WebSocket relay |
| **Trade Journal — Smart Auto-Tags** | ❌ Not implemented | 15+ rule engine analyzing MarketContextSnapshot | ❌ New backend service |
| **Trade Journal — Trade Verification** | ❌ Not implemented | Cross-reference prices against Massive.com 1-min bars | ❌ New backend service |
| **Trade Journal — Open Positions** | ❌ Not implemented | is_open flag, live P&L tracking, close button | ❌ New schema + UI + SSE |
| **Trade Journal — CSV Export** | ❌ Not implemented | Client-side generation respecting filters | ❌ New but straightforward |
| **Massive.com — REST API** | ✅ 7 methods with Redis caching | Same + enrichment + replay + verification endpoints | 🔶 Extend existing `massive.ts` |
| **Massive.com — WebSocket Relay** | ❌ Not implemented | Single backend WS → SSE broadcast to all members | ❌ New infrastructure |
| **Massive.com — Market Context Builder** | ❌ Not implemented | Calculate VWAP, ATR, levels, volume context from raw bars | ❌ New service (heaviest V2 feature) |
| **Social Trade Cards** | ❌ Not implemented | 5 templates, card builder, html-to-image, share actions | ❌ Entirely new feature area |
| **Member Dashboard** | 🔶 Basic (quick stats, recent trades) | Full redesign: live ticker, stat cards, equity curve, calendar heatmap, open positions, AI insights | 🔶 Exists minimally, needs major expansion |
| **Member Layout / Navigation** | 🔶 Sidebar + mobile nav exists | Redesigned 280px sidebar, mobile bottom nav, slide-over drawer, tab configuration | 🔶 Structural rewrite |
| **Design System** | 🔶 Emerald Standard (dark theme, Tailwind) | "Quiet Luxury" — glassmorphism, Playfair Display, Champagne accents, Framer Motion | ⚠️ Theme migration required |
| **Auth & RBAC** | ✅ Discord OAuth + Supabase JWT + RLS | Same core + unified MemberPermissions + TabConfig system | 🔶 Extend existing, add tab config |
| **Admin Dashboard** | ✅ Analytics, chat, leads, team, courses | Redesigned with command palette, activity feed, system diagnostics | 🔶 Visual redesign, add new widgets |
| **Admin Tab Configuration** | ❌ Not implemented | New page: drag-drop tab ordering per tier | ❌ New table + page + API |
| **Admin Journal Configuration** | ❌ Not implemented | Quick tags management, AI settings, rating config | ❌ New page + API |
| **Admin Analytics** | 🔶 Basic (traffic, clicks, conversions) | Enhanced: DAU/WAU/MAU, retention, feature usage, journal analytics | 🔶 Extend existing + new RPC functions |
| **SSE Streaming (AI Responses)** | ❌ Not implemented (in Phase 2 WP1) | Required for WebSocket relay + AI streaming | ❌ Already planned in Phase 2 |
| **Charts (Candlestick/OHLC)** | ✅ TradingView Lightweight Charts 5.1.0 | Same library for trade replay | ✅ Reuse existing |
| **Options Chain** | ✅ Live options viewer with Greeks | V2 mentions options context in enrichment | ✅ Already exceeds V2 needs |
| **LEAPS Tracker** | ✅ Full position tracking + Greeks projection | Not in V2 scope | ✅ Keep as-is |
| **Alert System** | 🔶 CRUD only, no monitoring worker | Not in V2 scope (Phase 2 WP3 covers this) | Phase 2 addresses this |
| **Screenshot Analysis** | 🔶 Vision works, not fed to chat context | V2 adds upload-to-storage + "Analyze with AI" in journal | 🔶 Extend existing |
| **Scan Opportunities** | ✅ Function calling → Massive.com scanner | Not in V2 scope | ✅ Keep as-is |
| **Macro/Swing Analysis** | ✅ Long-term trend + swing trade analysis | Not in V2 scope | ✅ Keep as-is |

---

## 3. Redundancy & Conflict Analysis

### 3.1 Critical Redundancies (Must Consolidate)

#### R1: Massive.com API Layer

**Current AI Coach:** `backend/src/config/massive.ts` — 7 methods with Redis caching (60-600s TTL), used by function handlers for real-time data during chat.

**V2 Spec:** Requires the same Massive.com data plus new endpoints for enrichment, replay, verification, and WebSocket relay.

**Redundancy Risk:** If V2 creates a separate Massive.com client, you'll have two competing cache strategies, two sets of error handling, and double the API calls.

**Recommendation:** Extend the existing `massive.ts` into a comprehensive `MassiveService` class with new methods:
- `getMinuteBars(symbol, date)` — for trade replay
- `getMarketContextSnapshot(symbol, entryTime, exitTime)` — for auto-enrichment
- `verifyPrice(symbol, timestamp, price)` — for trade verification
- `subscribeLivePrices(symbols)` — for WebSocket relay

All methods should share the existing Redis cache with appropriate TTLs.

**Effort:** 2-3 days to refactor + extend

---

#### R2: Trade Journal Backend

**Current AI Coach:** 6 journal endpoints in `backend/src/routes/journal.ts`:
- POST `/journal/entry` — create
- GET `/journal/entries` — list (with date range filtering)
- GET `/journal/entry/:id` — single entry
- PUT `/journal/entry/:id` — update
- DELETE `/journal/entry/:id` — delete
- GET `/journal/stats` — aggregate stats

The AI Coach also has a `get_trade_history` function that queries journal entries during chat conversations.

**V2 Spec:** Requires the same CRUD plus:
- Advanced filtering (symbol, direction, P&L, tags, AI grade, sort, pagination)
- Screenshot upload to Supabase Storage
- Auto-enrichment trigger on save
- Trade replay data endpoint
- One-click quick entry with live prices
- Close open position endpoint
- Smart tag suggestions endpoint
- CSV export

**Redundancy Risk:** V2's journal API could duplicate or conflict with existing endpoints. The `get_trade_history` AI function already queries the same table — schema changes must not break function calling.

**Recommendation:** Extend the existing journal routes (don't replace them). Add query parameter support for advanced filtering to the existing GET `/journal/entries` endpoint. Add new endpoints alongside existing ones. Update the `get_trade_history` function handler to include new columns (market_context, smart_tags, verification) in its responses so the AI Coach can reference enriched data during conversations.

**Effort:** 3-4 days to extend backend routes + update function handlers

---

#### R3: AI Analysis / Screenshot Pipeline

**Current AI Coach:** `backend/src/routes/screenshot.ts` provides GPT-4 Vision analysis. The result is returned but NOT persisted or fed into chat context. Phase 2 WP2 plans to fix this.

**V2 Spec:** "Analyze with AI" button in journal entry form calls GPT-4 Vision, returns structured `AITradeAnalysis` (grade, summary, strengths, improvements, coaching), auto-fills form fields, and stores the result in `trading_journal_entries.ai_analysis`.

**Redundancy Risk:** Two separate screenshot analysis pipelines could emerge — one for chat, one for journal.

**Recommendation:** Create a single `analyzeTradeScreenshot()` service function that:
1. Calls GPT-4 Vision (existing logic)
2. Returns structured `AITradeAnalysis` response
3. Optionally injects market context from Massive.com (V2 enhancement)
4. Can be called from both the journal "Analyze with AI" button AND the chat screenshot pipeline

Phase 2 WP2 (Screenshot-to-Chat) should be implemented first, then the journal analysis endpoint can reuse the same service.

**Effort:** 1-2 days (mostly reusing existing Vision code)

---

### 3.2 Moderate Redundancies (Plan Carefully)

#### R4: Member Dashboard

**Current AI Coach:** Basic dashboard at `/members` with quick stats and recent trades. Uses simple Supabase queries.

**V2 Spec:** Complete dashboard redesign with live market ticker, 5 stat cards, equity curve, calendar heatmap, quick actions, open positions, AI insights card.

**Recommendation:** This is a frontend rewrite, not a merge. The existing dashboard component can be archived. New dashboard components should use new Supabase RPC functions (`get_dashboard_stats`, `get_equity_curve`, `get_trading_calendar`) rather than inline queries.

**Effort:** 5-6 days (frontend-heavy)

---

#### R5: Member Layout & Navigation

**Current AI Coach:** Existing sidebar + mobile nav. MemberAuthContext handles permissions.

**V2 Spec:** Redesigned 280px sidebar pulling from `tab_configurations` table, mobile bottom nav (5 icons max), slide-over drawer. MemberPermissions interface replaces hardcoded tab lists.

**Recommendation:** This is the highest-risk change because it affects every member-facing page. Implement the `tab_configurations` table and API first, then migrate the layout. Use feature flags to toggle between old and new layouts during development.

**Effort:** 3-4 days

---

#### R6: Admin Platform

**Current AI Coach:** 11 admin sections (analytics, chat, leads, team, courses, knowledge base, settings, roles, etc.).

**V2 Spec:** Same sections plus new ones (tab config, journal config, social config, command palette, activity feed). Visual redesign of existing sections.

**Recommendation:** Admin is mostly additive. New pages (tabs, journal config, analytics enhancements) can be added without touching existing admin pages. Visual redesign (glassmorphism, typography) should happen in a single design system pass at the end.

**Effort:** 4-5 days for new pages, 2-3 days for visual redesign

---

### 3.3 No Conflict (Purely Additive)

These V2 features have zero overlap with AI Coach and can be built independently:

| Feature | Effort | Dependencies |
|---|---|---|
| Social Trade Cards (5 templates + builder) | 5-6 days | html-to-image library, journal entries |
| One-Click Trade Logging (live prices) | 3-4 days | WebSocket relay (must build first) |
| Trade Replay (TradingView chart + 1-min bars) | 3-4 days | Massive.com minute bars API |
| Smart Auto-Tags (rule engine) | 2-3 days | Market context enrichment (must build first) |
| Trade Verification (price matching) | 1-2 days | Massive.com minute bars API |
| Open Positions (live P&L tracking) | 2-3 days | WebSocket relay + journal schema update |
| Admin Command Palette (cmdk) | 1 day | None |
| Admin Activity Log | 1-2 days | New table + API |
| Admin Analytics Enhancement | 2-3 days | New RPC functions |
| Calendar Heatmap Widget | 1-2 days | New RPC function |
| Equity Curve Widget | 1-2 days | New RPC function |
| Journal CSV Export | 0.5 days | None |

---

## 4. Database Migration Strategy

### 4.1 Schema Changes Required

The V2 spec requires changes to the existing `trading_journal_entries` table and 5 new tables. These must be planned carefully to avoid breaking the 15 AI functions that query existing tables.

#### Existing Table Modifications

```sql
-- trading_journal_entries: ADD 10 columns
ALTER TABLE trading_journal_entries ADD COLUMN screenshot_storage_path TEXT;
ALTER TABLE trading_journal_entries ADD COLUMN share_count INTEGER DEFAULT 0;
ALTER TABLE trading_journal_entries ADD COLUMN market_context JSONB;
ALTER TABLE trading_journal_entries ADD COLUMN entry_timestamp TIMESTAMPTZ;
ALTER TABLE trading_journal_entries ADD COLUMN exit_timestamp TIMESTAMPTZ;
ALTER TABLE trading_journal_entries ADD COLUMN is_open BOOLEAN DEFAULT false;
ALTER TABLE trading_journal_entries ADD COLUMN smart_tags TEXT[] DEFAULT '{}';
ALTER TABLE trading_journal_entries ADD COLUMN verification JSONB;
ALTER TABLE trading_journal_entries ADD COLUMN enriched_at TIMESTAMPTZ;

-- journal_streaks: ADD 3 columns
ALTER TABLE journal_streaks ADD COLUMN best_ai_grade TEXT;
ALTER TABLE journal_streaks ADD COLUMN avg_ai_grade TEXT;
ALTER TABLE journal_streaks ADD COLUMN total_ai_analyses INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX idx_journal_open_positions
  ON trading_journal_entries(user_id, is_open) WHERE is_open = true;
CREATE INDEX idx_journal_unenriched
  ON trading_journal_entries(created_at) WHERE market_context IS NULL AND is_open = false;
CREATE INDEX idx_journal_smart_tags
  ON trading_journal_entries USING GIN(smart_tags);
```

#### New Tables (5)

1. **tab_configurations** — Admin-configurable member sidebar tabs (tab_id, label, icon, path, required_tier, badge, sort_order, mobile_visible)
2. **shared_trade_cards** — Social sharing records (entry_id, template, image_url, share_target, shared_at)
3. **journal_quick_tags** — Admin-managed predefined tags (name, category, sort_order, is_active)
4. **member_analytics_events** — Feature usage tracking (user_id, event_type, metadata, timestamp)
5. **admin_activity_log** — Admin action audit trail (admin_id, action, target, metadata, timestamp)

#### New RPC Functions (4)

1. `get_dashboard_stats(p_user_id, p_period)` — Aggregated member stats
2. `get_equity_curve(p_user_id, p_days)` — Cumulative P&L time series
3. `get_trading_calendar(p_user_id, p_months)` — Heatmap data
4. `get_admin_analytics(p_days)` — Admin dashboard aggregates

### 4.2 Migration Safety

**Risk:** The `trading_journal_entries` ALTER statements add nullable columns with defaults, so existing rows are unaffected. AI Coach function handlers that SELECT from this table will continue working — they just won't see the new columns unless updated.

**Recommendation:**
1. Run all ALTER TABLE statements in a single migration
2. Create new tables in a separate migration
3. Create RPC functions in a third migration
4. Update AI Coach function handlers to include new columns in responses (so the AI can reference market context, smart tags, verification status during conversations)
5. Add RLS policies to new tables

---

## 5. Upgrade Path — Recommended Phase Sequence

### Critical Dependency Chain

```
Phase 2 WP1 (SSE Streaming) ──────────────────────────┐
                                                        │
V2 Phase A (Database + Massive Service) ───┐           │
                                            │           │
V2 Phase B (WebSocket Relay) ──────────────┤── needs ──┘
                                            │
V2 Phase C (Journal Backend) ──────────────┤
                                            │
V2 Phase D (Enrichment + Tags + Verify) ───┘
                                            │
V2 Phase E (Journal Frontend) ─────────────┘
                                            │
V2 Phase F (Dashboard) ────────────────────┘
                                            │
V2 Phase G (Social Cards) ─────────────────┘  (independent)
                                            │
V2 Phase H (Admin Features) ───────────────┘  (independent)
                                            │
V2 Phase I (Design System) ────────────────┘  (last)
```

### Phase A: Database Foundation & Massive.com Service Extension (Week 1)

**Effort:** 3–4 days | **Risk:** Low | **Breaking Changes:** None

| Task | Details |
|---|---|
| Run schema migrations | 5 new tables + ALTER TABLE additions + indexes |
| Create RPC functions | 4 dashboard/analytics functions |
| Seed tab_configurations | Default 6 tabs |
| Seed journal_quick_tags | Default tag categories |
| Extend `massive.ts` | Add `getMinuteBars()`, `getMarketContextSnapshot()`, `verifyPrice()` methods |
| Add Redis cache keys | New TTLs for minute bars (24hr), context snapshots (1hr) |
| Update AI Coach function handlers | Include new columns in `get_trade_history` response |

**Acceptance Criteria:**
- All migrations run cleanly with rollback scripts
- Existing AI Coach backend tests still pass (373 tests, 22 suites)
- New Massive.com methods return data for any valid ticker symbol (not limited to specific indices)
- RPC functions return expected aggregates
- AI Coach `get_trade_history` function includes new columns (market_context, smart_tags, verification) in responses
- AI Coach system prompt references market context data when available in journal entries

---

### Phase B: WebSocket Relay & SSE Infrastructure (Week 2)

**Effort:** 4–5 days | **Risk:** Medium | **Breaking Changes:** None

**Prerequisite:** AI Coach Phase 2 WP1 (SSE Streaming) should be completed first or in parallel, as it establishes the SSE pattern.

| Task | Details |
|---|---|
| Build WebSocket relay service | Backend maintains Massive.com WS connection(s) for user-subscribed tickers (any symbol) |
| Create SSE broadcast endpoint | GET `/api/market/live` — streams LivePriceUpdate events to connected members |
| Add reconnection logic | Exponential backoff (5 attempts, 2s base) |
| Add fallback polling | 5-second REST polling if WS unavailable |
| Connection management | Track connected SSE clients, clean up on disconnect |
| Health endpoint | GET `/api/market/health` — WS connection status |
| Massive.com WS authentication | Subscription management + error handling |

**Acceptance Criteria:**
- WebSocket connects to Massive.com and receives price updates
- SSE endpoint streams updates to multiple concurrent clients
- Automatic reconnection after disconnection
- Fallback polling works when WS is down
- No impact on existing AI Coach routes

---

### Phase C: Journal Backend Extension (Week 3)

**Effort:** 3–4 days | **Risk:** Medium | **Breaking Changes:** Low (additive)

| Task | Details |
|---|---|
| Extend GET `/journal/entries` | Add query params: symbol, direction, pnl_filter, tags, ai_grade, sort_by, page, limit |
| Add POST `/journal/upload-screenshot` | Upload to Supabase Storage `trade-screenshots/{user_id}/{entry_id}/` |
| Add POST `/journal/enrich/:id` | Trigger Massive.com enrichment, store MarketContextSnapshot |
| Add GET `/journal/replay/:id` | Return 1-min OHLCV bars + overlays for trade replay |
| Add POST `/journal/quick-entry` | One-click log with live price capture |
| Add PATCH `/journal/close/:id` | Close open position with exit price + timestamp |
| Add GET `/journal/smart-tags/:id` | Run smart tag rules against market context |
| Add GET `/journal/tags` | Unique tags autocomplete |
| Update journal create/update | Save entry_timestamp, exit_timestamp, is_open flag |

**Acceptance Criteria:**
- Advanced filtering returns correct results with pagination
- Screenshot uploads to Supabase Storage and path saved to entry
- Enrichment populates market_context JSONB with full MarketContextSnapshot
- Replay endpoint returns 1-min bars with entry/exit markers
- Existing journal endpoints still work identically
- AI Coach `get_trade_history` function still works

---

### Phase D: Auto-Enrichment, Smart Tags & Verification (Week 4)

**Effort:** 3–4 days | **Risk:** Medium | **Breaking Changes:** None

| Task | Details |
|---|---|
| Build enrichment service | `services/market/enrichment.ts` — fetches bars, calculates VWAP, ATR, levels, volume context |
| Build smart tag engine | `services/market/smartTags.ts` — 15+ rules analyzing MarketContextSnapshot |
| Build verification service | `services/market/verification.ts` — cross-reference prices against 1-min bars |
| Wire enrichment into journal save | After create/update, trigger async enrichment |
| Build enriched AI analysis prompt | Inject MarketContextSnapshot into GPT-4 analysis requests |
| Update AI Coach screenshot analysis | Reuse enriched prompt when analyzing journal screenshots |
| Background enrichment for existing entries | One-time backfill script for entries with no market_context |

**Acceptance Criteria:**
- Every saved journal entry gets MarketContextSnapshot within 5 seconds
- Smart tags correctly identify PDH Break, VWAP Play, High Volume, etc.
- Verification matches entry/exit prices within $1 of Massive.com 1-min bar range
- AI analysis prompts include real market data (not generic feedback)
- Enrichment doesn't block the save response (async)

---

### Phase E: Journal Frontend Redesign (Weeks 5–7)

**Effort:** 8–10 days | **Risk:** Medium-High | **Breaking Changes:** Frontend only

> **Note:** This is the largest single phase. Consider splitting into E1 (filter bar, table/card views, stats row — 4 days) and E2 (entry/detail sheets, trade replay, market context panel — 4-6 days).

| Task | Details |
|---|---|
| Filter bar component | Date range, symbol, direction, P&L, tags, AI grade, sort, view toggle |
| Summary stats row | 8 horizontal scroll cards with aggregate data |
| Sortable data table | 12 columns, sticky header, colored left borders, click-to-expand |
| Card view | Grid layout, responsive, mobile-optimized |
| New/edit entry sheet | Full-screen sheet with screenshot upload, AI analysis, quick tags, tabbed notes |
| Entry detail sheet | Trade replay chart, market context panel, verification badge, AI analysis |
| Trade replay component | TradingView Lightweight Charts with 1-min bars, play/pause/speed controls |
| Market context panel | Visual display of enrichment data (levels, volume, VWAP) |
| Smart tag suggestions | Sparkle-icon suggested pills after enrichment |
| One-click logging | Live price feed integration, tap-to-record entry/exit |
| CSV export button | Client-side generation respecting filters |
| Open positions tracking | Live P&L via SSE, close position button |

**Acceptance Criteria:**
- Journal page loads in < 800ms
- Filter responses in < 200ms (client-side)
- Table supports sorting on all sortable columns
- Card view renders correctly on mobile
- Trade replay plays back 1-min bars smoothly at 1x/2x/5x/10x
- Screenshot upload + AI analysis flow works end-to-end
- Existing AI Coach chat still references journal entries correctly

---

### Phase F: Member Dashboard Redesign (Week 7)

**Effort:** 4–5 days | **Risk:** Low-Medium | **Breaking Changes:** Frontend only

| Task | Details |
|---|---|
| Live market ticker | SSE-powered price display for user-watchlisted tickers with connection indicator |
| Stat cards row | Win Rate, P&L MTD, Streak, AI Grade, Trades MTD |
| Equity curve chart | Recharts AreaChart with time range selector |
| Calendar heatmap | GitHub-style 6-month trading activity visualization |
| Quick actions | Log Trade, Ask AI Coach, Share Last Win |
| Recent trades | Last 5 journal entries as compact cards |
| AI insights card | Aggregated AI analysis patterns + "Chat with Coach" CTA |
| Open positions widget | Live unrealized P&L for unclosed entries |
| Market status indicator | Pre-market / Open / After Hours / Closed |

**Acceptance Criteria:**
- Dashboard loads in < 500ms
- Live ticker updates every 1 second via SSE
- All stat cards show correct aggregated data
- Equity curve renders smoothly with time range switching
- Calendar heatmap correctly colors trading days by P&L

---

### Phase G: Social Trade Cards (Week 9)

**Effort:** 5–6 days | **Risk:** Low | **Breaking Changes:** None

**Dependencies:** Phase D (enrichment data for market context overlays) and Phase E (journal UI for entry selection). Should be built after Phase E, not in parallel.

| Task | Details |
|---|---|
| 5 card templates | Dark Elite, Emerald Gradient, Champagne Premium, Minimal, Story (9:16) |
| Card builder modal | Live preview (60%) + controls (40%), show/hide toggles |
| html-to-image generation | Trade card → PNG at 2x retina resolution |
| Share actions | Download PNG, copy to clipboard, share to Twitter/X, share to Discord |
| Market context overlays | Optional: verified badge, level proximity bar, IV data, mini sparkline |
| Share tracking | Log share events to shared_trade_cards table |
| Gallery page (optional) | Public gallery with filters — can defer to later |

**Acceptance Criteria:**
- All 5 templates render correctly at specified dimensions
- Card generation completes in < 2 seconds
- Show/hide toggles update live preview in real-time
- Download produces high-quality retina PNG
- Share to Twitter opens compose with pre-filled text

---

### Phase H: Admin Platform Enhancements (Weeks 9–10)

**Effort:** 5–6 days | **Risk:** Low | **Breaking Changes:** None

| Task | Details |
|---|---|
| Tab Configuration page | Drag-drop sortable tabs, per-tier enable/disable, live preview, badge config |
| Journal Configuration page | Quick tags management, AI settings, rating system config |
| Command palette (cmdk) | Cmd+K, quick commands, recent items |
| Admin analytics enhancement | DAU/WAU/MAU, retention, feature usage, journal analytics |
| Activity log viewer | Chronological admin action feed with type icons |
| Admin dashboard widgets | System diagnostics, activity feed, enhanced stat cards |
| Enrichment status dashboard | View enrichment backfill progress, re-trigger failed entries |

**Acceptance Criteria:**
- Tab configuration changes reflect immediately for members
- Journal quick tags are manageable from admin panel
- Command palette finds all admin pages and actions
- Analytics show accurate DAU/WAU/MAU calculations

---

### Phase I: Design System Migration (Week 11)

**Effort:** 3–4 days | **Risk:** Medium | **Breaking Changes:** Visual only

This should be the **last phase** to avoid disrupting development of functional features.

| Task | Details |
|---|---|
| Typography migration | Add Playfair Display (titles), keep Inter (body), add Geist Mono (data) |
| Color token update | Emerald Elite, Champagne, glassmorphism backgrounds |
| Glass card components | GlassCard, HeavyGlassCard, StatCard primitives |
| Animation system | Framer Motion page transitions, card enter, hover lift, skeleton loading |
| Skeleton loading states | Shimmer gradient animation for all data-dependent components |
| Mobile optimizations | Reduced blur (20px mobile vs 40-60px desktop) |
| Dark mode polish | Ensure all components work with Onyx (#0A0A0B) background |

**Acceptance Criteria:**
- All pages use consistent typography scale
- Glassmorphism renders correctly across browsers
- Animations hit 60fps on mid-range devices
- FCP < 1.5s, LCP < 2.5s, TTI < 3.0s
- No visual regressions in existing admin pages

---

## 6. Effort Summary

| Phase | Scope | Effort (Days) | Risk | Dependencies |
|---|---|---|---|---|
| **A** | Database + Massive.com Extension | 3–4 | Low | None |
| **B** | WebSocket Relay + SSE | 4–5 | Medium | Phase 2 WP1 |
| **C** | Journal Backend Extension | 3–4 | Medium | Phase A |
| **D** | Enrichment + Tags + Verification | 3–4 | Medium | Phase A, C |
| **E** | Journal Frontend Redesign | 8–10 | Medium-High | Phase C, D |
| **F** | Dashboard Redesign | 4–5 | Low-Medium | Phase B (for ticker) |
| **G** | Social Trade Cards | 5–6 | Low | Phase D, E |
| **H** | Admin Enhancements | 5–6 | Low | Phase A (for tables) |
| **I** | Design System Migration | 4–5 | Medium | All prior phases |
| | **TOTAL** | **39–49 days** | | |

With **2 engineers working in parallel**, critical path is approximately **12–14 weeks** (Phases B+F can parallel C+D, Phase H can parallel E).

With **1 engineer**, estimate **14–16 weeks** sequential.

### Parallel Execution Strategy (2 Engineers)

```
Engineer 1 (Backend-focused):    Engineer 2 (Frontend-focused):
Week 1:  Phase A (DB + Massive)  Week 1:  Phase 2 WP1 (SSE)
Week 2:  Phase C (Journal API)   Week 2:  Phase B (WebSocket Relay)
Week 3:  Phase D (Enrichment)    Week 3:  Phase F (Dashboard)
Week 4-6: Phase H (Admin)        Week 4-7: Phase E (Journal Frontend)
Week 7:  Support + Testing       Week 8:  Phase G (Social Cards)
                                  Week 9:  Phase I (Design System)
Weeks 10-11: Integration testing, bug fixes, performance optimization
```

---

## 7. What NOT to Build (Already Done in AI Coach)

These features exist in the current AI Coach and should be preserved as-is. The V2 spec either doesn't mention them or explicitly defers to the AI Coach's existing implementation:

| Feature | Current Status | V2 Spec Treatment |
|---|---|---|
| 15 AI function definitions | Production, tested | Not in V2 scope — "integration points only" |
| Function calling with GPT-4 | Production, circuit-breaker wrapped | V2 uses AI Coach as a service |
| Key Levels (Pivot, Camarilla, Fibonacci) | Production, Massive.com + Redis | Keep as-is |
| Options Chain viewer | Production, live Greeks | Keep as-is |
| LEAPS Position Tracker | Production, projection charts | Keep as-is |
| Scan Opportunities | Production, configurable scanner | Keep as-is |
| Macro Context Analysis | Production, cross-symbol | Keep as-is |
| Swing Trade Analysis | Production | Keep as-is |
| Roll Decision Calculator | Production | Keep as-is |
| Chat history & session management | Production, Supabase realtime | Keep as-is |
| Rate limiting (100/min general, 20/min chat) | Production | Keep as-is |
| Zod validation middleware | Production | Extend for new routes |
| Circuit breaker (OpenAI calls) | Production | Keep as-is |
| Health/readiness endpoints | Production | Keep as-is |
| Admin Chat viewer | Production | Keep as-is |
| Course & Knowledge Base | Production | Keep as-is |

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Journal schema migration breaks AI Coach function queries | Medium | High | Test all 15 function handlers against new schema before deploying migration |
| 2 | WebSocket relay consumes excessive server memory | Low | High | Implement connection pooling, max client limits, heartbeat cleanup |
| 3 | Auto-enrichment overwhelms Massive.com API quota | Low | Medium | Queue enrichment requests, batch where possible, respect rate limits |
| 4 | Glassmorphism design causes performance issues on mobile | Medium | Medium | Reduce blur values on mobile (20px vs 60px), test on mid-range devices |
| 5 | Trade replay component conflicts with existing chart component | Low | Medium | Both use TradingView Lightweight Charts — ensure different instance IDs |
| 6 | Frontend state management conflict (MemberAuthContext refactor) | Medium | High | Feature flag the new TabConfig system, maintain backward compatibility |
| 7 | html-to-image (trade cards) has browser compatibility issues | Medium | Low | Test across Chrome, Safari, Firefox; fallback to canvas-based rendering |
| 8 | One-click logging with live prices causes race conditions | Medium | Medium | Use optimistic UI with server-side price confirmation within 5-second window |
| 9 | Market context enrichment adds latency to journal saves | Low | Medium | Make enrichment fully async (don't block save response) |
| 10 | Admin tab configuration breaks member navigation | Medium | High | Validate tab config before saving; require at least dashboard + profile tabs |
| 11 | AI Coach function handlers don't reference new enrichment columns | Medium | Medium | Update `get_trade_history` to include market_context; update system prompt to reference enriched data |
| 12 | Enrichment backfill fails silently for historical entries | Medium | Medium | Create enrichment status tracking; add admin panel view; allow manual re-trigger |
| 13 | Trade card image generation timeout on slow networks | Medium | Low | Preload fonts (Playfair, Geist Mono); 5-second timeout with system font fallback |
| 14 | Trade replay chart unusable on mobile viewports | Medium | Low | Collapsible replay controls on mobile; minimum chart height 200px |

---

## 9. AI Coach Phase 2 Prerequisites

The following AI Coach Phase 2 Work Packages (from `PHASE_2_IMPLEMENTATION_SPEC.md`) should be completed **before or during** V2 upgrade work:

| Work Package | Why It's a Prerequisite |
|---|---|
| **WP1: SSE Streaming** | V2's WebSocket relay and live market ticker depend on SSE infrastructure |
| **WP2: Screenshot-to-Chat** | V2's "Analyze with AI" in journal should reuse the same Vision pipeline |
| **WP5: Sentry Integration** | Error monitoring is critical before adding 30+ new endpoints |

These can be deferred and are **not prerequisites**:

| Work Package | Why It Can Wait |
|---|---|
| **WP3: Alert Monitoring Worker** | Independent feature, not referenced by V2 spec |
| **WP4: User Profile & Preferences** | Nice-to-have, V2 doesn't depend on it |
| **WP6: Frontend Polish & E2E** | Will be superseded by V2 frontend work |

---

## 10. Recommended Approach Summary

### Strategy: Extend, Don't Replace

The AI Coach backend is production-hardened with 373 passing tests, circuit breakers, rate limiting, and Zod validation. The V2 upgrade should:

1. **EXTEND** existing backend services (Massive.com, journal routes, auth)
2. **ADD** new backend services (enrichment, smart tags, verification, WebSocket relay)
3. **REWRITE** frontend components (journal page, dashboard, member layout) using V2 designs
4. **ADD** new frontend features (trade cards, trade replay, one-click logging)
5. **PRESERVE** all AI Coach chat functionality untouched
6. **APPLY** design system changes last, in a single pass

### What Changes vs. What Stays

```
BACKEND (mostly extend):
  ├── massive.ts .................. EXTEND (add 4 new methods)
  ├── routes/journal.ts ........... EXTEND (add 8 new endpoints)
  ├── routes/market.ts ............ NEW (5 endpoints)
  ├── services/enrichment.ts ...... NEW
  ├── services/smartTags.ts ....... NEW
  ├── services/verification.ts .... NEW
  ├── services/websocketRelay.ts .. NEW
  ├── chatkit/functions.ts ........ NO CHANGE
  ├── chatkit/functionHandlers.ts . MINOR UPDATE (include new columns)
  ├── routes/chat.ts .............. NO CHANGE
  ├── routes/options.ts ........... NO CHANGE
  ├── routes/levels.ts ............ NO CHANGE
  ├── routes/leaps.ts ............. NO CHANGE
  ├── routes/chart.ts ............. NO CHANGE
  ├── routes/alerts.ts ............ NO CHANGE
  ├── routes/macro.ts ............. NO CHANGE
  ├── middleware/*.ts .............. NO CHANGE (extend Zod schemas)
  └── server.ts ................... MINOR UPDATE (register new routes)

FRONTEND (mostly rewrite/add):
  ├── app/members/page.tsx ........ REWRITE (dashboard)
  ├── app/members/journal/ ........ REWRITE (journal page)
  ├── app/members/layout.tsx ...... REWRITE (sidebar + nav)
  ├── components/journal/* ........ NEW (12+ components)
  ├── components/dashboard/* ...... NEW (10+ components)
  ├── components/social/* ......... NEW (6+ components)
  ├── components/members/* ........ NEW (4 layout components)
  ├── app/admin/tabs/ ............. NEW
  ├── app/admin/journal-config/ ... NEW
  ├── app/admin/analytics/ ........ REWRITE
  ├── components/ui/chat-widget.tsx NO CHANGE
  ├── components/ui/message-bubble. NO CHANGE
  ├── components/ai-coach/* ....... NO CHANGE
  └── app/admin/chat/ ............. NO CHANGE

DATABASE:
  ├── trading_journal_entries ..... ALTER (add 10 columns)
  ├── journal_streaks ............. ALTER (add 3 columns)
  ├── tab_configurations .......... NEW TABLE
  ├── shared_trade_cards .......... NEW TABLE
  ├── journal_quick_tags .......... NEW TABLE
  ├── member_analytics_events ..... NEW TABLE
  └── admin_activity_log .......... NEW TABLE
```

---

## 11. Definition of Done

The V2 upgrade is complete when:

1. All 5 new database tables created with RLS policies
2. All 10 new columns added to trading_journal_entries
3. All 4 new RPC functions created and tested
4. Massive.com service extended with enrichment, replay, and verification
5. WebSocket relay operational for any ticker symbol (not hardcoded to specific indices)
6. Journal page fully redesigned with all V2 features (filter, table/cards, entry/detail sheets, replay, enrichment, smart tags, verification, export)
7. Dashboard redesigned with live ticker, stat cards, equity curve, calendar heatmap, and AI insights
8. Social trade card builder operational with all 5 templates
9. Admin tab configuration, journal configuration, and enhanced analytics pages operational
10. Design system migration complete (typography, colors, glassmorphism, animations)
11. All existing AI Coach backend tests still pass (373+ tests)
12. New features have test coverage (unit + integration)
13. FCP < 1.5s, LCP < 2.5s, TTI < 3.0s on Lighthouse
14. Mobile-responsive across all new pages
15. No regressions in AI Coach chat, options, LEAPS, scanner, or macro features
