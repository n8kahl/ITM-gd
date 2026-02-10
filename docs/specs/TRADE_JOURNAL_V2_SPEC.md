# Trade Journal V2 — Production Spec

> **Status:** Ready for implementation
> **Date:** 2026-02-10
> **Scope:** Full rewrite of the trade journal feature — simplified, hardened, production-grade
> **Philosophy:** Manual-first journaling. No drafts, no auto-journal, no AI Coach bridge. Three input methods: manual entry, screenshot upload, CSV import.

---

## 1. Goals & Non-Goals

### Goals

- Simple, reliable trade journaling with three input methods
- Accurate analytics with verified calculations
- Clean, minimal codebase with zero dead code
- Full test coverage on critical paths
- Secure by default (RLS, input validation, XSS prevention)
- Good UX: fast forms, clear feedback, responsive design

### Non-Goals (Explicitly Removed)

- Draft/auto-journal workflow
- AI Coach bridge / session context prefill
- Push notifications / PWA install prompts
- Behavioral insights worker
- Pattern analyzer service
- Real-time position tracking via external APIs

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js App Router)              │
│  /members/journal       → Main journal page │
│  /members/journal/analytics → Analytics     │
├─────────────────────────────────────────────┤
│  API Routes (/api/members/journal/*)        │
│  8 endpoints (down from 20)                 │
├─────────────────────────────────────────────┤
│  Validation Layer (Zod + sanitizer)         │
├─────────────────────────────────────────────┤
│  Supabase (Postgres + Storage)              │
│  RLS-enforced, single canonical table       │
└─────────────────────────────────────────────┘
```

### Tech Stack (No Changes)

- **Frontend:** Next.js 14 App Router, React 18, Tailwind CSS
- **Backend:** Next.js API routes (no separate Express backend for journal)
- **Database:** Supabase Postgres with RLS
- **Storage:** Supabase Storage (screenshots)
- **Validation:** Zod schemas
- **Charts:** Recharts (analytics), lightweight canvas (replay)

---

## 3. Database Schema

### 3.1 Canonical Table: `journal_entries`

One table. One migration. Replaces the 12 incremental migrations with a single clean schema.

```sql
CREATE TABLE public.journal_entries (
  -- Identity
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core trade data
  trade_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  symbol          TEXT NOT NULL CHECK (symbol ~ '^[A-Z0-9./]{1,16}$'),
  direction       TEXT NOT NULL CHECK (direction IN ('long', 'short')) DEFAULT 'long',
  contract_type   TEXT NOT NULL CHECK (contract_type IN ('stock', 'call', 'put')) DEFAULT 'stock',
  entry_price     NUMERIC(12,4),
  exit_price      NUMERIC(12,4),
  position_size   NUMERIC(12,4) CHECK (position_size > 0),
  pnl             NUMERIC(12,2),
  pnl_percentage  NUMERIC(8,4),
  is_winner       BOOLEAN GENERATED ALWAYS AS (CASE WHEN pnl IS NOT NULL THEN pnl > 0 ELSE NULL END) STORED,
  is_open         BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps (when the trade actually happened)
  entry_timestamp TIMESTAMPTZ,
  exit_timestamp  TIMESTAMPTZ,
  CHECK (exit_timestamp IS NULL OR entry_timestamp IS NULL OR exit_timestamp >= entry_timestamp),

  -- Risk management
  stop_loss       NUMERIC(12,4),
  initial_target  NUMERIC(12,4),
  hold_duration_min INTEGER CHECK (hold_duration_min >= 0),
  mfe_percent     NUMERIC(8,4),  -- Maximum Favorable Excursion %
  mae_percent     NUMERIC(8,4),  -- Maximum Adverse Excursion %

  -- Options fields (NULL for stocks)
  strike_price      NUMERIC(12,4),
  expiration_date   DATE,
  dte_at_entry      INTEGER CHECK (dte_at_entry >= 0),
  iv_at_entry       NUMERIC(8,4) CHECK (iv_at_entry >= 0),
  delta_at_entry    NUMERIC(8,4),
  theta_at_entry    NUMERIC(8,4),
  gamma_at_entry    NUMERIC(8,4),
  vega_at_entry     NUMERIC(8,4),
  underlying_at_entry NUMERIC(12,4),
  underlying_at_exit  NUMERIC(12,4),

  -- Psychology / self-assessment
  mood_before       TEXT CHECK (mood_before IN ('confident','neutral','anxious','frustrated','excited','fearful')),
  mood_after        TEXT CHECK (mood_after IN ('confident','neutral','anxious','frustrated','excited','fearful')),
  discipline_score  INTEGER CHECK (discipline_score BETWEEN 1 AND 5),
  followed_plan     BOOLEAN,
  deviation_notes   TEXT,

  -- Notes & tags
  strategy        TEXT,
  setup_notes     TEXT,
  execution_notes TEXT,
  lessons_learned TEXT,
  tags            TEXT[] DEFAULT '{}',
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),

  -- Screenshot
  screenshot_url          TEXT,
  screenshot_storage_path TEXT,

  -- AI grading (populated on-demand, not auto)
  ai_analysis     JSONB,

  -- Market context (populated by enrich endpoint)
  market_context  JSONB,

  -- Import tracking
  import_id       UUID,

  -- Favorites
  is_favorite     BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_journal_user_date ON journal_entries(user_id, trade_date DESC);
CREATE INDEX idx_journal_user_symbol ON journal_entries(user_id, symbol);
CREATE INDEX idx_journal_user_open ON journal_entries(user_id) WHERE is_open = true;
CREATE INDEX idx_journal_import ON journal_entries(import_id) WHERE import_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_journal_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_journal_entries_updated_at();
```

**Key design decisions:**
- `is_winner` is a **generated column** — no more P&L/winner mismatch bugs
- `direction` defaults to `'long'` and is NOT NULL — no more null direction bugs
- `contract_type` defaults to `'stock'` — clean enum, no `'spread'` (simplify)
- All functions use `SET search_path = ''` — fixes Supabase security warning
- `exit_timestamp >= entry_timestamp` enforced at DB level
- `position_size > 0` enforced at DB level
- Removed: `draft_status`, `is_draft`, `draft_expires_at`, `session_id`, `smart_tags`, `share_count`, `enriched_at`, `verification`, `screenshot_thumbnail_url`

### 3.2 Supporting Table: `import_history`

```sql
CREATE TABLE public.import_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker      TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  row_count   INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  duplicates  INTEGER NOT NULL DEFAULT 0,
  errors      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Supporting Table: `journal_streaks`

```sql
CREATE TABLE public.journal_streaks (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_entry_date DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.4 RLS Policies

Apply to ALL three tables:

```sql
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their entries" ON journal_entries
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass" ON journal_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all" ON journal_entries
  FOR SELECT USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);
```

Repeat pattern for `import_history` and `journal_streaks`.

### 3.5 Tables to DROP

```sql
DROP TABLE IF EXISTS public.trading_journal_entries CASCADE;
DROP TABLE IF EXISTS public.journal_quick_tags CASCADE;
DROP TABLE IF EXISTS public.journal_notifications CASCADE;
DROP TABLE IF EXISTS public.playbooks CASCADE;
DROP TABLE IF EXISTS public.behavioral_insights CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
-- Drop old materialized view
DROP MATERIALIZED VIEW IF EXISTS public.journal_analytics_cache;
```

---

## 4. API Endpoints

### 4.1 Endpoint Map (8 endpoints, down from 20)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/members/journal` | List entries with filters |
| POST | `/api/members/journal` | Create entry |
| PATCH | `/api/members/journal` | Update entry |
| DELETE | `/api/members/journal` | Delete entry |
| POST | `/api/members/journal/import` | CSV import |
| GET | `/api/members/journal/analytics` | Analytics data |
| POST | `/api/members/journal/screenshot-url` | Get signed upload URL |
| POST | `/api/members/journal/grade` | AI grade entries |

### 4.2 GET `/api/members/journal`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| startDate | ISO string | 90 days ago | Filter start |
| endDate | ISO string | now | Filter end |
| symbol | string | — | Filter by symbol |
| direction | 'long' \| 'short' | — | Filter by direction |
| contractType | 'stock' \| 'call' \| 'put' | — | Filter by type |
| isWinner | 'true' \| 'false' | — | Filter W/L |
| isOpen | 'true' \| 'false' | — | Open positions only |
| tags | comma-separated | — | Filter by tags |
| sortBy | 'trade_date' \| 'pnl' \| 'symbol' | 'trade_date' | Sort field |
| sortDir | 'asc' \| 'desc' | 'desc' | Sort direction |
| limit | number | 100 | Max 500 |
| offset | number | 0 | Pagination offset |

**Response:**

```typescript
{
  success: true,
  data: JournalEntry[],
  total: number,
  streaks: { current_streak: number, longest_streak: number }
}
```

### 4.3 POST `/api/members/journal`

**Body:** Validated by `journalEntryCreateSchema` (see Section 5).

**Business rules:**
- `symbol` is required, auto-uppercased
- If `entry_price` and `exit_price` provided but `pnl` missing, auto-calculate
- If `pnl` missing and can't calculate, set to null (don't error)
- `trade_date` defaults to now if not provided
- `is_open` = true means exit_price must be null
- After insert, update `journal_streaks`

**Response:** `{ success: true, data: JournalEntry }`

### 4.4 PATCH `/api/members/journal`

**Body:** `{ id: string, ...partialFields }` validated by `journalEntryUpdateSchema`.

**Business rules:**
- Only the owning user can update (RLS enforced)
- If `exit_price` is being set on an open position, auto-set `is_open = false`
- Re-calculate `pnl` if price fields change
- Update `journal_streaks` if `pnl` or `trade_date` changed

**Response:** `{ success: true, data: JournalEntry }`

### 4.5 DELETE `/api/members/journal`

**Query param:** `id` (required UUID).

**Business rules:**
- Only the owning user can delete (RLS enforced)
- Recalculate `journal_streaks` after delete
- If entry has `screenshot_storage_path`, delete the file from storage

**Response:** `{ success: true }`

### 4.6 POST `/api/members/journal/import`

**Body:**

```typescript
{
  broker: 'interactive_brokers' | 'schwab' | 'robinhood' | 'etrade' | 'fidelity' | 'webull',
  fileName: string,
  rows: Record<string, string>[]  // Pre-parsed CSV rows from client
}
```

**Business rules:**
- Client parses CSV using PapaParse (NOT naive split)
- Server normalizes fields per broker mapping
- Duplicate detection: match on `(user_id, symbol, DATE(trade_date), ABS(entry_price - existing) < 0.01 * existing)`
- Use database upsert with ON CONFLICT to prevent TOCTOU race
- Auto-calculate missing P&L
- Track import in `import_history`
- Max 500 rows per import

**Response:**

```typescript
{
  success: true,
  data: { importId: string, inserted: number, duplicates: number, errors: number }
}
```

### 4.7 GET `/api/members/journal/analytics`

**Query param:** `period: '7d' | '30d' | '90d' | '1y' | 'all'` (default `'30d'`)

**Response:** `AdvancedAnalyticsResponse` (see Section 5.3)

**Calculation requirements:**
- All division operations MUST guard against zero with `isFinite()` checks
- Sharpe/Sortino return `null` when fewer than 2 trades
- Profit factor returns `null` when gross loss = 0
- Hourly aggregation uses America/New_York timezone
- Equity curve tracks running P&L with drawdown from peak

### 4.8 POST `/api/members/journal/screenshot-url`

**Body:** `{ fileName: string, contentType: 'image/png' | 'image/jpeg' | 'image/webp' }`

**Business rules:**
- Generate signed upload URL for `journal-screenshots/{userId}/{uuid}/{fileName}`
- Validate file extension matches contentType
- Path must NOT contain `..` sequences (prevent traversal)
- Max file size: 5MB (enforced by Supabase storage policy)

**Response:** `{ success: true, uploadUrl: string, storagePath: string }`

### 4.9 POST `/api/members/journal/grade`

**Body:** `{ entryIds: string[] }` (max 10 per request)

**Business rules:**
- Fetches entries, sends to AI for analysis
- Stores structured grade in `ai_analysis` JSONB field
- Grade format: `{ grade: 'A'|'B'|'C'|'D'|'F', entry_quality: string, exit_quality: string, risk_management: string, lessons: string[], scored_at: ISO string }`

**Response:** `{ success: true, data: { entryId: string, grade: AITradeAnalysis }[] }`

---

## 5. Type Definitions & Validation

### 5.1 JournalEntry Type

```typescript
export interface JournalEntry {
  // Identity
  id: string
  user_id: string

  // Core
  trade_date: string          // ISO 8601
  symbol: string              // e.g. 'AAPL', 'SPY'
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null   // Generated column, read-only
  is_open: boolean

  // Timestamps
  entry_timestamp: string | null
  exit_timestamp: string | null

  // Risk
  stop_loss: number | null
  initial_target: number | null
  hold_duration_min: number | null
  mfe_percent: number | null
  mae_percent: number | null

  // Options (null when contract_type = 'stock')
  strike_price: number | null
  expiration_date: string | null  // ISO date
  dte_at_entry: number | null
  iv_at_entry: number | null
  delta_at_entry: number | null
  theta_at_entry: number | null
  gamma_at_entry: number | null
  vega_at_entry: number | null
  underlying_at_entry: number | null
  underlying_at_exit: number | null

  // Psychology
  mood_before: 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null
  mood_after: 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null
  discipline_score: number | null  // 1-5
  followed_plan: boolean | null
  deviation_notes: string | null

  // Notes & tags
  strategy: string | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  tags: string[]
  rating: number | null  // 1-5

  // Screenshot
  screenshot_url: string | null
  screenshot_storage_path: string | null

  // AI grading
  ai_analysis: AITradeAnalysis | null

  // Market context
  market_context: MarketContextSnapshot | null

  // Import
  import_id: string | null

  // Favorites
  is_favorite: boolean

  // Metadata
  created_at: string
  updated_at: string
}
```

### 5.2 Zod Validation Schemas

```typescript
// CREATE schema — symbol and direction required, everything else optional
export const journalEntryCreateSchema = z.object({
  symbol: z.string().min(1).max(16).transform(s => s.toUpperCase().trim())
    .refine(s => /^[A-Z0-9./]{1,16}$/.test(s), 'Invalid symbol format'),
  direction: z.enum(['long', 'short']).default('long'),
  contract_type: z.enum(['stock', 'call', 'put']).default('stock'),
  trade_date: z.string().datetime().optional(),
  entry_price: z.number().positive().max(999_999).nullable().optional(),
  exit_price: z.number().positive().max(999_999).nullable().optional(),
  position_size: z.number().positive().max(999_999).nullable().optional(),
  pnl: z.number().min(-999_999).max(999_999).nullable().optional(),
  pnl_percentage: z.number().min(-100_000).max(100_000).nullable().optional(),
  is_open: z.boolean().default(false),
  entry_timestamp: z.string().datetime().nullable().optional(),
  exit_timestamp: z.string().datetime().nullable().optional(),
  stop_loss: z.number().nonnegative().max(999_999).nullable().optional(),
  initial_target: z.number().nonnegative().max(999_999).nullable().optional(),
  hold_duration_min: z.number().int().nonnegative().max(525_600).nullable().optional(),
  mfe_percent: z.number().min(-100_000).max(100_000).nullable().optional(),
  mae_percent: z.number().min(-100_000).max(100_000).nullable().optional(),
  strike_price: z.number().positive().max(999_999).nullable().optional(),
  expiration_date: z.string().date().nullable().optional(),
  dte_at_entry: z.number().int().nonnegative().max(3_650).nullable().optional(),
  iv_at_entry: z.number().nonnegative().max(1_000).nullable().optional(),
  delta_at_entry: z.number().min(-10).max(10).nullable().optional(),
  theta_at_entry: z.number().min(-1_000).max(1_000).nullable().optional(),
  gamma_at_entry: z.number().min(-1_000).max(1_000).nullable().optional(),
  vega_at_entry: z.number().min(-1_000).max(1_000).nullable().optional(),
  underlying_at_entry: z.number().positive().max(999_999).nullable().optional(),
  underlying_at_exit: z.number().positive().max(999_999).nullable().optional(),
  mood_before: z.enum(['confident','neutral','anxious','frustrated','excited','fearful']).nullable().optional(),
  mood_after: z.enum(['confident','neutral','anxious','frustrated','excited','fearful']).nullable().optional(),
  discipline_score: z.number().int().min(1).max(5).nullable().optional(),
  followed_plan: z.boolean().nullable().optional(),
  deviation_notes: z.string().max(5_000).nullable().optional(),
  strategy: z.string().max(120).nullable().optional(),
  setup_notes: z.string().max(10_000).nullable().optional(),
  execution_notes: z.string().max(10_000).nullable().optional(),
  lessons_learned: z.string().max(10_000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  screenshot_url: z.string().url().max(2_048).nullable().optional(),
  screenshot_storage_path: z.string().max(512).nullable().optional(),
  is_favorite: z.boolean().default(false),
}).refine(data => {
  // Cross-field: exit_timestamp >= entry_timestamp
  if (data.entry_timestamp && data.exit_timestamp) {
    return new Date(data.exit_timestamp) >= new Date(data.entry_timestamp)
  }
  return true
}, { message: 'exit_timestamp must be >= entry_timestamp' })
.refine(data => {
  // Cross-field: open positions can't have exit_price
  if (data.is_open && data.exit_price != null) {
    return false
  }
  return true
}, { message: 'Open positions cannot have an exit price' })
.refine(data => {
  // Cross-field: options fields only valid for call/put
  if (data.contract_type === 'stock') {
    return data.strike_price == null && data.expiration_date == null
  }
  return true
}, { message: 'Stock entries cannot have strike price or expiration date' })

// UPDATE schema — everything optional, plus id required
export const journalEntryUpdateSchema = journalEntryCreateSchema
  .partial()
  .extend({ id: z.string().uuid() })
```

### 5.3 AdvancedAnalyticsResponse Type

```typescript
export interface AdvancedAnalyticsResponse {
  period: '7d' | '30d' | '90d' | '1y' | 'all'
  period_start: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number | null        // null if 0 trades
  total_pnl: number
  avg_pnl: number | null         // null if 0 trades
  expectancy: number | null      // null if 0 trades
  profit_factor: number | null   // null if 0 losses
  sharpe_ratio: number | null    // null if < 2 trades
  sortino_ratio: number | null   // null if < 2 trades
  max_drawdown: number
  max_drawdown_duration_days: number
  avg_hold_minutes: number | null
  hourly_pnl: { hour: number, pnl: number, count: number }[]
  day_of_week_pnl: { day: number, pnl: number, count: number }[]
  monthly_pnl: { month: string, pnl: number, count: number }[]
  symbol_stats: { symbol: string, pnl: number, count: number, win_rate: number }[]
  direction_stats: { direction: string, pnl: number, count: number, win_rate: number }[]
  equity_curve: { date: string, equity: number, drawdown: number }[]
  r_multiple_distribution: { bucket: string, count: number }[]
  mfe_mae_scatter: { id: string, mfe: number, mae: number, pnl: number }[]
}
```

### 5.4 AITradeAnalysis Type

```typescript
export interface AITradeAnalysis {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  entry_quality: string    // max 500 chars
  exit_quality: string     // max 500 chars
  risk_management: string  // max 500 chars
  lessons: string[]        // max 5 items, each max 200 chars
  scored_at: string        // ISO 8601
}
```

### 5.5 Sanitization Requirements

All string fields MUST be sanitized before storage:

```typescript
function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, MAX_LENGTH)
}
```

- Tags: sanitize each tag, reject empty strings after sanitization
- Notes fields: sanitize but preserve newlines
- AI analysis: validate against `AITradeAnalysis` schema before storing
- Market context: validate is a plain object with expected keys

---

## 6. Frontend Components

### 6.1 Component Map (11 components, down from 19)

| Component | File | Purpose |
|-----------|------|---------|
| JournalPage | `app/members/journal/page.tsx` | Main page: list, filter, CRUD orchestration |
| AnalyticsPage | `app/members/journal/analytics/page.tsx` | Analytics dashboard page |
| TradeEntrySheet | `components/journal/trade-entry-sheet.tsx` | Modal for create/edit with quick and full forms |
| QuickEntryForm | `components/journal/quick-entry-form.tsx` | 5-field fast entry (symbol, direction, P&L, notes) |
| FullEntryForm | `components/journal/full-entry-form.tsx` | Complete form with all fields |
| EntryDetailSheet | `components/journal/entry-detail-sheet.tsx` | Read-only detail view with edit/delete actions |
| JournalTableView | `components/journal/journal-table-view.tsx` | Sortable table view |
| JournalCardView | `components/journal/journal-card-view.tsx` | Mobile-friendly card view |
| JournalFilterBar | `components/journal/journal-filter-bar.tsx` | Filters: date, symbol, direction, type, W/L, tags |
| JournalSummaryStats | `components/journal/journal-summary-stats.tsx` | Stats bar: trades, win rate, P&L, profit factor |
| ImportWizard | `components/journal/import-wizard.tsx` | 3-step CSV import: select broker → upload → preview → confirm |
| AnalyticsDashboard | `components/journal/analytics-dashboard.tsx` | Charts: equity curve, breakdowns, scatter plots |

### 6.2 Key UX Requirements

**Entry Forms:**
- Quick form shows first; "Add Details" expands to full form
- All required fields (symbol) show inline validation errors with red text
- Save button shows loading spinner, disables during save
- On success: close sheet, show toast, prepend entry to list
- On error: show error message inline, keep form open with data preserved

**Table/Card Views:**
- Table: sortable columns (click header to sort), keyboard navigation (arrow keys)
- Card: tap to open detail, long-press for actions menu (edit, delete, favorite)
- Card swipe: remove entirely — use explicit action buttons instead (accessibility)
- Both views: loading skeleton on initial load, empty state with CTA

**Delete Confirmation:**
- Custom modal dialog (NOT `window.confirm()`)
- Shows entry summary (symbol, date, P&L)
- "Delete" button in red, "Cancel" as default focus
- Accessible: focus trap, Escape to close, aria-label

**Import Wizard:**
- Step 1: Select broker from dropdown
- Step 2: File upload (drag & drop or click), parse with PapaParse
- Step 3: Preview table showing parsed rows with validation status per row
- Step 4: Confirm import, show progress, display results (inserted/duplicates/errors)
- CSV parsing MUST use PapaParse — no naive string splitting

**Screenshot Upload:**
- Drag & drop zone on entry form
- Preview thumbnail after drop
- Upload progress indicator
- Max 5MB, PNG/JPEG/WebP only
- Show error if upload fails (with retry button)

**Offline Support:**
- Keep IndexedDB cache for read-only offline viewing
- Remove offline mutation queue (simplify — require online for writes)
- Show clear "You're offline" banner when disconnected
- Disable create/edit/delete buttons when offline

### 6.3 Components to DELETE

```
components/journal/draft-entries-panel.tsx
components/journal/behavioral-insights.tsx
components/journal/journal-pwa-prompt.tsx
components/journal/entry-modal.tsx          (legacy duplicate)
components/journal/playbook-manager.tsx     (remove for V2 simplicity)
components/journal/trade-replay-chart.tsx   (remove — depends on external API)
components/journal/open-positions-widget.tsx (remove — merge into main table with is_open filter)
components/journal/trade-entry-types.ts     (merge into lib/types/journal.ts)
components/journal/entries-table.tsx         (legacy duplicate of table-view)
```

---

## 7. Testing Requirements

### 7.1 Unit Tests (Vitest)

| Area | Tests Required |
|------|----------------|
| Zod schemas | Valid/invalid inputs for every field, cross-field refinements |
| Sanitizer | XSS payloads, empty strings, max lengths, Unicode |
| P&L calculation | Long/short, with/without position_size, edge cases (0 price) |
| Analytics math | Sharpe, Sortino, profit factor with known datasets, zero-division guards |
| Import normalization | Each broker format, direction mapping, contract type detection, duplicate logic |

### 7.2 Integration Tests (against real Supabase)

| Flow | Tests Required |
|------|----------------|
| CRUD lifecycle | Create → Read → Update → Delete, verify each step |
| RLS enforcement | User A cannot read/update/delete User B's entries |
| Import flow | Upload CSV → verify entries created → verify duplicates detected on re-import |
| Analytics accuracy | Insert known dataset → verify all metrics match hand-calculated values |
| Screenshot flow | Get signed URL → upload → verify accessible → delete entry → verify file removed |

### 7.3 E2E Tests (Playwright)

| Test | Priority |
|------|----------|
| Unauthenticated redirect | P0 |
| Create entry via quick form | P0 |
| Create entry via full form | P0 |
| Edit existing entry | P0 |
| Delete entry with confirmation | P0 |
| CSV import happy path | P0 |
| Filter by date range | P1 |
| Filter by symbol | P1 |
| Filter by direction | P1 |
| Sort by P&L | P1 |
| Screenshot upload | P1 |
| Analytics page loads with data | P1 |
| Empty state displays correctly | P1 |
| Form validation errors display | P1 |
| Offline banner shows when disconnected | P2 |
| Keyboard navigation in table view | P2 |

---

## 8. Files to Delete

### 8.1 API Routes (Remove)

```
app/api/members/journal/drafts/route.ts
app/api/members/journal/drafts/[id]/confirm/route.ts
app/api/members/journal/auto-journal/route.ts
app/api/members/journal/draft-from-session/route.ts
app/api/members/journal/push-subscriptions/route.ts
app/api/members/journal/session-context/[sessionId]/route.ts
app/api/members/journal/insights/route.ts
app/api/members/journal/analyze/route.ts
app/api/members/journal/enrich/route.ts
app/api/members/journal/replay/[entryId]/route.ts
app/api/members/journal/history/[symbol]/route.ts
app/api/members/journal/open-positions/route.ts
app/api/members/journal/close-position/route.ts
app/api/members/journal/import-history/route.ts
```

### 8.2 Components (Remove)

```
components/journal/draft-entries-panel.tsx
components/journal/behavioral-insights.tsx
components/journal/journal-pwa-prompt.tsx
components/journal/entry-modal.tsx
components/journal/playbook-manager.tsx
components/journal/trade-replay-chart.tsx
components/journal/open-positions-widget.tsx
components/journal/trade-entry-types.ts
components/journal/entries-table.tsx
```

### 8.3 Lib / Utilities (Remove)

```
lib/journal/ai-coach-bridge.ts
lib/journal/draft-candidate-extractor.ts
```

### 8.4 Backend Services (Remove)

```
backend/src/workers/journalAutoPopulateWorker.ts
backend/src/workers/journalInsightsWorker.ts
backend/src/services/journal/autoPopulate.ts
backend/src/services/journal/pushNotifications.ts
backend/src/services/journal/patternAnalyzer.ts
backend/src/workers/__tests__/journalAutoPopulateWorker.test.ts
backend/src/workers/__tests__/journalInsightsWorker.test.ts
backend/src/services/journal/__tests__/autoPopulate.test.ts
```

### 8.5 Old Migrations (Remove — replaced by single clean migration)

```
supabase/migrations/20260201100000_create_trading_journal.sql
supabase/migrations/20260209000002_journal_massive_enhancements.sql
supabase/migrations/20260209000004_journal_quick_tags.sql
supabase/migrations/20260303000000_journal_full.sql
supabase/migrations/20260304000000_fix_journal_rls_policies.sql
supabase/migrations/20260304100000_journal_security_and_backfill.sql
supabase/migrations/20260305000000_unify_journal_tables.sql
supabase/migrations/20260306000000_journal_screenshots_bucket.sql
supabase/migrations/20260307000000_trade_journal_spec_phase2_7.sql
supabase/migrations/20260308000001_journal_notifications.sql
supabase/migrations/20260310000001_journal_phase7_mobile_favorites.sql
supabase/migrations/20260312000000_journal_entry_exit_timestamps.sql
```

---

## 9. Security Checklist

- [ ] All DB functions use `SET search_path = ''`
- [ ] All string inputs HTML-escaped before storage
- [ ] All API routes validate auth via `supabase.auth.getUser()`
- [ ] RLS enabled on all journal tables with user_id checks
- [ ] Screenshot paths validated against `..` traversal
- [ ] API keys in environment variables, never in URLs or client code
- [ ] AI analysis validated against strict schema before storage
- [ ] CSV import limited to 500 rows per request
- [ ] Rate limiting on write endpoints (10 req/min per user)
- [ ] All numeric calculations guarded against division by zero / Infinity

---

## 10. Migration Plan

Since the code has NOT shipped:

1. Create single new migration with clean schema (Section 3)
2. Drop all old journal tables and migrations
3. Delete all files listed in Section 8
4. Rewrite remaining files to match this spec
5. Run full test suite
6. Deploy

No data migration needed — the 1 existing test entry can be re-created manually.
