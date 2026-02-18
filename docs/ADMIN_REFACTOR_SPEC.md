# Admin Dashboard Refactor — Spec-Driven Development Plan

**Status:** Draft — Awaiting Approval
**Date:** February 16, 2026
**Scope:** Remove all hardcoded data, consolidate data layer, make admin analytics production-grade

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Principles](#2-principles)
3. [Phase 1 — Hardcoded Data Removal](#3-phase-1--hardcoded-data-removal)
4. [Phase 2 — Admin Analytics API Consolidation](#4-phase-2--admin-analytics-api-consolidation)
5. [Phase 3 — Command Center Overhaul](#5-phase-3--command-center-overhaul)
6. [Phase 4 — Analytics Page Production Upgrade](#6-phase-4--analytics-page-production-upgrade)
7. [Phase 5 — Data Pipeline Activation](#7-phase-5--data-pipeline-activation)
8. [Phase 6 — Environment Hardening](#8-phase-6--environment-hardening)
9. [Migration Plan](#9-migration-plan)
10. [Acceptance Criteria](#10-acceptance-criteria)

---

## 1. Problem Statement

The admin dashboard has several categories of issues that prevent it from being production-grade:

**Hardcoded/Fake Data:**
- Command Center "Recent Sales" widget renders 3 static rows ("Pro Sniper +$299") with no database connection
- Command Center "New Leads" widget renders 3 static rows ("John Doe") despite real `cohort_applications` data already loaded on the same page
- Chat page canned responses contain hardcoded pricing ($199/$299/$499) that will drift from the `pricing_tiers` table
- Team page Discord webhook test contains a hardcoded Railway production URL

**Orphaned Infrastructure:**
- `get_admin_analytics` RPC function exists in the database but no page or API route calls it
- `member_analytics_events` table (0 rows) — schema exists, nothing writes to it
- `chat_analytics` table (0 rows) — rich schema exists, no aggregation populates it
- `admin_activity_log` table (2 rows) — barely used despite being purpose-built for audit trails

**Data Quality:**
- "Total Members" on the dashboard queries `subscribers` (78 email signups) instead of `auth.users` (10 registered members)
- Page view tracking only fires on the homepage — all 5,310 rows have `page_path = "/"`
- Click tracking covers only 2 element types (`cta_button`, `pricing_card`)
- Date range selector on `/admin/analytics` only filters 2 of 6 data sections
- All queries fetch raw rows with a hardcoded 1,000 limit — won't scale

**Hardcoded Production URL:**
- `https://trade-itm-prod.up.railway.app` appears in 5 source files instead of using an environment variable

---

## 2. Principles

1. **Zero hardcoded data** — Every number, name, and timestamp visible on admin pages comes from a database query or API call.
2. **Single source of truth** — One consolidated `/api/admin/analytics` route serves all admin metrics. No scattered client-side Supabase queries for aggregation.
3. **Server-side aggregation** — Counts, sums, and breakdowns computed in SQL or RPC functions, not by fetching raw rows to the browser.
4. **Date-range aware** — Every metric on every admin page respects the selected date range.
5. **Empty state design** — When a section has no data, show a meaningful empty state with a call-to-action, never show fake data.
6. **Audit trail** — All admin write operations log to `admin_activity_log`.

---

## 3. Phase 1 — Hardcoded Data Removal

### 3.1 Command Center: Replace "Recent Sales" Widget

**File:** `app/admin/page.tsx` (lines 279-295)

**Current:** Static `[1,2,3].map` rendering "Pro Sniper +$299" three times.

**Spec:**
- Create a new query that pulls the most recent WHOP `payment.succeeded` webhook events. If no payment events table exists, query the `conversion_events` table filtered to `event_type = 'subscription'`, joined with `subscribers` for names.
- Show the 5 most recent conversions with: subscriber name (first initial + last name), tier name, amount, and relative timestamp.
- Empty state: "No recent sales" with muted text.

**Acceptance Test:**
```
GIVEN the admin visits /admin
WHEN there are 0 conversion events
THEN the Recent Sales card shows "No recent sales" empty state

GIVEN there are 3+ conversion events
THEN the card shows the 3 most recent with real names, amounts, and timestamps
AND no hardcoded strings appear
```

### 3.2 Command Center: Replace "New Leads" Widget

**File:** `app/admin/page.tsx` (lines 296-312)

**Current:** Static `[1,2,3].map` rendering "John Doe" three times. Ironically, the page already loads `recentLeads` from `cohort_applications` and renders them in a separate "Recent Applications" card above.

**Spec:**
- Remove the duplicate "New Leads" widget entirely.
- Replace it with a new **"AI Coach Activity"** card showing the 3 most recent AI coach sessions: user display name, message count, and relative timestamp. This surfaces data from the `ai_coach_sessions` table (444 rows) that currently has no admin visibility.
- If AI coach data isn't desired, alternative: **"Journal Activity"** card showing recent journal entries with symbol, P&L, and timestamp from `journal_entries`.

**Acceptance Test:**
```
GIVEN the admin visits /admin
WHEN there are AI coach sessions in the database
THEN the card shows real session data with user names and timestamps
AND "John Doe" does not appear anywhere on the page
```

### 3.3 Command Center: Fix "Total Members" Metric

**File:** `app/admin/page.tsx` (line 50)

**Current:** Queries `subscribers` table (`count: 78`), labels it "Total Members."

**Spec:**
- Change the query to count `auth.users` via the service role. Since the page is client-side, this requires calling a new API endpoint (see Phase 2) or the existing `get_admin_analytics` RPC.
- Rename label to "Registered Members" for clarity.
- Add a secondary metric below: "Email Subscribers: 78" so both numbers are visible.

### 3.4 Chat Page: Dynamic Canned Responses Pricing

**File:** `app/admin/chat/page.tsx` (lines 54-107)

**Current:** Canned responses contain hardcoded tier pricing ("$199/mo", "$299/mo", "$499/mo").

**Spec:**
- On mount, fetch `pricing_tiers` via `/api/admin/packages` (already exists).
- Interpolate actual prices into the canned response templates using a template string pattern (e.g., `{{core_price}}`, `{{pro_price}}`, `{{exec_price}}`).
- Store templates with placeholders, resolve on render.

**Acceptance Test:**
```
GIVEN the chat page loads
WHEN an admin clicks a canned response containing pricing
THEN the prices match the current values in the pricing_tiers table
AND if a tier price is updated in /admin/packages, the canned responses reflect the change on next page load
```

### 3.5 Hardcoded Production URL Removal

**Files affected (5):**
- `app/admin/team/page.tsx`
- `app/api/admin/logout/route.ts`
- `supabase/functions/handle-chat-message/index.ts`
- `supabase/functions/notify-team-lead/index.ts`
- `components/seo/structured-data.tsx`

**Spec:**
- Define `NEXT_PUBLIC_APP_URL` in environment variables (already likely exists or should be added).
- Replace all instances of `https://trade-itm-prod.up.railway.app` with the environment variable.
- For edge functions, use `Deno.env.get('APP_URL')` or pass via function invoke params.

**Acceptance Test:**
```
GIVEN a grep for "trade-itm-prod.up.railway" across the entire codebase
THEN 0 results are returned (only the migration doc may reference it historically)
```

---

## 4. Phase 2 — Admin Analytics API Consolidation

### 4.1 Create `/api/admin/analytics` Route

**Current state:** No API route exists. The analytics page makes 6 parallel client-side Supabase calls with the anon key. The `get_admin_analytics` RPC exists in the DB but nothing calls it.

**Spec:**

Create `app/api/admin/analytics/route.ts` with a single GET handler:

```typescript
// GET /api/admin/analytics?period=30d
// Returns all admin analytics in one payload
interface AdminAnalyticsResponse {
  // Platform metrics (from get_admin_analytics RPC)
  platform: {
    total_members: number       // from auth.users
    new_members: number         // auth.users created in period
    total_journal_entries: number
    ai_analysis_count: number
    ai_coach_sessions: number
    ai_coach_messages: number
    shared_trade_cards: number
    active_users: number        // from member_analytics_events
  }

  // Marketing metrics (aggregated server-side)
  marketing: {
    total_page_views: number
    unique_visitors: number     // distinct session_id count
    total_clicks: number
    total_subscribers: number
    total_contacts: number
    conversion_rate: number     // subscriptions / unique_visitors
  }

  // Time-series data
  page_views_by_day: { date: string; views: number }[]
  conversions_by_day: { date: string; count: number }[]

  // Funnel data
  conversion_funnel: {
    modal_opened: number
    modal_closed: number
    form_submitted: number
    subscribed: number
  }

  // Breakdowns
  device_breakdown: Record<string, number>
  browser_breakdown: Record<string, number>
  click_breakdown: Record<string, number>
  top_pages: { path: string; views: number }[]

  // Recent items (for tables)
  recent_subscribers: Subscriber[]    // last 20
  recent_contacts: ContactSubmission[] // last 20
  recent_page_views: PageView[]       // last 20
}
```

**Implementation:**
- Use `getSupabaseAdmin()` (service role) to call `get_admin_analytics` RPC for platform metrics.
- Run server-side COUNT/GROUP BY queries for marketing metrics instead of fetching raw rows.
- Accept `period` query param: `today`, `7d`, `30d`, `90d`, `all`.
- Apply date filtering to ALL metrics consistently.
- Cache response for 60 seconds using `Cache-Control` headers.

### 4.2 Upgrade `get_admin_analytics` RPC

**Current:** Returns 8 basic counts. Missing revenue, conversion funnel, and engagement data.

**Spec — New Migration:**

```sql
CREATE OR REPLACE FUNCTION get_admin_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
-- Add to existing fields:
--   conversion_funnel (from conversion_events grouped by event_type)
--   daily_signups (auth.users grouped by date)
--   ai_coach_avg_messages (avg messages per session)
--   top_referrers (from page_views.referrer)
```

---

## 5. Phase 3 — Command Center Overhaul

### 5.1 Metric Cards (Top Row)

**Current:** 4 cards — Total Members (wrong source), Active Chats, Courses, System Health.

**New layout — 5 cards:**

| Card | Data Source | Period-Aware |
|------|-----------|--------------|
| Registered Members | `auth.users` count via `/api/admin/analytics` | No (lifetime) |
| New Signups | `auth.users` created in period | Yes |
| AI Coach Sessions | `ai_coach_sessions` count in period | Yes |
| Active Learners | `user_lesson_progress` distinct users in period | Yes |
| System Health | `/api/admin/system` (keep as-is) | No |

### 5.2 Body Layout Redesign

Replace the current 2/3 + 1/3 grid with:

**Left column (2/3):**
1. **Pending Applications** callout (keep — works correctly)
2. **Recent Applications** card (keep — works correctly, already uses real data)
3. **Quick links** row (keep)
4. **NEW: Recent Sales** card (real data, replaces hardcoded widget) — sources from `conversion_events` + `subscribers`
5. **NEW: AI Coach Activity** card (replaces hardcoded "New Leads" widget) — sources from `ai_coach_sessions`

**Right column (1/3):**
1. **System Status** card (keep — works correctly)
2. **NEW: Quick Stats** mini-card showing today's page views, clicks, and new subscribers (from `/api/admin/analytics?period=today`)

### 5.3 Period Selector

Add a date range toggle (Today / 7d / 30d) to the Command Center header. This filters all period-aware cards.

---

## 6. Phase 4 — Analytics Page Production Upgrade

### 6.1 Migrate to Server-Side Data

**Current:** The analytics page makes 6 client-side Supabase calls using the anon key with a hardcoded 1,000 row limit.

**Spec:**
- Replace all `lib/supabase.ts` helper calls with a single `fetch('/api/admin/analytics?period=...')`.
- Remove the 6 parallel `getSubscribers`, `getPageViews`, etc. calls.
- This gives accurate counts (server-side `COUNT(*)` instead of `array.length` capped at 1,000).

### 6.2 Fix Date Range Filtering

**Current:** Only device/browser breakdowns respond to the date selector.

**Spec:**
- All 5 metric cards respond to date range.
- All charts respond to date range.
- Subscriber and contact tables show entries within the selected range (with an "All Time" option to see everything).
- Page views table shows entries within the selected range.

### 6.3 New Charts

Add these visualizations using data from `/api/admin/analytics`:

1. **Page Views Over Time** — Line chart of daily page views (data already exists, just never charted).
2. **Conversion Funnel** — Funnel/waterfall chart: modal_opened → modal_closed → form_submitted → subscribed.
3. **Browser Breakdown** — Pie chart (data is already computed in the current code but never rendered).
4. **Top Pages** — Horizontal bar chart of page_path by view count (currently only "/" exists, but this will become useful once Phase 5 fixes tracking).

### 6.4 Remove Raw Row Fetching

**Current:** `getPageViews(1000)` fetches 1,000 raw rows to show 20 in a table.

**Spec:**
- Recent tables (subscribers, contacts, page views) fetch only their displayed limit (20 rows) from the API.
- Aggregate metrics come from server-side counts.
- CSV export triggers a dedicated download endpoint that streams results.

---

## 7. Phase 5 — Data Pipeline Activation

### 7.1 Activate Page View Tracking Across All Routes

**Current:** `lib/analytics.ts` `trackPage()` only fires on the homepage.

**Spec:**
- Add an `AnalyticsProvider` component to the root layout (or members layout) that calls `Analytics.trackPageView(pathname)` on every route change using `usePathname()` from `next/navigation`.
- This populates `page_views` with member-area paths: `/members/dashboard`, `/members/journal`, `/members/social`, `/members/ai-coach`, etc.

**Acceptance Test:**
```
GIVEN a member navigates from /members/dashboard to /members/journal
THEN 2 page_view rows are created with correct page_path values
```

### 7.2 Activate `member_analytics_events` Tracking

**Current:** Table exists with schema (user_id, event_type, event_data, session_id) but 0 rows.

**Spec:**
- Add event tracking calls in key member actions:
  - `journal_entry_created` — when a trade is logged
  - `journal_entry_analyzed` — when AI analysis runs
  - `ai_coach_session_started` — when coach opens
  - `trade_shared` — when a trade card is shared
  - `lesson_completed` — when academy progress updates
  - `screenshot_uploaded` — when upload intelligence triggers
- This powers the `active_users` metric in `get_admin_analytics`.

### 7.3 Activate `chat_analytics` Daily Aggregation

**Current:** Table exists with rich schema but 0 rows.

**Spec:**
- Create a Supabase Edge Function (`aggregate-chat-analytics`) that runs daily via `pg_cron` or an external scheduler.
- Aggregates from `chat_conversations` and `chat_messages` for the previous day:
  - total_conversations, ai_only_conversations, human_conversations
  - escalations count, conversations_to_signup
  - avg_response_time_seconds, avg_ai_confidence
  - busiest_hour, top_categories

### 7.4 Activate `admin_activity_log` Tracking

**Current:** Only 2 entries ever logged.

**Spec:**
- Add logging middleware/helper for admin write operations. Every admin API route that performs a CREATE, UPDATE, or DELETE should log:
  - `admin_user_id`, `action` (e.g., "lead_approved"), `target_type` (e.g., "cohort_application"), `target_id`, `details` (JSON diff of changes).
- Routes to instrument:
  - `/api/admin/leads` PATCH → "lead_status_changed"
  - `/api/admin/courses` POST/PATCH/DELETE → "course_created/updated/deleted"
  - `/api/admin/lessons` POST/PATCH/DELETE → "lesson_created/updated/deleted"
  - `/api/admin/notifications` POST → "notification_broadcast"
  - `/api/admin/packages` PATCH → "pricing_tier_updated"
  - `/api/admin/roles` POST/PUT/DELETE → "role_permissions_changed"
  - `/api/admin/settings` PATCH → "setting_updated"
  - `/api/admin/tabs` PUT → "tabs_updated"
  - `/api/admin/members/force-sync` POST → "member_force_synced"

---

## 8. Phase 6 — Environment Hardening

### 8.1 Replace All Hardcoded URLs

Add to `.env` / Vercel / Railway environment:
```
NEXT_PUBLIC_APP_URL=https://trade-itm-prod.up.railway.app
```

Replace in all 5 affected source files + 1 edge function.

### 8.2 Click Tracking Expansion

**Current:** Only 2 element types tracked (cta_button, pricing_card).

**Spec:**
- Add click tracking to the members area:
  - `nav_item` — sidebar/tab navigation clicks
  - `journal_action` — add trade, analyze, import, export
  - `ai_coach_action` — send message, upload screenshot, action chip
  - `social_action` — share trade, like, view leaderboard
  - `academy_action` — start lesson, complete quiz, resume course
- Each click event should include `element_label` (human-readable name) and `page_path`.

### 8.3 Security Audit

- Verify all admin API routes check `isAdminUser()` before returning data (confirmed: all 18 routes do).
- Verify the analytics page doesn't expose PII through client-side queries (current risk: anon key queries `subscribers` table with emails — move to server-side API).
- Ensure `admin_activity_log` has RLS that only allows admin reads.

---

## 9. Migration Plan

### Execution Order

| Phase | Effort | Dependencies | Risk |
|-------|--------|--------------|------|
| Phase 1.5 — Hardcoded URL removal | 1 hour | None | Low |
| Phase 1.3 — Fix "Total Members" count | 30 min | Phase 2 API | Low |
| Phase 2 — Create `/api/admin/analytics` | 3-4 hours | None | Medium |
| Phase 1.1 — Replace "Recent Sales" widget | 1-2 hours | Phase 2 API or direct query | Low |
| Phase 1.2 — Replace "New Leads" widget | 1 hour | Direct query | Low |
| Phase 1.4 — Dynamic canned response pricing | 1 hour | `/api/admin/packages` exists | Low |
| Phase 3 — Command Center overhaul | 3-4 hours | Phase 2 API | Medium |
| Phase 4 — Analytics page production upgrade | 4-5 hours | Phase 2 API | Medium |
| Phase 5.1 — Page view tracking activation | 1-2 hours | None | Low |
| Phase 5.2 — member_analytics_events activation | 2-3 hours | None | Low |
| Phase 5.3 — chat_analytics aggregation | 2-3 hours | Edge function deploy | Medium |
| Phase 5.4 — admin_activity_log activation | 2-3 hours | None | Low |
| Phase 6 — Click tracking + security | 2-3 hours | Phase 5.1 | Low |

**Total estimated effort: ~25-30 hours**

### Database Migrations Required

1. **Upgrade `get_admin_analytics` RPC** — Add conversion funnel, daily signups, avg messages.
2. **No new tables needed** — All required tables already exist.
3. **Optional:** Add indexes on `conversion_events(event_type, created_at)` and `page_views(page_path, created_at)` if query performance degrades with volume.

---

## 10. Acceptance Criteria

### Zero Hardcoded Data (Phase 1)

- [ ] `grep -r "Pro Sniper" app/admin/` returns 0 results
- [ ] `grep -r "John Doe" app/admin/` returns 0 results
- [ ] `grep -r "\+\$299" app/admin/` returns 0 results
- [ ] `grep -r "2 mins ago" app/admin/` returns 0 results (as hardcoded string)
- [ ] `grep -r "trade-itm-prod.up.railway" --include="*.ts" --include="*.tsx"` returns 0 results in source files
- [ ] Chat canned response prices match `pricing_tiers` table values

### Analytics API (Phase 2)

- [ ] `GET /api/admin/analytics?period=30d` returns complete `AdminAnalyticsResponse`
- [ ] Response `platform.total_members` matches `SELECT COUNT(*) FROM auth.users`
- [ ] All metrics change when period parameter changes
- [ ] Response time < 500ms with caching
- [ ] Non-admin requests return 401

### Command Center (Phase 3)

- [ ] All 5 metric cards show real data
- [ ] "Registered Members" shows auth.users count, not subscribers count
- [ ] No `[1,2,3].map` patterns remain for data rendering
- [ ] Empty states render correctly when tables have 0 relevant rows
- [ ] Period selector filters all period-aware metrics

### Analytics Page (Phase 4)

- [ ] Page fetches from `/api/admin/analytics` (single request) instead of 6 client-side queries
- [ ] Date range selector filters ALL sections (metrics, charts, and tables)
- [ ] Page Views Over Time line chart renders
- [ ] Conversion Funnel chart renders
- [ ] Browser Breakdown pie chart renders
- [ ] No raw-row fetching for aggregate metrics (no 1,000 row limit)

### Data Pipelines (Phase 5)

- [ ] Navigating between member pages creates page_view rows with correct paths
- [ ] Creating a journal entry generates a `member_analytics_events` row
- [ ] `get_admin_analytics` `active_users` returns > 0 after member activity
- [ ] `chat_analytics` table populates daily with aggregate data
- [ ] Admin actions (approve lead, create course, etc.) generate `admin_activity_log` entries

### Environment (Phase 6)

- [ ] App URL sourced from `NEXT_PUBLIC_APP_URL` in all contexts
- [ ] Click events cover at least 6 distinct element types across members area
- [ ] No subscriber emails exposed via client-side anon key queries
