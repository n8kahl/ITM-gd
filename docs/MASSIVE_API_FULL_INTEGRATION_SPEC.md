# MASSIVE.COM FULL API INTEGRATION SPEC

## Autonomous Implementation Guide for Codex

**Version:** 1.1.0
**Date:** 2026-02-13
**Status:** Repo-aligned with scope lock + WebSocket-first real-time rules
**Scope:** phased high-value integration, optional endpoint packs, production hardening
**Repo validation target:** `6326dafebe5299c4a94af17c0e813689d01dbe5b` (HEAD on 2026-02-12)

---

## Table of Contents

0. [Repo Alignment (MUST READ)](#0-repo-alignment-must-read)
1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Current State Audit](#3-current-state-audit)
4. [Phase 0 — Cleanup & Technical Debt](#4-phase-0--cleanup--technical-debt)
5. [Phase 1 — Core Infrastructure Endpoints](#5-phase-1--core-infrastructure-endpoints)
6. [Phase 2 — Dashboard & Market Intelligence](#6-phase-2--dashboard--market-intelligence)
7. [Phase 3 — AI Coach Data Enrichment](#7-phase-3--ai-coach-data-enrichment)
8. [Phase 4 — Advanced Analytics & Flow Intelligence](#8-phase-4--advanced-analytics--flow-intelligence)
9. [Phase 5 — Benzinga Partner Data (Conditional)](#9-phase-5--benzinga-partner-data-conditional)
10. [Testing Strategy](#10-testing-strategy)
11. [Caching Architecture](#11-caching-architecture)
12. [Error Handling & Resilience](#12-error-handling--resilience)
13. [Rate Limiting & Cost Management](#13-rate-limiting--cost-management)
14. [Database Migrations](#14-database-migrations)
15. [Environment Variables](#15-environment-variables)
16. [Acceptance Criteria](#16-acceptance-criteria)
17. [File Manifest](#17-file-manifest)
18. [Dependency Map](#18-dependency-map)

---

## 0. Repo Alignment (MUST READ)

This section resolves the highest-impact mismatches between this spec and the current repo so implementation can proceed autonomously without “surprise” production blockers.

### 0.1 Massive.com call placement (authoritative decision)

**Decision:** Keep `MASSIVE_API_KEY` **only** in the backend (Express service in `backend/`). The Next.js app **must not** call `api.massive.com` directly in production.

**Why:**
- The current Docker setup injects `MASSIVE_API_KEY` into the backend container, not the Next.js app container.
- Centralizing Massive traffic in one service is required for consistent caching, rate limiting, and circuit breaker behavior across:
  - REST endpoints (`backend/src/routes/*`)
  - WebSocket price stream (`backend/src/services/websocket.ts`)
  - Background workers (`backend/src/workers/*`)

**Implementation rule:** Any `app/api/**` dashboard routes added by this spec MUST proxy to backend endpoints (via `NEXT_PUBLIC_AI_COACH_API_URL`) instead of calling Massive.com directly.

### 0.2 Massive client API shape (do not copy the old sample code)

In this repo, `backend/src/config/massive.ts` exports:
- `massiveClient`: an Axios instance (low-level)
- many `export async function ...` helpers (high-level; preferred)

**Do not implement new code that calls `massiveClient.getDailyAggregates(...)`** — that method does not exist. New code should call the exported functions (or you may optionally refactor into a typed class wrapper, but then update all call sites consistently).

### 0.3 Env validation truth source

Backend env validation lives in `backend/src/config/env.ts`.

Required vs optional MUST be consistent across:
- `backend/src/config/env.ts` (Zod schema)
- `backend/src/config/massive.ts` (must not crash the whole server on import in environments where Massive is intentionally disabled)

This spec’s “graceful degradation” goals require that Massive access failures degrade features, not crash the process.

### 0.4 Test framework reality (repo-aligned)

- **Frontend/Next.js:** Vitest is configured at the repo root (`pnpm test` runs Vitest).
- **Backend/Express:** Jest is configured in `backend/package.json`.

New tests proposed by this spec MUST use the framework already used in that package (Vitest in root, Jest in backend), unless this spec explicitly adds a migration plan.

### 0.5 Database naming + existing tables

Supabase migrations already include tables for AI Coach insights and caching (e.g., `ai_coach_journal_insights`, `ai_coach_earnings_cache`).

If you introduce new tables in Phase 3/4, they MUST either:
- reuse/extend existing `ai_coach_*` tables, or
- create new tables using the same naming pattern (`ai_coach_*`) with clear ownership, RLS, and retention/purge strategy.

### 0.6 Scope lock (prevent overkill in first production cut)

For autonomous handoff and first production deployment, this spec is **value-first**, not “integrate everything first.”

| Bucket | Include in Production Cut A | Defer to Optional Pack |
|---|---|---|
| Core market plumbing | Market status, holidays, indices snapshot, last trade/quote | Unified snapshot |
| Dashboard intelligence | Indices ticker, movers, breadth, news | Expanded widgets not tied to active UX |
| AI Coach enrichment | News + market breadth context | Deep fundamentals/flow analytics until baseline is stable |
| Corporate actions | None required for go-live | Dividends + splits |

**Explicit decision:** Dividends and splits are **optional** for Cut A.
- `getDividends()` is only required when shipping early-assignment/dividend-risk alerts in the same release.
- `getSplits()` is only required when shipping split-adjusted historical replay/P&L normalization in the same release.
- Both remain in this document as add-on tasks, but they are not launch blockers.

### 0.7 WebSocket-first real-time policy (multi-user safe)

Use WebSockets wherever the UX is live and user-facing. REST remains for snapshots, backfills, and fallback.

**Required architecture rules:**
- Browser clients subscribe via backend `ws://.../ws/prices`; no direct Massive.com client-side sockets.
- Backend must multiplex many users into shared market streams.
- Backend must keep **one upstream Massive WebSocket connection per feed type per backend instance** (not per user).
- Downstream subscriptions (symbols/channels) must be reference-counted and fan-out to all subscribed clients.
- If upstream WS fails, degrade to bounded REST polling with cache + circuit breaker until WS recovers.

**Repo validation notes (current state):**
- `components/dashboard/live-market-ticker.tsx` still uses REST polling every 15s and should migrate to `/ws/prices`.
- `components/ai-coach/tracked-setups-panel.tsx` and `components/ai-coach/position-tracker.tsx` currently open separate sockets per component; move to a shared client-side WS manager/provider to keep one socket per user session.

---

## 1. Executive Summary

### What This Spec Covers

This document provides an autonomous implementation plan to upgrade the TITM AI Coach platform from ~6 Massive.com endpoint families to a **high-value, production-safe endpoint set first**, with optional add-on packs after baseline stability.

### Why This Matters

The platform currently uses approximately 15% of the data available in its Massive.com plan. Traders are missing real-time market status, news context, institutional flow signals, earnings awareness, execution quality analysis, and market breadth — all of which are available with zero additional API cost.

### Implementation Phases

| Phase | Focus | Estimated Tasks | Priority |
|-------|-------|-----------------|----------|
| 0 | Cleanup & Tech Debt | 12 tasks | CRITICAL |
| 1 | Core Infrastructure | 6 tasks | HIGH |
| 2 | Dashboard & Market Intel | 8 tasks | HIGH |
| 3 | AI Coach Enrichment | 7 tasks | MEDIUM |
| 4 | Advanced Analytics | 5 tasks | MEDIUM |
| 5 | Benzinga Partner Data | 4 tasks | LOW (conditional) |

### Critical Rules

- **NEVER** refer to the API provider as "Polygon.io" or "Polygon" — always "Massive.com"
- **NEVER** use hex `#D4AF37` (old gold) — use `#10B981` (Emerald Elite) or CSS var `--emerald-elite`
- **ALWAYS** use `glass-card-heavy` for new container components
- **ALWAYS** use the centralized `massive.ts` client — never direct fetch/axios calls
- **ALWAYS** prefix index symbols with `I:` for API calls (e.g., `I:SPX`, `I:NDX`)
- **ALWAYS** use `next/image` for image elements
- **ALWAYS** use `@/` alias for absolute imports
- **ALWAYS** use Lucide React for icons

---

## 2. Architecture Overview

### Current Data Flow

```
Massive.com REST API (https://api.massive.com)
  ↓ Bearer Token Auth (MASSIVE_API_KEY)
  ↓
backend/src/config/massive.ts (Axios client, 806 lines)
  ├── getAggregates()          → Levels Service, Chart Service
  ├── getDailyAggregates()     → Levels, Options, Price Checks
  ├── getMinuteAggregates()    → Levels (premarket, intraday)
  ├── getEMA/SMA/RSI/MACD()   → Chart Service overlays
  ├── getOptionsContracts()    → Options Chain Fetcher
  ├── getOptionsSnapshot()     → Options Chain Fetcher, GEX
  ├── getOptionsExpirations()  → Options Chain Fetcher
  ├── getMarketContext()       → Journal enrichment
  ├── verifyPrice()            → Trade verification
  └── getIVRank()              → IV Analysis
       ↓
  Backend Services (levels/, options/, charts/, leaps/, earnings/, websocket/, workers/)
       ↓
  Backend HTTP Routes + ChatKit (Express: backend/src/routes/*, backend/src/chatkit/*)
       ↓
  Next.js Frontend (calls backend via NEXT_PUBLIC_AI_COACH_API_URL, plus WS /ws/prices)
       ↓
  (Optional) Next.js API Routes (app/api/**) for Supabase-backed features
```

### Target Data Flow (Post-Implementation)

```
Massive.com APIs
  ├── REST API (snapshots, history, reference)
  └── WebSocket Feed (live trades/quotes)
  ↓
massive.ts (EXPANDED — ~1400 lines)
  ├── [EXISTING] Aggregates, Indicators, Options Chain
  ├── [NEW] Market Status & Holidays
  ├── [NEW] Snapshots (Ticker, All, Indices, Unified)
  ├── [NEW] Last Trade / Last Quote
  ├── [NEW] Gainers / Losers
  ├── [NEW] Grouped Daily Bars
  ├── [NEW] Daily Open/Close
  ├── [NEW] Historical Trades & Quotes
  ├── [NEW] Dividends & Splits Reference
  ├── [NEW] Financials (Income, Balance, Cash Flow)
  ├── [NEW] News
  ├── [NEW] Ticker Details
  ├── [NEW] Options Aggregates
  ├── [NEW] Options Technical Indicators
  ├── [NEW] Conditions & Exchanges Reference
  └── [CONDITIONAL] Benzinga (Earnings, Ratings, Guidance)
       ↓
  [NEW] Market Data Service Layer (centralized caching + rate limiting + circuit breaker)
  [NEW] Realtime Stream Gateway (single upstream WS per feed, multi-tenant fan-out)
       ↓
  Backend Services + Workers + WebSocket (existing + new)
       ↓
  ChatKit Function Handlers (expanded with 10+ new functions)
       ↓
  Backend Market Routes (NEW) consumed by:
    - Next.js UI (server/client)
    - Next.js API route proxies (member auth + shape normalization)
       ↓
  Frontend Components (existing + 8 new widgets)
```

### Key Files Reference

| File | Path | Purpose |
|------|------|---------|
| Massive Client | `backend/src/config/massive.ts` | Centralized API client (MODIFY) |
| Market Hours | `backend/src/services/marketHours.ts` | Market status logic (REPLACE INTERNALS) |
| Market Data Routes | `backend/src/routes/market.ts` | Backend-only market endpoints (NEW) |
| Options Fetcher | `backend/src/services/options/optionsChainFetcher.ts` | Options chain + Greeks (MODIFY) |
| Function Handlers | `backend/src/chatkit/functionHandlers.ts` | AI Coach functions (EXPAND) |
| AI Functions List | `backend/src/chatkit/functions.ts` | Available function definitions (EXPAND) |
| Market Ticker Route | `app/api/members/dashboard/market-ticker/route.ts` | Live ticker data (REWRITE) |
| Symbols Library | `backend/src/lib/symbols.ts` | Symbol validation (MINOR MODIFY) |
| Types | `backend/src/services/options/types.ts` | TypeScript interfaces (EXPAND) |
| Env Config | `backend/src/config/env.ts` | Environment validation (MINOR MODIFY) |
| Globals CSS | `app/globals.css` | Design tokens (REFERENCE ONLY) |

---

## 3. Current State Audit

### Endpoints Currently Used

| Endpoint | Method in massive.ts | Used By |
|----------|---------------------|---------|
| `/v2/aggs/ticker/{ticker}/range/...` | `getAggregates()` | Levels, Charts |
| `/v2/aggs/ticker/{ticker}/prev` | `getDailyAggregates()` | Levels, Options, Ticker |
| `/v1/indicators/ema/{ticker}` | `getEMAIndicator()` | Charts |
| `/v1/indicators/sma/{ticker}` | `getSMAIndicator()` | Charts |
| `/v1/indicators/rsi/{ticker}` | `getRSIIndicator()` | Charts |
| `/v1/indicators/macd/{ticker}` | `getMACDIndicator()` | Charts |
| `/v3/reference/options/contracts` | `getOptionsContracts()` | Options Chain |
| `/v3/snapshot/options/{ticker}` | `getOptionsSnapshot()` | Options Chain, GEX |
| `/v3/reference/options/contracts` (sorted by expiry) | `getOptionsExpirations()` / `getNearestOptionsExpiration()` | Options Chain |
| `/v3/reference/tickers` | `searchReferenceTickers()` | Ticker search |
| `/tmx/v1/corporate-events` (optional) | low-level `massiveClient.get()` | Earnings service (conditional, env-gated) |

### Endpoints NOT Used (Target for Integration)

| # | Endpoint Family | Priority | Phase |
|---|----------------|----------|-------|
| 1 | Market Status (`/v1/marketstatus/now`) | CRITICAL | 1 |
| 2 | Market Holidays (`/v1/marketstatus/upcoming`) | CRITICAL | 1 |
| 3 | Last Trade (`/v2/last/trade/{ticker}`) | HIGH | 1 |
| 4 | Last Quote (`/v2/last/quote/{ticker}`) | HIGH | 1 |
| 5 | Dividends Reference (`/v3/reference/dividends`) | LOW | 3 (optional pack) |
| 6 | Splits Reference (`/v3/reference/splits`) | LOW | 3 (optional pack) |
| 7 | Ticker Snapshot (`/v2/snapshot/locale/us/markets/stocks/tickers/{ticker}`) | HIGH | 2 |
| 8 | Indices Snapshot (`/v3/snapshot/indices`) | HIGH | 2 |
| 9 | Gainers/Losers (`/v2/snapshot/locale/us/markets/stocks/{direction}`) | HIGH | 2 |
| 10 | Grouped Daily Bars (`/v2/aggs/grouped/locale/us/market/stocks/{date}`) | MEDIUM | 2 |
| 11 | Daily Open/Close (`/v1/open-close/{ticker}/{date}`) | MEDIUM | 2 |
| 12 | News (`/v2/reference/news`) | HIGH | 3 |
| 13 | Ticker Details (`/v3/reference/tickers/{ticker}`) | MEDIUM | 3 |
| 14 | Financials (`/vX/reference/tickers/{ticker}/financials`) | MEDIUM | 3 |
| 15 | Historical Trades (`/v3/trades/{ticker}`) | MEDIUM | 4 |
| 16 | Historical Quotes (`/v3/quotes/{ticker}`) | MEDIUM | 4 |
| 17 | Options Aggregates (`/v2/aggs/ticker/{optionTicker}/range/...`) | MEDIUM | 4 |
| 18 | Conditions Reference (`/v3/reference/conditions`) | LOW | 4 |
| 19 | Exchanges Reference (`/v3/reference/exchanges`) | LOW | 4 |
| 20 | Unified Snapshot (`/v3/snapshot`) | LOW | 2 |
| 21 | Earnings (Benzinga) | CONDITIONAL | 5 |
| 22 | Analyst Ratings (Benzinga) | CONDITIONAL | 5 |
| 23 | Corporate Guidance (Benzinga) | CONDITIONAL | 5 |

### Technical Debt Identified

| # | Issue | Severity | Files Affected |
|---|-------|----------|---------------|
| 1 | Hardcoded risk-free rate (0.045) | HIGH | 4 files |
| 2 | Hardcoded dividend yields | HIGH | 1 file (13 symbols) |
| 3 | Direct fetch bypassing massive.ts | HIGH | market-ticker/route.ts |
| 4 | Massive API key not injected into Next.js app runtime | HIGH | docker-compose + deployment env |
| 5 | Market-ticker route not auth-gated (abuse risk for expensive calls) | MEDIUM | market-ticker/route.ts |
| 6 | 161+ console.log in production code | MEDIUM | 40+ files in app/ |
| 7 | Placeholder IV Rank calculation | MEDIUM | optionsChainFetcher.ts |
| 8 | Hardcoded holiday calendar (2025-2028) | MEDIUM | marketHours.ts |
| 9 | TODO: Academy lesson gating disabled | LOW | 2 route files |
| 10 | Direct OpenAI fetch calls | MEDIUM | 3 route files |

---

## 4. Phase 0 — Cleanup & Technical Debt

> **Goal:** Eliminate all hardcoded market data, consolidate API access patterns, and prepare the codebase for new integrations.

### Task 0.0 — Align Massive Env + Client Initialization (Crash-Proofing)

**Problem (repo reality):**
- `backend/src/config/env.ts` currently treats `MASSIVE_API_KEY` as optional.
- `backend/src/config/massive.ts` currently throws at module import time if `MASSIVE_API_KEY` is missing.

This is incompatible with autonomous testing and with the spec’s “graceful degradation” rules.

**Required fix (pick one, document choice):**
1) **Make Massive required in production:** Update `backend/src/config/env.ts` to require `MASSIVE_API_KEY` when `NODE_ENV=production` and keep it optional for `test`/local dev, OR
2) **Make Massive lazy:** Remove the import-time throw in `backend/src/config/massive.ts` and instead throw a typed error only when a Massive method is called without configuration.

**Acceptance:** Backend unit tests can run without `MASSIVE_API_KEY` when Massive calls are mocked, and production startup fails fast with a clear message if Massive is required but misconfigured.

### Task 0.1 — Create Centralized Market Constants Service

**Create:** `backend/src/services/marketConstants.ts`

**Purpose:** Single source of truth for all market constants that can later be driven by API data.

```typescript
// backend/src/services/marketConstants.ts

import { logger } from '../lib/logger';

// Cache for API-fetched values
let cachedRiskFreeRate: number | null = null;
let cachedDividendYields: Map<string, number> = new Map();
let lastRateRefresh: number = 0;
let lastDividendRefresh: number = 0;

const RATE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DIVIDEND_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Fallback values (used if API unavailable)
const FALLBACK_RISK_FREE_RATE = 0.045;
const FALLBACK_DIVIDEND_YIELDS: Record<string, number> = {
  'SPX': 0.014, 'NDX': 0.007, 'QQQ': 0.006,
  'SPY': 0.013, 'IWM': 0.012, 'DIA': 0.018,
  'AAPL': 0.005, 'MSFT': 0.007, 'AMZN': 0.0,
  'GOOGL': 0.005, 'META': 0.004, 'TSLA': 0.0,
  'NVDA': 0.0003,
};
const DEFAULT_DIVIDEND_YIELD = 0.005;

/**
 * Get current risk-free rate.
 * Phase 1: Returns hardcoded fallback.
 * Phase 2+: Will fetch from Treasury yield endpoint if available.
 */
export async function getRiskFreeRate(): Promise<number> {
  if (cachedRiskFreeRate && (Date.now() - lastRateRefresh) < RATE_REFRESH_INTERVAL_MS) {
    return cachedRiskFreeRate;
  }

  try {
    // TODO Phase 5: Fetch from Massive.com Treasury Yields endpoint
    // const yields = await getTreasuryYields();
    // cachedRiskFreeRate = yields.tenYear / 100;
    cachedRiskFreeRate = FALLBACK_RISK_FREE_RATE;
    lastRateRefresh = Date.now();
    return cachedRiskFreeRate;
  } catch (error) {
    logger.warn('Failed to fetch risk-free rate, using fallback', { error });
    return FALLBACK_RISK_FREE_RATE;
  }
}

/**
 * Get dividend yield for a symbol.
 * Phase 0: Returns from static map.
 * Phase 1+: Fetches from Massive.com Dividends Reference endpoint.
 */
export async function getDividendYield(symbol: string): Promise<number> {
  const normalizedSymbol = symbol.replace('I:', '').toUpperCase();

  // Check cache first
  if (cachedDividendYields.has(normalizedSymbol) &&
      (Date.now() - lastDividendRefresh) < DIVIDEND_REFRESH_INTERVAL_MS) {
    return cachedDividendYields.get(normalizedSymbol)!;
  }

  // Fallback to static map
  return FALLBACK_DIVIDEND_YIELDS[normalizedSymbol] ?? DEFAULT_DIVIDEND_YIELD;
}

/**
 * Batch refresh dividend yields from API.
 * Called on startup and periodically.
 */
export async function refreshDividendYields(symbols: string[]): Promise<void> {
  // Implementation in Phase 1, Task 1.5
}

export { FALLBACK_RISK_FREE_RATE, DEFAULT_DIVIDEND_YIELD };
```

**Modify the following files to import from this service:**

| File | Current Code | Replace With |
|------|-------------|-------------|
| `backend/src/services/options/optionsChainFetcher.ts` line 35 | `const RISK_FREE_RATE = 0.045;` | `const riskFreeRate = await getRiskFreeRate();` |
| `backend/src/services/options/optionsChainFetcher.ts` lines 38-54 | `const DIVIDEND_YIELDS = {...}` | `const dividendYield = await getDividendYield(symbol);` |
| `backend/src/services/leaps/rollCalculator.ts` line 45 | `const RISK_FREE_RATE = 0.045;` | `const riskFreeRate = await getRiskFreeRate();` |
| `backend/src/services/leaps/greeksProjection.ts` line 29 | `const RISK_FREE_RATE = 0.045;` | `const riskFreeRate = await getRiskFreeRate();` |

**Test:** Unit tests in `backend/src/services/__tests__/marketConstants.test.ts` verifying fallback behavior and cache expiration.

---

### Task 0.2 — Consolidate Market Ticker Route

**Modify:** `app/api/members/dashboard/market-ticker/route.ts`

**Problem:** This route makes direct `fetch()` calls to `https://api.massive.com` with the API key embedded in the URL string, bypassing the centralized `massive.ts` client.

**Current Code (lines 14-22):**
```typescript
const apiKey = process.env.MASSIVE_API_KEY;
const [spxRes, ndxRes] = await Promise.all([
  fetch(`https://api.massive.com/v2/aggs/ticker/I:SPX/prev?apiKey=${apiKey}`, {
    next: { revalidate: 15 },
  }),
  fetch(`https://api.massive.com/v2/aggs/ticker/I:NDX/prev?apiKey=${apiKey}`, {
    next: { revalidate: 15 },
  }),
]);
```

**Replace with:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

/**
 * Repo-aligned rule: the Next.js app must NOT call api.massive.com directly in production.
 * This route becomes an authenticated proxy to the backend market endpoint.
 *
 * Backend endpoint to create (Phase 1/2): GET /api/market/indices
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUserFromRequest(request)
  if (!auth?.user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } },
      { status: 401 },
    )
  }

  // Obtain Supabase access token from the server-side client session (cookie or bearer auth).
  const { data: { session } } = await auth.supabase.auth.getSession()
  const accessToken = session?.access_token

  const apiBase = String(process.env.NEXT_PUBLIC_AI_COACH_API_URL || '').replace(/\\/$/, '')
  if (!apiBase || !accessToken) {
    return NextResponse.json({
      success: true,
      data: { quotes: [], metrics: {}, source: 'unavailable' },
    })
  }

  const res = await fetch(`${apiBase}/api/market/indices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  const payload = await res.json()
  return NextResponse.json(payload, { status: res.status })
}
```

**Note:** After Phase 2 (Indices Snapshot integration), the backend `/api/market/indices` should use the snapshot endpoint for richer data in a single call.

**Test:** Verify route returns same response shape. Integration test against `/api/members/dashboard/market-ticker`.

---

### Task 0.3 — Replace console.log with Logger

**Scope:** All files in `app/` directory that use `console.log`, `console.error`, or `console.warn`.

**Approach:**

1. Create a frontend-compatible logger wrapper:

**Create:** `lib/logger.ts`

```typescript
// lib/logger.ts
// Lightweight frontend logger that mirrors backend logger interface

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (isDev) console.debug(`[DEBUG] ${msg}`, meta ?? '');
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (isDev) console.info(`[INFO] ${msg}`, meta ?? '');
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${msg}`, meta ?? '');
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${msg}`, meta ?? '');
    // In production, optionally report to Sentry
  },
};
```

2. Find-and-replace across `app/` directory:
   - `console.log(` → `logger.info(` or `logger.debug(` (context-dependent)
   - `console.error(` → `logger.error(`
   - `console.warn(` → `logger.warn(`

3. Remove emoji prefixes from log messages (e.g., `'✓ Session created'` → `'Session created'`).

**Priority files (highest console.log density):**
- `app/api/auth/callback/route.ts` (40+ instances)
- `app/api/members/journal/grade/route.ts`
- `app/api/academy/tutor/session/route.ts`
- `app/api/admin/academy/generate-lesson/route.ts`

**Test:** Verify no `console.log` calls remain in `app/` directory (grep check). Verify logger suppresses debug/info in production.

---

### Task 0.4 — Fix Placeholder IV Rank Calculation

**Modify:** `backend/src/services/options/optionsChainFetcher.ts` (lines 402-407)

**Problem:** IV Rank is calculated as average IV, not as a percentile rank against historical IV.

**Current (placeholder):**
```typescript
// Calculate IV Rank (simplified - would need historical IV data for accurate calculation)
const allIVs = [...calls, ...puts].map(c => c.impliedVolatility).filter(iv => iv > 0);
const avgIV = allIVs.length > 0 ? allIVs.reduce((a, b) => a + b, 0) / allIVs.length : null;
```

**Replace with proper implementation:**
```typescript
// Calculate IV Rank using 52-week historical realized vol as proxy
async function calculateIVRank(symbol: string, currentIV: number): Promise<number | null> {
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dailyBars = await getDailyAggregates(
      formatMassiveTicker(symbol), from, to
    );

    if (dailyBars.length < 30) return null;

    // Calculate 20-day rolling realized vol for each window
    const windowSize = 20;
    const historicalIVs: number[] = [];

    for (let i = windowSize; i < dailyBars.length; i++) {
      const window = dailyBars.slice(i - windowSize, i);
      const returns = window.slice(1).map((bar, idx) =>
        Math.log(bar.c / window[idx].c)
      );
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
      const annualizedVol = Math.sqrt(variance * 252);
      historicalIVs.push(annualizedVol);
    }

    if (historicalIVs.length === 0) return null;

    const min = Math.min(...historicalIVs);
    const max = Math.max(...historicalIVs);

    if (max === min) return 50;

    return Math.round(((currentIV - min) / (max - min)) * 100);
  } catch (error) {
    logger.warn('Failed to calculate IV Rank', { symbol, error });
    return null;
  }
}
```

**Test:** Unit test verifying IV Rank of 0 when current IV equals 52-week low, 100 at high, ~50 at midpoint.

---

### Task 0.5 — Audit and Remove Dead Imports

**Scope:** Run TypeScript compiler with `noUnusedLocals` and `noUnusedParameters` across `backend/src/` and `app/`.

**Command:**
```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep "is declared but"
```

**Action:** Remove all unused imports and variables flagged by the compiler. Do NOT remove parameters prefixed with `_` (convention for intentionally unused params).

**Test:** Clean TypeScript compilation with no unused warnings.

---

### Task 0.6 — Document All Existing Massive.com Methods

**Create:** `backend/src/config/__docs__/massive-api-methods.md`

**Purpose:** Living documentation of every method in `massive.ts` with endpoint, parameters, return type, and usage locations. This file will be updated as new methods are added in subsequent phases.

**Format per method:**
```markdown
### getDailyAggregates
- **Endpoint:** `GET /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}`
- **Params:** ticker (string), from (YYYY-MM-DD), to (YYYY-MM-DD)
- **Returns:** `MassiveAggregate[]`
- **Used by:** Levels fetcher, Options chain fetcher, Chart service, Market ticker route
- **Cache TTL:** None (fetched fresh)
- **Added:** Phase 0 (original)
```

---

## 5. Phase 1 — Core Infrastructure Endpoints

> **Goal:** Add the foundational endpoints that fix existing fragilities and unlock data accuracy improvements.

**Routing policy (repo-aligned):**
- Authoritative implementations live in the backend (Express) under `backend/src/routes/market.ts` as `/api/market/*`.
- Any `app/api/members/dashboard/*` routes added by this spec are **optional proxies** only, used for same-origin access and cookie-based auth; they must not call Massive.com directly.

**Scope lock note:** Task 1.5 (Dividends) and Task 1.6 (Splits) are moved to an optional pack and are not required for Production Cut A.

### Task 1.0 — Backend Market Router (Required Foundation)

**Create:** `backend/src/routes/market.ts`

**Purpose:** Provide a single backend surface for all market-data endpoints added by this spec, so Massive API key usage, caching, rate limiting, and circuit breaker logic stay centralized.

**Endpoints (phased):**
- Phase 1:
  - `GET /api/market/status`
  - `GET /api/market/holidays`
  - `GET /api/market/indices`
- Phase 2:
  - `GET /api/market/movers`
  - `GET /api/market/breadth`
  - `GET /api/market/news`

**Auth:** Require Supabase JWT via `authenticateToken` for all routes (see `backend/src/middleware/auth.ts`).

**Register route:** Modify `backend/src/server.ts` to mount the router:
- `import marketRouter from './routes/market'`
- `app.use('/api/market', marketRouter)`

### Task 1.1 — Market Status Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get real-time market status from all exchanges.
 * Endpoint: GET /v1/marketstatus/now
 * Returns: Exchange-level status (open, closed, pre-market, after-hours, early-close)
 */
export async function getMarketStatusNow(): Promise<MassiveMarketStatusResponse> {
  const response = await massiveClient.get<MassiveMarketStatusResponse>('/v1/marketstatus/now');
  return response.data;
}
```

**New Type (add to `massive.ts` type declarations):**
```typescript
interface MassiveMarketStatusResponse {
  market: string;           // "open" | "closed" | "extended-hours"
  serverTime: string;       // ISO 8601
  exchanges: {
    nyse: string;           // "open" | "closed"
    nasdaq: string;
    otc: string;
  };
  currencies: {
    fx: string;
    crypto: string;
  };
  earlyHours: boolean;      // Pre-market
  afterHours: boolean;      // After-hours
}
```

**Modify:** `backend/src/services/marketHours.ts`

Replace the hardcoded time-based logic with a hybrid approach:

```typescript
// PRIMARY: Use Massive.com API for real-time status
// FALLBACK: Use existing time-based logic if API unavailable

import { getMarketStatusNow, type MassiveMarketStatusResponse } from '../config/massive';
import { logger } from '../lib/logger';

let cachedStatus: MassiveMarketStatusResponse | null = null;
let lastStatusFetch: number = 0;
const STATUS_CACHE_TTL_MS = 30_000; // 30 seconds

export async function getMarketStatus(now?: Date): Promise<MarketStatus> {
  // Try API first
  if (!cachedStatus || (Date.now() - lastStatusFetch) > STATUS_CACHE_TTL_MS) {
    try {
      cachedStatus = await getMarketStatusNow();
      lastStatusFetch = Date.now();
    } catch (error) {
      logger.warn('Market status API unavailable, using fallback', { error });
    }
  }

  if (cachedStatus) {
    return mapMassiveStatusToInternal(cachedStatus);
  }

  // Fallback to existing time-based logic
  return getMarketStatusFallback(now);
}
```

**Repo impact (IMPORTANT):** In the current repo, `getMarketStatus()` is a synchronous function used by:
- `backend/src/services/websocket.ts`
- `backend/src/workers/alertWorker.ts`
- other services that embed market status in responses

This task makes `getMarketStatus()` `async`. You MUST update those call sites to `await` it (or keep the old sync function as `getMarketStatusFallback()` and introduce a new `getMarketStatusAsync()` for call sites that can await).

**Keep the existing `MARKET_HOLIDAYS` object and time-based logic** as the fallback implementation in a separate function `getMarketStatusFallback()`. Do not delete it.

**New backend API Route (authoritative):** `backend/src/routes/market.ts` → `GET /api/market/status` (auth-gated with `authenticateToken`)

**Optional Next.js proxy route (cookie auth, same-origin):** `app/api/members/dashboard/market-status/route.ts` (proxy to backend `/api/market/status`)

```typescript
// GET /api/members/dashboard/market-status
// Returns: { status, session, message, nextOpen, exchanges }
// Cache: 30 second revalidation
```

**Test:**
- Unit test: mock API response → verify correct status mapping
- Unit test: API failure → verify fallback to time-based logic
- Unit test: verify early close days map correctly
- Integration test: route returns valid JSON with required fields

---

### Task 1.2 — Market Holidays Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get upcoming market holidays and early closes.
 * Endpoint: GET /v1/marketstatus/upcoming
 * Returns: Array of upcoming holidays with dates and hours
 */
export async function getMarketHolidaysUpcoming(): Promise<MassiveMarketHoliday[]> {
  const response = await massiveClient.get<MassiveMarketHoliday[]>('/v1/marketstatus/upcoming');
  return response.data;
}
```

**New Type:**
```typescript
interface MassiveMarketHoliday {
  exchange: string;        // "NYSE", "NASDAQ", "OTC"
  name: string;            // "Christmas", "Good Friday"
  date: string;            // YYYY-MM-DD
  status: string;          // "closed" | "early-close"
  open?: string;           // HH:MM (if early close)
  close?: string;          // HH:MM (if early close)
}
```

**Create:** `backend/src/services/marketHolidays.ts`

```typescript
/**
 * Market Holidays Service
 *
 * Fetches upcoming holidays from Massive.com API with daily cache refresh.
 * Updates the legacy MARKET_HOLIDAYS map in marketHours.ts as a side effect.
 * Provides helper functions for UI display.
 */

export interface UpcomingHoliday {
  name: string;
  date: string;           // YYYY-MM-DD
  status: 'closed' | 'early-close';
  closeTime?: string;     // "1:00 PM ET" for early closes
  daysUntil: number;      // Trading days until holiday
  affectsTrading: string; // Human-readable impact description
}

export async function getUpcomingHolidays(limit?: number): Promise<UpcomingHoliday[]>;
export async function getNextHoliday(): Promise<UpcomingHoliday | null>;
export async function isHolidayOrEarlyClose(date: string): Promise<{
  isHoliday: boolean;
  isEarlyClose: boolean;
  details?: UpcomingHoliday;
}>;
```

**Modify:** `backend/src/services/marketHours.ts`

Add a startup function that fetches holidays from the API and merges them into the `MARKET_HOLIDAYS` object, extending coverage beyond the hardcoded 2025-2028 range.

**New backend API Route (authoritative):** `backend/src/routes/market.ts` → `GET /api/market/holidays` (auth-gated with `authenticateToken`)

**Optional Next.js proxy route (cookie auth, same-origin):** `app/api/members/dashboard/market-holidays/route.ts` (proxy to backend `/api/market/holidays`)

```typescript
// GET /api/members/dashboard/market-holidays
// Query: ?limit=5 (default 5, max 20)
// Returns: UpcomingHoliday[]
// Cache: 24 hour revalidation
```

**New ChatKit Function:** `get_market_holidays`

```typescript
// Added to functionHandlers.ts and functions.ts
// Name: get_market_holidays
// Description: "Get upcoming market holidays and early closes"
// Parameters: { limit?: number }
// Returns: UpcomingHoliday[]
// Tier: All tiers (free)
```

**AI Coach Usage Example:**
> "Heads up — the market closes at 1:00 PM ET this Friday for Independence Day weekend. Your Thursday 0DTE window will have shortened hours. Plan entries accordingly."

**Test:**
- Unit test: parse API response → correct UpcomingHoliday format
- Unit test: daysUntil calculation accounts for weekends
- Unit test: getNextHoliday returns nearest future holiday
- Integration test: API route returns valid JSON

---

### Task 1.3 — Last Trade Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get the most recent trade for a ticker.
 * Endpoint: GET /v2/last/trade/{ticker}
 * Returns: Last trade price, size, timestamp, exchange, conditions
 */
export async function getLastTrade(ticker: string): Promise<MassiveLastTrade> {
  const formattedTicker = formatMassiveTicker(ticker);
  const response = await massiveClient.get(`/v2/last/trade/${formattedTicker}`);
  return response.data.results;
}
```

**New Type:**
```typescript
interface MassiveLastTrade {
  T: string;        // Ticker symbol
  t: number;        // Timestamp (nanoseconds)
  y: number;        // Exchange timestamp
  q: number;        // Sequence number
  i: string;        // Trade ID
  x: number;        // Exchange ID
  s: number;        // Trade size
  c: number[];      // Condition codes
  p: number;        // Price
  z: number;        // Tape (1=A, 2=B, 3=C)
}
```

---

### Task 1.4 — Last Quote (NBBO) Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get the most recent NBBO quote for a ticker.
 * Endpoint: GET /v2/last/nbbo/{ticker}
 * Returns: Best bid/ask with sizes
 */
export async function getLastQuote(ticker: string): Promise<MassiveLastQuote> {
  const formattedTicker = formatMassiveTicker(ticker);
  const response = await massiveClient.get(`/v2/last/nbbo/${formattedTicker}`);
  return response.data.results;
}
```

**New Type:**
```typescript
interface MassiveLastQuote {
  T: string;        // Ticker symbol
  t: number;        // Timestamp (nanoseconds)
  y: number;        // Exchange timestamp
  q: number;        // Sequence number
  P: number;        // Bid price
  S: number;        // Bid size
  p: number;        // Ask price
  s: number;        // Ask size
  z: number;        // Tape
  X: number;        // Bid exchange ID
  x: number;        // Ask exchange ID
  c: number[];      // Condition codes
}
```

**Create:** `backend/src/services/realTimePrice.ts`

```typescript
/**
 * Real-Time Price Service
 *
 * Provides the most accurate current price by combining
 * last trade and last quote data. Replaces the existing
 * getDailyAggregates-based price fetching pattern.
 */

export interface RealTimePrice {
  symbol: string;
  price: number;           // Last trade price
  bid: number;             // Best bid
  ask: number;             // Best ask
  mid: number;             // Midpoint
  spread: number;          // Ask - Bid
  spreadPct: number;       // Spread as % of mid
  size: number;            // Last trade size
  timestamp: number;       // Trade timestamp (ms)
  exchange: number;        // Exchange ID
  source: 'last_trade' | 'last_quote' | 'aggregate_fallback';
}

export async function getRealTimePrice(symbol: string): Promise<RealTimePrice>;
export async function getRealTimePrices(symbols: string[]): Promise<Map<string, RealTimePrice>>;
```

**Modify consumers to prefer this service over `getDailyAggregates` for current price:**
- `backend/src/services/options/optionsChainFetcher.ts` → `getCurrentPrice()` function
- `backend/src/chatkit/functionHandlers.ts` → `get_current_price` handler
- `app/api/members/dashboard/market-ticker/route.ts` (further upgrade in Phase 2)

**Test:**
- Unit test: RealTimePrice construction from mock trade/quote
- Unit test: fallback to aggregate when trade/quote unavailable
- Unit test: spread calculation accuracy
- Integration test: price matches expected format

---

### Task 1.5 — Dividends Reference Endpoint

**Scope decision (2026-02-13):** Optional add-on task. Do not block Cut A on this task.

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get dividend history for a ticker.
 * Endpoint: GET /v3/reference/dividends
 * Returns: Dividend declarations with ex-date, pay-date, amounts
 */
export async function getDividends(
  ticker: string,
  options?: {
    exDividendDateGte?: string;   // YYYY-MM-DD
    exDividendDateLte?: string;
    limit?: number;               // Default 10
    order?: 'asc' | 'desc';
    dividendType?: 'CD' | 'SC' | 'LT' | 'ST'; // Cash, Special, Long-term, Short-term
  }
): Promise<MassiveDividend[]> {
  const params: Record<string, string | number> = { ticker };
  if (options?.exDividendDateGte) params['ex_dividend_date.gte'] = options.exDividendDateGte;
  if (options?.exDividendDateLte) params['ex_dividend_date.lte'] = options.exDividendDateLte;
  if (options?.limit) params.limit = options.limit;
  if (options?.order) params.order = options.order;
  if (options?.dividendType) params.dividend_type = options.dividendType;

  const response = await massiveClient.get('/v3/reference/dividends', { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveDividend {
  ticker: string;
  cash_amount: number;           // $ per share
  currency: string;              // "USD"
  declaration_date: string;      // YYYY-MM-DD
  dividend_type: string;         // "CD" (cash), "SC" (special), etc.
  ex_dividend_date: string;      // YYYY-MM-DD
  frequency: number;             // 1=annual, 2=bi-annual, 4=quarterly, 12=monthly
  pay_date: string;              // YYYY-MM-DD
  record_date: string;           // YYYY-MM-DD
}
```

**Modify:** `backend/src/services/marketConstants.ts`

Update `refreshDividendYields()` to fetch from this endpoint and calculate annualized yield:

```typescript
export async function refreshDividendYields(symbols: string[]): Promise<void> {
  for (const symbol of symbols) {
    try {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const dividends = await getDividends(symbol, {
        exDividendDateGte: oneYearAgo,
        exDividendDateLte: today,
        order: 'desc',
        limit: 20,
      });

      if (dividends.length === 0) {
        cachedDividendYields.set(symbol, 0);
        continue;
      }

      // Sum trailing 12-month dividends
      const ttmDividends = dividends.reduce((sum, d) => sum + d.cash_amount, 0);

      // Get current price for yield calculation
      const price = await getRealTimePrice(symbol);
      const yield_ = price.price > 0 ? ttmDividends / price.price : 0;

      cachedDividendYields.set(symbol, yield_);
    } catch (error) {
      logger.warn('Failed to fetch dividend for symbol', { symbol, error });
    }
  }
  lastDividendRefresh = Date.now();
}
```

**Create:** `backend/src/services/dividendAlert.ts`

```typescript
/**
 * Dividend Alert Service
 *
 * Checks if any symbols in a user's positions have upcoming ex-dividend dates.
 * Used by AI Coach to warn about early assignment risk on short calls.
 */

export interface DividendAlert {
  symbol: string;
  exDate: string;                // YYYY-MM-DD
  amount: number;                // $ per share
  daysUntilExDate: number;
  earlyAssignmentRisk: boolean;  // True if user has short calls near/ITM
  message: string;               // Human-readable alert
}

export async function checkDividendAlerts(
  symbols: string[]
): Promise<DividendAlert[]>;
```

**New ChatKit Function:** `get_dividend_info`

```typescript
// Name: get_dividend_info
// Description: "Get dividend history and upcoming ex-dates for a symbol"
// Parameters: { symbol: string }
// Returns: { dividends: MassiveDividend[], annualizedYield: number, nextExDate: string | null }
// Tier: All tiers (free)
```

**Test:**
- Unit test: yield calculation from dividend history
- Unit test: early assignment risk detection
- Unit test: handles symbols with no dividends
- Integration test: refreshDividendYields updates cache

---

### Task 1.6 — Stock Splits Reference Endpoint

**Scope decision (2026-02-13):** Optional add-on task. Do not block Cut A on this task.

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get stock split history for a ticker.
 * Endpoint: GET /v3/reference/splits
 * Returns: Historical and upcoming splits with ratios
 */
export async function getSplits(
  ticker: string,
  options?: {
    executionDateGte?: string;
    executionDateLte?: string;
    limit?: number;
    order?: 'asc' | 'desc';
  }
): Promise<MassiveSplit[]> {
  const params: Record<string, string | number> = { ticker };
  if (options?.executionDateGte) params['execution_date.gte'] = options.executionDateGte;
  if (options?.executionDateLte) params['execution_date.lte'] = options.executionDateLte;
  if (options?.limit) params.limit = options.limit;
  if (options?.order) params.order = options.order;

  const response = await massiveClient.get('/v3/reference/splits', { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveSplit {
  ticker: string;
  execution_date: string;        // YYYY-MM-DD
  split_from: number;            // Original shares
  split_to: number;              // New shares (e.g., 1 → 4 for 4:1 split)
}
```

**Usage:** Primarily for journal accuracy — when a user looks at historical P&L, splits can distort price comparisons. The chart service should also use this to annotate split events on price charts.

**Test:**
- Unit test: split ratio calculation
- Unit test: adjust historical prices for splits

---

## 6. Phase 2 — Dashboard & Market Intelligence

> **Goal:** Transform the dashboard from a basic stats page into a live market intelligence hub.

### Task 2.1 — Ticker Snapshot (Single Symbol)

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get comprehensive snapshot for a single stock ticker.
 * Endpoint: GET /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}
 * Returns: Current minute bar, today's bar, previous day bar, last trade, last quote
 */
export async function getTickerSnapshot(ticker: string): Promise<MassiveTickerSnapshot> {
  const formattedTicker = formatMassiveTicker(ticker);
  const response = await massiveClient.get(
    `/v2/snapshot/locale/us/markets/stocks/tickers/${formattedTicker}`
  );
  return response.data.ticker;
}
```

**New Type:**
```typescript
interface MassiveTickerSnapshot {
  ticker: string;
  todaysChange: number;          // $ change today
  todaysChangePerc: number;      // % change today
  updated: number;               // Nanosecond timestamp
  day: {                         // Today's aggregates
    o: number; h: number; l: number;
    c: number; v: number; vw: number;
  };
  lastTrade: {
    p: number; s: number; t: number;
    c: number[];                 // Condition codes
  };
  lastQuote: {
    P: number; S: number;        // Bid price, size
    p: number; s: number;        // Ask price, size
    t: number;
  };
  min: {                         // Current minute bar
    o: number; h: number; l: number;
    c: number; v: number; vw: number;
    t: number;                   // Timestamp
    av: number;                  // Accumulated volume
    n: number;                   // Number of trades
  };
  prevDay: {                     // Previous day aggregates
    o: number; h: number; l: number;
    c: number; v: number; vw: number;
  };
}
```

**This replaces multiple separate API calls.** The market ticker route currently makes 2 calls (SPX prev + NDX prev). A single snapshot returns the same data plus today's OHLCV, current minute data, last trade, and last quote.

---

### Task 2.2 — Indices Snapshot

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get snapshot for one or more indices.
 * Endpoint: GET /v3/snapshot/indices
 * Returns: Current value, session details, change metrics
 */
export async function getIndicesSnapshot(
  tickers?: string[]    // e.g., ['I:SPX', 'I:NDX', 'I:DJI', 'I:VIX', 'I:RUT']
): Promise<MassiveIndexSnapshot[]> {
  const params: Record<string, string> = {};
  if (tickers?.length) {
    params['ticker.any_of'] = tickers.join(',');
  }
  const response = await massiveClient.get('/v3/snapshot/indices', { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveIndexSnapshot {
  ticker: string;
  name: string;
  value: number;                  // Current index value
  type: string;
  market_status: string;
  session: {
    change: number;               // $ change
    change_percent: number;       // % change
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
  };
}
```

**Upgrade backend market endpoint (authoritative):** `backend/src/routes/market.ts` → `GET /api/market/indices`

Implement it using the indices snapshot endpoint so the platform gets 5 indices in a single Massive.com call, with backend-controlled caching/rate limiting/circuit breaker.

**Keep:** `app/api/members/dashboard/market-ticker/route.ts` as a proxy (Task 0.2). It must not call Massive.com directly.

Example backend shape (preserve existing frontend expectations):
```typescript
// GET /api/market/indices
// Returns the same response shape currently used by LiveMarketTicker:
// { success: true, data: { quotes: [{ symbol, price, change, changePercent }], metrics: {...}, source }, }
```

**Modify:** `components/dashboard/live-market-ticker.tsx`, `hooks/use-price-stream.ts`

Expand from SPX/NDX to 5 indices and switch to WebSocket live updates (`/ws/prices`) for active sessions.
- Remove the 15-second REST polling loop for live quotes.
- Keep `app/api/members/dashboard/market-ticker/route.ts` as bootstrap/fallback shape normalizer only.

**Test:**
- Unit test: snapshot response mapping
- Unit test: handles missing indices gracefully
- Integration test: route returns all 5 indices
- Visual test: ticker bar renders correctly with 5 indices

### Task 2.2b — Single WebSocket Connection Multiplexing (Required)

**Goal:** Prevent per-component socket sprawl while supporting many users/channels.

**Frontend requirements:**
- Add a shared WS connection manager/provider (one socket per authenticated browser session).
- Convert channel consumers to subscribe/unsubscribe through the manager instead of creating new `new WebSocket(...)` instances in each component.
- Apply to:
  - `components/ai-coach/tracked-setups-panel.tsx`
  - `components/ai-coach/position-tracker.tsx`
  - `components/dashboard/live-market-ticker.tsx`

**Backend requirements:**
- Keep `/ws/prices` as fan-out hub.
- If Massive upstream WS is enabled, keep one upstream connection per feed type per instance.
- Enforce per-user channel authorization exactly as currently implemented.

**Test:**
- Unit test: manager de-duplicates socket creation with 3+ subscribing widgets.
- Integration test: one browser session opens one socket while receiving setup/position/price events.
- Load test: 100+ downstream clients do not create >1 upstream feed socket per backend instance.

---

### Task 2.3 — Market Gainers & Losers

**Add to:** `backend/src/config/massive.ts`

**New Methods:**
```typescript
/**
 * Get top gaining/losing stocks for the day.
 * Endpoint: GET /v2/snapshot/locale/us/markets/stocks/{direction}
 * Direction: "gainers" or "losers"
 */
export async function getMarketMovers(
  direction: 'gainers' | 'losers',
  includeOtc?: boolean
): Promise<MassiveTickerSnapshot[]> {
  const params: Record<string, string> = {};
  if (includeOtc === false) params.include_otc = 'false';
  const response = await massiveClient.get(
    `/v2/snapshot/locale/us/markets/stocks/${direction}`,
    { params }
  );
  return response.data.tickers || [];
}
```

**New backend API Route (authoritative):** `backend/src/routes/market.ts` → `GET /api/market/movers`

**Optional Next.js proxy route (cookie auth, same-origin):** `app/api/members/dashboard/market-movers/route.ts` (proxy to backend `/api/market/movers`)

```typescript
// GET /api/members/dashboard/market-movers
// Query: ?direction=gainers|losers&limit=10
// Returns: MassiveTickerSnapshot[] (top N movers)
// Cache: 60 second revalidation
```

**New Component:** `components/dashboard/market-movers-card.tsx`

```typescript
// Dashboard widget showing top 5 gainers and top 5 losers
// Uses glass-card-heavy container
// Green (#10B981) for gainers, Red (#EF4444) for losers
// Each row: Symbol | Price | Change% | Mini sparkline (optional)
// Clicking a symbol could trigger AI Coach context: "Tell me about {symbol}"
```

**New ChatKit Function:** `get_market_movers`

```typescript
// Name: get_market_movers
// Description: "Get today's top gaining and losing stocks"
// Parameters: { direction?: "gainers" | "losers" | "both", limit?: number }
// Returns: { gainers: Mover[], losers: Mover[] }
// Tier: All tiers (free)
```

**Test:**
- Unit test: filter OTC stocks
- Unit test: limit parameter works
- Integration test: route returns valid movers
- Component test: renders gainers/losers correctly

---

### Task 2.4 — Grouped Daily Bars (Market Breadth)

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get OHLCV for all stocks on a given date.
 * Endpoint: GET /v2/aggs/grouped/locale/us/market/stocks/{date}
 * Returns: All stock bars for the day (used for breadth calculations)
 */
export async function getGroupedDailyBars(
  date: string,                    // YYYY-MM-DD
  adjusted?: boolean,
  includeOtc?: boolean
): Promise<MassiveAggregate[]> {
  const params: Record<string, string | boolean> = {};
  if (adjusted !== undefined) params.adjusted = adjusted;
  if (includeOtc !== undefined) params.include_otc = includeOtc;

  const response = await massiveClient.get(
    `/v2/aggs/grouped/locale/us/market/stocks/${date}`,
    { params }
  );
  return response.data.results || [];
}
```

**Create:** `backend/src/services/marketBreadth.ts`

```typescript
/**
 * Market Breadth Service
 *
 * Calculates breadth indicators from grouped daily bars.
 * Provides advance/decline ratios, new highs/lows, and sector heatmap data.
 */

export interface MarketBreadthData {
  date: string;
  advancers: number;             // Stocks closing higher than previous close
  decliners: number;             // Stocks closing lower
  unchanged: number;
  advanceDeclineRatio: number;   // Advancers / Decliners
  advanceDeclineLine: number;    // Cumulative A-D
  totalVolume: number;
  advancingVolume: number;
  decliningVolume: number;
  breadthThrust: number;         // Advancers / (Advancers + Decliners) %
  marketSentiment: 'strongly_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly_bearish';
}

export async function calculateMarketBreadth(date?: string): Promise<MarketBreadthData>;
export async function getMultiDayBreadth(days?: number): Promise<MarketBreadthData[]>;
```

**New backend API Route (authoritative):** `backend/src/routes/market.ts` → `GET /api/market/breadth`

**Optional Next.js proxy route (cookie auth, same-origin):** `app/api/members/dashboard/market-breadth/route.ts` (proxy to backend `/api/market/breadth`)

```typescript
// GET /api/members/dashboard/market-breadth
// Query: ?days=5 (default 1)
// Returns: MarketBreadthData[]
// Cache: 5 minute revalidation during market hours, 1 hour otherwise
```

**New ChatKit Function:** `get_market_breadth`

```typescript
// Name: get_market_breadth
// Description: "Get market breadth data including advance/decline ratio and sentiment"
// Parameters: { days?: number }
// Returns: MarketBreadthData
// Tier: All tiers (free)
```

**AI Coach Usage Example:**
> "Despite SPX being flat today, breadth is poor — 62% of stocks are declining with a 0.58 A/D ratio. This divergence between the index and breadth often precedes weakness. Be cautious with new bullish positions."

**Test:**
- Unit test: breadth calculation from mock bars
- Unit test: sentiment classification thresholds
- Unit test: handles weekends/holidays (no data)
- Integration test: route returns valid breadth data

---

### Task 2.5 — Daily Open/Close

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get official open, close, high, low for a specific date.
 * Endpoint: GET /v1/open-close/{ticker}/{date}
 * Returns: Official session prices with pre/after market data
 */
export async function getDailyOpenClose(
  ticker: string,
  date: string,          // YYYY-MM-DD
  adjusted?: boolean
): Promise<MassiveDailyOpenClose> {
  const formattedTicker = formatMassiveTicker(ticker);
  const params: Record<string, boolean> = {};
  if (adjusted !== undefined) params.adjusted = adjusted;

  const response = await massiveClient.get(
    `/v1/open-close/${formattedTicker}/${date}`,
    { params }
  );
  return response.data;
}
```

**New Type:**
```typescript
interface MassiveDailyOpenClose {
  status: string;
  from: string;           // YYYY-MM-DD
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  afterHours: number;     // After-hours close
  preMarket: number;      // Pre-market open
}
```

**Usage:** Journal enrichment. When a user logs a trade for a specific date, auto-populate the day's market context.

**Modify:** `backend/src/chatkit/functionHandlers.ts`

Enhance `get_journal_insights` to include day context from this endpoint.

**Test:**
- Unit test: response parsing
- Unit test: handles non-trading days
- Integration test: fetches valid data for recent date

---

### Task 2.6 — Unified Snapshot

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get snapshots for multiple tickers across asset classes in a single call.
 * Endpoint: GET /v3/snapshot
 * Returns: Cross-asset snapshots (stocks, options, indices, forex, crypto)
 */
export async function getUnifiedSnapshot(
  tickers: string[],
  options?: {
    type?: 'stocks' | 'options' | 'indices' | 'forex' | 'crypto';
  }
): Promise<MassiveUnifiedSnapshotResult[]> {
  const params: Record<string, string> = {
    'ticker.any_of': tickers.join(','),
  };
  if (options?.type) params.type = options.type;

  const response = await massiveClient.get('/v3/snapshot', { params });
  return response.data.results || [];
}
```

**Usage:** Batch price lookups for watchlists and portfolio views. Instead of N individual calls, one unified snapshot call.

**Test:**
- Unit test: handles mixed asset types
- Unit test: handles partial failures (some tickers not found)

---

### Task 2.7 — News Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get ticker-specific news articles.
 * Endpoint: GET /v2/reference/news
 * Returns: News articles with publisher, title, description, tickers, image
 */
export async function getNews(options?: {
  ticker?: string;
  publishedUtcGte?: string;      // ISO 8601
  publishedUtcLte?: string;
  limit?: number;                // Default 10, max 1000
  order?: 'asc' | 'desc';
  sort?: 'published_utc';
}): Promise<MassiveNewsArticle[]> {
  const params: Record<string, string | number> = {};
  if (options?.ticker) params.ticker = options.ticker;
  if (options?.publishedUtcGte) params['published_utc.gte'] = options.publishedUtcGte;
  if (options?.publishedUtcLte) params['published_utc.lte'] = options.publishedUtcLte;
  if (options?.limit) params.limit = options.limit;
  if (options?.order) params.order = options.order;
  if (options?.sort) params.sort = options.sort;

  const response = await massiveClient.get('/v2/reference/news', { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveNewsArticle {
  id: string;
  publisher: {
    name: string;
    homepage_url: string;
    logo_url: string;
    favicon_url: string;
  };
  title: string;
  author: string;
  published_utc: string;         // ISO 8601
  article_url: string;
  tickers: string[];             // Related tickers
  image_url?: string;
  description?: string;
  keywords?: string[];
  insights?: {
    ticker: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentiment_reasoning: string;
  }[];
}
```

**New backend API Route (authoritative):** `backend/src/routes/market.ts` → `GET /api/market/news`

**Optional Next.js proxy route (cookie auth, same-origin):** `app/api/members/dashboard/news/route.ts` (proxy to backend `/api/market/news`)

```typescript
// GET /api/members/dashboard/news
// Query: ?ticker=SPX&limit=10
// Returns: MassiveNewsArticle[] (sanitized — no full article text)
// Cache: 5 minute revalidation
```

**New Component:** `components/dashboard/news-feed-card.tsx`

```typescript
// Dashboard widget showing latest 5-8 news headlines
// Uses glass-card-heavy container
// Each item: Publisher icon | Title (truncated) | Time ago | Ticker chips
// Sentiment indicator (green/red/gray dot) if available
// "View All" link to expanded news page or AI Coach query
```

**New ChatKit Function:** `get_news`

```typescript
// Name: get_news
// Description: "Get latest news articles for a symbol or the broader market"
// Parameters: { symbol?: string, limit?: number }
// Returns: { articles: NewsArticle[] }
// Tier: All tiers (free)
```

**AI Coach Usage Example:**
> "There's been a flurry of NVDA news today — 3 articles about the new chip announcement and 2 about the DOJ investigation. Sentiment is mixed. Options IV is elevated at 52% (rank 78). If you're considering a position, this is priced as an event."

**Test:**
- Unit test: news parsing, date formatting
- Unit test: ticker filtering
- Unit test: handles empty results
- Integration test: route returns valid articles
- Component test: renders headlines correctly

---

### Task 2.8 — Market Status Dashboard Widget

**New Component:** `components/dashboard/market-status-badge.tsx`

```typescript
// Compact badge showing current market status
// States: "Market Open" (green pulse), "Pre-Market" (yellow), "After Hours" (blue),
//         "Closed" (gray), "Early Close Today" (orange)
// Shows countdown: "Closes in 2h 15m" or "Opens in 14h 32m"
// If holiday approaching: "Closed Tomorrow — Thanksgiving"
// Uses animate-pulse-emerald for "open" state
// Positioned in dashboard header next to welcome message
```

**Test:**
- Component test: renders correct state for each market status
- Component test: countdown timer accuracy
- Component test: holiday warning display

---

## 7. Phase 3 — AI Coach Data Enrichment

> **Goal:** Make the AI Coach dramatically smarter by giving it access to fundamentals, news context, and richer symbol data.

### Task 3.1 — Ticker Details Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get comprehensive details about a ticker.
 * Endpoint: GET /v3/reference/tickers/{ticker}
 * Returns: Company name, description, SIC code, market cap, employees, etc.
 */
export async function getTickerDetails(ticker: string): Promise<MassiveTickerDetails> {
  const response = await massiveClient.get(`/v3/reference/tickers/${ticker}`);
  return response.data.results;
}
```

**New Type:**
```typescript
interface MassiveTickerDetails {
  ticker: string;
  name: string;
  market: string;                  // "stocks"
  locale: string;                  // "us"
  primary_exchange: string;        // "XNYS"
  type: string;                    // "CS" (common stock)
  active: boolean;
  currency_name: string;
  cik: string;                     // SEC CIK number
  composite_figi: string;
  share_class_figi: string;
  market_cap?: number;
  phone_number?: string;
  address?: {
    address1: string;
    city: string;
    state: string;
    postal_code: string;
  };
  description?: string;
  sic_code?: string;
  sic_description?: string;
  ticker_root?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url: string;
    icon_url: string;
  };
  share_class_shares_outstanding?: number;
  weighted_shares_outstanding?: number;
  round_lot?: number;
}
```

**New ChatKit Function:** `get_ticker_details`

```typescript
// Name: get_ticker_details
// Description: "Get company details including description, market cap, sector, and employees"
// Parameters: { symbol: string }
// Returns: TickerDetails
// Tier: All tiers (free)
```

**Usage:** AI Coach can provide company context when users ask about unfamiliar tickers: "PLTR is Palantir Technologies, a data analytics company in the Technology sector with a market cap of $145B and 3,800 employees."

**Test:**
- Unit test: response parsing
- Unit test: handles missing optional fields
- Integration test: fetches valid details for known ticker

---

### Task 3.2 — Financials Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get financial statements from SEC filings.
 * Endpoint: GET /vX/reference/financials
 * Returns: Income statement, balance sheet, cash flow data
 */
export async function getFinancials(
  ticker: string,
  options?: {
    type?: 'Y' | 'Q' | 'T' | 'YA' | 'QA' | 'TA';  // Annual, Quarterly, Trailing, etc.
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    filingDateGte?: string;
    filingDateLte?: string;
    periodOfReportDateGte?: string;
    periodOfReportDateLte?: string;
  }
): Promise<MassiveFinancial[]> {
  const params: Record<string, string | number> = { ticker };
  if (options?.type) params.timeframe = options.type;
  if (options?.limit) params.limit = options.limit;
  if (options?.order) params.order = options.order;
  if (options?.filingDateGte) params['filing_date.gte'] = options.filingDateGte;
  if (options?.filingDateLte) params['filing_date.lte'] = options.filingDateLte;
  if (options?.periodOfReportDateGte) params['period_of_report_date.gte'] = options.periodOfReportDateGte;
  if (options?.periodOfReportDateLte) params['period_of_report_date.lte'] = options.periodOfReportDateLte;

  const response = await massiveClient.get('/vX/reference/financials', { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveFinancial {
  id: string;
  start_date: string;
  end_date: string;
  filing_date: string;
  timeframe: string;
  fiscal_period: string;
  fiscal_year: string;
  source_filing_url: string;
  source_filing_file_url: string;
  financials: {
    income_statement: {
      revenues: { value: number; unit: string; label: string };
      cost_of_revenue?: { value: number; unit: string; label: string };
      gross_profit?: { value: number; unit: string; label: string };
      operating_expenses?: { value: number; unit: string; label: string };
      operating_income_loss?: { value: number; unit: string; label: string };
      net_income_loss: { value: number; unit: string; label: string };
      basic_earnings_per_share?: { value: number; unit: string; label: string };
      diluted_earnings_per_share?: { value: number; unit: string; label: string };
      // Additional line items...
    };
    balance_sheet: {
      assets: { value: number; unit: string; label: string };
      current_assets?: { value: number; unit: string; label: string };
      equity: { value: number; unit: string; label: string };
      liabilities: { value: number; unit: string; label: string };
      // Additional line items...
    };
    cash_flow_statement: {
      net_cash_flow: { value: number; unit: string; label: string };
      net_cash_flow_from_operating_activities?: { value: number; unit: string; label: string };
      net_cash_flow_from_investing_activities?: { value: number; unit: string; label: string };
      net_cash_flow_from_financing_activities?: { value: number; unit: string; label: string };
      // Additional line items...
    };
  };
}
```

**New ChatKit Function:** `get_financials`

```typescript
// Name: get_financials
// Description: "Get financial data (income, balance sheet, cash flow) from SEC filings"
// Parameters: { symbol: string, type?: "annual" | "quarterly", quarters?: number }
// Returns: { financials: FormattedFinancials[] }
// Tier: Pro (premium function)
```

**AI Coach Usage Example:**
> "NVDA's latest quarter shows revenue of $35.1B (up 94% YoY), operating income of $21.9B (62.3% margin), and free cash flow of $16.8B. The fundamental trajectory strongly supports the bullish case. Revenue has accelerated for 5 consecutive quarters."

**Test:**
- Unit test: financial data parsing
- Unit test: YoY growth calculation
- Unit test: handles missing fields gracefully
- Integration test: fetches valid financials for known ticker

---

### Task 3.3 — AI Coach System Prompt Enhancement

**Modify:** `backend/src/chatkit/systemPrompt.ts`

Add new capabilities to the system prompt so the AI Coach knows it can use the new functions:

```typescript
// Add to system prompt context section:

## Available Market Data (Massive.com Integration)

You have access to the following real-time and historical data through function calls:

### Real-Time Data
- **Market Status**: Whether exchanges are open, in pre-market, after-hours, or closed
- **Market Holidays**: Upcoming holidays and early closes
- **Live Prices**: Last trade and NBBO quote for any stock or index
- **Market Movers**: Today's top gaining and losing stocks
- **Market Breadth**: Advance/decline ratio, breadth thrust, market sentiment

### Options Data
- **Options Chain**: Full chain with Greeks, IV, open interest
- **Gamma Exposure (GEX)**: Dealer gamma positioning and key levels
- **Zero DTE Analysis**: Theta decay projections and gamma risk
- **IV Analysis**: IV rank, skew, term structure

### Fundamental Data
- **Company Details**: Description, sector, market cap, employees
- **Financial Statements**: Income statement, balance sheet, cash flow from SEC filings
- **Dividends**: Upcoming ex-dates, yield, historical payments
- **Stock Splits**: Historical and upcoming split events

### News & Events
- **News**: Ticker-specific and market-wide news articles with sentiment
- **Earnings Calendar**: Upcoming earnings dates and estimates (if Benzinga available)

### Technical Analysis
- **Key Levels**: PDH/PDL/PDC, VWAP, ATR, Pivots, Fibonacci
- **Technical Indicators**: EMA, SMA, RSI, MACD
- **Chart Data**: Multi-timeframe OHLCV with overlays

### USAGE RULES:
1. Always check market status before providing real-time guidance
2. When discussing a symbol, proactively check for upcoming dividends or earnings
3. Reference news context when IV is elevated or unusual moves occur
4. Use market breadth to provide broader context beyond SPX/NDX
5. Warn about early close days when relevant to trade planning
6. Use financial data to support or challenge fundamental theses
```

---

### Task 3.4 — AI Coach Proactive Insights Engine

**Create:** `backend/src/services/proactiveInsights.ts`

```typescript
/**
 * Proactive Insights Engine
 *
 * Generates unprompted insights for the AI Coach based on current market conditions.
 * Called when a user opens the chat or at periodic intervals.
 *
 * Checks:
 * 1. Is there an early close or holiday this week?
 * 2. Do any watchlist symbols have earnings this week?
 * 3. Do any watchlist symbols go ex-dividend soon?
 * 4. Is market breadth diverging from index direction?
 * 5. Are there notable market movers relevant to the user?
 * 6. Is VIX elevated or spiking?
 */

export interface ProactiveInsight {
  type: 'holiday_warning' | 'earnings_alert' | 'dividend_alert' |
        'breadth_divergence' | 'mover_alert' | 'vix_alert' | 'news_alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  expiresAt: string;             // ISO 8601 — when this insight becomes stale
}

export async function generateProactiveInsights(
  userId: string,
  watchlistSymbols?: string[]
): Promise<ProactiveInsight[]>;
```

**New ChatKit Function:** `get_proactive_insights`

```typescript
// Name: get_proactive_insights
// Description: "Get AI-generated market insights and alerts relevant to the user"
// Parameters: {}
// Returns: ProactiveInsight[]
// Tier: All tiers (free — limited to 3 insights; Pro — unlimited)
```

**Test:**
- Unit test: each insight type generates correctly
- Unit test: priority sorting
- Unit test: expiration logic
- Integration test: returns insights based on mock market data

---

### Task 3.5 — Journal Enrichment with Daily Context

**Modify:** `backend/src/chatkit/functionHandlers.ts` → `get_journal_insights` handler

**Enhancement:** When the AI Coach analyzes a trade from the journal, auto-fetch the Daily Open/Close for that date and include:

```typescript
// Added context in journal insight response:
{
  tradeDate: "2026-02-10",
  dayContext: {
    spxOpen: 5842.15,
    spxClose: 5867.30,
    spxHigh: 5873.40,
    spxLow: 5835.20,
    spxRange: 38.20,           // High - Low
    spxRangeVsATR: 0.85,      // Range as % of ATR14
    preMarketPrice: 5840.50,
    afterHoursPrice: 5869.10,
    sessionType: "trending",   // trending | range-bound | volatile
    vixClose: 16.42,
  },
  // ... existing journal insight fields
}
```

**Test:**
- Unit test: day context calculation
- Unit test: session type classification
- Integration test: journal insight includes day context

---

### Task 3.6 — Functions Registry Update

**Modify:** `backend/src/chatkit/functions.ts`

Add all new function definitions to the AI function registry. Each function definition must include:

```typescript
{
  name: string;
  description: string;          // Clear, concise — used by GPT to decide when to call
  parameters: {
    type: "object",
    properties: { ... },
    required: [ ... ],
  }
}
```

**New functions to register:**

| Function Name | Description | Phase |
|--------------|-------------|-------|
| `get_market_holidays` | Get upcoming market holidays and early closes | 1 |
| `get_dividend_info` | Get dividend history and upcoming ex-dates | 1 |
| `get_market_movers` | Get today's top gaining and losing stocks | 2 |
| `get_market_breadth` | Get advance/decline ratio and market sentiment | 2 |
| `get_news` | Get latest news for a symbol or the market | 2 |
| `get_ticker_details` | Get company details, sector, market cap | 3 |
| `get_financials` | Get income statement, balance sheet, cash flow | 3 |
| `get_proactive_insights` | Get AI-generated alerts relevant to user | 3 |
| `get_execution_quality` | Analyze trade fill quality vs NBBO | 4 |
| `get_options_history` | Get historical price data for option contracts | 4 |
| `get_institutional_flow` | Detect block trades and sweeps | 4 |

**Also add to `PREMIUM_FUNCTIONS` set:**
- `get_financials`
- `get_execution_quality`
- `get_options_history`
- `get_institutional_flow`

---

### Task 3.7 — Watchlist Enhancement

**Modify:** `backend/src/routes/watchlist.ts` (or equivalent)

Enhance watchlist to use unified snapshot for batch price updates:

```typescript
// Instead of N individual price calls for watchlist symbols,
// use getUnifiedSnapshot() for all symbols at once
const snapshots = await getUnifiedSnapshot(
  watchlistSymbols.map(s => formatMassiveTicker(s))
);
```

**Test:**
- Unit test: batch snapshot handling
- Integration test: watchlist returns prices for all symbols

---

## 8. Phase 4 — Advanced Analytics & Flow Intelligence

> **Goal:** Add differentiated features that justify premium pricing — execution quality analysis, institutional flow detection, and historical options analytics.

### Task 4.1 — Historical Trades Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get historical trades for a ticker within a time range.
 * Endpoint: GET /v3/trades/{ticker}
 * Returns: Individual trade prints with conditions, exchange, size
 */
export async function getHistoricalTrades(
  ticker: string,
  options?: {
    timestampGte?: string;       // Nanoseconds or ISO 8601
    timestampLte?: string;
    limit?: number;              // Default 5000, max 50000
    order?: 'asc' | 'desc';
    sort?: 'timestamp';
  }
): Promise<MassiveHistoricalTrade[]> {
  const formattedTicker = formatMassiveTicker(ticker);
  const params: Record<string, string | number> = {};
  if (options?.timestampGte) params['timestamp.gte'] = options.timestampGte;
  if (options?.timestampLte) params['timestamp.lte'] = options.timestampLte;
  if (options?.limit) params.limit = options.limit;
  if (options?.order) params.order = options.order;
  if (options?.sort) params.sort = options.sort;

  const response = await massiveClient.get(`/v3/trades/${formattedTicker}`, { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveHistoricalTrade {
  conditions: number[];          // Trade condition codes
  correction: number;
  exchange: number;              // Exchange ID
  id: string;
  participant_timestamp: number; // Nanoseconds
  price: number;
  sequence_number: number;
  sip_timestamp: number;         // Nanoseconds
  size: number;                  // Share count
  trf_id: number;
  trf_timestamp: number;
}
```

---

### Task 4.2 — Historical Quotes (NBBO) Endpoint

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get historical NBBO quotes for a ticker.
 * Endpoint: GET /v3/quotes/{ticker}
 * Returns: Bid/ask history for execution quality analysis
 */
export async function getHistoricalQuotes(
  ticker: string,
  options?: {
    timestampGte?: string;
    timestampLte?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    sort?: 'timestamp';
  }
): Promise<MassiveHistoricalQuote[]> {
  const formattedTicker = formatMassiveTicker(ticker);
  const params: Record<string, string | number> = {};
  if (options?.timestampGte) params['timestamp.gte'] = options.timestampGte;
  if (options?.timestampLte) params['timestamp.lte'] = options.timestampLte;
  if (options?.limit) params.limit = options.limit;
  if (options?.order) params.order = options.order;

  const response = await massiveClient.get(`/v3/quotes/${formattedTicker}`, { params });
  return response.data.results || [];
}
```

**New Type:**
```typescript
interface MassiveHistoricalQuote {
  ask_exchange: number;
  ask_price: number;
  ask_size: number;
  bid_exchange: number;
  bid_price: number;
  bid_size: number;
  conditions: number[];
  indicators: number[];
  participant_timestamp: number;
  sequence_number: number;
  sip_timestamp: number;
  tape: number;
  trf_timestamp: number;
}
```

---

### Task 4.3 — Execution Quality Analyzer

**Create:** `backend/src/services/executionQuality.ts`

```typescript
/**
 * Execution Quality Analyzer
 *
 * Compares a user's reported trade fills against the historical NBBO
 * at the exact timestamp to assess execution quality.
 *
 * Metrics:
 * - Fill vs. Mid: How far from midpoint was the fill?
 * - Fill vs. NBBO: Was the fill inside or outside the NBBO?
 * - Effective Spread: What spread did the trader actually pay?
 * - Slippage: Estimated slippage in $ and bps
 * - Improvement: Did the fill improve upon the NBBO?
 */

export interface ExecutionQualityReport {
  tradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  fillPrice: number;
  fillTime: string;              // ISO 8601
  nbboAtFill: {
    bid: number;
    ask: number;
    mid: number;
    spread: number;
    spreadBps: number;           // Spread in basis points
  };
  quality: {
    fillVsMid: number;           // $ difference from mid
    fillVsMidBps: number;        // Basis points from mid
    effectiveSpread: number;     // $ effective spread paid
    effectiveSpreadBps: number;
    slippage: number;            // $ slippage (negative = improvement)
    priceImprovement: boolean;   // Fill inside NBBO
    grade: 'excellent' | 'good' | 'fair' | 'poor';
  };
  recommendations: string[];    // Execution improvement suggestions
}

export async function analyzeExecutionQuality(
  symbol: string,
  fillPrice: number,
  fillTime: string,
  side: 'buy' | 'sell'
): Promise<ExecutionQualityReport>;

export async function analyzePortfolioExecutionQuality(
  trades: Array<{ symbol: string; fillPrice: number; fillTime: string; side: 'buy' | 'sell' }>
): Promise<{
  trades: ExecutionQualityReport[];
  aggregate: {
    averageSlippage: number;
    averageSlippageBps: number;
    totalSlippageCost: number;
    priceImprovementRate: number;   // % of fills that improved
    overallGrade: string;
  };
}>;
```

**New ChatKit Function:** `get_execution_quality`

```typescript
// Name: get_execution_quality
// Description: "Analyze trade fill quality against the NBBO at time of execution"
// Parameters: {
//   symbol: string,
//   fillPrice: number,
//   fillTime: string,   // ISO 8601
//   side: "buy" | "sell"
// }
// Returns: ExecutionQualityReport
// Tier: Pro (premium function)
```

**AI Coach Usage Example:**
> "Your SPX 5850 put fill at $4.20 was $0.05 above the midpoint ($4.15) at 10:32:15 AM. The NBBO was $4.10 x $4.20, so you filled at the ask. That's a 'fair' execution — try using a limit order at the mid next time. On your last 20 trades, you've averaged 2.3 bps of slippage, costing roughly $47 total."

**Test:**
- Unit test: fill vs. NBBO comparison
- Unit test: grade classification thresholds
- Unit test: handles wide spreads (illiquid options)
- Unit test: portfolio aggregate calculation

---

### Task 4.4 — Options Aggregates (Contract-Level History)

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
/**
 * Get OHLCV bars for a specific options contract.
 * Endpoint: GET /v2/aggs/ticker/{optionTicker}/range/{multiplier}/{timespan}/{from}/{to}
 * Returns: Historical price bars for the option itself (not just the underlying)
 */
export async function getOptionsAggregates(
  optionTicker: string,          // e.g., "O:SPX260213C05850000"
  multiplier: number,
  timespan: 'minute' | 'hour' | 'day',
  from: string,                  // YYYY-MM-DD
  to: string                     // YYYY-MM-DD
): Promise<MassiveAggregate[]> {
  const response = await massiveClient.get(
    `/v2/aggs/ticker/${optionTicker}/range/${multiplier}/${timespan}/${from}/${to}`
  );
  return response.data.results || [];
}
```

**Usage:** Historical option price replay for trade review. Show how an option contract's price moved throughout the day alongside the underlying.

**New ChatKit Function:** `get_options_history`

```typescript
// Name: get_options_history
// Description: "Get historical price data for a specific options contract"
// Parameters: {
//   optionTicker: string,   // Full option ticker
//   timespan: "minute" | "hour" | "day",
//   from: string,
//   to: string
// }
// Returns: { bars: Aggregate[], metadata: { symbol, strike, expiry, type } }
// Tier: Pro (premium function)
```

**Test:**
- Unit test: option ticker parsing
- Unit test: aggregate response handling
- Integration test: fetches valid bars for recent option contract

---

### Task 4.5 — Conditions & Exchanges Reference (Flow Intelligence)

**Add to:** `backend/src/config/massive.ts`

**New Methods:**
```typescript
/**
 * Get all trade condition code definitions.
 * Endpoint: GET /v3/reference/conditions
 * Cache indefinitely — these rarely change.
 */
export async function getConditions(
  assetClass?: 'stocks' | 'options',
  dataType?: 'trade' | 'bbo' | 'nbbo'
): Promise<MassiveCondition[]> {
  const params: Record<string, string> = {};
  if (assetClass) params.asset_class = assetClass;
  if (dataType) params.data_type = dataType;

  const response = await massiveClient.get('/v3/reference/conditions', { params });
  return response.data.results || [];
}

/**
 * Get all exchange definitions.
 * Endpoint: GET /v3/reference/exchanges
 * Cache indefinitely.
 */
export async function getExchanges(
  assetClass?: 'stocks' | 'options' | 'crypto' | 'fx',
  locale?: 'us' | 'global'
): Promise<MassiveExchange[]> {
  const params: Record<string, string> = {};
  if (assetClass) params.asset_class = assetClass;
  if (locale) params.locale = locale;

  const response = await massiveClient.get('/v3/reference/exchanges', { params });
  return response.data.results || [];
}
```

**New Types:**
```typescript
interface MassiveCondition {
  id: number;
  type: string;             // "trade", "bbo", "nbbo"
  name: string;             // "Regular Sale", "Intermarket Sweep", etc.
  asset_class: string;
  data_types: string[];
  legacy: boolean;
  description?: string;
  sip_mapping: {
    CTA: string;
    UTP: string;
    OPRA?: string;
  };
  update_rules: {
    consolidated: { updates_high_low: boolean; updates_open_close: boolean; updates_volume: boolean };
    market_center: { updates_high_low: boolean; updates_open_close: boolean; updates_volume: boolean };
  };
}

interface MassiveExchange {
  id: number;
  type: string;             // "exchange", "TRF", "SIP"
  asset_class: string;
  locale: string;
  name: string;             // "New York Stock Exchange"
  acronym: string;          // "NYSE"
  mic: string;              // "XNYS"
  operating_mic: string;
  participant_id: string;
  url: string;
}
```

**Create:** `backend/src/services/flowIntelligence.ts`

```typescript
/**
 * Flow Intelligence Service
 *
 * Uses historical trades + condition codes to detect institutional activity:
 * - Block trades (large size, single print)
 * - Intermarket sweeps (aggressive fills across exchanges)
 * - Dark pool prints
 * - Unusual volume
 *
 * Condition code reference (loaded from /v3/reference/conditions):
 * - Code 15: "Intermarket Sweep" — aggressive institutional order
 * - Code 37: "Derivatively Priced" — dark pool/crossing network
 * - Block trades: size > 10,000 shares or notional > $200,000
 */

export interface FlowSignal {
  type: 'block_trade' | 'sweep' | 'dark_pool' | 'unusual_volume';
  symbol: string;
  timestamp: string;
  price: number;
  size: number;
  notional: number;              // Price * Size
  exchange: string;              // Human-readable exchange name
  conditions: string[];          // Human-readable condition names
  significance: 'high' | 'medium' | 'low';
  interpretation: string;        // "Large institutional buy on sweep — aggressive bullish signal"
}

export async function detectFlowSignals(
  symbol: string,
  lookbackMinutes?: number
): Promise<FlowSignal[]>;

export async function getUnusualVolumeSymbols(): Promise<Array<{
  symbol: string;
  volume: number;
  avgVolume: number;
  volumeRatio: number;           // Today's volume / 20-day avg
}>>;
```

**New ChatKit Function:** `get_institutional_flow`

```typescript
// Name: get_institutional_flow
// Description: "Detect block trades, sweeps, and institutional flow for a symbol"
// Parameters: { symbol: string, lookbackMinutes?: number }
// Returns: { signals: FlowSignal[], summary: string }
// Tier: Pro (premium function)
```

**AI Coach Usage Example:**
> "In the last 30 minutes, there were 3 intermarket sweeps on SPX 5850 calls totaling 2,400 contracts ($4.8M notional). The sweeps hit the ask aggressively, suggesting institutional urgency on the upside. Combined with positive GEX, this is a bullish flow signal."

**Test:**
- Unit test: block trade detection thresholds
- Unit test: sweep identification from condition codes
- Unit test: flow signal generation
- Integration test: handles high-volume periods without timeout

---

## 9. Phase 5 — Benzinga Partner Data (Conditional)

> **Conditional:** These endpoints require the Benzinga add-on. Check availability before implementing.

### Task 5.0 — Benzinga Availability Check

**Before implementing any Task 5.x:** Add a startup check in `massive.ts`:

```typescript
export async function checkBenzingaAvailability(): Promise<boolean> {
  try {
    await massiveClient.get('/v1/reference/earnings', { params: { ticker: 'AAPL', limit: 1 } });
    return true;
  } catch (error) {
    if (error.response?.status === 403) {
      logger.info('Benzinga endpoints not available on current plan');
      return false;
    }
    throw error;
  }
}
```

Store the result in a module-level flag. All Benzinga-dependent functions should check this flag and return `{ available: false, message: "Benzinga data not included in current plan" }` if unavailable.

---

### Task 5.1 — Earnings Calendar

**Add to:** `backend/src/config/massive.ts` (gated behind Benzinga check)

**New Method:**
```typescript
async getEarnings(
  ticker?: string,
  options?: {
    dateGte?: string;
    dateLte?: string;
    limit?: number;
    order?: 'asc' | 'desc';
  }
): Promise<MassiveEarnings[]>;
```

**New Type:**
```typescript
interface MassiveEarnings {
  ticker: string;
  name: string;
  date: string;                  // YYYY-MM-DD
  time_of_day: string;           // "bmo" (before open), "amc" (after close)
  eps_estimate?: number;
  eps_actual?: number;
  eps_surprise?: number;
  eps_surprise_pct?: number;
  revenue_estimate?: number;
  revenue_actual?: number;
  revenue_surprise?: number;
}
```

**New ChatKit Function:** `get_earnings_calendar` (enhance existing stub)

---

### Task 5.2 — Analyst Ratings

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
async getAnalystRatings(
  ticker: string,
  options?: { limit?: number }
): Promise<MassiveAnalystRating[]>;
```

---

### Task 5.3 — Corporate Guidance

**Add to:** `backend/src/config/massive.ts`

**New Method:**
```typescript
async getCorporateGuidance(
  ticker: string,
  options?: { limit?: number }
): Promise<MassiveCorporateGuidance[]>;
```

---

## 10. Testing Strategy

### Test Framework

Repo-aligned testing is split by package:

- **Backend (Express in `backend/`):** Jest (already configured via `backend/jest.config.js`)
- **Frontend/Shared libs (repo root):** Vitest (already configured via `vitest.config.ts`)
- **E2E Tests:** Playwright (repo root)
- **Live Massive integration tests:** Jest (backend) gated behind `RUN_INTEGRATION_TESTS=true`

### Test File Structure

```
backend/src/
├── config/__tests__/
│   ├── massive.test.ts                  (EXPAND — add new method tests)
│   └── massive-integration.test.ts      (NEW — live API tests, gated)
├── services/__tests__/
│   ├── marketConstants.test.ts          (NEW)
│   ├── marketHolidays.test.ts           (NEW)
│   ├── realTimePrice.test.ts            (NEW)
│   ├── marketBreadth.test.ts            (NEW)
│   ├── dividendAlert.test.ts            (NEW)
│   ├── proactiveInsights.test.ts        (NEW)
│   ├── executionQuality.test.ts         (NEW)
│   └── flowIntelligence.test.ts         (NEW)
├── services/options/__tests__/
│   ├── optionsChainFetcher.test.ts      (MODIFY — update for new constants)
│   └── ...existing tests...
└── chatkit/__tests__/
    └── functionHandlers.test.ts         (EXPAND — add new function tests)

lib/**/__tests__/
└── (optional) thin tests for Next.js proxy helpers (Vitest)
```

### Test Categories

**Category 1 — Unit Tests (Mock API)**
Every new method in `massive.ts` gets a unit test with mocked Axios responses verifying:
- Correct URL construction
- Correct parameter passing
- Response parsing
- Error handling (400, 403, 429, 500)
- Type safety

**Category 2 — Service Logic Tests**
Every new service gets unit tests verifying:
- Business logic calculations (breadth ratios, execution quality grades, etc.)
- Cache behavior (TTL expiration, cache hits/misses)
- Fallback behavior (API down → graceful degradation)
- Edge cases (weekends, holidays, missing data)

**Category 3 — Integration Tests (Live API)**
Gated behind `RUN_INTEGRATION_TESTS=true` environment variable:
- Each new `massive.ts` method makes a real API call
- Verifies response shape matches TypeScript types
- Tests rate limiting behavior
- Tests pagination for large result sets

**Category 4 — ChatKit Function Tests**
Each new AI function gets tests verifying:
- Correct dispatch from `executeFunctionCall()`
- Parameter validation
- Tier-gating (premium functions return error for free users)
- Response format matches what the AI model expects
- Timeout handling

**Category 5 — E2E Tests (Playwright)**
- Dashboard loads with market status badge
- Market ticker shows 5 indices with change percentages
- News feed card renders headlines
- Market movers card shows gainers/losers
- AI Coach can answer "what's moving today?" using new functions

### Test Data Strategy

**Create:** `backend/src/__fixtures__/massive/`

```
massive/
├── marketStatus.json           (sample /v1/marketstatus/now response)
├── marketHolidays.json         (sample /v1/marketstatus/upcoming response)
├── tickerSnapshot.json         (sample /v2/snapshot/.../tickers/AAPL)
├── indicesSnapshot.json        (sample /v3/snapshot/indices response)
├── gainers.json                (sample /v2/snapshot/.../gainers)
├── losers.json                 (sample /v2/snapshot/.../losers)
├── lastTrade.json              (sample /v2/last/trade/AAPL)
├── lastQuote.json              (sample /v2/last/nbbo/AAPL)
├── dividends.json              (sample /v3/reference/dividends)
├── splits.json                 (sample /v3/reference/splits)
├── news.json                   (sample /v2/reference/news)
├── tickerDetails.json          (sample /v3/reference/tickers/AAPL)
├── financials.json             (sample /vX/reference/financials)
├── historicalTrades.json       (sample /v3/trades/AAPL)
├── historicalQuotes.json       (sample /v3/quotes/AAPL)
├── optionsAggregates.json      (sample option contract OHLCV)
├── conditions.json             (sample /v3/reference/conditions)
├── exchanges.json              (sample /v3/reference/exchanges)
├── groupedDailyBars.json       (sample /v2/aggs/grouped response)
└── dailyOpenClose.json         (sample /v1/open-close response)
```

---

## 11. Caching Architecture

### Cache Tier Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Market Status | 30 seconds | Near-real-time, low cost |
| Market Holidays | 24 hours | Changes infrequently |
| Last Trade / Last Quote | 5 seconds | Real-time pricing |
| Ticker Snapshot | 15 seconds | Dashboard refresh cycle |
| Indices Snapshot | 15 seconds | Dashboard refresh cycle |
| Gainers / Losers | 60 seconds | Acceptable staleness |
| Market Breadth | 5 minutes | Computationally expensive |
| News | 5 minutes | Acceptable staleness |
| Dividends | 7 days | Changes quarterly |
| Splits | 7 days | Rare events |
| Ticker Details | 30 days | Near-static data |
| Financials | 24 hours | Updates quarterly |
| Conditions Reference | 30 days | Near-static |
| Exchanges Reference | 30 days | Near-static |
| Execution Quality | No cache | Per-request analysis |
| Historical Trades | No cache | Per-request lookback |
| Historical Quotes | No cache | Per-request lookback |
| Options Aggregates | 60 seconds | Same as existing options cache |

### Cache Implementation

Use the existing Redis cache (`backend/src/config/redis.ts`) with a namespaced key pattern:

```typescript
// Key pattern: massive:{endpoint}:{params_hash}
// Example:  massive:market_status:{}
// Example:  massive:indices_snapshot:SPX_NDX_DJI_VIX_RUT
// Example:  massive:news:AAPL_10

const CACHE_KEY_PREFIX = 'massive';

function buildCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const hash = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('_');
  return `${CACHE_KEY_PREFIX}:${endpoint}:${hash}`;
}
```

### Cache Invalidation Rules

1. **Market hours change:** Clear market status cache when market opens/closes
2. **New trading day:** Clear all daily caches (snapshots, movers, breadth) at 4:00 AM ET
3. **Manual flush:** Admin endpoint to clear all Massive caches if needed
4. **TTL-based:** Primary invalidation mechanism for all caches

---

## 12. Error Handling & Resilience

### Error Classification

```typescript
enum MassiveErrorType {
  RATE_LIMITED = 'RATE_LIMITED',        // 429 — back off and retry
  UNAUTHORIZED = 'UNAUTHORIZED',       // 401/403 — API key issue
  NOT_FOUND = 'NOT_FOUND',             // 404 — ticker not found
  SERVER_ERROR = 'SERVER_ERROR',       // 5xx — Massive.com down
  TIMEOUT = 'TIMEOUT',                // Request exceeded 30s
  NETWORK_ERROR = 'NETWORK_ERROR',    // Connection failed
  PLAN_LIMIT = 'PLAN_LIMIT',          // 403 with plan limitation message
}
```

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504],
};
```

### Graceful Degradation Rules

| Scenario | Behavior |
|----------|----------|
| Market Status API down | Fall back to time-based logic in `marketHours.ts` |
| Snapshot API down | Fall back to `getDailyAggregates()` for price data |
| News API down | Show "News unavailable" in widget; AI Coach omits news context |
| Dividends API down | Fall back to `FALLBACK_DIVIDEND_YIELDS` map |
| Financials API down | AI Coach says "Financial data temporarily unavailable" |
| Historical trades/quotes down | Execution quality returns "Unable to verify — data unavailable" |
| All Massive.com down | Dashboard shows cached data with "Data may be delayed" banner |

### Circuit Breaker

```typescript
// Repo note: backend already has a circuit breaker implementation in backend/src/lib/circuitBreaker.ts
// Integrate it into backend/src/config/massive.ts so ALL Massive calls (routes, websocket, workers)
// share the same protection behavior.
//
// Implement circuit breaker for Massive.com API
// If 5 consecutive failures within 60 seconds:
// 1. Open circuit (stop making requests)
// 2. Wait 30 seconds
// 3. Half-open (allow one test request)
// 4. If test succeeds, close circuit (resume normal)
// 5. If test fails, re-open circuit

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  failureWindowMs: 60_000,
  recoveryTimeMs: 30_000,
};
```

---

## 13. Rate Limiting & Cost Management

### Massive.com Rate Limits

Implement a client-side rate limiter to stay within plan limits:

**Production requirement (multi-instance):** The limiter MUST be effective across:
- backend HTTP routes
- WebSocket polling loops
- background workers

If the backend can run multiple instances, an in-memory limiter is insufficient. Prefer:
- Redis-backed counters/queues (use `backend/src/config/redis.ts` when available), with
- an in-memory fallback only for local development.

```typescript
// Rate limiter configuration (adjust based on plan tier)
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 5,       // Free tier: 5/min
  // maxRequestsPerMinute: 100,  // Starter tier: ~100/min
  // Uncomment appropriate tier
  burstAllowance: 3,             // Allow 3 extra requests in burst
  windowMs: 60_000,
};
```

**Create:** `backend/src/config/rateLimiter.ts`

```typescript
/**
 * Client-side rate limiter for Massive.com API
 *
 * Uses a sliding window counter to prevent exceeding plan limits.
 * Queues excess requests rather than rejecting them.
 */

export class MassiveRateLimiter {
  private requestTimestamps: number[] = [];

  async acquirePermit(): Promise<void>;
  getQueueDepth(): number;
  getRemainingCapacity(): number;
}
```

### Request Priority

When approaching rate limits, prioritize requests:

| Priority | Requests | Rationale |
|----------|----------|-----------|
| 1 (Critical) | Market status, last trade/quote | Real-time user-facing data |
| 2 (High) | Options chain, levels, AI Coach functions | Core feature data |
| 3 (Medium) | News, movers, breadth | Dashboard enrichment |
| 4 (Low) | Financials, ticker details, conditions | Background/cached data |
| 5 (Background) | Dividend refresh, split refresh | Periodic maintenance |

---

## 14. Database Migrations

### New Tables Required

**Migration 1:** `ai_coach_market_data_cache`

```sql
-- Persistent cache for expensive/infrequent API responses
CREATE TABLE IF NOT EXISTS ai_coach_market_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  endpoint TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ai_coach_market_data_cache_key ON ai_coach_market_data_cache(cache_key);
CREATE INDEX idx_ai_coach_market_data_cache_expires ON ai_coach_market_data_cache(expires_at);
```

**Migration 2:** `ai_coach_execution_quality_history`

```sql
-- Track execution quality over time for user analytics
CREATE TABLE IF NOT EXISTS ai_coach_execution_quality_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  fill_price NUMERIC NOT NULL,
  fill_time TIMESTAMPTZ NOT NULL,
  nbbo_bid NUMERIC,
  nbbo_ask NUMERIC,
  nbbo_mid NUMERIC,
  slippage_bps NUMERIC,
  grade TEXT CHECK (grade IN ('excellent', 'good', 'fair', 'poor')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_execution_quality_user ON ai_coach_execution_quality_history(user_id);
CREATE INDEX idx_ai_coach_execution_quality_symbol ON ai_coach_execution_quality_history(symbol);
```

**Migration 3:** `ai_coach_proactive_insights_log`

```sql
-- Log generated insights for analytics and deduplication
CREATE TABLE IF NOT EXISTS ai_coach_proactive_insights_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ai_coach_proactive_insights_user ON ai_coach_proactive_insights_log(user_id);
CREATE INDEX idx_ai_coach_proactive_insights_type ON ai_coach_proactive_insights_log(insight_type);
```

### RLS Policies

```sql
-- ai_coach_execution_quality_history: Users can only see their own data
ALTER TABLE ai_coach_execution_quality_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own execution quality"
  ON ai_coach_execution_quality_history FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own execution quality"
  ON ai_coach_execution_quality_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ai_coach_proactive_insights_log: Users can only see their own insights
ALTER TABLE ai_coach_proactive_insights_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own insights"
  ON ai_coach_proactive_insights_log FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own insights"
  ON ai_coach_proactive_insights_log FOR UPDATE
  USING (auth.uid() = user_id);

-- ai_coach_market_data_cache: Service role only (no user access)
ALTER TABLE ai_coach_market_data_cache ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — accessed via service role key only
```

### Retention / Purge (Production Requirement)

This spec introduces `expires_at` columns. Production MUST include a scheduled purge:
- Delete expired rows from `ai_coach_market_data_cache` and `ai_coach_proactive_insights_log` at least daily.
- Prefer Supabase scheduled jobs (pg_cron / scheduled functions) or your deployment scheduler.

---

## 15. Environment Variables

### Repo Alignment Notes

- `MASSIVE_API_KEY` is required in the **backend** runtime (Express service in `backend/`).
- The Next.js app should not need `MASSIVE_API_KEY` if it proxies to backend `/api/market/*` endpoints (Section 0.1).
- Existing related env vars already in use by the repo and affected by this work:
  - `NEXT_PUBLIC_AI_COACH_API_URL` (frontend → backend base URL)
  - `ENABLE_TMX_CORPORATE_EVENTS` (earnings corporate-events endpoint toggle)
  - `ALPHA_VANTAGE_API_KEY`, `ALPHA_VANTAGE_BASE_URL` (earnings fallback)

### New Variables

```env
# No new required variables — all new endpoints use the existing MASSIVE_API_KEY (backend)

# Optional: Fine-tune behavior
MASSIVE_RATE_LIMIT_PER_MINUTE=5       # Adjust per plan tier (default: 5)
MASSIVE_CIRCUIT_BREAKER_ENABLED=true  # Enable circuit breaker (default: true)
MASSIVE_BENZINGA_ENABLED=false        # Set true if Benzinga add-on active
RUN_INTEGRATION_TESTS=false           # Set true in CI for live API tests
```

### Modify `backend/src/config/env.ts`

Add optional validation for new variables:

```typescript
// Add to envSchema:
MASSIVE_RATE_LIMIT_PER_MINUTE: z.coerce.number().optional().default(5),
MASSIVE_CIRCUIT_BREAKER_ENABLED: z.coerce.boolean().optional().default(true),
MASSIVE_BENZINGA_ENABLED: z.coerce.boolean().optional().default(false),
```

---

## 16. Acceptance Criteria

### Phase 0 — Cleanup

- [ ] No hardcoded risk-free rate outside `marketConstants.ts`
- [ ] No hardcoded dividend yields outside `marketConstants.ts`
- [ ] No direct `fetch()`/Axios calls to `api.massive.com` in runtime code outside `backend/src/config/massive.ts`
- [ ] No `console.log` in `app/` directory (all replaced with logger)
- [ ] IV Rank uses proper percentile calculation
- [ ] Clean TypeScript compilation with no unused warnings
- [ ] All existing tests pass after refactoring

### Phase 1 — Core Infrastructure

- [ ] `getMarketStatusNow()` fetches real-time exchange status (Massive endpoint)
- [ ] `getMarketHolidaysUpcoming()` returns upcoming holidays (Massive endpoint)
- [ ] `getLastTrade()` returns most recent trade
- [ ] `getLastQuote()` returns current NBBO
- [ ] (Optional pack) `getDividends()` returns dividend history
- [ ] (Optional pack) `getSplits()` returns split history
- [ ] Market status falls back to time-based logic when API unavailable
- [ ] (Optional pack) Dividend yields auto-refresh from API data
- [ ] Backend market routes exist: `/api/market/status`, `/api/market/holidays`, `/api/market/indices`
- [ ] All Phase 1 unit tests pass
- [ ] All Phase 1 integration tests pass (when `RUN_INTEGRATION_TESTS=true`)

### Phase 2 — Dashboard & Market Intelligence

- [ ] Market ticker route uses indices snapshot (single API call for 5 indices)
- [ ] Live market ticker consumes `/ws/prices` for active updates (no 15s REST polling loop)
- [ ] Browser session uses a single shared WebSocket connection across ticker + setup + position widgets
- [ ] Market movers route returns top gainers/losers
- [ ] Market breadth calculation returns valid A/D ratios
- [ ] News route returns ticker-filtered articles
- [ ] Dashboard renders market status badge with correct state
- [ ] Dashboard renders 5-index ticker bar with change percentages
- [ ] Dashboard renders market movers card
- [ ] Dashboard renders news feed card
- [ ] All new components use `glass-card-heavy` styling
- [ ] All new components are mobile-responsive (stack on mobile)

### Phase 3 — AI Coach Enrichment

- [ ] AI Coach can answer "what's moving today?" using market movers
- [ ] AI Coach can answer "any holidays coming up?" using holidays endpoint
- [ ] AI Coach proactively warns about earnings/dividends for watchlist symbols
- [ ] AI Coach includes news context when discussing elevated IV
- [ ] AI Coach uses market breadth for broader market commentary
- [ ] AI Coach can provide company fundamentals on request
- [ ] All new ChatKit functions registered in `functions.ts`
- [ ] Premium functions properly gated behind Pro tier

### Phase 4 — Advanced Analytics

- [ ] Execution quality analyzer compares fills against historical NBBO
- [ ] Flow intelligence detects block trades and sweeps
- [ ] Options aggregates return contract-level OHLCV
- [ ] Condition codes are human-readable (not raw numbers)
- [ ] All Phase 4 features gated as premium functions

### Phase 5 — Benzinga (If Available)

- [ ] Benzinga availability auto-detected at startup
- [ ] Earnings calendar populates when available
- [ ] Analyst ratings accessible through AI Coach
- [ ] All Benzinga functions gracefully return "unavailable" message when add-on not active

### Cross-Cutting

- [ ] All new endpoints cached according to caching architecture table
- [ ] Circuit breaker protects against Massive.com outages
- [ ] Rate limiter prevents exceeding plan limits
- [ ] Realtime gateway uses one upstream Massive WS connection per feed type per backend instance
- [ ] All new database tables have RLS policies
- [ ] No references to "Polygon" or "Polygon.io" in runtime code (`app/`, `backend/`, `components/`, `lib/`) — docs may mention it historically
- [ ] No instances of `#D4AF37` in runtime code (`app/`, `backend/`, `components/`, `lib/`) — docs/guides may mention it as “forbidden”
- [ ] All new components follow Emerald Standard design system
- [ ] Frontend build completes without errors: `pnpm build`
- [ ] Frontend tests pass: `pnpm test`
- [ ] Backend build completes without errors: `cd backend && npm run build`
- [ ] Backend tests pass: `cd backend && npm test`
- [ ] E2E tests pass: `pnpm test:e2e`

---

## 17. File Manifest

### New Files to Create

```
backend/src/services/marketConstants.ts          (Phase 0)
backend/src/services/__tests__/marketConstants.test.ts
lib/logger.ts                                     (Phase 0)
backend/src/services/marketHolidays.ts           (Phase 1)
backend/src/services/__tests__/marketHolidays.test.ts
backend/src/services/realTimePrice.ts            (Phase 1)
backend/src/services/__tests__/realTimePrice.test.ts
backend/src/services/dividendAlert.ts            (Phase 1)
backend/src/services/__tests__/dividendAlert.test.ts
backend/src/services/marketBreadth.ts            (Phase 2)
backend/src/services/__tests__/marketBreadth.test.ts
backend/src/services/proactiveInsights.ts        (Phase 3)
backend/src/services/__tests__/proactiveInsights.test.ts
backend/src/services/executionQuality.ts         (Phase 4)
backend/src/services/__tests__/executionQuality.test.ts
backend/src/services/flowIntelligence.ts         (Phase 4)
backend/src/services/__tests__/flowIntelligence.test.ts
backend/src/config/rateLimiter.ts                (Phase 1)
backend/src/config/__tests__/rateLimiter.test.ts
backend/src/config/__docs__/massive-api-methods.md  (Phase 0)
backend/src/__fixtures__/massive/*.json          (All phases)
backend/src/routes/market.ts                     (Phase 1-2)
backend/src/routes/__tests__/market.test.ts      (Phase 1-2)

app/api/members/dashboard/market-status/route.ts   (Phase 1, optional proxy)
app/api/members/dashboard/market-holidays/route.ts  (Phase 1, optional proxy)
app/api/members/dashboard/market-movers/route.ts    (Phase 2, optional proxy)
app/api/members/dashboard/market-breadth/route.ts   (Phase 2, optional proxy)
app/api/members/dashboard/news/route.ts              (Phase 2, optional proxy)

components/dashboard/market-status-badge.tsx         (Phase 2)
components/dashboard/market-movers-card.tsx           (Phase 2)
components/dashboard/news-feed-card.tsx               (Phase 2)
components/dashboard/market-holidays-widget.tsx       (Phase 1)
```

### Files to Modify

```
backend/src/config/massive.ts                    (All phases — expand methods)
backend/src/config/env.ts                        (Phase 0 — add optional vars)
backend/src/services/marketHours.ts              (Phase 1 — add API integration)
backend/src/server.ts                            (Phase 1 — mount market router)
backend/src/services/websocket.ts                (Phase 1 — await async market status)
backend/src/workers/alertWorker.ts               (Phase 1 — await async market status)
backend/src/services/options/optionsChainFetcher.ts  (Phase 0+1 — fix constants)
backend/src/services/options/types.ts            (Phase 2+4 — expand types)
backend/src/services/leaps/rollCalculator.ts     (Phase 0 — use marketConstants)
backend/src/services/leaps/greeksProjection.ts   (Phase 0 — use marketConstants)
backend/src/chatkit/functionHandlers.ts          (Phase 1-4 — add new handlers)
backend/src/chatkit/functions.ts                 (Phase 1-4 — register new functions)
backend/src/chatkit/systemPrompt.ts              (Phase 3 — enhance AI instructions)
backend/src/lib/symbols.ts                       (Phase 2 — minor additions)
app/api/members/dashboard/market-ticker/route.ts (Phase 0+2 — rewrite)
components/dashboard/live-market-ticker.tsx       (Phase 2 — expand to 5 indices)
components/dashboard/customizable-dashboard.tsx  (Phase 2 — add new widgets)
```

---

## 18. Dependency Map

### Build Order (Phases MUST execute sequentially)

```
Phase 0 (Cleanup)
  ├── Task 0.0: Massive env alignment       (no deps)
  ├── Task 0.1: marketConstants.ts         (no deps)
  ├── Task 0.2: Consolidate market ticker  (no deps)
  ├── Task 0.3: Replace console.log        (needs lib/logger.ts)
  ├── Task 0.4: Fix IV Rank               (no deps)
  ├── Task 0.5: Remove dead imports        (after 0.1-0.4)
  └── Task 0.6: Document methods           (after 0.1-0.4)

Phase 1 (Core Infrastructure)
  ├── Task 1.0: Backend market router      (depends on 0.2)
  ├── Task 1.1: Market Status              (depends on 0.1, 0.2)
  ├── Task 1.2: Market Holidays            (depends on 1.1)
  ├── Task 1.3: Last Trade                 (no deps within phase)
  ├── Task 1.4: Last Quote + RealTimePrice (depends on 1.3)
  ├── Task 1.5: Dividends (optional pack)  (depends on 0.1, 1.4)
  └── Task 1.6: Splits (optional pack)     (no deps within phase)

Phase 2 (Dashboard)
  ├── Task 2.1: Ticker Snapshot            (no deps within phase)
  ├── Task 2.2: Indices Snapshot           (no deps within phase)
  ├── Task 2.2b: WS Multiplexing           (depends on 2.2)
  ├── Task 2.3: Gainers/Losers            (depends on 2.1 types)
  ├── Task 2.4: Grouped Daily / Breadth    (no deps within phase)
  ├── Task 2.5: Daily Open/Close           (no deps within phase)
  ├── Task 2.6: Unified Snapshot           (depends on 2.1, 2.2)
  ├── Task 2.7: News                       (no deps within phase)
  └── Task 2.8: Dashboard Widgets          (depends on 2.1-2.7)

Phase 3 (AI Coach)
  ├── Task 3.1: Ticker Details             (no deps within phase)
  ├── Task 3.2: Financials                 (no deps within phase)
  ├── Task 3.3: System Prompt Update       (depends on 3.1, 3.2)
  ├── Task 3.4: Proactive Insights         (depends on Phase 1+2 services)
  ├── Task 3.5: Journal Enrichment         (depends on 2.5)
  ├── Task 3.6: Functions Registry         (depends on all Phase 3 tasks)
  └── Task 3.7: Watchlist Enhancement      (depends on 2.6)

Phase 4 (Advanced Analytics)
  ├── Task 4.1: Historical Trades          (no deps within phase)
  ├── Task 4.2: Historical Quotes          (no deps within phase)
  ├── Task 4.3: Execution Quality          (depends on 4.1, 4.2)
  ├── Task 4.4: Options Aggregates         (no deps within phase)
  └── Task 4.5: Conditions + Flow Intel    (depends on 4.1)

Phase 5 (Benzinga — Conditional)
  ├── Task 5.0: Availability Check         (no deps)
  ├── Task 5.1: Earnings Calendar          (depends on 5.0)
  ├── Task 5.2: Analyst Ratings            (depends on 5.0)
  └── Task 5.3: Corporate Guidance         (depends on 5.0)
```

### Tasks That Can Run in Parallel (Within Each Phase)

**Phase 0:** Tasks 0.1, 0.2, 0.3, 0.4 can run in parallel
**Phase 1:** Tasks 1.1 and 1.3 can run in parallel; then 1.2 (needs 1.1), 1.4 (needs 1.3). Optional pack tasks 1.5/1.6 can run after 1.4.
**Phase 2:** Tasks 2.1, 2.2, 2.3-2.7 can mostly run in parallel; 2.2b (WS multiplexing) depends on 2.2 and should complete before 2.8; 2.8 (widgets) runs last
**Phase 3:** Tasks 3.1, 3.2 can run in parallel; 3.3-3.7 depend on earlier work
**Phase 4:** Tasks 4.1, 4.2, 4.4 can run in parallel; 4.3 and 4.5 depend on 4.1/4.2

---

## Appendix A — Design System Quick Reference

For all new UI components, follow these rules:

```css
/* Container */     glass-card-heavy
/* Primary color */ var(--emerald-elite) or #10B981
/* Accent color */  var(--champagne) or #F5EDCC
/* Background */    var(--onyx) or #0A0A0B
/* Positive */      #10B981 (emerald green)
/* Negative */      #EF4444 (red)
/* Neutral */       #6B7280 (gray)
/* Button */        btn-premium (emerald fill) or btn-premium-outline (border)
/* Text gradient */ text-gradient-emerald or text-gradient-champagne
/* Animation */     All transitions: 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)
/* Icons */         Lucide React only
/* Images */        next/image only
/* FORBIDDEN */     #D4AF37 (old gold), <Sparkles /> as logo, generic browser spinners
```

## Appendix B — API Base URL & Auth

```typescript
// ALL API calls go through:
const BASE_URL = 'https://api.massive.com';

// Auth header:
Authorization: `Bearer ${process.env.MASSIVE_API_KEY}`

// Index symbol prefix:
// SPX → I:SPX, NDX → I:NDX, DJI → I:DJI, VIX → I:VIX, RUT → I:RUT
```

---

**END OF SPEC**

*This document is designed for autonomous implementation by Codex or equivalent AI coding agents. Each task is self-contained with exact file paths, code examples, type definitions, and test requirements. Execute phases sequentially, tasks within phases can be parallelized per the dependency map.*
