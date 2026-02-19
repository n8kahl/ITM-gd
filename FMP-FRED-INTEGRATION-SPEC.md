# FMP + FRED Integration — Autonomous Development Spec

> **Status:** 6 of 13 tasks complete. 7 remaining.
> **Date:** February 18, 2026
> **Stack:** Express.js (TypeScript) backend, Next.js 16 frontend, Supabase, Redis
> **Backend root:** `backend/src/`

---

## What This Does

Adds two free data providers to the TITM AI Coach:

1. **FMP (Financial Modeling Prep)** — Earnings calendar (symbol, date, EPS/revenue estimates). Supplements the existing Massive.com/Benzinga earnings pipeline. Does NOT replace it.
2. **FRED (Federal Reserve Economic Data)** — Real economic calendar (CPI, NFP, GDP, FOMC, etc.) and Fed Funds rate. Replaces the procedural placeholder calendar in `macroContext.ts`.

Both are **feature-flagged** and **optional**. The app runs without them.

---

## Environment Variables

Already defined in `backend/src/config/env.ts` (zod schema). Must be set in `backend/.env`:

```
FMP_API_KEY=<key>
FMP_ENABLED=true
FRED_API_KEY=<key>
FRED_ENABLED=true
```

---

## Completed Work (DO NOT MODIFY)

These files are done. Read them for context but do not change them unless a task below explicitly says to.

| # | File | What it does |
|---|------|-------------|
| 1 | `config/fmp.ts` | FMP axios client, `getFMPEarningsCalendar(from, to)`, `testFMPConnection()`, 250/day rate limiter |
| 2 | `config/fred.ts` | FRED axios client, `getUpcomingReleaseDates()`, `getSeriesObservations()`, `testFREDConnection()`, curated `HIGH_IMPACT_RELEASES` (9 releases), `RELEASE_MAP` |
| 3 | `config/env.ts` | Added `FMP_API_KEY`, `FMP_ENABLED`, `FRED_API_KEY`, `FRED_ENABLED` (all optional, default false) |
| 4 | `services/economic/index.ts` | `getEconomicCalendar(daysAhead?, impactFilter?)` → `EconomicEvent[]`, `getCurrentFedFundsRate()` → `string\|null`. Redis cache (2h calendar, 6h series). Falls back to empty on disable. |
| 5 | `services/earnings/index.ts` | Added `fetchFMPCalendar()` and merge logic in `getEarningsCalendar()`. FMP enriches primary sources (fills missing estimates) or adds missed symbols. Source tagged `'fmp'`. |
| 6 | `services/macro/macroContext.ts` | `getMacroContext()` and `assessMacroImpact()` changed from **sync to async**. FRED calendar tried first, falls back to procedural. Fed rate from FRED, falls back to `'4.25-4.50%'`. |
| 7 | `routes/macro.ts` | Added `await` to `getMacroContext()` and `assessMacroImpact()` calls |
| 8 | `chatkit/functionHandlers.ts` | Added `await` to `getMacroContext()` and `assessMacroImpact()` at 3 call sites |
| 9 | `services/morningBrief/index.ts` | Added `await` to `getMacroContext()` call |

---

## Task 1: Create Economic Calendar REST Route

**Create file:** `backend/src/routes/economic.ts`

**Pattern to follow:** `backend/src/routes/earnings.ts` (same auth, validation, response structure)

```typescript
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { getEconomicCalendar } from '../services/economic';
import { z } from 'zod';

const router = Router();

// Validation schema
const economicCalendarQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
  impact: z.enum(['HIGH', 'MEDIUM', 'ALL']).default('ALL'),
});

// GET /calendar — Full calendar with configurable window
router.get(
  '/calendar',
  authenticateToken,
  validateQuery(economicCalendarQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { days, impact } = (req as any).validatedQuery as {
        days: number;
        impact: 'HIGH' | 'MEDIUM' | 'ALL';
      };

      const events = await getEconomicCalendar(days, impact);

      return res.json({
        daysAhead: days,
        impactFilter: impact,
        count: events.length,
        events,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to fetch economic calendar',
        message: error.message,
      });
    }
  }
);

// GET /calendar/upcoming — Convenience: next 7 days, HIGH impact only
router.get(
  '/calendar/upcoming',
  authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      const events = await getEconomicCalendar(7, 'HIGH');

      return res.json({
        daysAhead: 7,
        impactFilter: 'HIGH',
        count: events.length,
        events,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to fetch upcoming economic events',
        message: error.message,
      });
    }
  }
);

export default router;
```

