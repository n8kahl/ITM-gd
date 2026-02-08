# AI Coach - Status Assessment & Completion Plan

**Date**: 2026-02-08
**Prepared by**: Claude Code (Autonomous Review)
**Branch**: `claude/review-ai-coach-plan-j7xlp`

---

## Executive Summary

The AI Coach implementation is **approximately 35-40% complete** when measured against the full 13-phase Implementation Roadmap. The foundational backend (Phases 0-3) and basic frontend (Phases 2-3) are solidly built. Options analysis has backend-only coverage. Everything from Phase 4 onward (Card Widgets, Screenshot Analysis, Trade Journal integration, Alerts, Scanner, Swing/LEAPS) remains unbuilt on the frontend and largely unbuilt end-to-end.

**What works today**: A user can open the AI Coach tab, chat with the AI about key levels (PDH, VWAP, pivots, ATR), and view annotated candlestick charts in the center panel. The backend can also fetch options chains and analyze positions, but this isn't exposed in the UI yet.

---

## Phase-by-Phase Status

### Phase 0: Foundation & Planning — COMPLETE

| Item | Status |
|------|--------|
| Master specification document | Done |
| Implementation roadmap | Done |
| Database schema design | Done |
| API contracts | Done |
| System prompt design | Done |
| Cost analysis | Done |
| Center column UI/UX spec | Done |
| Calculations documentation | Done |

**Notes**: All 15 documentation files are comprehensive and production-quality. The documentation is a strong asset.

---

### Phase 1: Levels Engine MVP — COMPLETE

