# Trade Journal Review — Execution Spec

> **Feature:** Admin Trade Journal Review & Coach Experience
> **Author:** Claude (Orchestrator Agent)
> **Date:** 2026-03-01
> **Status:** DRAFT — Awaiting Approval
> **Governs:** EPIC-COACH — Trade Journal Coach Review System
> **Runtime:** Node >= 20.19.5 | pnpm 10+

---

## 1. Objective

Replace the dead `/admin/journal` ("Journal Config") sidebar link with a fully-featured **Trade Journal Review** admin experience that enables coaches to review any member's trades, generate AI coaching analysis, and publish structured feedback visible to members.

Additionally, gate-eligible members (via a new `flag_for_coach_review` permission mapped to any Discord role) can flag individual trades for coach review, creating a prioritized queue.

### 1.1 Success Criteria

1. Admin can browse ALL journal entries across all members with filtering/search.
2. Admin can view a flagged-trade queue sorted by recency and priority.
3. Each trade detail view displays full trade data, member screenshot, and enriched Massive.com market context (price chart, options Greeks, SPX regime, volume/tape).
4. Admin can manually trigger an AI Coach Response (GPT-4o) that produces structured feedback: what went well, areas to improve, specific drills, overall assessment, and grade.
5. Admin can edit the AI draft, add internal notes, upload coach screenshots, and publish feedback.
6. Members with `flag_for_coach_review` permission see a "Request Coach Review" button on their trade detail sheet.
7. Members see published coach feedback on their entry detail view (read-only).
8. Badge count on admin sidebar shows pending review count (real-time via Supabase Realtime).
9. Full audit trail for all coach actions.

### 1.2 Non-Goals (Out of Scope)

- Automated/scheduled AI grading (existing `/api/members/journal/grade` remains unchanged).
- Member-to-member trade sharing (handled by Trade Social).
- Bulk coach operations (v2 consideration).
- Video/audio coach feedback (v2 consideration).
- Push notifications to members on publish (v2 — use existing notification system).

---

## 2. Constraints

| Constraint | Detail |
|------------|--------|
| Design System | Emerald Standard: dark mode only, `glass-card-heavy`, Playfair/Inter/Geist Mono, emerald-500 primary, champagne accents |
| Market Data Provider | Massive.com ONLY. Never say "Polygon." Use `MASSIVE_API_KEY` env var. |
| AI Model | GPT-4o for coach responses (richer than existing gpt-4o-mini grade). Temperature 0.3. |
| Auth | `isAdminUser()` for all admin routes. Supabase RLS for member access. |
| Permission System | New permission via existing RBAC (`app_permissions` + `discord_role_permissions` + `user_permissions` tables). |
| Screenshot Storage | Supabase Storage. Member screenshots in `journal-screenshots` bucket. Coach screenshots in new `coach-review-screenshots` bucket. |
| Validation | Zod schemas on all API boundaries. |
| Icons | Lucide React, stroke width 1.5. |
| Imports | `@/` alias for absolute imports. |

---

## 3. In-Scope / Out-of-Scope Files

### 3.1 New Files (Create)

```
# Database
supabase/migrations/2026MMDD000000_coach_review_schema.sql
supabase/migrations/2026MMDD000001_coach_review_permission.sql
supabase/migrations/2026MMDD000002_coach_review_storage.sql

# Admin Pages
app/admin/trade-review/page.tsx
app/admin/trade-review/[id]/page.tsx

# Admin Components
components/admin/trade-review/review-queue-table.tsx
components/admin/trade-review/review-browse-table.tsx
components/admin/trade-review/trade-detail-panel.tsx
components/admin/trade-review/market-context-panel.tsx
components/admin/trade-review/coach-workspace.tsx
components/admin/trade-review/coach-feedback-card.tsx
components/admin/trade-review/review-stats-bar.tsx

# Member Components
components/journal/coach-review-button.tsx
components/journal/coach-feedback-section.tsx

# API Routes — Admin
app/api/admin/trade-review/route.ts                    (GET: queue list)
app/api/admin/trade-review/browse/route.ts             (GET: all entries)
app/api/admin/trade-review/[id]/route.ts               (GET: detail)
app/api/admin/trade-review/[id]/notes/route.ts         (GET/POST/PATCH)
app/api/admin/trade-review/[id]/publish/route.ts       (POST)
app/api/admin/trade-review/[id]/dismiss/route.ts       (POST)
app/api/admin/trade-review/[id]/screenshots/route.ts   (POST/DELETE)
app/api/admin/trade-review/ai-coach/route.ts           (POST)
app/api/admin/trade-review/stats/route.ts              (GET)

# API Routes — Member
app/api/members/journal/[id]/request-review/route.ts   (POST)
app/api/members/journal/[id]/coach-feedback/route.ts   (GET)

# Types
lib/types/coach-review.ts

# Validation
lib/validation/coach-review.ts

# Tests
e2e/specs/admin/trade-review.spec.ts
e2e/specs/admin/trade-review-test-helpers.ts
lib/validation/__tests__/coach-review.test.ts
```

### 3.2 Modified Files (Edit)

```
# Sidebar Navigation
components/admin/admin-sidebar.tsx                    (Replace 'Journal Config' → 'Trade Review', add badge count)

# Entry Detail Sheet (member-facing)
components/journal/entry-detail-sheet.tsx             (Add coach review button + feedback section)

# Journal Types (extend)
lib/types/journal.ts                                  (Add coach_review_status field to JournalEntry)

# Permission Types (extend)
lib/types_db.ts                                       (Add 'flag_for_coach_review' to PermissionName union)

# Journal Validation (extend)
lib/validation/journal-entry.ts                       (Add coach_review_status to schema)
```