**Also create:** `backend/src/schemas/economicValidation.ts` — only if you prefer extracting the zod schema to a separate file (following `macroValidation.ts` pattern). Inline in the route file is also acceptable.

---

## Task 2: Register Route in `server.ts`

**File:** `backend/src/server.ts`

**Step 1 — Add import** (after line 31, with the other route imports):
```typescript
import economicRouter from './routes/economic';
```

**Step 2 — Mount route** (after line 135 `app.use('/api/earnings', earningsRouter);`):
```typescript
app.use('/api/economic', economicRouter);
```

**Step 3 — Add to endpoints object** (line ~157 area, after the `earningsAnalysis` entry):
```typescript
economicCalendar: '/api/economic/calendar', economicUpcoming: '/api/economic/calendar/upcoming',
```

---

## Task 3: AI Coach Function Definition

**File:** `backend/src/chatkit/functions.ts`

**Location:** Add a new entry to the exported array, directly after the `get_macro_context` definition which ends at line 773 (before the closing `]`).

**Insert this object:**
```typescript
{
  type: 'function',
  function: {
    name: 'get_economic_calendar',
    description: 'Get upcoming economic data releases (CPI, NFP, GDP, FOMC, PPI, Retail Sales, PCE, ISM, Consumer Sentiment) that could impact market volatility and options pricing. Use when trader asks about upcoming macro events, economic releases, what might move the market this week, or before recommending trades near major data releases.',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: {
          type: 'number',
          description: 'Number of days to look ahead (default 7, max 60)',
        },
        impact_filter: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'ALL'],
          description: 'Filter by impact level (default HIGH). HIGH = CPI, NFP, GDP, FOMC. MEDIUM = PPI, Retail, ISM, Sentiment.',
        },
      },
    },
  },
},
```

---

## Task 4: AI Coach Function Handler

**File:** `backend/src/chatkit/functionHandlers.ts`

### 4a. Add import

Near the top of the file, add:
```typescript
import { getEconomicCalendar } from '../services/economic';
```

### 4b. Create handler function

Add this after the `handleGetEarningsCalendar` function (which ends at line 1291). Follow the exact same pattern:

```typescript
/**
 * Handler: get_economic_calendar
 * Returns upcoming high-impact economic releases from FRED.
 */
async function handleGetEconomicCalendar(args: {
  days_ahead?: number;
  impact_filter?: string;
}) {
  const daysAheadRaw = typeof args.days_ahead === 'number' ? args.days_ahead : 7;
  const daysAhead = Math.max(1, Math.min(60, Math.round(daysAheadRaw)));
  const impactFilter = (['HIGH', 'MEDIUM', 'ALL'].includes(args.impact_filter || '')
    ? args.impact_filter
    : 'HIGH') as 'HIGH' | 'MEDIUM' | 'ALL';

  try {
    const events = await withTimeout(
      () => getEconomicCalendar(daysAhead, impactFilter),
      FUNCTION_TIMEOUT_MS,
      'get_economic_calendar',
    );

    return withFreshness({
      daysAhead,
      impactFilter,
      count: events.length,
      events,
    }, {
      asOf: new Date().toISOString(),
      source: 'economic_calendar',
      delayed: false,
      staleAfterSeconds: 2 * 60 * 60,
    });
  } catch (error: any) {
    return {
      error: 'Failed to fetch economic calendar',
      message: error.message,
    };
  }
}
```

### 4c. Register in dispatch map

Find the `switch` statement containing the function dispatch (around line 189-233). Add a new case after the `get_macro_context` case (line 232):