| Component | Status | Files |
|-----------|--------|-------|
| Express.js backend server | Done | `backend/src/server.ts` |
| Supabase database connection | Done | `backend/src/config/database.ts` |
| Redis caching layer | Done | `backend/src/config/redis.ts` |
| Massive.com API client | Done | `backend/src/config/massive.ts` |
| Health check endpoints | Done | `backend/src/routes/health.ts` |
| Data fetcher (daily, minute, pre-market) | Done | `backend/src/services/levels/fetcher.ts` |
| Previous Day levels (PDH/PDL/PDC/PWH/PWL) | Done | `backend/src/services/levels/calculators/previousDay.ts` |
| Pre-Market levels (PMH/PML) | Done | `backend/src/services/levels/calculators/premarket.ts` |
| Pivots (Standard, Camarilla, Fibonacci) | Done | `backend/src/services/levels/calculators/pivots.ts` |
| VWAP (cumulative + bands) | Done | `backend/src/services/levels/calculators/vwap.ts` |
| ATR (Wilder's smoothing, 7/14/21 periods) | Done | `backend/src/services/levels/calculators/atr.ts` |
| Levels orchestrator + caching | Done | `backend/src/services/levels/index.ts`, `cache.ts` |
| Levels API route | Done | `backend/src/routes/levels.ts` |
| Unit tests (pivots, ATR) | Done | 2 test files, 19+ tests |

**Known gaps**:
- `testsToday` is hardcoded to 0 (level-test tracking not implemented)
- DST handling is simplified (UTC-5 always, no daylight saving adjustment)
- No holiday calendar (simple weekend-skip only)
- TradingView validation not performed (requires live API keys)

---

### Phase 2: Basic AI Chat — COMPLETE

| Component | Status | Files |
|-----------|--------|-------|
| OpenAI GPT-4 client config | Done | `backend/src/config/openai.ts` |
| System prompt (personality, rules) | Done | `backend/src/chatkit/systemPrompt.ts` |
| Function definitions (6 tools) | Done | `backend/src/chatkit/functions.ts` |
| Function handlers | Done | `backend/src/chatkit/functionHandlers.ts` |
| Chat service (session mgmt, function calling loop) | Done | `backend/src/chatkit/chatService.ts` |
| Chat API routes (message, sessions, delete) | Done | `backend/src/routes/chat.ts` |
| Auth middleware (JWT + query limits) | Done | `backend/src/middleware/auth.ts` |
| Function handler tests | Done | 1 test file, 17+ tests |
| **Frontend** AI Coach page (responsive layout) | Done | `app/members/ai-coach/page.tsx` |
| **Frontend** Chat panel (sessions, messages, input) | Done | `components/ai-coach/chat-panel.tsx` |
| **Frontend** Message bubbles (markdown, function badges) | Done | `components/ai-coach/message-bubble.tsx` |
| **Frontend** Chat hook (state mgmt, chart requests) | Done | `hooks/use-ai-coach-chat.ts` |
| **Frontend** API client (typed HTTP calls) | Done | `lib/api/ai-coach.ts` |

**Known gaps**:
- Message history not loaded when selecting existing sessions (code comment: "Phase 2 feature")
- No streaming responses (full response only)

---

### Phase 3: Center Panel - Charts — COMPLETE

| Component | Status | Files |
|-----------|--------|-------|
| Backend chart data route (OHLCV candles) | Done | `backend/src/routes/chart.ts` |
| **Frontend** Center panel (welcome + chart views) | Done | `components/ai-coach/center-panel.tsx` |
| **Frontend** Trading chart (Lightweight Charts) | Done | `components/ai-coach/trading-chart.tsx` |
| **Frontend** Chart toolbar (symbol/timeframe) | Done | `components/ai-coach/chart-toolbar.tsx` |
| Candlestick + volume rendering | Done | Inside `trading-chart.tsx` |
| Level annotations (support/resistance/VWAP) | Done | Inside `center-panel.tsx` + `trading-chart.tsx` |
| Multi-timeframe (1m, 5m, 15m, 1h, 4h, 1D) | Done | Toolbar + API |
| AI-triggered chart display (`show_chart` function) | Done | Hook detects function call, passes to center panel |

**Known gaps**:
- No WebSocket real-time updates (polling/manual refresh only)
- No multi-timeframe grid view (single chart only)
- No volume profile visualization
- Symbols limited to SPX/NDX (hardcoded in toolbar)

---

### Phase 4: Card Widgets — NOT STARTED

| Component | Status |
|-----------|--------|
| Card widget framework | Not built |
| Key Levels Dashboard card (in chat) | Not built |
| Position Summary card | Not built |
| P&L Tracker card | Not built |
| Alert Status card | Not built |
| WebSocket subscriptions for live updates | Not built |
| Click-to-expand (card → center panel) | Not built |
| AI-aware card selection logic | Not built |

**Notes**: The center panel's welcome view lists these as "Coming Soon". No component code exists.

---

### Phase 5: Options Analysis — BACKEND ONLY (50%)

| Component | Status | Files |
|-----------|--------|-------|
| Options chain fetcher | Done | `backend/src/services/options/optionsChainFetcher.ts` |
| Black-Scholes model | Done | `backend/src/services/options/blackScholes.ts` |
| Position analyzer (single + portfolio) | Done | `backend/src/services/options/positionAnalyzer.ts` |
| Type definitions | Done | `backend/src/services/options/types.ts` |
| Options API routes | Done | `backend/src/routes/options.ts` |
| AI functions (get_options_chain, analyze_position) | Done | Registered in `functions.ts` |
| Unit tests (Black-Scholes, position analyzer) | Done | 2 test files, 24+ tests |
| **Frontend** Options chain viewer | Not built |
| **Frontend** Greeks visualizations (Delta curve, IV smile) | Not built |
| **Frontend** Position analysis dashboard | Not built |
| **Frontend** Manual position entry form | Not built |
| **Frontend** Portfolio Greeks aggregation view | Not built |

---

### Phase 6: Screenshot Analysis — NOT STARTED

| Component | Status |
|-----------|--------|
| File upload in chat interface | Not built |
| OpenAI Vision API integration in backend | Not built |
| Position extraction logic | Not built |
| Confidence scoring | Not built |
| User review/confirm flow | Not built |
| Multi-broker support (TastyTrade, ToS, IBKR, etc.) | Not built |

**Notes**: A Supabase edge function `analyze-trade-screenshot` exists separately, but it's not integrated with the AI Coach backend or frontend.

---

### Phase 7: Trade Journal — SCHEMA ONLY (15%)

| Component | Status |
|-----------|--------|
| Database table (ai_coach_trades) | Done (migration) |
| Auto-create trade from closed position (trigger) | Done (migration) |
| Trade journal API routes | Not built |
| Manual trade entry form | Not built |
| CSV import (broker formats) | Not built |
| Performance analytics engine | Not built |
| Analytics dashboard (equity curve, heatmaps) | Not built |
| AI integration (query trade history, provide insights) | Not built |

**Notes**: A separate `/members/journal` feature exists in the frontend but it's an independent system, not connected to the AI Coach.

---

### Phase 8: Real-Time Alerts — SCHEMA ONLY (10%)

| Component | Status |
|-----------|--------|
| Database table (ai_coach_alerts) | Done (migration) |
| Alert configuration API | Not built |
| Background monitoring worker | Not built |
| Notification service (push, email, in-chat) | Not built |
| Alert configuration UI | Not built |
| WebSocket for real-time delivery | Not built |
| Contextual alert messages | Not built |
| Hysteresis / spam prevention | Not built |

---

### Phase 9: Opportunity Scanner — NOT STARTED

| Component | Status |
|-----------|--------|
| Technical scanning algorithms | Not built |
| Options-based scanners | Not built |
| Scheduled scan jobs (BullMQ/cron) | Not built |
| Opportunity scoring system | Not built |
| Opportunity cards in chat | Not built |
| Filter configuration UI | Not built |

---

### Phase 10: Swing & LEAPS Module — NOT STARTED

| Component | Status |
|-----------|--------|
| Weekly/monthly data fetching | Not built |
| LEAPS position tracker | Not built |
| Macro context integration | Not built |
| Roll calculator | Not built |

---

### Phase 11-13: Beta Launch, Public Launch, Training Materials — NOT STARTED

These are operational milestones that depend on feature completion.

---

## Database Schema Status

All 7 AI Coach tables are **fully migrated** with RLS policies and triggers:

| Table | Schema | RLS | Triggers | Used by Code |
|-------|--------|-----|----------|-------------|
| ai_coach_users | Done | Done | — | Yes (auth middleware) |
| ai_coach_sessions | Done | Done | — | Yes (chat service) |
| ai_coach_messages | Done | Done | increment_count | Yes (chat service) |
| ai_coach_positions | Done | Done | metrics, to_trade | Partially (backend routes exist, no frontend) |
| ai_coach_trades | Done | Done | — | No (schema only) |
| ai_coach_alerts | Done | Done | — | No (schema only) |
| ai_coach_levels_cache | Done | N/A | — | Yes (cache fallback) |

---

## Test Coverage

| Test File | Tests | Area |
|-----------|-------|------|
| `pivots.test.ts` | 19 | Standard, Camarilla, Fibonacci pivots |
| `atr.test.ts` | 6 | ATR calculations |
| `blackScholes.test.ts` | 12 | Option pricing, Greeks, IV |
| `positionAnalyzer.test.ts` | 12 | Position analysis, portfolio Greeks |
| `functionHandlers.test.ts` | 17 | All 6 AI function handlers |
| **Total** | **66+** | |

Frontend has no automated tests. E2E tests exist for auth/admin flows but not for the AI Coach.

---

## Completion Plan

### Priority Order

The roadmap's original 48-52 week timeline assumed a team of 3-4 developers. The implementation so far has been done autonomously by Claude Code. The plan below is ordered by **user value** and **dependency chain**:

### Work Package 1: Options Chain UI (Phase 5 Frontend)

**Why first**: Backend is 100% done. This is the highest-value net-new feature requiring only frontend work.

**Tasks**:
1. **Options chain viewer component** — Table displaying calls/puts by strike with Greeks columns (Delta, Gamma, Theta, Vega, IV)
2. **Expiration date selector** — Dropdown using `GET /api/options/:symbol/expirations`
3. **Strike range filter** — Slider or input for min/max strikes
4. **ATM/ITM/OTM highlighting** — Color-code moneyness
5. **Position entry form** — Modal to manually enter positions (symbol, type, strike, expiry, quantity, entry price)
6. **Position analysis view** — Display P&L, Greeks, max gain/loss, breakeven from `POST /api/options/analyze`
7. **Portfolio Greeks summary** — Aggregate net Delta/Gamma/Theta/Vega across open positions
8. **Center panel integration** — Add "Options" tab to center panel, AI can trigger via `get_options_chain` function
9. **Greeks visualizations** (stretch) — Delta curve chart, IV smile chart

**Dependencies**: None (backend ready)

---

### Work Package 2: Card Widgets (Phase 4)

**Why second**: Transforms the chat experience from text-only to rich interactive cards.

**Tasks**:
1. **Card widget framework** — Reusable `<WidgetCard>` component that embeds in message bubbles
2. **Key Levels card** — Show current price, nearest resistance/support with distances, ATR context
3. **Position Summary card** — Show position details, P&L, Greeks in compact format
4. **P&L Tracker card** — Total portfolio P&L with mini sparkline
5. **Alert Status card** — Active alerts with status indicators
6. **Card rendering in messages** — Detect when AI response includes structured widget data, render card instead of/alongside text
7. **Click-to-expand** — Clicking a card opens the detailed view in center panel
8. **Live update subscription** — Cards update in real-time (start with polling, migrate to WebSocket)

**Dependencies**: Position entry form from WP1 (for position/P&L cards)

---

### Work Package 3: Chat History & Session Polish

**Why third**: Quality-of-life improvement that makes the existing chat usable for returning users.

**Tasks**:
1. **Backend endpoint** — `GET /api/chat/sessions/:id/messages` to fetch message history
2. **Frontend integration** — Load messages when selecting a session in sidebar
3. **Session title generation** — Auto-title sessions from first user message (backend)
4. **Streaming responses** — Implement SSE/streaming for AI responses (better UX for long answers)
5. **Message search** — Search across sessions

**Dependencies**: None

---

### Work Package 4: Screenshot Analysis (Phase 6)

**Why fourth**: High-value feature that dramatically reduces manual position entry friction.

**Tasks**:
1. **File upload component** — Drag-and-drop or click-to-upload in chat input area
2. **Image preview** — Show thumbnail before sending
3. **Backend Vision API integration** — New AI function `analyze_screenshot` using OpenAI Vision
4. **Position extraction prompt** — Engineer prompt to extract ticker, strike, expiry, quantity, entry price, current price from broker screenshots
5. **Confidence scoring** — Return confidence per extracted field
6. **User confirmation flow** — Show extracted positions, let user edit before saving
7. **Auto-populate positions** — Save confirmed positions to `ai_coach_positions` table
8. **Multi-broker testing** — Test with TastyTrade, Thinkorswim, IBKR, Robinhood, Webull screenshots

**Dependencies**: Position entry form from WP1

---

### Work Package 5: Trade Journal Integration (Phase 7)

**Why fifth**: Builds on positions data to provide analytics.

**Tasks**:
1. **Trade journal API routes** — CRUD for trades, query with filters
2. **Manual trade entry form** — Entry/exit date, price, strategy, notes
3. **CSV import** — Parse TastyTrade, ToS, IBKR export formats
4. **Performance analytics engine** — Win rate, profit factor, avg win/loss, by strategy/time/symbol
5. **Analytics dashboard** — Equity curve, win rate over time, day-of-week heatmap
6. **AI integration** — New function `get_trade_history` for AI to query and provide insights
7. **Pattern recognition** — Best/worst time of day, winning strategies, etc.

**Dependencies**: Positions infrastructure from WP1, WP4

---

### Work Package 6: Real-Time Alerts (Phase 8)

**Tasks**:
1. **Alert configuration API** — CRUD endpoints for alerts
2. **Alert configuration UI** — Form to set price alerts, level approach alerts
3. **Background monitoring worker** — Service that checks Massive.com prices against active alerts
4. **Notification delivery** — In-app (WebSocket), email, push notification channels
5. **Contextual alert messages** — Include level context, volume, test count
6. **Alert history view** — Past triggered alerts with outcomes
7. **AI integration** — `set_alert` function for conversational alert creation

**Dependencies**: WebSocket infrastructure (can start with polling)

---

### Work Package 7: Opportunity Scanner (Phase 9)

**Tasks**:
1. **Technical scanners** — Support/resistance bounces, breakouts, MA crossovers, RSI divergence, volume spikes
2. **Options scanners** — High IV rank, unusual activity, IV crush, high-probability spreads
3. **Scheduled jobs** — BullMQ or cron for periodic scanning
4. **Opportunity scoring** — Probability and risk/reward scoring
5. **Opportunity cards in chat** — Rich cards showing setup, chart, suggested entry
6. **Filter configuration** — User preferences for scan criteria

**Dependencies**: Card widgets from WP2, alerts infrastructure from WP6

---

### Work Package 8: Swing & LEAPS Module (Phase 10)

**Tasks**:
1. **Weekly/monthly data endpoints** — Fetch longer-timeframe aggregates
2. **Weekly/monthly chart views** — Extended timeframe charts
3. **LEAPS position tracker** — Long-term position management with Greeks projection
4. **Roll calculator** — When/how to roll LEAPS strikes
5. **Macro context** — Economic calendar, Fed policy tracker
6. **AI long-term analysis** — Swing trade and LEAPS-specific AI guidance

**Dependencies**: Options UI from WP1, chart infrastructure from Phase 3

---

### Work Package 9: Production Hardening

**Tasks**:
1. **WebSocket real-time updates** — Replace polling with WebSocket for prices, charts, alerts
2. **Rate limiting** — Express-rate-limit per-user and per-IP
3. **DST handling** — Proper timezone library for market hours
4. **Holiday calendar** — NYSE/NASDAQ holiday schedules
5. **Error monitoring** — Sentry integration
6. **Performance monitoring** — Response time tracking, cache hit rates
7. **E2E tests** — Playwright tests for AI Coach flows
8. **Level-test tracking** — Count how many times price tests a level intraday
9. **Request validation** — Schema validation (zod/joi) on all API inputs

---

### Work Package 10: Beta & Launch Prep (Phases 11-12)

**Tasks**:
1. **Beta onboarding flow** — Welcome screen, feature tour
2. **Usage analytics dashboard** (admin) — Queries/user, popular features, API costs
3. **Support documentation** — FAQ, tutorials
4. **Launch video & marketing assets**
5. **Infrastructure scaling** — Load testing, auto-scaling
6. **Monitoring dashboards** — Datadog/Grafana setup

---

## Effort Estimates (Rough)

| Work Package | Scope | Relative Size |
|-------------|-------|---------------|
| WP1: Options Chain UI | Frontend only | Medium |
| WP2: Card Widgets | Frontend + message protocol | Large |
| WP3: Chat History & Polish | Backend + Frontend | Small |
| WP4: Screenshot Analysis | Full stack + Vision API | Large |
| WP5: Trade Journal | Full stack + analytics | Large |
| WP6: Real-Time Alerts | Full stack + background worker | Large |
| WP7: Opportunity Scanner | Backend-heavy + ML | Very Large |
| WP8: Swing & LEAPS | Full stack | Medium |
| WP9: Production Hardening | Backend + DevOps | Medium |
| WP10: Beta & Launch | Operational | Medium |

---

## Recommended Implementation Order

```
WP3 (Chat History)     ─── quick win, improves daily usability
  ↓
WP1 (Options UI)       ─── highest value, backend ready
  ↓
WP2 (Card Widgets)     ─── transforms chat experience
  ↓
WP4 (Screenshots)      ─── reduces friction for position entry
  ↓
WP5 (Trade Journal)    ─── analytics layer on accumulated data
  ↓
WP6 (Alerts)           ─── passive monitoring capability
  ↓
WP9 (Hardening)        ─── prepare for beta users
  ↓
WP7 (Scanner)          ─── advanced feature, needs stable base
  ↓
WP8 (Swing/LEAPS)      ─── niche audience feature
  ↓
WP10 (Beta & Launch)   ─── go-to-market
```

---

## Summary Table

| Roadmap Phase | Status | Completion |
|---------------|--------|------------|
| Phase 0: Foundation & Planning | COMPLETE | 100% |
| Phase 1: Levels Engine MVP | COMPLETE | 95% |
| Phase 2: Basic AI Chat | COMPLETE | 90% |
| Phase 3: Center Panel - Charts | COMPLETE | 85% |
| Phase 4: Card Widgets | NOT STARTED | 0% |
| Phase 5: Options Analysis | BACKEND ONLY | 50% |
| Phase 6: Screenshot Analysis | NOT STARTED | 0% |
| Phase 7: Trade Journal | SCHEMA ONLY | 15% |
| Phase 8: Real-Time Alerts | SCHEMA ONLY | 10% |
| Phase 9: Opportunity Scanner | NOT STARTED | 0% |
| Phase 10: Swing & LEAPS | NOT STARTED | 0% |
| Phase 11: Beta Launch | NOT STARTED | 0% |
| Phase 12: Public Launch | NOT STARTED | 0% |
| Phase 13: Training Materials | NOT STARTED | 0% |

**Overall Progress**: ~35-40% of total roadmap scope

**Solid Foundation**: The hardest architectural decisions are made, the backend is well-structured, and the frontend patterns are established. Remaining work is primarily feature development on top of proven infrastructure.

---

**End of Status Assessment & Completion Plan**