### 3.3 Never Touch

```
lib/spx/**                    (SPX Engine Agent ownership)
backend/src/**                (Backend Agent ownership — except reading config/massive.ts for reference)
app/admin/roles/**            (Unrelated admin surface)
app/admin/settings/**         (Unrelated admin surface)
supabase/migrations/20260211* (Existing journal schema — additive only)
```

---

## 4. Database Schema

### 4.1 Migration: `coach_review_schema.sql`

```sql
-- ============================================================
-- Coach Review Request Queue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_review_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_review', 'completed', 'dismissed')),
  priority        TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('normal', 'urgent')),
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_pending_review
    UNIQUE (journal_entry_id, status)
    -- Prevents duplicate pending requests for same entry
);

CREATE INDEX idx_coach_review_status ON public.coach_review_requests(status, requested_at DESC);
CREATE INDEX idx_coach_review_user ON public.coach_review_requests(user_id, status);
CREATE INDEX idx_coach_review_entry ON public.coach_review_requests(journal_entry_id);

-- ============================================================
-- Coach Trade Notes (the coach's work product)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_trade_notes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id      UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  review_request_id     UUID REFERENCES public.coach_review_requests(id) ON DELETE SET NULL,
  coach_user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Structured AI coach response (editable by coach)
  coach_response        JSONB,
  -- Schema: {
  --   what_went_well: string[],           (3-5 items, each max 300 chars)
  --   areas_to_improve: {point: string, instruction: string}[],  (3-5 items)
  --   specific_drills: {title: string, description: string}[],   (1-3 items)
  --   overall_assessment: string,          (max 1000 chars)
  --   grade: 'A'|'B'|'C'|'D'|'F',
  --   grade_reasoning: string,             (max 500 chars)
  --   confidence: 'high'|'medium'|'low'    (data quality indicator)
  -- }

  -- Internal coach notes (NEVER shown to member)
  internal_notes        TEXT CHECK (char_length(internal_notes) <= 10000),

  -- Raw AI draft before coach edits
  ai_draft              JSONB,

  -- Coach-uploaded screenshots (storage paths)
  screenshots           TEXT[] DEFAULT '{}',

  -- Frozen market data at review time
  market_data_snapshot  JSONB,

  -- Publication control
  is_published          BOOLEAN NOT NULL DEFAULT false,
  published_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_notes_entry ON public.coach_trade_notes(journal_entry_id);
CREATE INDEX idx_coach_notes_published ON public.coach_trade_notes(journal_entry_id)
  WHERE is_published = true;

-- ============================================================
-- Coach Review Activity Log (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_review_activity_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id UUID REFERENCES public.coach_review_requests(id) ON DELETE CASCADE,
  journal_entry_id  UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  actor_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action            TEXT NOT NULL
                      CHECK (action IN (
                        'requested', 'claimed', 'ai_generated', 'draft_saved',
                        'edited', 'published', 'unpublished', 'dismissed',
                        'screenshot_added', 'screenshot_removed', 'priority_changed'
                      )),
  details           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_activity_entry ON public.coach_review_activity_log(journal_entry_id, created_at DESC);
CREATE INDEX idx_coach_activity_request ON public.coach_review_activity_log(review_request_id, created_at DESC);

-- ============================================================
-- Alter journal_entries: add denormalized coach review status
-- ============================================================
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS coach_review_status TEXT
    CHECK (coach_review_status IN ('pending', 'in_review', 'completed'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coach_review_requested_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_journal_coach_review ON public.journal_entries(coach_review_status)
  WHERE coach_review_status IS NOT NULL;

-- ============================================================
-- Auto-update updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_coach_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coach_review_requests_updated
  BEFORE UPDATE ON public.coach_review_requests
  FOR EACH ROW EXECUTE FUNCTION update_coach_review_updated_at();

CREATE TRIGGER trg_coach_trade_notes_updated
  BEFORE UPDATE ON public.coach_trade_notes
  FOR EACH ROW EXECUTE FUNCTION update_coach_review_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

-- coach_review_requests
ALTER TABLE public.coach_review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own review requests"
  ON public.coach_review_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Members insert own review requests"
  ON public.coach_review_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to review requests"
  ON public.coach_review_requests FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- coach_trade_notes
ALTER TABLE public.coach_trade_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own published notes"
  ON public.coach_trade_notes FOR SELECT
  USING (
    is_published = true
    AND journal_entry_id IN (
      SELECT id FROM public.journal_entries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to trade notes"
  ON public.coach_trade_notes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- coach_review_activity_log
ALTER TABLE public.coach_review_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to activity log"
  ON public.coach_review_activity_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 4.2 Migration: `coach_review_permission.sql`

```sql
-- Add coach review permission to RBAC system
INSERT INTO public.app_permissions (name, description)
VALUES ('flag_for_coach_review', 'Allows member to flag trades for coach review')
ON CONFLICT (name) DO NOTHING;
```

### 4.3 Migration: `coach_review_storage.sql`

```sql
-- Create storage bucket for coach review screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coach-review-screenshots',
  'coach-review-screenshots',
  false,
  5242880,  -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: admin-only upload/read/delete