```typescript
    case 'get_economic_calendar':
      return await handleGetEconomicCalendar(typedArgs);
```

---

## Task 5: AI Coach System Prompt Update

**File:** `backend/src/chatkit/systemPrompt.ts`

### 5a. Add tool reference

At line 84 (after `- **get_macro_context(symbol)** — Fed, calendar, sectors`), add:
```
- **get_economic_calendar(days_ahead, impact_filter)** — Upcoming economic releases (CPI, NFP, GDP, FOMC)
```

### 5b. Add behavioral directive

At line 188 (after `'\nWhen VIX > 25, note elevated fear. When VIX < 15, note complacency.'`), add:
```typescript
prompt += '\nWhen high-impact economic events (CPI, NFP, FOMC, GDP) are within 48 hours, proactively warn about potential volatility impact on open positions and IV changes. Use get_economic_calendar to check before recommending new trades.';
```

---

## Task 6: Frontend Client Function

**File:** `lib/api/ai-coach.ts`

**Pattern to follow:** The existing `getEarningsCalendar` function at lines 1005-1030.

### 6a. Add response interface

Near the other response interfaces:
```typescript
export interface EconomicCalendarEvent {
  date: string;
  event: string;
  expected: string | null;
  previous: string | null;
  actual: string | null;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  relevance: string;
}

export interface EconomicCalendarResponse {
  daysAhead: number;
  impactFilter: string;
  count: number;
  events: EconomicCalendarEvent[];
}
```

### 6b. Add client function

After the `getEarningsCalendar` function:
```typescript
export async function getEconomicCalendar(
  token: string,
  daysAhead: number = 7,
  impactFilter: 'HIGH' | 'MEDIUM' | 'ALL' = 'HIGH',
): Promise<EconomicCalendarResponse> {
  const params = new URLSearchParams();
  params.set('days', String(daysAhead));
  params.set('impact', impactFilter);

  const response = await fetch(
    `${API_BASE}/api/economic/calendar?${params.toString()}`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }));
    throw new AICoachAPIError(response.status, error);
  }

  return response.json();
}
```

**Note on proxy:** The frontend calls the backend directly via `API_BASE` (defaults to `http://localhost:3001`). There is no Next.js API proxy. No `next.config.mjs` changes needed.

---

## Task 7: Update `.env.example`

**File:** `backend/.env.example`

Add after line 20 (`# ALPHA_VANTAGE_BASE_URL=...`):

```bash

# FMP (Financial Modeling Prep) — free tier earnings calendar supplement
# Sign up: https://site.financialmodelingprep.com/register
# FMP_API_KEY=your-fmp-api-key
# FMP_ENABLED=false

# FRED (Federal Reserve Economic Data) — free economic calendar + macro series
# Sign up: https://fred.stlouisfed.org/docs/api/api_key.html
# FRED_API_KEY=your-fred-api-key
# FRED_ENABLED=false
```

---

## Task 8: Fix Test Files (Async Mock Migration)

The sync-to-async change in `macroContext.ts` breaks existing test mocks.

### 8a. `backend/src/chatkit/__tests__/wp8Handlers.test.ts`

**Line 70:** Change `getMacroContext: jest.fn().mockReturnValue({` → `getMacroContext: jest.fn().mockResolvedValue({`

**Line 96:** Change `assessMacroImpact: jest.fn().mockReturnValue({` → `assessMacroImpact: jest.fn().mockResolvedValue({`

### 8b. `backend/src/routes/__tests__/macro.test.ts`

**Lines 10-11:** The mock is already set up as `jest.fn()`. Check usages like `mockGetMacroContext.mockReturnValue(...)` and change to `mockGetMacroContext.mockResolvedValue(...)`. Same for `mockAssessMacroImpact`.

### 8c. `backend/src/services/macro/__tests__/macroContext.test.ts`

Every test case calls `getMacroContext()` or `assessMacroImpact()` synchronously. They now return Promises. Change all calls to `await` form:

```typescript
// Before:
const context = getMacroContext();

// After:
const context = await getMacroContext();
```

