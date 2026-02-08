# Phase 2 Implementation Specification

**Status**: Active
**Last Updated**: 2026-02-08
**Owner**: Nate
**Version**: 1.0
**Branch**: `claude/phase-2-implementation-prep-uJvLK`

---

## Overview

Phase 2 builds on the completed foundation (Phases 0–3: Levels Engine, Basic AI Chat, Center Panel Charts) and the backend-complete Phase 5 (Options Analysis). It focuses on delivering the remaining production features, hardening infrastructure, and preparing for beta launch.

**Current State**: ~35-40% complete (see [STATUS_AND_PLAN.md](./STATUS_AND_PLAN.md))

---

## Work Package Index

| WP | Name | Scope | Priority | Dependencies |
|----|------|-------|----------|-------------|
| WP1 | Options Chain UI | Frontend | High | None (backend ready) |
| WP2 | Card Widgets | Frontend + protocol | High | WP1 (position cards) |
| WP3 | Chat History & Session Polish | Full stack | High | None |
| WP4 | Screenshot Analysis | Full stack + Vision API | High | WP1 |
| **WP5** | **Sentry Error Monitoring** | **Full stack + infra** | **Critical** | **None** |
| WP6 | Trade Journal Integration | Full stack + analytics | Medium | WP1, WP4 |
| WP7 | Real-Time Alerts | Full stack + worker | Medium | None |
| WP8 | Opportunity Scanner | Backend-heavy + ML | Low | WP2, WP7 |
| WP9 | Swing & LEAPS Module | Full stack | Low | WP1 |
| WP10 | Production Hardening | Backend + DevOps | Critical | WP5 |
| WP11 | Beta & Launch Prep | Operational | Final | All |

---

## WP1: Options Chain UI (Frontend)

**Goal**: Expose the fully-built backend Options Analysis (Phase 5) to users via a rich frontend.

### Tasks

1. **Options chain viewer component** — Table with calls/puts by strike, Greeks columns (Delta, Gamma, Theta, Vega, IV)
2. **Expiration date selector** — Dropdown using `GET /api/options/:symbol/expirations`
3. **Strike range filter** — Slider for min/max strikes
4. **ATM/ITM/OTM highlighting** — Color-code moneyness
5. **Position entry form** — Modal: symbol, type, strike, expiry, quantity, entry price
6. **Position analysis view** — Display P&L, Greeks, max gain/loss, breakeven from `POST /api/options/analyze`
7. **Portfolio Greeks summary** — Aggregate net Delta/Gamma/Theta/Vega
8. **Center panel integration** — "Options" tab, AI triggers via `get_options_chain`
9. **Greeks visualizations** (stretch) — Delta curve, IV smile charts

### Files to Create/Modify

- `components/ai-coach/options-chain.tsx` (new)
- `components/ai-coach/position-entry-form.tsx` (new)
- `components/ai-coach/position-analysis.tsx` (new)
- `components/ai-coach/portfolio-greeks.tsx` (new)
- `components/ai-coach/center-panel.tsx` (modify — add Options tab)
- `lib/api/ai-coach.ts` (modify — add options API calls)

### API Endpoints (Backend Ready)

- `GET /api/options/:symbol/expirations`
- `GET /api/options/:symbol/chain?expiration=YYYY-MM-DD`
- `POST /api/options/analyze` (body: positions array)

---

## WP2: Card Widgets

**Goal**: Transform chat from text-only to rich interactive embedded cards.

### Tasks

1. **Card widget framework** — Reusable `<WidgetCard>` component
2. **Key Levels card** — Current price, nearest S/R, distances, ATR
3. **Position Summary card** — Position details, P&L, Greeks (compact)
4. **P&L Tracker card** — Portfolio P&L with sparkline
5. **Alert Status card** — Active alerts with indicators
6. **Card rendering in messages** — Detect structured widget data in AI responses
7. **Click-to-expand** — Card click opens detail in center panel
8. **Live update subscription** — Polling first, migrate to WebSocket

### Files to Create

