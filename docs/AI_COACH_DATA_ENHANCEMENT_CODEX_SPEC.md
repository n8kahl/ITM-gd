# AI Coach Data Enhancement Codex Spec

> **Version**: 1.0
> **Status**: Ready for autonomous execution
> **Prerequisite**: Phases 1–14 from `NAVIGATION_AND_AI_COACH_MOBILE_CODEX_SPEC.md`
> **Stack**: Next.js 16 App Router · TypeScript strict · Tailwind CSS 4 · Framer Motion · Radix UI · Vitest · Playwright

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Context](#2-architecture-context)
3. [Design System](#3-design-system)
4. [Phase 15 — System Prompt Enrichment](#4-phase-15--system-prompt-enrichment)
5. [Phase 16 — Massive.com API Expansion](#5-phase-16--massivecom-api-expansion)
6. [Phase 17 — New AI Functions & Handlers](#6-phase-17--new-ai-functions--handlers)
7. [Phase 18 — Intent Router Expansion](#7-phase-18--intent-router-expansion)
8. [Phase 19 — New Widget Cards](#8-phase-19--new-widget-cards)
9. [Phase 20 — Market Context Enrichment Pipeline](#9-phase-20--market-context-enrichment-pipeline)
10. [Testing Requirements](#10-testing-requirements)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Files Touched Summary](#12-files-touched-summary)
13. [Validation Commands](#13-validation-commands)
14. [Codex Execution Prompt](#14-codex-execution-prompt)

---

## 1. Overview

This spec adds 6 new AI functions, 6 new widget card types, and a significantly enriched system prompt context pipeline. It triples Massive.com API utilization from ~15% to ~45% by wiring news, company profiles, dividends, market breadth, unusual options activity, and real-time market status endpoints.

**Key deliverables:**

- Enriched system prompt with VIX, DXY, session phase, earnings proximity, and news digest
- 6 new callable AI functions: `get_ticker_news`, `get_company_profile`, `get_market_breadth`, `get_dividend_info`, `get_unusual_activity`, `compare_symbols`
- 6 new widget card types in the chat panel
- Enhanced `get_market_status` using live Massive.com endpoint instead of hardcoded hours
- Enhanced `get_current_price` using `getLastTrade()` for true real-time prices
- 5 new intent routing specs for news, fundamentals, breadth, dividends, and unusual options activity
- Complete Vitest coverage for all new code

---

## 2. Architecture Context

### Data flow (existing)

```
User message → intentRouter.ts → systemPrompt.ts (+ promptContext.ts)
  → OpenAI → function calls → functionHandlers.ts → backend services
  → Massive.com API → response → widget-cards.tsx renders
```

### Key files by role

| Role | File | Lines |
|------|------|-------|
| System prompt | `backend/src/chatkit/systemPrompt.ts` | ~200 |
| Prompt context builder | `backend/src/chatkit/promptContext.ts` | ~120 |
| Function definitions | `backend/src/chatkit/functions.ts` | ~600 |
| Function handlers | `backend/src/chatkit/functionHandlers.ts` | ~1050 |
| Intent router | `backend/src/chatkit/intentRouter.ts` | ~690 |
| Required backfill | `backend/src/chatkit/requiredBackfill.ts` | ~108 |
| Massive.com client | `backend/src/config/massive.ts` | ~950 |
| Widget cards | `components/ai-coach/widget-cards.tsx` | ~1050 |
| Widget actions | `components/ai-coach/widget-actions.ts` | ~175 |
| Market indices | `backend/src/services/marketIndices.ts` | ~78 |
| Market hours | `backend/src/services/marketHours.ts` | ~150 |

### Conventions

- **Imports**: Named exports. No default exports except React components.
- **Error handling**: Every handler wraps in `try/catch`, returns `{ error: string, message: string }` on failure.
- **Freshness**: All handlers use `withFreshness(data, { asOf, source, delayed, staleAfterSeconds })`.
- **Caching**: Redis via `cacheGet`/`cacheSet` with TTL in seconds.
- **Symbol validation**: `toValidSymbol(symbol)` → uppercased, 1–8 chars, alpha only.
- **Timeouts**: `withTimeout(fn, FUNCTION_TIMEOUT_MS, label)` wraps every async call.
- **Widget types**: Union type `WidgetType` in `widget-cards.tsx` line ~40.

---

## 3. Design System

| Token | Value | Usage |
|-------|-------|-------|
| Emerald | `#10B981` | Primary accent, positive values |
| Champagne | `#F3E5AB` | Alerts, warnings |
| Red | `#EF4444` | Negative values, bearish |
| Blue | `#3B82F6` | Info, links, neutral highlights |
| Background | `#0A0A0B` | Dark-only base |
| Card | `glass-card-heavy` | All widget cards |
| Text primary | `text-white` | — |
| Text muted | `text-white/50` | Metadata, timestamps |

---

## 4. Phase 15 — System Prompt Enrichment

### Task 15.1: Add session time awareness

**Modify**: `backend/src/chatkit/promptContext.ts`

Add a function that returns current ET time and session phase:

```typescript
type SessionPhase =
  | 'pre-market'       // 4:00–9:29 ET
  | 'opening-drive'    // 9:30–10:00 ET
  | 'mid-morning'      // 10:00–11:30 ET
  | 'midday'           // 11:30–13:30 ET
  | 'afternoon'        // 13:30–15:00 ET
  | 'power-hour'       // 15:00–15:45 ET
  | 'moc-imbalance'    // 15:45–16:00 ET
  | 'after-hours'      // 16:00–20:00 ET
  | 'closed';          // 20:00–4:00 ET

export function getSessionContext(): { time: string; phase: SessionPhase; phaseNote: string } {
  const now = new Date();
  const etTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const [hourStr, minStr] = etTime.split(':');
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  const totalMin = hour * 60 + min;

  let phase: SessionPhase;
  let phaseNote: string;

  if (totalMin < 240) { phase = 'closed'; phaseNote = 'Markets closed. Pre-market opens at 4:00 AM ET.'; }
  else if (totalMin < 570) { phase = 'pre-market'; phaseNote = 'Pre-market session. Thin liquidity, wide spreads.'; }
  else if (totalMin < 600) { phase = 'opening-drive'; phaseNote = 'Opening 30 min. High volatility, gap resolution period.'; }
  else if (totalMin < 690) { phase = 'mid-morning'; phaseNote = 'Mid-morning. Trend continuation or reversal setups.'; }
  else if (totalMin < 810) { phase = 'midday'; phaseNote = 'Midday chop zone. Reduced volume, mean-reversion bias.'; }
  else if (totalMin < 900) { phase = 'afternoon'; phaseNote = 'Afternoon session. Institutional flow building.'; }
  else if (totalMin < 945) { phase = 'power-hour'; phaseNote = 'Power hour. Elevated volume, trend resumption.'; }
  else if (totalMin < 960) { phase = 'moc-imbalance'; phaseNote = 'MOC imbalance window. Large order flow into close.'; }
  else if (totalMin < 1200) { phase = 'after-hours'; phaseNote = 'After-hours. Thin liquidity, earnings reactions.'; }
  else { phase = 'closed'; phaseNote = 'Markets closed.'; }

  return { time: etTime, phase, phaseNote };
}
```

### Task 15.2: Enrich market context injection

**Modify**: `backend/src/chatkit/promptContext.ts`

Currently `loadMarketContext()` only fetches SPX/NDX. Expand to include VIX, DXY (via `I:DXY`), and 10Y yield (via `I:TNX`):

```typescript
// Replace the existing loadMarketContext function body
export async function loadMarketContext(): Promise<string> {
  try {
    const [spxRes, ndxRes, vixRes, dxyRes, tnxRes] = await Promise.all([
      massiveClient.get('/v2/aggs/ticker/I:SPX/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:NDX/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:VIX/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:DXY/prev').catch(() => null),
      massiveClient.get('/v2/aggs/ticker/I:TNX/prev').catch(() => null),
    ]);

    const format = (res: any, symbol: string): string | null => {
      const r = res?.data?.results?.[0];
      if (!r) return null;
      const price = r.c;
      const change = r.c - r.o;
      const pct = ((change / r.o) * 100).toFixed(2);
      const sign = change >= 0 ? '+' : '';
      return `${symbol}: $${price.toFixed(2)} (${sign}${pct}%)`;
    };

    const session = getSessionContext();

    const lines = [
      `Current time: ${session.time} ET (${session.phase})`,
      session.phaseNote,
      '',
      [
        format(spxRes, 'SPX'),
        format(ndxRes, 'NDX'),
        format(vixRes, 'VIX'),
        format(dxyRes, 'DXY'),
        format(tnxRes, '10Y'),
      ].filter(Boolean).join(' | '),
    ];

    return lines.join('\n');
  } catch (error) {
    return 'Market context temporarily unavailable.';
  }
}
```

### Task 15.3: Add earnings proximity injection

**Modify**: `backend/src/chatkit/promptContext.ts`

Add a function called during prompt building that checks if any recently-discussed symbol has earnings within 5 days:

```typescript
import { getEarningsCalendar } from '../services/earnings';

export async function getEarningsProximityWarnings(symbols: string[]): Promise<string | null> {
  if (symbols.length === 0) return null;

  try {
    const events = await getEarningsCalendar(symbols.slice(0, 10), 5);
    if (events.length === 0) return null;

    const warnings = events.map((e) => {
      const daysText = e.date === new Date().toISOString().slice(0, 10)
        ? 'TODAY'
        : `in ${Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000)} days`;
      return `⚠ ${e.symbol} reports earnings ${daysText} (${e.time}). Factor IV crush risk into any options analysis.`;
    });

    return warnings.join('\n');
  } catch {
    return null;
  }
}
```

### Task 15.4: Inject context into system prompt

**Modify**: `backend/src/chatkit/systemPrompt.ts`

Add a new section to the system prompt template between `## RULES` and `## CRITICAL TECHNICAL ANALYSIS REASONING`. This section is populated dynamically:

```typescript
// Add after the RULES section in the SYSTEM_PROMPT template string:

## CURRENT MARKET CONTEXT (auto-populated)

{marketContext}

{earningsWarnings}

When this context includes earnings warnings, proactively mention IV crush risk and
suggest checking get_earnings_analysis() before recommending long options positions.
When session phase is 'moc-imbalance' or 'power-hour', note elevated volume.
When VIX > 25, note elevated fear. When VIX < 15, note complacency.
```

**Modify**: `backend/src/chatkit/chatService.ts` (or wherever the prompt is assembled)

Wire the new context functions into the prompt assembly:

```typescript
// In the function that builds the final system prompt:
const marketContext = await loadMarketContext();
const recentSymbols = extractSymbolsFromHistory(conversationHistory); // use last 5 messages
const earningsWarnings = await getEarningsProximityWarnings(recentSymbols);

const finalPrompt = SYSTEM_PROMPT
  .replace('{marketContext}', marketContext)
  .replace('{earningsWarnings}', earningsWarnings || 'No imminent earnings for discussed symbols.');
```

---

## 5. Phase 16 — Massive.com API Expansion

### Task 16.1: Add ticker news endpoint

**Modify**: `backend/src/config/massive.ts`

Add after the `searchReferenceTickers` function:

```typescript
export interface MassiveNewsArticle {
  id: string;
  publisher: { name: string; homepage_url?: string; logo_url?: string };
  title: string;
  author?: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  description?: string;
  keywords?: string[];
  insights?: Array<{
    ticker: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentiment_reasoning?: string;
  }>;
}

interface MassiveNewsResponse {
  results: MassiveNewsArticle[];
  next_url?: string;
  count?: number;
}

export async function getTickerNews(
  ticker: string,
  limit: number = 5,
): Promise<MassiveNewsArticle[]> {
  try {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
    const response = await massiveClient.get<MassiveNewsResponse>(
      '/v2/reference/news',
      {
        params: {
          ticker: ticker.toUpperCase(),
          limit: safeLimit,
          sort: 'published_utc',
          order: 'desc',
        },
      },
    );
    return response.data.results || [];
  } catch (error: any) {
    logger.error(`Failed to fetch news for ${ticker}`, { error: error.message });
    throw error;
  }
}
```

### Task 16.2: Add ticker details endpoint

**Modify**: `backend/src/config/massive.ts`

```typescript
export interface MassiveTickerDetail {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  market_cap?: number;
  phone_number?: string;
  address?: { address1?: string; city?: string; state?: string };
  description?: string;
  sic_code?: string;
  sic_description?: string;
  ticker_root?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: { logo_url?: string; icon_url?: string };
  share_class_shares_outstanding?: number;
  weighted_shares_outstanding?: number;
  round_lot?: number;
}

interface MassiveTickerDetailResponse {
  results: MassiveTickerDetail;
}

export async function getTickerDetails(ticker: string): Promise<MassiveTickerDetail> {
  try {
    const response = await massiveClient.get<MassiveTickerDetailResponse>(
      `/v3/reference/tickers/${ticker.toUpperCase()}`,
    );
    return response.data.results;
  } catch (error: any) {
    logger.error(`Failed to fetch ticker details for ${ticker}`, { error: error.message });
    throw error;
  }
}
```

### Task 16.3: Add dividends endpoint

**Modify**: `backend/src/config/massive.ts`

```typescript
export interface MassiveDividend {
  cash_amount: number;
  currency: string;
  declaration_date?: string;
  dividend_type: string;
  ex_dividend_date: string;
  frequency: number;
  pay_date?: string;
  record_date?: string;
  ticker: string;
}

interface MassiveDividendResponse {
  results: MassiveDividend[];
  next_url?: string;
}

export async function getDividends(
  ticker: string,
  options?: { limit?: number; order?: 'asc' | 'desc' },
): Promise<MassiveDividend[]> {
  try {
    const response = await massiveClient.get<MassiveDividendResponse>(
      '/v3/reference/dividends',
      {
        params: {
          ticker: ticker.toUpperCase(),
          limit: options?.limit ?? 4,
          order: options?.order ?? 'desc',
          sort: 'ex_dividend_date',
        },
      },
    );
    return response.data.results || [];
  } catch (error: any) {
    logger.error(`Failed to fetch dividends for ${ticker}`, { error: error.message });
    throw error;
  }
}
```

### Task 16.4: Add market status live endpoint

**Modify**: `backend/src/config/massive.ts`

```typescript
export interface MassiveMarketStatus {
  market: string;
  serverTime: string;
  exchanges: Record<string, string>;
  currencies: Record<string, string>;
  afterHours: boolean;
  earlyHours: boolean;
}

export async function getMarketStatusLive(): Promise<MassiveMarketStatus> {
  try {
    const response = await massiveClient.get<MassiveMarketStatus>('/v1/marketstatus/now');
    return response.data;
  } catch (error: any) {
    logger.error('Failed to fetch live market status', { error: error.message });
    throw error;
  }
}

export interface MassiveMarketHoliday {
  exchange: string;
  name: string;
  date: string;
  status: string;
  open?: string;
  close?: string;
}

export async function getMarketHolidays(): Promise<MassiveMarketHoliday[]> {
  try {
    const response = await massiveClient.get<MassiveMarketHoliday[]>('/v1/marketstatus/upcoming');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    logger.error('Failed to fetch market holidays', { error: error.message });
    throw error;
  }
}
```

### Task 16.5: Add grouped daily endpoint for breadth

**Modify**: `backend/src/config/massive.ts`

```typescript
interface MassiveGroupedDailyResponse {
  resultsCount: number;
  results: Array<{
    T: string;  // ticker
    o: number;  // open
    h: number;  // high
    l: number;  // low
    c: number;  // close
    v: number;  // volume
    vw: number; // vwap
    n: number;  // number of trades
  }>;
}

export async function getGroupedDaily(date: string): Promise<MassiveGroupedDailyResponse['results']> {
  try {
    const response = await massiveClient.get<MassiveGroupedDailyResponse>(
      `/v2/aggs/grouped/locale/us/market/stocks/${date}`,
    );
    return response.data.results || [];
  } catch (error: any) {
    logger.error(`Failed to fetch grouped daily for ${date}`, { error: error.message });
    throw error;
  }
}
```

---

## 6. Phase 17 — New AI Functions & Handlers

### Task 17.1: Add function definitions

**Modify**: `backend/src/chatkit/functions.ts`

Append to the `AI_FUNCTIONS` array:

```typescript
  {
    type: 'function',
    function: {
      name: 'get_ticker_news',
      description: 'Get recent news headlines for a stock or ETF. Returns up to 5 articles with publisher, title, date, and sentiment when available. Use this when users ask "why is X up/down?" or want news context.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock symbol (e.g., AAPL, NVDA, TSLA)'
          },
          limit: {
            type: 'number',
            description: 'Number of articles to return (1-10, default 5)',
            default: 5
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_profile',
      description: 'Get company details including sector, market cap, description, and employee count. Use for fundamental context when discussing a stock.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock symbol (e.g., AAPL, PLTR, MSFT)'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_breadth',
      description: 'Get market breadth analysis: advance/decline ratio, new highs vs new lows, and percentage of stocks above key moving averages. Use when assessing broad market health beyond just SPX.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (default: previous trading day)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_dividend_info',
      description: 'Get dividend information for a stock including upcoming ex-dates, yield, and payment history. Critical for assessing early assignment risk on short call options.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock symbol (e.g., AAPL, KO, JNJ)'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_unusual_activity',
      description: 'Scan for unusual options activity on a symbol: contracts where volume significantly exceeds open interest. Useful for detecting institutional positioning.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock symbol (e.g., AAPL, NVDA, SPY)'
          },
          min_volume_oi_ratio: {
            type: 'number',
            description: 'Minimum volume-to-OI ratio to flag as unusual (default: 3)',
            default: 3
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_symbols',
      description: 'Side-by-side comparison of 2-4 symbols: price, change, IV rank, key levels distance, and earnings proximity. Use when users ask to compare stocks.',
      parameters: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of 2-4 stock symbols to compare (e.g., ["AAPL", "MSFT"])',
            minItems: 2,
            maxItems: 4
          }
        },
        required: ['symbols']
      }
    }
  },
```

### Task 17.2: Add function handlers

**Modify**: `backend/src/chatkit/functionHandlers.ts`

Add imports at the top:

```typescript
import { getTickerNews, getTickerDetails, getDividends, getGroupedDaily, getOptionsSnapshot } from '../config/massive';
import { getEarningsCalendar } from '../services/earnings';
```

Add these handler functions before the `executeFunctionCall` switch statement:

```typescript
/**
 * Handler: get_ticker_news
 * Returns recent news articles for a symbol.
 */
async function handleGetTickerNews(args: { symbol: string; limit?: number }) {
  const validSymbol = toValidSymbol(args.symbol);
  if (!validSymbol) return invalidSymbolError();

  try {
    const articles = await withTimeout(
      () => getTickerNews(validSymbol, args.limit ?? 5),
      FUNCTION_TIMEOUT_MS,
      'get_ticker_news',
    );

    const formatted = articles.map((a) => ({
      title: a.title,
      publisher: a.publisher.name,
      published: a.published_utc,
      url: a.article_url,
      sentiment: a.insights?.find((i) => i.ticker === validSymbol)?.sentiment ?? null,
      sentimentReasoning: a.insights?.find((i) => i.ticker === validSymbol)?.sentiment_reasoning ?? null,
    }));

    return withFreshness({
      symbol: validSymbol,
      articleCount: formatted.length,
      articles: formatted,
    }, {
      asOf: new Date().toISOString(),
      source: 'ticker_news',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return { error: 'Failed to fetch news', message: error.message };
  }
}

/**
 * Handler: get_company_profile
 * Returns company details from Massive.com ticker reference.
 */
async function handleGetCompanyProfile(args: { symbol: string }) {
  const validSymbol = toValidSymbol(args.symbol);
  if (!validSymbol) return invalidSymbolError();

  try {
    const details = await withTimeout(
      () => getTickerDetails(validSymbol),
      FUNCTION_TIMEOUT_MS,
      'get_company_profile',
    );

    const marketCapB = details.market_cap
      ? `$${(details.market_cap / 1e9).toFixed(1)}B`
      : null;

    return withFreshness({
      symbol: validSymbol,
      name: details.name,
      description: details.description ?? null,
      sector: details.sic_description ?? null,
      sicCode: details.sic_code ?? null,
      marketCap: marketCapB,
      marketCapRaw: details.market_cap ?? null,
      totalEmployees: details.total_employees ?? null,
      exchange: details.primary_exchange,
      listDate: details.list_date ?? null,
      homepage: details.homepage_url ?? null,
      active: details.active,
    }, {
      asOf: new Date().toISOString(),
      source: 'company_profile',
      delayed: false,
      staleAfterSeconds: 86400,
    });
  } catch (error: any) {
    return { error: 'Failed to fetch company profile', message: error.message };
  }
}

/**
 * Handler: get_market_breadth
 * Returns advance/decline, new highs/lows from grouped daily data.
 */
async function handleGetMarketBreadth(args: { date?: string }) {
  try {
    const targetDate = args.date || new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const stocks = await withTimeout(
      () => getGroupedDaily(targetDate),
      FUNCTION_TIMEOUT_MS,
      'get_market_breadth',
    );

    if (!stocks.length) {
      return { error: 'No data available for this date', message: `No grouped daily data for ${targetDate}` };
    }

    let advancing = 0;
    let declining = 0;
    let unchanged = 0;
    let newHighs = 0;
    let newLows = 0;
    let totalVolume = 0;

    for (const s of stocks) {
      const change = s.c - s.o;
      if (change > 0) advancing++;
      else if (change < 0) declining++;
      else unchanged++;

      // Rough proxy: if close is within 2% of high and above a threshold, count as "near high"
      if (s.h > 0 && (s.c / s.h) > 0.98) newHighs++;
      if (s.l > 0 && (s.c / s.l) < 1.02) newLows++;
      totalVolume += s.v;
    }

    const adRatio = declining > 0 ? Number((advancing / declining).toFixed(2)) : advancing;
    const adLine = advancing - declining;
    const breadthPct = stocks.length > 0 ? Number(((advancing / stocks.length) * 100).toFixed(1)) : 0;

    return withFreshness({
      date: targetDate,
      totalStocks: stocks.length,
      advancing,
      declining,
      unchanged,
      advanceDeclineRatio: adRatio,
      advanceDeclineLine: adLine,
      breadthPercent: breadthPct,
      nearNewHighs: newHighs,
      nearNewLows: newLows,
      totalVolume,
      assessment: adRatio > 2 ? 'strong_breadth' : adRatio > 1.2 ? 'healthy' : adRatio > 0.8 ? 'mixed' : adRatio > 0.5 ? 'weak' : 'very_weak',
    }, {
      asOf: new Date().toISOString(),
      source: 'market_breadth',
      delayed: true,
      staleAfterSeconds: 3600,
    });
  } catch (error: any) {
    return { error: 'Failed to calculate market breadth', message: error.message };
  }
}

/**
 * Handler: get_dividend_info
 * Returns dividend history and upcoming ex-dates.
 */
async function handleGetDividendInfo(args: { symbol: string }) {
  const validSymbol = toValidSymbol(args.symbol);
  if (!validSymbol) return invalidSymbolError();

  try {
    const dividends = await withTimeout(
      () => getDividends(validSymbol, { limit: 8, order: 'desc' }),
      FUNCTION_TIMEOUT_MS,
      'get_dividend_info',
    );

    if (!dividends.length) {
      return withFreshness({
        symbol: validSymbol,
        hasDividend: false,
        message: `${validSymbol} does not pay a dividend or no dividend data available.`,
      }, {
        asOf: new Date().toISOString(),
        source: 'dividend_info',
        delayed: false,
        staleAfterSeconds: 86400,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = dividends.find((d) => d.ex_dividend_date >= today);
    const annualizedAmount = dividends.length >= 4
      ? dividends.slice(0, 4).reduce((sum, d) => sum + d.cash_amount, 0)
      : dividends[0].cash_amount * (dividends[0].frequency || 4);

    return withFreshness({
      symbol: validSymbol,
      hasDividend: true,
      lastDividend: {
        amount: dividends[0].cash_amount,
        exDate: dividends[0].ex_dividend_date,
        payDate: dividends[0].pay_date ?? null,
        frequency: dividends[0].frequency,
      },
      upcomingExDate: upcoming?.ex_dividend_date ?? null,
      upcomingAmount: upcoming?.cash_amount ?? null,
      annualizedAmount: Number(annualizedAmount.toFixed(4)),
      earlyAssignmentRisk: upcoming ? `Ex-date ${upcoming.ex_dividend_date}. Short calls ITM near ex-date carry early assignment risk.` : null,
      history: dividends.slice(0, 4).map((d) => ({
        exDate: d.ex_dividend_date,
        amount: d.cash_amount,
        payDate: d.pay_date ?? null,
      })),
    }, {
      asOf: new Date().toISOString(),
      source: 'dividend_info',
      delayed: false,
      staleAfterSeconds: 3600,
    });
  } catch (error: any) {
    return { error: 'Failed to fetch dividend info', message: error.message };
  }
}

/**
 * Handler: get_unusual_activity
 * Scans options snapshot for volume >> OI.
 */
async function handleGetUnusualActivity(args: { symbol: string; min_volume_oi_ratio?: number }) {
  const validSymbol = toValidSymbol(args.symbol);
  if (!validSymbol) return invalidSymbolError();

  const minRatio = args.min_volume_oi_ratio ?? 3;

  try {
    const snapshots = await withTimeout(
      () => getOptionsSnapshot(validSymbol),
      FUNCTION_TIMEOUT_MS,
      'get_unusual_activity',
    );

    const unusual = snapshots
      .filter((s) => {
        const vol = s.day?.volume ?? 0;
        const oi = s.open_interest ?? 0;
        return oi > 10 && vol > 0 && (vol / oi) >= minRatio;
      })
      .map((s) => ({
        contract: s.details?.contract_type === 'call' ? 'CALL' : 'PUT',
        strike: s.details?.strike_price,
        expiry: s.details?.expiration_date,
        volume: s.day?.volume ?? 0,
        openInterest: s.open_interest ?? 0,
        volumeOiRatio: Number(((s.day?.volume ?? 0) / (s.open_interest || 1)).toFixed(1)),
        lastPrice: s.day?.close ?? s.last_quote?.midpoint ?? null,
        impliedVol: s.implied_volatility ?? null,
      }))
      .sort((a, b) => b.volumeOiRatio - a.volumeOiRatio)
      .slice(0, 10);

    return withFreshness({
      symbol: validSymbol,
      minRatioUsed: minRatio,
      unusualCount: unusual.length,
      contracts: unusual,
      assessment: unusual.length > 5 ? 'high_unusual_activity' : unusual.length > 0 ? 'moderate_unusual_activity' : 'no_unusual_activity',
    }, {
      asOf: new Date().toISOString(),
      source: 'unusual_activity',
      delayed: false,
      staleAfterSeconds: 300,
    });
  } catch (error: any) {
    return { error: 'Failed to scan unusual activity', message: error.message };
  }
}

/**
 * Handler: compare_symbols
 * Side-by-side comparison compositing multiple existing functions.
 */
async function handleCompareSymbols(args: { symbols: string[] }) {
  const symbols = sanitizeSymbols(args.symbols || [], 4);
  if (symbols.length < 2) {
    return { error: 'At least 2 symbols required for comparison' };
  }

  try {
    const comparisons = await withTimeout(
      () => Promise.all(symbols.map(async (symbol) => {
        const [price, levels, earnings] = await Promise.allSettled([
          handleGetCurrentPrice({ symbol }),
          handleGetKeyLevels({ symbol, timeframe: 'intraday' }),
          getEarningsCalendar([symbol], 14),
        ]);

        const priceData = price.status === 'fulfilled' ? price.value : null;
        const levelsData = levels.status === 'fulfilled' ? levels.value : null;
        const earningsData = earnings.status === 'fulfilled' ? earnings.value : [];

        return {
          symbol,
          price: (priceData as any)?.price ?? null,
          change: (priceData as any)?.change ?? null,
          changePct: (priceData as any)?.changePct ?? null,
          nearestEarnings: earningsData[0]?.date ?? null,
          earningsTiming: earningsData[0]?.time ?? null,
          keyLevelsSummary: levelsData ? {
            nearestResistance: (levelsData as any)?.levels?.resistance?.[0]?.price ?? null,
            nearestSupport: (levelsData as any)?.levels?.support?.[0]?.price ?? null,
          } : null,
        };
      })),
      FUNCTION_TIMEOUT_MS,
      'compare_symbols',
    );

    return withFreshness({
      symbolCount: comparisons.length,
      comparisons,
    }, {
      asOf: new Date().toISOString(),
      source: 'symbol_comparison',
      delayed: false,
      staleAfterSeconds: 120,
    });
  } catch (error: any) {
    return { error: 'Failed to compare symbols', message: error.message };
  }
}
```

### Task 17.3: Wire handlers into executeFunctionCall switch

**Modify**: `backend/src/chatkit/functionHandlers.ts`

Add cases to the `executeFunctionCall` switch statement:

```typescript
    case 'get_ticker_news':
      return handleGetTickerNews(parsedArgs);
    case 'get_company_profile':
      return handleGetCompanyProfile(parsedArgs);
    case 'get_market_breadth':
      return handleGetMarketBreadth(parsedArgs);
    case 'get_dividend_info':
      return handleGetDividendInfo(parsedArgs);
    case 'get_unusual_activity':
      return handleGetUnusualActivity(parsedArgs);
    case 'compare_symbols':
      return handleCompareSymbols(parsedArgs);
```

### Task 17.4: Enhance get_market_status to use live endpoint

**Modify**: `backend/src/chatkit/functionHandlers.ts`

Replace the `handleGetMarketStatus` function body to try the live Massive.com endpoint first, falling back to the existing hardcoded logic:

```typescript
async function handleGetMarketStatus() {
  try {
    // Try live Massive.com market status first
    const liveStatus = await withTimeout(
      () => getMarketStatusLive(),
      5000, // shorter timeout for status check
      'get_market_status_live',
    );

    const nyseStatus = liveStatus.exchanges?.nyse || liveStatus.exchanges?.NYSE;
    const isOpen = nyseStatus === 'open';
    const isAfterHours = liveStatus.afterHours;
    const isPreMarket = liveStatus.earlyHours;

    let status: string;
    if (isOpen) status = 'open';
    else if (isPreMarket) status = 'pre-market';
    else if (isAfterHours) status = 'after-hours';
    else status = 'closed';

    const session = getSessionContext();

    return withFreshness({
      status,
      session: session.phase,
      sessionNote: session.phaseNote,
      currentTimeET: session.time,
      serverTime: liveStatus.serverTime,
      source: 'massive_live',
    }, {
      asOf: new Date().toISOString(),
      source: 'market_status',
      delayed: false,
      staleAfterSeconds: 60,
    });
  } catch {
    // Fall back to existing hardcoded logic
    const existing = getMarketStatusService();
    return withFreshness(existing, {
      asOf: new Date().toISOString(),
      source: 'market_status_fallback',
      delayed: false,
      staleAfterSeconds: 60,
    });
  }
}
```

### Task 17.5: Enhance get_current_price to use getLastTrade

**Modify**: `backend/src/chatkit/functionHandlers.ts`

In `handleGetCurrentPrice`, add `getLastTrade()` as the first attempt before the existing `getAggregates()` fallback:

```typescript
// At the top of handleGetCurrentPrice, before the existing aggregates fetch:
try {
  const lastTrade = await getLastTrade(formatMassiveTicker(validSymbol));
  if (lastTrade && lastTrade.price > 0) {
    return withFreshness({
      symbol: validSymbol,
      price: lastTrade.price,
      source: 'last_trade',
    }, {
      asOf: new Date().toISOString(),
      source: 'current_price',
      delayed: false,
      staleAfterSeconds: 30,
    });
  }
} catch {
  // Fall through to existing aggregates logic
}
```

---

## 7. Phase 18 — Intent Router Expansion

### Task 18.1: Add new intent specs

**Modify**: `backend/src/chatkit/intentRouter.ts`

Add to the `CoachIntentId` union type:

```typescript
  | 'ticker_news'
  | 'company_profile'
  | 'market_breadth'
  | 'dividend_info'
  | 'unusual_activity';
```

Add to the `INTENT_SPECS` array:

```typescript
  {
    id: 'ticker_news',
    phrases: ['news', 'headline', 'why is it up', 'why is it down', 'what happened', 'catalyst', 'announcement'],
    requiredFunctions: ['get_ticker_news'],
    recommendedFunctions: ['get_current_price'],
  },
  {
    id: 'company_profile',
    phrases: ['what does', 'what is', 'company info', 'about the company', 'sector', 'market cap', 'fundamentals'],
    requiredFunctions: ['get_company_profile'],
  },
  {
    id: 'market_breadth',
    phrases: ['market breadth', 'advance decline', 'new highs', 'new lows', 'broad market', 'breadth', 'how many stocks'],
    requiredFunctions: ['get_market_breadth'],
    recommendedFunctions: ['get_market_status'],
  },
  {
    id: 'dividend_info',
    phrases: ['dividend', 'ex-date', 'ex date', 'yield', 'early assignment', 'dividend risk'],
    requiredFunctions: ['get_dividend_info'],
    recommendedFunctions: ['get_current_price'],
  },
  {
    id: 'unusual_activity',
    phrases: ['unusual activity', 'unusual options', 'smart money', 'big volume', 'institutional', 'dark pool', 'options flow'],
    requiredFunctions: ['get_unusual_activity'],
    recommendedFunctions: ['get_options_chain'],
  },
```

### Task 18.2: Add to SYMBOL_SPECIFIC_FUNCTIONS and BACKFILL_ALLOWED_FUNCTIONS

**Modify**: `backend/src/chatkit/intentRouter.ts`

Add to `SYMBOL_SPECIFIC_FUNCTIONS`:

```typescript
  'get_ticker_news',
  'get_company_profile',
  'get_dividend_info',
  'get_unusual_activity',
```

**Modify**: `backend/src/chatkit/requiredBackfill.ts`

Add to `BACKFILL_ALLOWED_FUNCTIONS`:

```typescript
  'get_ticker_news',
  'get_company_profile',
  'get_dividend_info',
  'get_unusual_activity',
```

Add to the `buildBackfillArgs` switch:

```typescript
    case 'get_ticker_news':
    case 'get_company_profile':
    case 'get_dividend_info':
    case 'get_unusual_activity':
      if (!symbol) return null;
      return { symbol };
    case 'get_market_breadth':
      return {};
```

---

## 8. Phase 19 — New Widget Cards

### Task 19.1: Extend WidgetType union

**Modify**: `components/ai-coach/widget-cards.tsx`

Add to the `WidgetType` union type:

```typescript
  | 'ticker_news'
  | 'company_profile'
  | 'market_breadth'
  | 'dividend_info'
  | 'unusual_activity'
  | 'symbol_comparison'
```

### Task 19.2: Create widget card components

**Modify**: `components/ai-coach/widget-cards.tsx`

Add these card components. Each follows the existing pattern: receives `data: Record<string, unknown>`, extracts fields with `parseNumeric` / `String()`, renders inside the existing `WidgetCard` wrapper with `glass-card-heavy`.

```tsx
// ── TICKER NEWS CARD ──
function TickerNewsCard({ data }: { data: Record<string, unknown> }) {
  const symbol = String(data.symbol || '')
  const articles = Array.isArray(data.articles) ? data.articles.slice(0, 5) : []

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">{symbol} News</span>
        <span className="text-xs text-white/40">{articles.length} articles</span>
      </div>
      {articles.map((article: any, i: number) => {
        const sentiment = String(article.sentiment || '')
        const sentimentColor = sentiment === 'positive' ? 'text-emerald-400'
          : sentiment === 'negative' ? 'text-red-400' : 'text-white/50'
        return (
          <div key={i} className="group/row flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 leading-tight truncate">{String(article.title || '')}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-white/40">{String(article.publisher || '')}</span>
                {sentiment && <span className={cn('text-xs font-medium', sentimentColor)}>{sentiment}</span>}
              </div>
            </div>
          </div>
        )
      })}
      {articles.length === 0 && (
        <p className="text-sm text-white/40 py-2">No recent news found.</p>
      )}
    </div>
  )
}

// ── COMPANY PROFILE CARD ──
function CompanyProfileCard({ data }: { data: Record<string, unknown> }) {
  const name = String(data.name || data.symbol || '')
  const symbol = String(data.symbol || '')
  const description = String(data.description || '')
  const sector = String(data.sector || 'N/A')
  const marketCap = String(data.marketCap || 'N/A')
  const employees = data.totalEmployees ? Number(data.totalEmployees).toLocaleString() : 'N/A'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">{symbol}</span>
        <span className="text-xs text-white/50">{name}</span>
      </div>
      {description && (
        <p className="text-xs text-white/60 leading-relaxed line-clamp-3">{description}</p>
      )}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <p className="text-[10px] text-white/40 uppercase">Sector</p>
          <p className="text-xs text-white/80 truncate">{sector}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase">Market Cap</p>
          <p className="text-xs text-white/80">{marketCap}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase">Employees</p>
          <p className="text-xs text-white/80">{employees}</p>
        </div>
      </div>
    </div>
  )
}

// ── MARKET BREADTH CARD ──
function MarketBreadthCard({ data }: { data: Record<string, unknown> }) {
  const advancing = parseNumeric(data.advancing)
  const declining = parseNumeric(data.declining)
  const adRatio = parseNumeric(data.advanceDeclineRatio)
  const breadthPct = parseNumeric(data.breadthPercent)
  const assessment = String(data.assessment || '')
  const date = String(data.date || '')

  const assessmentColor = assessment.includes('strong') ? 'text-emerald-400'
    : assessment.includes('healthy') ? 'text-emerald-400/70'
    : assessment.includes('weak') ? 'text-red-400' : 'text-white/60'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Market Breadth</span>
        <span className="text-xs text-white/40">{date}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-white/40 uppercase">Advancing</p>
          <p className="text-lg font-bold text-emerald-400">{advancing}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase">Declining</p>
          <p className="text-lg font-bold text-red-400">{declining}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase">A/D Ratio</p>
          <p className="text-sm font-semibold text-white">{adRatio.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase">% Advancing</p>
          <p className="text-sm font-semibold text-white">{breadthPct.toFixed(1)}%</p>
        </div>
      </div>
      <p className={cn('text-xs font-medium capitalize', assessmentColor)}>
        {assessment.replace(/_/g, ' ')}
      </p>
    </div>
  )
}

// ── DIVIDEND INFO CARD ──
function DividendInfoCard({ data }: { data: Record<string, unknown> }) {
  const symbol = String(data.symbol || '')
  const hasDividend = Boolean(data.hasDividend)
  const annualized = data.annualizedAmount ? `$${Number(data.annualizedAmount).toFixed(2)}` : 'N/A'
  const upcomingDate = String(data.upcomingExDate || 'None scheduled')
  const risk = data.earlyAssignmentRisk ? String(data.earlyAssignmentRisk) : null

  if (!hasDividend) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-white/40" />
          <span className="text-sm font-semibold text-white">{symbol} Dividends</span>
        </div>
        <p className="text-sm text-white/50">No dividend data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">{symbol} Dividends</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-white/40 uppercase">Annualized</p>
          <p className="text-sm font-semibold text-white">{annualized}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase">Next Ex-Date</p>
          <p className="text-sm font-semibold text-white">{upcomingDate}</p>
        </div>
      </div>
      {risk && (
        <div className="mt-2 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300">{risk}</p>
        </div>
      )}
    </div>
  )
}

// ── UNUSUAL ACTIVITY CARD ──
function UnusualActivityCard({ data }: { data: Record<string, unknown> }) {
  const symbol = String(data.symbol || '')
  const contracts = Array.isArray(data.contracts) ? data.contracts.slice(0, 5) : []
  const assessment = String(data.assessment || '')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">{symbol} Unusual Options</span>
        <span className="text-xs text-white/40">{contracts.length} flagged</span>
      </div>
      {contracts.map((c: any, i: number) => (
        <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', c.contract === 'CALL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
              {c.contract}
            </span>
            <span className="text-sm text-white">${c.strike}</span>
            <span className="text-xs text-white/40">{c.expiry}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-amber-400 font-semibold">{c.volumeOiRatio}x</span>
            <span className="text-xs text-white/40 ml-1">vol/OI</span>
          </div>
        </div>
      ))}
      {contracts.length === 0 && (
        <p className="text-sm text-white/40 py-2">No unusual activity detected.</p>
      )}
    </div>
  )
}

// ── SYMBOL COMPARISON CARD ──
function SymbolComparisonCard({ data }: { data: Record<string, unknown> }) {
  const comparisons = Array.isArray(data.comparisons) ? data.comparisons : []

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Workflow className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Symbol Comparison</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-1 text-white/40 font-normal">Symbol</th>
              <th className="text-right py-1 text-white/40 font-normal">Price</th>
              <th className="text-right py-1 text-white/40 font-normal">Chg%</th>
              <th className="text-right py-1 text-white/40 font-normal">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c: any, i: number) => {
              const changePct = parseNumeric(c.changePct)
              return (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-1.5 font-semibold text-white">{c.symbol}</td>
                  <td className="py-1.5 text-right text-white/80">${parseNumeric(c.price).toFixed(2)}</td>
                  <td className={cn('py-1.5 text-right font-medium', changePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </td>
                  <td className="py-1.5 text-right text-white/50">{c.nearestEarnings || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### Task 19.3: Wire cards into renderWidget switch

**Modify**: `components/ai-coach/widget-cards.tsx`

Add cases to the main widget rendering switch:

```typescript
    case 'ticker_news':
      return <TickerNewsCard data={widget.data} />
    case 'company_profile':
      return <CompanyProfileCard data={widget.data} />
    case 'market_breadth':
      return <MarketBreadthCard data={widget.data} />
    case 'dividend_info':
      return <DividendInfoCard data={widget.data} />
    case 'unusual_activity':
      return <UnusualActivityCard data={widget.data} />
    case 'symbol_comparison':
      return <SymbolComparisonCard data={widget.data} />
```

---

## 9. Phase 20 — Market Context Enrichment Pipeline

### Task 20.1: Enhance marketIndices to include VIX, DXY, TNX

**Modify**: `backend/src/services/marketIndices.ts`

Expand `getMarketIndicesSnapshot` to fetch 5 indices instead of 2:

```typescript
// Replace the existing Promise.all with:
const [spxRes, ndxRes, vixRes, dxyRes, tnxRes] = await Promise.all([
  massiveClient.get('/v2/aggs/ticker/I:SPX/prev'),
  massiveClient.get('/v2/aggs/ticker/I:NDX/prev'),
  massiveClient.get('/v2/aggs/ticker/I:VIX/prev').catch(() => null),
  massiveClient.get('/v2/aggs/ticker/I:DXY/prev').catch(() => null),
  massiveClient.get('/v2/aggs/ticker/I:TNX/prev').catch(() => null),
]);

// Add VIX, DXY, TNX to the quotes array using the same pattern as SPX/NDX
```

Update the `IndexQuote` type and `MarketIndicesResponse` to include VIX flag:

```typescript
interface MarketIndicesResponse {
  quotes: IndexQuote[];
  metrics: {
    vwap: number | null;
    vixLevel: number | null;   // NEW
    vixChange: number | null;  // NEW
  };
  source: 'massive';
}
```

### Task 20.2: Add news digest to prompt context

**Modify**: `backend/src/chatkit/promptContext.ts`

```typescript
export async function getNewsDigest(symbols: string[]): Promise<string | null> {
  if (symbols.length === 0) return null;

  try {
    const primarySymbol = symbols[0];
    const articles = await getTickerNews(primarySymbol, 3);

    if (articles.length === 0) return null;

    const lines = articles.map(
      (a) => `- "${a.title}" (${a.publisher.name}, ${new Date(a.published_utc).toLocaleDateString()})`,
    );

    return `Recent ${primarySymbol} headlines:\n${lines.join('\n')}`;
  } catch {
    return null;
  }
}
```

Wire into the system prompt assembly alongside the earnings warnings.

---

## 10. Testing Requirements

### New Test Files

| File | Type | Purpose |
|------|------|---------|
| `backend/src/chatkit/__tests__/functionHandlers-news.test.ts` | Vitest | get_ticker_news handler: valid symbol, empty results, error fallback |
| `backend/src/chatkit/__tests__/functionHandlers-profile.test.ts` | Vitest | get_company_profile handler: valid, missing fields, invalid symbol |
| `backend/src/chatkit/__tests__/functionHandlers-breadth.test.ts` | Vitest | get_market_breadth handler: strong/weak/mixed assessment logic |
| `backend/src/chatkit/__tests__/functionHandlers-dividends.test.ts` | Vitest | get_dividend_info handler: has/no dividend, early assignment risk |
| `backend/src/chatkit/__tests__/functionHandlers-unusual.test.ts` | Vitest | get_unusual_activity handler: filtering, sorting, min ratio |
| `backend/src/chatkit/__tests__/functionHandlers-compare.test.ts` | Vitest | compare_symbols handler: 2 symbols, partial failures, empty |
| `backend/src/chatkit/__tests__/promptContext-enriched.test.ts` | Vitest | Session phase calculation, market context format, earnings proximity |
| `backend/src/chatkit/__tests__/intentRouter-expanded.test.ts` | Vitest | New intent matching: news, breadth, dividend, unusual phrases |
| `components/ai-coach/__tests__/widget-cards-new.test.tsx` | Vitest | All 6 new widget card renders with mock data |

---

## 11. Acceptance Criteria

### Blocking — Phase 15 (System Prompt)

1. System prompt includes current ET time and session phase
2. Market context includes VIX, DXY, 10Y in addition to SPX/NDX
3. Earnings proximity warning injects when symbol reports within 5 days
4. Session phase correctly identifies all 9 phases by ET time

### Blocking — Phase 16 (API Expansion)

5. `getTickerNews()` returns articles from `/v2/reference/news`
6. `getTickerDetails()` returns company info from `/v3/reference/tickers/{ticker}`
7. `getDividends()` returns dividend history from `/v3/reference/dividends`
8. `getMarketStatusLive()` returns status from `/v1/marketstatus/now`
9. `getGroupedDaily()` returns all stocks for a date from grouped endpoint

### Blocking — Phase 17 (Functions & Handlers)

10. All 6 new functions appear in `AI_FUNCTIONS` array
11. All 6 new handlers are wired in `executeFunctionCall` switch
12. `get_market_status` tries live endpoint, falls back to hardcoded
13. `get_current_price` tries `getLastTrade()` first, falls back to aggregates
14. All handlers return `withFreshness` envelope
15. All handlers wrap async calls in `withTimeout`
16. All handlers validate symbol with `toValidSymbol`

### Blocking — Phase 18 (Intent Router)

17. 5 new intent IDs added to `CoachIntentId` union
18. 5 new intent specs with phrases and required functions
19. New functions added to `SYMBOL_SPECIFIC_FUNCTIONS` and `BACKFILL_ALLOWED_FUNCTIONS`

### Blocking — Phase 19 (Widgets)

20. 6 new types added to `WidgetType` union
21. 6 new card components render without errors
22. Cards handle empty/missing data gracefully (no crashes)
23. Cards follow design system: dark bg, emerald accent, glass-card-heavy

### Blocking — Phase 20 (Context Pipeline)

24. `getMarketIndicesSnapshot` returns 5 indices (SPX, NDX, VIX, DXY, TNX)
25. News digest populates for primary symbol when available

---

## 12. Files Touched Summary

### New Files: 9

| File | Phase |
|------|-------|
| `backend/src/chatkit/__tests__/functionHandlers-news.test.ts` | 17 |
| `backend/src/chatkit/__tests__/functionHandlers-profile.test.ts` | 17 |
| `backend/src/chatkit/__tests__/functionHandlers-breadth.test.ts` | 17 |
| `backend/src/chatkit/__tests__/functionHandlers-dividends.test.ts` | 17 |
| `backend/src/chatkit/__tests__/functionHandlers-unusual.test.ts` | 17 |
| `backend/src/chatkit/__tests__/functionHandlers-compare.test.ts` | 17 |
| `backend/src/chatkit/__tests__/promptContext-enriched.test.ts` | 15 |
| `backend/src/chatkit/__tests__/intentRouter-expanded.test.ts` | 18 |
| `components/ai-coach/__tests__/widget-cards-new.test.tsx` | 19 |

### Modified Files: 10

| File | Phases |
|------|--------|
| `backend/src/chatkit/promptContext.ts` | 15 |
| `backend/src/chatkit/systemPrompt.ts` | 15 |
| `backend/src/chatkit/chatService.ts` | 15 |
| `backend/src/config/massive.ts` | 16 |
| `backend/src/chatkit/functions.ts` | 17 |
| `backend/src/chatkit/functionHandlers.ts` | 17 |
| `backend/src/chatkit/intentRouter.ts` | 18 |
| `backend/src/chatkit/requiredBackfill.ts` | 18 |
| `components/ai-coach/widget-cards.tsx` | 19 |
| `backend/src/services/marketIndices.ts` | 20 |

### Deleted Files: 0

---

## 13. Validation Commands

```bash
# Type checking
pnpm tsc --noEmit

# All unit tests
pnpm vitest run

# Specific new tests — function handlers
pnpm vitest run backend/src/chatkit/__tests__/functionHandlers-news.test.ts
pnpm vitest run backend/src/chatkit/__tests__/functionHandlers-profile.test.ts
pnpm vitest run backend/src/chatkit/__tests__/functionHandlers-breadth.test.ts
pnpm vitest run backend/src/chatkit/__tests__/functionHandlers-dividends.test.ts
pnpm vitest run backend/src/chatkit/__tests__/functionHandlers-unusual.test.ts
pnpm vitest run backend/src/chatkit/__tests__/functionHandlers-compare.test.ts

# Specific new tests — prompt context
pnpm vitest run backend/src/chatkit/__tests__/promptContext-enriched.test.ts

# Specific new tests — intent router
pnpm vitest run backend/src/chatkit/__tests__/intentRouter-expanded.test.ts

# Specific new tests — widget cards
pnpm vitest run components/ai-coach/__tests__/widget-cards-new.test.tsx

# Lint
pnpm lint

# Full validation
pnpm tsc --noEmit && pnpm vitest run && pnpm lint
```

---

## 14. Codex Execution Prompt

```
You are implementing a data enhancement layer for the AI Coach feature of a Next.js 16 trading platform (TypeScript strict, Tailwind, Vitest).

Read `docs/AI_COACH_DATA_ENHANCEMENT_CODEX_SPEC.md` in its entirety — it is the single source of truth. It contains 6 implementation phases (15-20), TypeScript code for every new addition, modification instructions for every existing file, and complete testing requirements.

Execute every phase in order (15 → 20). For each phase:

1. Apply all modifications to existing files as described.
2. Create all new test files with proper mocking of Massive.com API calls.
3. After each phase, run `pnpm tsc --noEmit` and fix any type errors before proceeding.

### Phase-by-phase checklist:

Phase 15: Modify promptContext.ts to add getSessionContext(), enhanced loadMarketContext() with VIX/DXY/TNX, and getEarningsProximityWarnings(). Modify systemPrompt.ts to add the dynamic context section. Modify chatService.ts to wire the new context into prompt assembly.

Phase 16: Modify massive.ts to add getTickerNews(), getTickerDetails(), getDividends(), getMarketStatusLive(), getMarketHolidays(), and getGroupedDaily() with full TypeScript interfaces.

Phase 17: Modify functions.ts to add 6 new function definitions. Modify functionHandlers.ts to add 6 new handlers + enhance get_market_status (live endpoint) and get_current_price (getLastTrade). Create 6 test files for handlers.

Phase 18: Modify intentRouter.ts to add 5 new intent IDs, 5 intent specs, and SYMBOL_SPECIFIC_FUNCTIONS entries. Modify requiredBackfill.ts to add backfill support. Create intent router test file.

Phase 19: Modify widget-cards.tsx to add 6 new WidgetType values and 6 new card components (TickerNewsCard, CompanyProfileCard, MarketBreadthCard, DividendInfoCard, UnusualActivityCard, SymbolComparisonCard). Create widget card test file.

Phase 20: Modify marketIndices.ts to fetch 5 indices. Add getNewsDigest() to promptContext.ts.

### After all phases:

Run the full validation suite:
```bash
pnpm tsc --noEmit && pnpm vitest run && pnpm lint
```

Commit each phase as a separate commit using conventional commit format:
- `feat(ai-coach): Phase 15 — system prompt enrichment`
- `feat(ai-coach): Phase 16 — Massive.com API expansion`
- `feat(ai-coach): Phase 17 — new AI functions and handlers`
- `feat(ai-coach): Phase 18 — intent router expansion`
- `feat(ai-coach): Phase 19 — new widget cards`
- `feat(ai-coach): Phase 20 — market context enrichment pipeline`

If any phase introduces type errors that block the next phase, fix them within that phase's commit. The spec has all the code — follow it precisely.
```