Make the test functions `async`:
```typescript
// Before:
it('should return...', () => {

// After:
it('should return...', async () => {
```

Also need to mock the FRED imports since the tests shouldn't make real API calls. Add at the top of the test file:
```typescript
jest.mock('../../../services/economic', () => ({
  getEconomicCalendar: jest.fn().mockResolvedValue([]),
  getCurrentFedFundsRate: jest.fn().mockResolvedValue(null),
}));
```

---

## Verification Plan

Run these checks after all tasks are complete:

### Check 1: TypeScript compilation
```bash
cd backend && npx tsc --noEmit
```
Must compile with zero errors.

### Check 2: Test suite
```bash
cd backend && npm test
```
All tests must pass (especially the three async-migrated test files).

### Check 3: FMP connection
```bash
curl http://localhost:3001/health/ready
# Then test FMP:
node -e "
const { testFMPConnection } = require('./dist/config/fmp');
testFMPConnection().then(r => console.log(JSON.stringify(r, null, 2)));
"
```
Expect `{ ok: true, sampleCount: >0 }`.

### Check 4: FRED connection
```bash
node -e "
const { testFREDConnection } = require('./dist/config/fred');
testFREDConnection().then(r => console.log(JSON.stringify(r, null, 2)));
"
```
Expect `{ ok: true, sampleCount: >0 }`.

### Check 5: Economic calendar endpoint
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/economic/calendar?days=14
```
Expect real FRED dates (CPI, NFP with actual dates, not procedural approximations). Events should have `impact`, `previous`, and `relevance` fields.

### Check 6: Earnings calendar with FMP merge
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3001/api/earnings/calendar?watchlist=AAPL,MSFT,NVDA&days=30"
```
Verify response includes events with `source: 'fmp'` alongside Massive/Benzinga events.

### Check 7: Macro context with FRED
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/macro
```
Verify `economicCalendar` has real FRED dates. Verify `fedPolicy.currentRate` is a real value (not hardcoded `4.25-4.50%`).

### Check 8: AI Coach integration
Send a chat message: *"What economic events are coming this week?"*
The coach should call `get_economic_calendar` and return real FRED release dates.

### Check 9: Fallback mode
Set `FRED_ENABLED=false` and `FMP_ENABLED=false` in `.env`. Restart server. Verify:
- `/api/macro` falls back to procedural economic calendar
- `/api/earnings/calendar` still works via Massive pipeline
- `/api/economic/calendar` returns empty events array (not an error)

---

## Key Patterns & Conventions

These are patterns used throughout this codebase. Follow them exactly.

- **Auth:** All API routes use `authenticateToken` middleware
- **Validation:** Zod schemas with `validateQuery()` / `validateParams()` middleware
- **Error responses:** `res.status(500).json({ error: '<label>', message: error.message })`
- **AI Coach handlers:** Wrap in `withTimeout()`, return via `withFreshness()`
- **Imports:** Use relative paths (not `@/` alias — that's frontend only)
- **Feature flags:** Check `process.env.X_ENABLED === 'true'`, return graceful empty on false
- **Logging:** Use `logger` from `../lib/logger` (winston). Use `.debug()` for fallbacks, `.warn()` for errors.
- **Redis cache:** Use existing `redisGet`/`redisSet` from `../config/redis` with TTL in seconds

---

## File Dependency Order

Execute tasks in this order to avoid import errors:

```
Task 7 (.env.example)          — no dependencies
Task 1 (routes/economic.ts)    — depends on services/economic (done)
Task 2 (server.ts)             — depends on Task 1
Task 3 (functions.ts)          — no dependencies
Task 4 (functionHandlers.ts)   — depends on services/economic (done)
Task 5 (systemPrompt.ts)       — no dependencies
Task 6 (frontend client)       — depends on Task 1+2 (backend running)
Task 8 (test fixes)            — depends on Tasks 1-5 being complete
```

Parallel-safe groups:
- **Group A (independent):** Tasks 1, 3, 5, 7
- **Group B (depends on A):** Tasks 2, 4, 6
- **Group C (last):** Task 8, then verification