- `components/ai-coach/widgets/widget-card.tsx`
- `components/ai-coach/widgets/key-levels-card.tsx`
- `components/ai-coach/widgets/position-summary-card.tsx`
- `components/ai-coach/widgets/pnl-tracker-card.tsx`
- `components/ai-coach/widgets/alert-status-card.tsx`
- `components/ai-coach/message-bubble.tsx` (modify — widget rendering)

---

## WP3: Chat History & Session Polish

**Goal**: Make chat usable for returning users with full session history.

### Tasks

1. **Message history endpoint** — `GET /api/chat/sessions/:id/messages` (backend)
2. **Frontend session loading** — Load messages when selecting sidebar session
3. **Session title generation** — Auto-title from first user message
4. **Streaming responses** — SSE for AI responses
5. **Message search** — Cross-session search

### Files to Create/Modify

- `backend/src/routes/chat.ts` (modify — add messages endpoint)
- `hooks/use-ai-coach-chat.ts` (modify — session loading, streaming)
- `components/ai-coach/chat-panel.tsx` (modify — search, history)

---

## WP4: Screenshot Analysis

**Goal**: Upload broker screenshots, AI extracts and analyzes positions.

### Tasks

1. **File upload component** — Drag-and-drop in chat input
2. **Image preview** — Thumbnail before sending
3. **Backend Vision API integration** — `analyze_screenshot` AI function
4. **Position extraction prompt** — Extract ticker, strike, expiry, qty, prices
5. **Confidence scoring** — Per-field confidence
6. **User confirmation flow** — Review/edit before saving
7. **Auto-populate positions** — Save to `ai_coach_positions`
8. **Multi-broker testing** — TastyTrade, ToS, IBKR, Robinhood, Webull

### Files to Create/Modify

- `components/ai-coach/screenshot-upload.tsx` (new)
- `backend/src/routes/screenshot.ts` (modify — Vision API integration)
- `backend/src/chatkit/functions.ts` (modify — add analyze_screenshot)
- `backend/src/chatkit/functionHandlers.ts` (modify — handler)

---

## WP5: Sentry Error Monitoring (CRITICAL)

**Goal**: Production-grade error tracking, performance monitoring, and alerting across the entire stack.

### Rationale

Before shipping any new features to beta users, we need visibility into errors and performance. Sentry provides:
- Automatic error capture with full stack traces
- Performance monitoring (transaction tracing)
- Release tracking and source maps
- User context (which subscriber hit the error)
- Alert rules for critical failures

### Tasks

#### Backend (Express/Node.js)

1. **Install `@sentry/node`** — Add to backend dependencies
2. **Create `backend/src/config/sentry.ts`** — Initialize Sentry with DSN, environment, release, tracesSampleRate
3. **Instrument `server.ts`** — Add Sentry request handler (before routes), error handler (after routes), and flush on shutdown
4. **Tag requests** — Attach userId and requestId to Sentry scope
5. **Capture in critical paths** — Add `Sentry.captureException()` in chat, options, levels error handlers
6. **Environment config** — Add `SENTRY_DSN` to `backend/.env.example` and env validation schema

#### Frontend (Next.js)

7. **Install `@sentry/nextjs`** — Add to frontend dependencies
8. **Create `sentry.client.config.ts`** — Client-side Sentry init (replaysSessionSampleRate, replaysOnErrorSampleRate)
9. **Create `sentry.server.config.ts`** — Server-side Sentry init
10. **Create `sentry.edge.config.ts`** — Edge runtime Sentry init
11. **Create `app/global-error.tsx`** — Global error boundary that reports to Sentry
12. **Update `next.config.mjs`** — Wrap with `withSentryConfig` for source maps and tunnel
13. **Create `instrumentation.ts`** — Next.js instrumentation hook for server-side Sentry
14. **Environment config** — Add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to `.env.example`

#### Shared

15. **Update `.env.example`** files — Document all Sentry env vars
16. **Build verification** — Ensure both frontend and backend compile cleanly

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `SENTRY_DSN` | Backend `.env` | Backend error reporting DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend `.env.local` | Frontend error reporting DSN |
| `SENTRY_AUTH_TOKEN` | Frontend `.env.local` | Source map upload token |
| `SENTRY_ORG` | Frontend `.env.local` | Sentry organization slug |
| `SENTRY_PROJECT` | Frontend `.env.local` | Sentry project slug |