CREATE POLICY "Admin upload coach screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-review-screenshots'
    AND auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Admin read coach screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'coach-review-screenshots'
    AND (
      auth.jwt() ->> 'role' = 'service_role'
      OR auth.uid() IN (
        SELECT user_id FROM public.journal_entries
        WHERE id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY "Admin delete coach screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coach-review-screenshots'
    AND auth.jwt() ->> 'role' = 'service_role'
  );
```

---

## 5. Type Definitions

### 5.1 `lib/types/coach-review.ts`

```typescript
// ============================================================
// Coach Review Types
// ============================================================

export type CoachReviewStatus = 'pending' | 'in_review' | 'completed' | 'dismissed'
export type CoachReviewPriority = 'normal' | 'urgent'
export type CoachGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type CoachConfidence = 'high' | 'medium' | 'low'

export type CoachReviewAction =
  | 'requested'
  | 'claimed'
  | 'ai_generated'
  | 'draft_saved'
  | 'edited'
  | 'published'
  | 'unpublished'
  | 'dismissed'
  | 'screenshot_added'
  | 'screenshot_removed'
  | 'priority_changed'

// ---- Request Queue ----

export interface CoachReviewRequest {
  id: string
  journal_entry_id: string
  user_id: string
  status: CoachReviewStatus
  priority: CoachReviewPriority
  assigned_to: string | null
  requested_at: string
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Enriched for admin queue display
export interface CoachReviewQueueItem extends CoachReviewRequest {
  // Joined from journal_entries
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  trade_date: string
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  entry_price: number | null
  exit_price: number | null
  screenshot_url: string | null
  // Joined from profiles or user metadata
  member_display_name: string
  member_avatar_url: string | null
  member_discord_username: string | null
  // Coach note status
  has_draft: boolean
  has_published_note: boolean
}

// ---- Coach Response Structure ----

export interface CoachImprovementItem {
  point: string          // max 300 chars — the observation
  instruction: string    // max 500 chars — specific actionable instruction
}

export interface CoachDrill {
  title: string          // max 120 chars
  description: string    // max 500 chars
}

export interface CoachResponsePayload {
  what_went_well: string[]              // 3-5 items, each max 300 chars
  areas_to_improve: CoachImprovementItem[]  // 3-5 items
  specific_drills: CoachDrill[]         // 1-3 items
  overall_assessment: string            // max 1000 chars
  grade: CoachGrade
  grade_reasoning: string               // max 500 chars
  confidence: CoachConfidence
}

// ---- Coach Trade Note ----

export interface CoachTradeNote {
  id: string
  journal_entry_id: string
  review_request_id: string | null
  coach_user_id: string
  coach_response: CoachResponsePayload | null
  internal_notes: string | null
  ai_draft: CoachResponsePayload | null
  screenshots: string[]
  market_data_snapshot: CoachMarketDataSnapshot | null
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

// ---- Market Data Snapshot (frozen at review time) ----

export interface CoachMarketDataSnapshot {
  // Price chart data
  chart: {
    symbol: string
    date: string
    minuteBars: Array<{
      t: number   // timestamp ms
      o: number   // open
      h: number   // high
      l: number   // low
      c: number   // close
      v: number   // volume
      vw?: number // vwap
    }>
    dailyBars: Array<{
      t: number; o: number; h: number; l: number; c: number; v: number; vw?: number
    }>
    entryMarker?: { timestamp: number; price: number }
    exitMarker?: { timestamp: number; price: number }
  }

  // Options data (if applicable)
  options?: {
    contractTicker: string
    strikePrice: number
    expirationDate: string
    contractType: 'call' | 'put'
    greeksAtEntry: {
      delta: number
      gamma: number
      theta: number
      vega: number
    }
    ivAtEntry: number
    openInterest: number | null
    bidAskSpread: { bid: number; ask: number } | null
  }

  // SPX context at trade time
  spxContext: {
    spxPrice: number
    spxChange: number    // percent
    vixLevel: number
    regime: 'trending' | 'ranging' | 'compression' | 'breakout'
    regimeDirection: 'bullish' | 'bearish' | 'neutral'
    gexRegime: 'positive_gamma' | 'negative_gamma' | 'near_flip'
    gexFlipPoint: number | null
  }

  // Volume & tape context
  volumeContext: {
    tradeTimeVolume: number         // volume of the bar at entry
    avgVolume: number               // 20-day average volume
    relativeVolume: number          // ratio
    vwapAtEntry: number | null
    vwapAtExit: number | null
  }

  // Metadata
  fetchedAt: string                 // ISO datetime
  dataQuality: 'full' | 'partial' | 'stale'
}

// ---- Activity Log ----

export interface CoachReviewActivityEntry {
  id: string
  review_request_id: string | null
  journal_entry_id: string
  actor_id: string
  action: CoachReviewAction
  details: Record<string, unknown>
  created_at: string
}

// ---- API Request/Response Contracts ----

export interface CoachReviewQueueParams {
  status?: CoachReviewStatus | 'all'
  priority?: CoachReviewPriority | 'all'
  symbol?: string
  member?: string                    // search by name or discord username
  sortBy?: 'requested_at' | 'trade_date' | 'pnl'
  sortDir?: 'asc' | 'desc'
  limit?: number                     // default 50, max 200
  offset?: number
}

export interface CoachReviewBrowseParams {
  symbol?: string
  direction?: 'long' | 'short' | 'all'
  contractType?: 'stock' | 'call' | 'put' | 'all'
  memberId?: string
  memberSearch?: string
  startDate?: string
  endDate?: string
  hasCoachNote?: boolean
  sortBy?: 'trade_date' | 'pnl' | 'created_at'
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface CoachAIGenerateRequest {
  journal_entry_id: string
  coach_preliminary_notes?: string   // optional context for the AI
}

export interface CoachAIGenerateResponse {
  success: boolean
  data: {
    draft: CoachResponsePayload
    market_data_snapshot: CoachMarketDataSnapshot
    tokens_used: number
  }
}

export interface CoachNoteUpdateRequest {
  coach_response?: Partial<CoachResponsePayload>
  internal_notes?: string
}

export interface CoachReviewStatsResponse {
  pending_count: number
  in_review_count: number
  completed_today: number
  completed_this_week: number
  avg_response_hours: number | null  // avg time from request to publish
}
```

---

## 6. Validation Schemas

### 6.1 `lib/validation/coach-review.ts`

```typescript
import { z } from 'zod'

export const coachReviewStatusSchema = z.enum([
  'pending', 'in_review', 'completed', 'dismissed'
])

export const coachGradeSchema = z.enum(['A', 'B', 'C', 'D', 'F'])

export const coachImprovementItemSchema = z.object({
  point: z.string().min(1).max(300),
  instruction: z.string().min(1).max(500),
})

export const coachDrillSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
})

export const coachResponsePayloadSchema = z.object({
  what_went_well: z.array(z.string().max(300)).min(1).max(5),
  areas_to_improve: z.array(coachImprovementItemSchema).min(1).max(5),
  specific_drills: z.array(coachDrillSchema).min(1).max(3),
  overall_assessment: z.string().min(1).max(1000),
  grade: coachGradeSchema,
  grade_reasoning: z.string().min(1).max(500),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const coachNoteUpdateSchema = z.object({
  coach_response: coachResponsePayloadSchema.partial().optional(),
  internal_notes: z.string().max(10000).nullable().optional(),
})

export const coachAIGenerateSchema = z.object({
  journal_entry_id: z.string().uuid(),
  coach_preliminary_notes: z.string().max(5000).optional(),
})

export const requestReviewSchema = z.object({
  priority: z.enum(['normal', 'urgent']).default('normal'),
})

export const coachQueueParamsSchema = z.object({
  status: z.enum(['pending', 'in_review', 'completed', 'dismissed', 'all']).default('pending'),
  priority: z.enum(['normal', 'urgent', 'all']).default('all'),
  symbol: z.string().max(16).optional(),
  member: z.string().max(100).optional(),
  sortBy: z.enum(['requested_at', 'trade_date', 'pnl']).default('requested_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const coachBrowseParamsSchema = z.object({
  symbol: z.string().max(16).optional(),
  direction: z.enum(['long', 'short', 'all']).default('all'),
  contractType: z.enum(['stock', 'call', 'put', 'all']).default('all'),
  memberId: z.string().uuid().optional(),
  memberSearch: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  hasCoachNote: z.coerce.boolean().optional(),
  sortBy: z.enum(['trade_date', 'pnl', 'created_at']).default('trade_date'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
```

---

## 7. API Route Specifications

### 7.1 Admin Routes (all require `isAdminUser()`)

#### `GET /api/admin/trade-review`
**Purpose:** Fetch the coach review queue (flagged trades).
**Query:** `CoachReviewQueueParams`
**Response:**
```json
{
  "success": true,
  "data": CoachReviewQueueItem[],
  "meta": { "total": 42 }
}
```
**SQL Pattern:** Join `coach_review_requests` → `journal_entries` → `profiles/user_discord_profiles`. Left join `coach_trade_notes` for draft/published status.

#### `GET /api/admin/trade-review/browse`
**Purpose:** Browse ALL journal entries across all members.
**Query:** `CoachReviewBrowseParams`
**Response:**
```json
{
  "success": true,
  "data": JournalEntry[] (with member display info),
  "meta": { "total": 1250 }
}
```

#### `GET /api/admin/trade-review/[id]`
**Purpose:** Full trade detail for coaching. `[id]` = journal_entry_id.
**Response:**
```json
{
  "success": true,
  "data": {
    "entry": JournalEntry,
    "member": { display_name, avatar_url, discord_username, tier },
    "review_request": CoachReviewRequest | null,
    "coach_note": CoachTradeNote | null,
    "member_stats": {
      "total_trades": number,
      "win_rate": number,
      "avg_pnl": number,
      "symbol_stats": { win_rate, avg_pnl, trade_count } | null,
      "recent_streak": "winning" | "losing" | "mixed",
      "avg_discipline_score": number | null
    },
    "activity_log": CoachReviewActivityEntry[]
  }
}
```
**Note:** Does NOT include market data — that's fetched on-demand via AI coach endpoint or separate market data call to avoid slow page loads.

#### `POST /api/admin/trade-review/ai-coach`
**Purpose:** Generate AI coaching analysis for a trade.
**Request:** `CoachAIGenerateRequest`
**Processing:**
1. Fetch full journal entry + member history (last 20 trades for symbol)
2. Fetch Massive.com market data:
   - `getMinuteAggregates(symbol, tradeDate)` — 1-min bars for chart
   - `getDailyAggregates(symbol, from30daysAgo, tradeDate)` — daily bars for context
   - `getOptionsSnapshotAtDate(underlying, tradeDate, optionTicker)` — Greeks (if options trade)
   - `getMarketIndicesSnapshot()` cached — SPX, VIX
   - Derive regime from daily bars + VIX level
3. Build market data snapshot and freeze to `CoachMarketDataSnapshot`
4. Call OpenAI GPT-4o (temp 0.3) with enhanced prompt (see Section 8)
5. Validate response against `coachResponsePayloadSchema`
6. Upsert `coach_trade_notes` with `ai_draft` and `market_data_snapshot`
7. Log activity: `ai_generated`
**Response:** `CoachAIGenerateResponse`
**Errors:** 503 if OpenAI unavailable (no heuristic fallback — coach experience requires quality)

#### `GET/POST/PATCH /api/admin/trade-review/[id]/notes`
- **GET:** Fetch existing coach note for entry
- **POST:** Create new coach note (body: `CoachNoteUpdateRequest`)
- **PATCH:** Update existing coach note (body: `CoachNoteUpdateRequest`)
- All log activity: `draft_saved` or `edited`

#### `POST /api/admin/trade-review/[id]/publish`
**Purpose:** Publish coach feedback to member.
**Processing:**
1. Set `coach_trade_notes.is_published = true`, `published_at = now()`
2. Update `coach_review_requests.status = 'completed'`, `completed_at = now()`
3. Update `journal_entries.coach_review_status = 'completed'`
4. Log activity: `published`
**Response:** `{ success: true }`

#### `POST /api/admin/trade-review/[id]/dismiss`
**Purpose:** Dismiss review request without feedback.
**Processing:**
1. Update `coach_review_requests.status = 'dismissed'`
2. Update `journal_entries.coach_review_status = null`
3. Log activity: `dismissed`

#### `POST/DELETE /api/admin/trade-review/[id]/screenshots`
- **POST:** Upload coach screenshot to `coach-review-screenshots` bucket. Append path to `coach_trade_notes.screenshots[]`.
- **DELETE:** Remove screenshot from storage and array. Query param: `path`.

#### `GET /api/admin/trade-review/stats`
**Response:** `CoachReviewStatsResponse`

### 7.2 Member Routes (authenticated user)

#### `POST /api/members/journal/[id]/request-review`
**Auth:** Authenticated + `flag_for_coach_review` permission check via `user_has_permission(user_id, 'flag_for_coach_review')`.
**Request:** `{ priority?: 'normal' | 'urgent' }` (default: normal)
**Processing:**
1. Verify entry belongs to user
2. Verify entry is not a draft
3. Verify no existing pending/in_review request for this entry
4. Insert `coach_review_requests`
5. Update `journal_entries.coach_review_status = 'pending'`, `coach_review_requested_at = now()`
6. Log activity: `requested`
**Response:** `{ success: true, data: CoachReviewRequest }`
**Errors:** 403 (no permission), 409 (already requested), 400 (draft entry)

#### `GET /api/members/journal/[id]/coach-feedback`
**Auth:** Authenticated, entry must belong to user.
**Response:**
```json
{
  "success": true,
  "data": {
    "coach_response": CoachResponsePayload | null,
    "coach_screenshots": string[] (signed URLs),
    "published_at": string | null,
    "review_status": CoachReviewStatus | null
  }
}
```
**Note:** `internal_notes` and `ai_draft` are NEVER returned to members.

---

## 8. AI Coach Response Prompt

### 8.1 System Prompt

```
You are an expert options and equities trading coach performing a detailed review
of a student's trade. Your role is to provide actionable, specific, and encouraging
feedback that helps the trader improve their process and decision-making.

You must return a JSON object with this exact structure:
{
  "what_went_well": string[],          // 3-5 specific observations (max 300 chars each)
  "areas_to_improve": [                // 3-5 items
    { "point": string, "instruction": string }  // point: observation, instruction: specific action
  ],
  "specific_drills": [                 // 1-3 practice exercises
    { "title": string, "description": string }
  ],
  "overall_assessment": string,        // 2-4 sentences (max 1000 chars)
  "grade": "A"|"B"|"C"|"D"|"F",
  "grade_reasoning": string,           // 1-2 sentences (max 500 chars)
  "confidence": "high"|"medium"|"low"  // based on data completeness
}

Grading rubric:
- A: Excellent process AND outcome. Trade plan followed. Risk managed. Entry/exit disciplined.
- B: Good process with minor execution gaps. Plan mostly followed. Positive risk management.
- C: Average execution. Some plan deviation OR missing risk framework. Mixed signals.
- D: Poor process. Significant plan deviation, poor risk management, or emotional trading.
- F: Reckless. No plan, no stops, position sizing violation, or revenge trading.

Factor in: plan adherence, risk management quality, entry/exit timing relative to levels,
position sizing appropriateness, emotional discipline, and pattern recognition from history.

For "instruction" fields, be SPECIFIC: reference exact price levels, timeframes, and actions.
Example: "Next time SPY tests PDH at $452.30, wait for a 5-min close above before entering
rather than anticipating the breakout."

For "specific_drills", suggest concrete practice exercises the trader can do:
Example: { title: "Level Identification Drill", description: "Before each session, mark
PDH, PDL, VWAP, and Pivot on your chart. After close, review which levels held and which
broke. Track hold rate over 2 weeks." }

If the coach provided preliminary notes, incorporate them into your analysis.
Always be encouraging where warranted — acknowledge good habits even in losing trades.
```

### 8.2 User Prompt Template

```json
{
  "trade": {
    "symbol": "{{symbol}}",
    "direction": "{{direction}}",
    "contract_type": "{{contract_type}}",
    "trade_date": "{{trade_date}}",
    "entry_price": {{entry_price}},
    "exit_price": {{exit_price}},
    "position_size": {{position_size}},
    "pnl": {{pnl}},
    "pnl_percentage": {{pnl_percentage}},
    "stop_loss": {{stop_loss}},
    "initial_target": {{initial_target}},
    "hold_duration_min": {{hold_duration_min}},
    "entry_timestamp": "{{entry_timestamp}}",
    "exit_timestamp": "{{exit_timestamp}}",
    "strategy": "{{strategy}}",
    "setup_type": "{{setup_type}}",
    "followed_plan": {{followed_plan}},
    "discipline_score": {{discipline_score}},
    "mood_before": "{{mood_before}}",
    "mood_after": "{{mood_after}}",
    "setup_notes": "{{setup_notes}}",
    "execution_notes": "{{execution_notes}}",
    "lessons_learned": "{{lessons_learned}}",
    "rating": {{rating}},
    "options_data": {
      "strike_price": {{strike_price}},
      "expiration_date": "{{expiration_date}}",
      "dte_at_entry": {{dte_at_entry}},
      "iv_at_entry": {{iv_at_entry}},
      "delta_at_entry": {{delta_at_entry}},
      "theta_at_entry": {{theta_at_entry}},
      "gamma_at_entry": {{gamma_at_entry}},
      "vega_at_entry": {{vega_at_entry}}
    }
  },
  "market_context": {
    "spx_price_at_trade": {{spx_price}},
    "vix_level": {{vix_level}},
    "market_regime": "{{regime}}",
    "regime_direction": "{{regime_direction}}",
    "gex_regime": "{{gex_regime}}",
    "price_vs_vwap": "{{above/below/at}}",
    "distance_from_pdh_pct": {{pdh_distance}},
    "distance_from_pdl_pct": {{pdl_distance}},
    "relative_volume": {{relative_volume}},
    "session_phase": "{{open/mid_morning/lunch/power_hour/close}}"
  },
  "member_history": {
    "total_trades": {{total}},
    "win_rate": {{win_rate_pct}},
    "symbol_win_rate": {{symbol_win_rate}},
    "symbol_avg_pnl": {{symbol_avg_pnl}},
    "symbol_trade_count": {{symbol_count}},
    "recent_streak": "{{winning/losing/mixed}}",
    "avg_discipline_score": {{avg_discipline}},
    "common_mistakes": ["{{pattern_1}}", "{{pattern_2}}"]
  },
  "coach_notes": "{{coach_preliminary_notes_if_any}}"
}
```

---

## 9. UI Component Specifications

### 9.1 Admin Sidebar Change

**File:** `components/admin/admin-sidebar.tsx`

Replace:
```typescript
{ name: 'Journal Config', href: '/admin/journal', icon: Notebook }
```
With:
```typescript
{ name: 'Trade Review', href: '/admin/trade-review', icon: ClipboardCheck, badge: pendingCount }
```

Badge: Real-time count of `coach_review_requests WHERE status = 'pending'`. Subscribe via Supabase Realtime on the `coach_review_requests` table. Display as emerald badge when count > 0.

### 9.2 Admin Queue View (`/admin/trade-review`)

**Layout:** Full-width page with stats bar at top, tab switcher (Queue / Browse All), and data table.

**Stats Bar:** 4 metric cards in a row — Pending Reviews (count), In Review (count), Completed Today, Avg Response Time.

**Queue Tab (default):**
- Table columns: Member (avatar + name), Symbol, Direction, P&L ($), Trade Date, Time Waiting, Priority, Status, Actions (View)
- Filters: Status dropdown, Priority dropdown, Symbol search, Member search
- Sort: Default by `requested_at DESC`
- Color coding: P&L green/red, Priority badge (amber for urgent), Status badges (pending=amber, in_review=blue, completed=emerald, dismissed=gray)
- Click row → navigate to `/admin/trade-review/[journal_entry_id]`

**Browse All Tab:**
- Table columns: Member, Symbol, Direction, Contract Type, Entry/Exit, P&L, Trade Date, Coach Status (none/pending/reviewed), Actions
- Filters: Symbol, Direction, Contract Type, Member search, Date range, Has Coach Note toggle
- Click row → navigate to detail

### 9.3 Trade Detail & Coaching View (`/admin/trade-review/[id]`)

**Layout:** Three-column responsive grid (stacks to single column on mobile).

**Left Column — Trade Data (col-span-1):**
- Member info card: avatar, name, discord username, tier badge
- Trade summary card: symbol, direction, contract type, entry→exit with arrow, P&L prominently displayed, position size, hold duration
- Options card (if applicable): strike, expiration, DTE, Greeks at entry
- Psychology card: mood before/after (emoji + label), discipline score (1-5 stars), followed plan (check/x), rating
- Notes card: strategy, setup type, setup notes, execution notes, lessons learned — all read-only, collapsible
- Member's existing AI grade card (if `ai_analysis` exists)
- Member screenshot: displayed with zoom-on-click

**Center Column — Market Context (col-span-1):**
- Loads on-demand when coach clicks "Load Market Data" or when AI is generated
- Price chart: rendered from `minuteBars` with entry/exit markers (vertical lines with price labels), EMA8/21 overlays computed client-side from bar data
- Options panel: contract Greeks at entry, IV, open interest, bid/ask spread — displayed as key-value pairs
- SPX Context card: SPX price, VIX level, regime badge, GEX regime badge, GEX flip point
- Volume & Tape card: relative volume ratio, VWAP at entry/exit, volume bar highlighting around entry/exit times
- Data quality badge: "Full" (green), "Partial" (amber), "Stale" (red) — based on `dataQuality` field

**Right Column — Coach Workspace (col-span-1):**
- "Generate AI Analysis" button (emerald, prominent) — triggers `POST /api/admin/trade-review/ai-coach`
- Internal Notes textarea (marked "Private — never shown to member")
- AI Draft display (once generated): each section rendered as editable cards
  - "What Went Well" — list of editable text inputs
  - "Areas to Improve" — list of point + instruction pairs
  - "Specific Drills" — list of title + description pairs
  - "Overall Assessment" — editable textarea
  - "Grade" — selectable dropdown A-F with reasoning textarea
- Coach Screenshots section: upload button + gallery of thumbnails with delete
- Action buttons: "Save Draft" (gray), "Publish to Member" (emerald, confirmation dialog), "Dismiss" (red outline, confirmation dialog)
- Activity log: collapsible timeline showing all actions taken on this review

### 9.4 Member Coach Review Button

**File:** `components/journal/coach-review-button.tsx`
**Placement:** Inside `entry-detail-sheet.tsx`, below the trade summary section
**Visibility:** Only shown if user has `flag_for_coach_review` permission (checked client-side from user permissions context)
**States:**
- Default: "Request Coach Review" button (outline style)
- Pending: "Coach Review Pending" badge (amber pulse)
- In Review: "Under Coach Review" badge (blue)
- Completed: Hidden (feedback section shown instead)

### 9.5 Member Coach Feedback Section

**File:** `components/journal/coach-feedback-section.tsx`
**Placement:** Inside `entry-detail-sheet.tsx`, after trade notes, before AI grade
**Visibility:** Only shown when `is_published = true` for this entry
**Content:**
- "Coach Feedback" heading with ClipboardCheck icon
- Grade badge (large, color-coded: A=emerald, B=blue, C=amber, D=orange, F=red)
- "What Went Well" — list with checkmark icons
- "Areas to Improve" — list with each item showing point (bold) + instruction (normal)
- "Practice Drills" — collapsible cards with title and description
- "Overall Assessment" — paragraph
- Coach screenshots — gallery of images
- "Reviewed on [date]" footer

---

## 10. Phase/Slice Plan

### Phase 1: Foundation (Slices 1-3)

**Slice 1: Database Schema + Types + Permission**
- Target files: migrations, `lib/types/coach-review.ts`, `lib/types_db.ts`, `lib/types/journal.ts`
- Deliverable: All 3 migrations applied, types compiled, permission seeded
- Gate: `pnpm exec tsc --noEmit`, migration applies cleanly

**Slice 2: Validation Schemas + Unit Tests**
- Target files: `lib/validation/coach-review.ts`, `lib/validation/__tests__/coach-review.test.ts`
- Deliverable: All Zod schemas, unit tests for edge cases
- Gate: `pnpm vitest run lib/validation/__tests__/coach-review.test.ts`

**Slice 3: Admin Sidebar Update**
- Target files: `components/admin/admin-sidebar.tsx`
- Deliverable: "Journal Config" → "Trade Review" with badge count
- Gate: `pnpm exec eslint components/admin/admin-sidebar.tsx`, `pnpm exec tsc --noEmit`

### Phase 2: Admin API Layer (Slices 4-8)

**Slice 4: Queue + Browse API Routes**
- Target: `app/api/admin/trade-review/route.ts`, `browse/route.ts`, `stats/route.ts`
- Gate: Manual curl test + TypeScript pass

**Slice 5: Trade Detail API Route**
- Target: `app/api/admin/trade-review/[id]/route.ts`
- Gate: TypeScript pass, returns enriched data

**Slice 6: Coach Notes CRUD API**
- Target: `app/api/admin/trade-review/[id]/notes/route.ts`, `publish/route.ts`, `dismiss/route.ts`, `screenshots/route.ts`
- Gate: TypeScript pass, Zod validation on all inputs

**Slice 7: AI Coach Generation API**
- Target: `app/api/admin/trade-review/ai-coach/route.ts`
- Integrates: Massive.com data fetching (chart bars, options, indices), OpenAI GPT-4o call, snapshot freezing
- Gate: TypeScript pass, mock test for prompt construction

**Slice 8: Member Flag + Feedback API Routes**
- Target: `app/api/members/journal/[id]/request-review/route.ts`, `coach-feedback/route.ts`
- Includes permission check via `user_has_permission()`
- Gate: TypeScript pass, 403 on missing permission, 409 on duplicate request

### Phase 3: Admin UI (Slices 9-12)

**Slice 9: Queue View + Browse View Page**
- Target: `app/admin/trade-review/page.tsx`, `components/admin/trade-review/review-queue-table.tsx`, `review-browse-table.tsx`, `review-stats-bar.tsx`
- Gate: `pnpm exec eslint <files>`, `pnpm exec tsc --noEmit`, visual verification

**Slice 10: Trade Detail Panel — Trade Data + Member Info**
- Target: `app/admin/trade-review/[id]/page.tsx`, `components/admin/trade-review/trade-detail-panel.tsx`
- Gate: Lint + TypeScript pass

**Slice 11: Market Context Panel**
- Target: `components/admin/trade-review/market-context-panel.tsx`
- Charts rendered from minute bar data (canvas or recharts)
- Gate: Lint + TypeScript pass

**Slice 12: Coach Workspace**
- Target: `components/admin/trade-review/coach-workspace.tsx`, `coach-feedback-card.tsx`
- AI generation, editable draft, screenshots, publish/dismiss
- Gate: Lint + TypeScript pass

### Phase 4: Member UI (Slices 13-14)

**Slice 13: Coach Review Button**
- Target: `components/journal/coach-review-button.tsx`, modify `entry-detail-sheet.tsx`
- Permission check, state management, API integration
- Gate: Lint + TypeScript pass

**Slice 14: Coach Feedback Section**
- Target: `components/journal/coach-feedback-section.tsx`, modify `entry-detail-sheet.tsx`
- Display published coach response with grade, feedback, screenshots
- Gate: Lint + TypeScript pass

### Phase 5: QA & Hardening (Slices 15-17)

**Slice 15: E2E Test Suite**
- Target: `e2e/specs/admin/trade-review.spec.ts`, `trade-review-test-helpers.ts`
- Coverage: Queue loading, detail view, AI generation mock, publish flow, member flag flow, permission gate
- Gate: `pnpm exec playwright test e2e/specs/admin/trade-review.spec.ts --project=chromium --workers=1`

**Slice 16: Security Audit**
- Run `get_advisors(type: "security")` for new tables
- Verify RLS policies are correct
- Verify admin routes reject non-admin users
- Verify member routes respect entry ownership
- Verify `internal_notes` never exposed to members
- Gate: All advisories addressed

**Slice 17: Release Evidence + Documentation**
- Full validation gate run (lint, tsc, build, vitest, playwright)
- Update CLAUDE.md feature registry
- Create release notes
- Gate: All gates green under Node >= 20.19.5

---

## 11. Risk Register

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | Massive.com data unavailable for historical trades | Market context panel empty | Medium | Graceful degradation: show "Market data unavailable for this date" with `dataQuality: 'stale'`. Coach can still write manual notes. |
| R2 | OpenAI API down during AI generation | Coach can't generate AI draft | Low | No heuristic fallback (quality requirement). Show clear error. Coach can write manual notes. Retry button. |
| R3 | Large screenshot files slow page load | Poor UX on detail view | Medium | Lazy-load screenshots. Limit to 5MB per image. Generate thumbnails for gallery. |
| R4 | Race condition: two admins claim same review | Conflicting edits | Low | `assigned_to` column with optimistic locking. Second admin sees "Claimed by [name]" banner. |
| R5 | Permission not mapped to role after migration | Members can't flag trades | Medium | Include seed data in migration. Document in runbook: "Map `flag_for_coach_review` to desired Discord role in Admin > Role Permissions." |
| R6 | Supabase Realtime subscription for badge count | Connection drops, stale count | Low | Fallback polling every 60s. Reconnect on visibility change. |
| R7 | Member sees incomplete AI response | Coach publishes accidentally | Medium | Publish requires confirmation dialog: "This will be visible to the member. Are you sure?" |

---

## 12. Rollback Plan

**Database:** All migrations are additive (new tables + new columns with NULL default). Rollback = drop tables and column:
```sql
DROP TABLE IF EXISTS public.coach_review_activity_log;
DROP TABLE IF EXISTS public.coach_trade_notes;
DROP TABLE IF EXISTS public.coach_review_requests;
ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS coach_review_status;
ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS coach_review_requested_at;
DELETE FROM public.app_permissions WHERE name = 'flag_for_coach_review';
```

**UI:** Revert sidebar link to original. Remove admin page. Remove member button/section. All changes are additive — no existing functionality is modified.

**Feature Flag (optional):** If risk posture requires it, gate the member-facing flag button behind a `coachReviewV1` feature flag in `app_settings`.

---

## 13. Acceptance Criteria Checklist

- [ ] `/admin/journal` dead link replaced with `/admin/trade-review`
- [ ] Admin sidebar shows "Trade Review" with live pending badge count
- [ ] Queue view shows flagged trades with member info, symbol, P&L, status
- [ ] Browse view shows all journal entries across all members
- [ ] Trade detail view displays full trade data, psychology, notes, member screenshot
- [ ] Market context panel renders minute chart with entry/exit markers
- [ ] Market context shows options Greeks, SPX/VIX context, volume data
- [ ] AI Coach generation produces structured response via GPT-4o
- [ ] Coach can edit every field of the AI draft
- [ ] Coach can add internal notes (never visible to member)
- [ ] Coach can upload/remove screenshots
- [ ] Coach can save draft, publish, or dismiss
- [ ] Published feedback visible to member on their entry detail
- [ ] Member with `flag_for_coach_review` permission sees flag button
- [ ] Member without permission does NOT see flag button
- [ ] Duplicate flag requests return 409
- [ ] Draft entries cannot be flagged
- [ ] Activity log records all coach actions
- [ ] RLS policies enforce: members see own data only, admins see all
- [ ] `internal_notes` never returned in member API responses
- [ ] TypeScript strict: zero `any` in new code
- [ ] ESLint: zero warnings in new files
- [ ] Build passes: `pnpm run build`
- [ ] E2E tests pass for admin and member flows
- [ ] Security advisors clean after DDL changes

---

## 14. Definition of Done

A slice is complete when:
1. Acceptance criteria for that slice are met
2. `pnpm exec eslint <touched files>` passes
3. `pnpm exec tsc --noEmit` passes
4. At least one non-happy-path test exists
5. Docs updated if operational behavior changed
6. Known pre-existing failures documented

The feature is release-ready when:
1. All 17 slices complete
2. Full release gate passes: `pnpm exec eslint . && pnpm exec tsc --noEmit && pnpm run build`
3. E2E suite green
4. Security advisors clean
5. This spec's checklist (Section 13) fully checked
6. Release notes written

---

## 15. External Service Dependencies

| Service | Usage in This Feature | Failure Mode |
|---------|----------------------|--------------|
| Massive.com | Chart bars, options snapshots, indices | Graceful degradation: market panel shows "unavailable" |
| OpenAI (GPT-4o) | AI coach response generation | Error state: coach writes manual notes |
| Supabase Storage | Member + coach screenshots | Signed URL generation; 24h TTL |
| Supabase Realtime | Badge count subscription | Fallback polling every 60s |
| Supabase Auth | Permission checks, admin verification | Fail-closed: deny access |

---

*End of Execution Spec*