### Files to Create

- `backend/src/config/sentry.ts`
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`
- `app/global-error.tsx`

### Files to Modify

- `backend/src/server.ts` — Add Sentry handlers
- `backend/src/config/env.ts` — Add SENTRY_DSN to schema
- `backend/package.json` — Add @sentry/node dependency
- `package.json` — Add @sentry/nextjs dependency
- `next.config.mjs` — Wrap with withSentryConfig
- `.env.example` — Add Sentry vars
- `app/layout.tsx` — No changes needed (global-error.tsx handles it)

---

## WP6: Trade Journal Integration

**Goal**: Full trade history tracking with analytics and AI insights.

### Tasks

1. Trade journal API routes — CRUD, filtered queries
2. Manual trade entry form
3. CSV import — TastyTrade, ToS, IBKR formats
4. Performance analytics engine — Win rate, profit factor, avg win/loss
5. Analytics dashboard — Equity curve, heatmaps
6. AI integration — `get_trade_history` function
7. Pattern recognition — Best/worst time, winning strategies

---

## WP7: Real-Time Alerts

**Goal**: Notify users when price approaches key levels.

### Tasks

1. Alert configuration API — CRUD endpoints
2. Alert configuration UI
3. Background monitoring worker — Checks Massive.com prices
4. Notification delivery — In-app (WebSocket), email, push
5. Contextual alert messages — Level context, volume, test count
6. Alert history view
7. AI integration — `set_alert` conversational function

---

## WP8: Opportunity Scanner

**Goal**: AI proactively finds high-probability setups.

### Tasks

1. Technical scanners — S/R bounces, breakouts, MA crossovers, RSI divergence
2. Options scanners — High IV rank, unusual activity, IV crush
3. Scheduled jobs — BullMQ/cron
4. Opportunity scoring
5. Opportunity cards in chat
6. Filter configuration UI

---

## WP9: Swing & LEAPS Module

**Goal**: Support longer-timeframe trading styles.

### Tasks

1. Weekly/monthly data endpoints
2. Extended timeframe charts
3. LEAPS position tracker with Greeks projection
4. Roll calculator
5. Macro context — Economic calendar, Fed policy
6. Swing/LEAPS-specific AI guidance

---

## WP10: Production Hardening

**Goal**: Prepare infrastructure for beta users.

### Tasks

1. WebSocket real-time updates (replace polling)
2. DST handling — Proper timezone library
3. Holiday calendar — NYSE/NASDAQ schedules
4. Performance monitoring — Response time, cache hit rates
5. E2E tests — Playwright for AI Coach flows
6. Level-test tracking — Intraday price test counts
7. Request validation audit — Zod schemas on all inputs

---

## WP11: Beta & Launch Prep

**Goal**: Ship to 10-15 beta users.

### Tasks

1. Beta onboarding flow — Welcome screen, feature tour
2. Admin usage analytics — Queries/user, API costs
3. Support documentation — FAQ, tutorials
4. Infrastructure scaling — Load testing
5. Monitoring dashboards

---

## Recommended Implementation Order

```
WP5 (Sentry)           ─── FIRST: visibility before features
  ↓
WP3 (Chat History)     ─── quick win, daily usability
  ↓
WP1 (Options UI)       ─── highest value, backend ready
  ↓
WP2 (Card Widgets)     ─── transforms chat experience
  ↓
WP4 (Screenshots)      ─── reduces friction
  ↓
WP6 (Trade Journal)    ─── analytics layer
  ↓
WP7 (Alerts)           ─── passive monitoring
  ↓
WP10 (Hardening)       ─── prepare for beta
  ↓
WP8 (Scanner)          ─── advanced feature
  ↓
WP9 (Swing/LEAPS)      ─── niche audience
  ↓
WP11 (Beta & Launch)   ─── go-to-market
```

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-08 | Claude Code | Initial Phase 2 spec with WP1-WP11 |
