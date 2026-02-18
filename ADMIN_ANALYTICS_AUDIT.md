# Admin Analytics Audit Report

**Date:** February 16, 2026
**Scope:** Full audit of `/admin` analytics surfaces, data pipelines, and database infrastructure

---

## 1. Current State Summary

### Data Inventory (Live Database)

| Table | Row Count | Status |
|-------|-----------|--------|
| page_views | 5,310 | Active tracking |
| sessions | 3,081 | Active (1,020 returning) |
| click_events | 532 | Active — only 2 element types tracked |
| conversion_events | 2,431 | Active — 4 event types |
| subscribers | 78 | Active |
| contact_submissions | 6 | Active |
| ai_coach_sessions | 444 | Active |
| ai_coach_messages | 1,087 | Active |
| member_analytics_events | 0 | **EMPTY — never populated** |
| admin_activity_log | 2 | **Near-empty — barely used** |
| chat_analytics | 0 | **EMPTY — never populated** |
| journal_entries | 8 | Low usage |
| shared_trade_cards | 1 | Low usage |
| auth.users | 10 | Small user base |
| member_profiles | 1 | Very low |
| cohort_applications | 5 | Active pipeline |

### Admin Pages Reviewed

| Page | What It Shows | Data Source |
|------|--------------|-------------|
| `/admin` (Command Center) | Members, active chats, courses, system health, recent leads | Client-side Supabase queries + `/api/admin/system` |
| `/admin/analytics` | Page views, clicks, devices, browsers, subscribers, contacts | Client-side Supabase via `lib/supabase.ts` helpers |
| `/admin/leads` | Cohort application pipeline | `/api/admin/leads` |
| `/admin/courses` + academy analytics | Course/learner stats | `/api/admin/academy/analytics` |

### Existing RPC Functions

| Function | Used By | Status |
|----------|---------|--------|
| `get_admin_analytics(p_days)` | **Nothing** — exists in DB but no page calls it | Orphaned |
| `get_dashboard_stats(user_id, period)` | Member dashboard only | Working |
| `get_equity_curve(user_id, days)` | Member dashboard only | Working |
| `get_trading_calendar(user_id, months)` | Member dashboard only | Working |

---

## 2. E2E Test Results

### Test: `/admin/analytics` Page Data Flow

| Check | Result | Notes |
|-------|--------|-------|
| Page views load | PASS | 5,310 rows fetched (hardcoded limit 1000 — data is truncated) |
| Date range filter on page views | **FAIL** | Date range only filters device/browser breakdown, NOT the page views, subscribers, contacts, or click events tables |
| Unique visitors calculation | PASS | Computed client-side from session_id Set |
| Device breakdown chart | PASS | Filters by date range correctly |
| Browser breakdown chart | PASS | Filters by date range correctly |
| Click events chart | PARTIAL | Only 2 element types tracked (cta_button, pricing_card) — very limited |
| Subscriber table | PASS | Shows all 78 subscribers |
| Contact table | PASS | Shows all 6 contacts |
| CSV export | PASS | All 4 export buttons functional |
| Page views table only shows "/" | **ISSUE** | All 5,310 page views are for "/" — tracking only fires on homepage |

### Test: `/admin` Command Center

| Check | Result | Notes |
|-------|--------|-------|
| Total Members count | **ISSUE** | Queries `subscribers` table (78), not `auth.users` (10) — misleading label |
| Active Chats count | PASS | Queries chat_conversations where status=active |
| Courses count | PASS | |
| System Health | PASS | Calls `/api/admin/system` and calculates pass percentage |
| Pending Applications | PASS | Shows callout when > 0 |
| Recent Applications | PASS | Shows last 5 with status badges |
| Recent Sales widget | **HARDCODED** | Displays static placeholder data ("Pro Sniper +$299") — not connected to any data |
| New Leads widget | **HARDCODED** | Displays static placeholder data ("John Doe") — not connected to any data |

### Test: `get_admin_analytics` RPC Function

| Check | Result | Notes |
|-------|--------|-------|
| Function exists in DB | PASS | Confirmed via pg_proc |
| Called by any page | **FAIL** | No admin page or API route invokes this function |
| Returns correct data | UNTESTED | Requires admin JWT auth context |
| `active_users` metric | **FAIL** | Depends on `member_analytics_events` which has 0 rows |

---

## 3. Identified Gaps

### Critical Gaps

**Gap 1: `get_admin_analytics` RPC is orphaned**
A well-designed function exists that aggregates total members, new members, journal entries, AI coach sessions/messages, shared trade cards, and active users — but nothing calls it. The admin dashboard and analytics page both ignore it, instead running scattered client-side queries.

**Gap 2: `member_analytics_events` table is never populated**
The table exists with proper schema and indexes, but the client-side `Analytics` library (`lib/analytics.ts`) only writes to `page_views`, `click_events`, `conversion_events`, and `sessions`. No code writes to `member_analytics_events`, making the `active_users` metric in `get_admin_analytics` permanently zero.

**Gap 3: `chat_analytics` table is never populated**
A rich schema exists (total_conversations, ai_only_conversations, human_conversations, escalations, avg_response_time, avg_ai_confidence, busiest_hour, top_categories) but no aggregation job or trigger populates it.

**Gap 4: `admin_activity_log` is barely used**
Only 2 entries total. Admin actions (lead approvals, course edits, notification broadcasts, settings changes) are not being logged.

### Data Quality Gaps

**Gap 5: Page views only track homepage**
All 5,310 page views have `page_path = "/"`. The tracking script either only runs on the landing page or doesn't capture navigation within the Next.js app router (likely because `trackPage` isn't called on route changes in the members area).

**Gap 6: Click tracking covers only 2 element types**
Only `cta_button` (361) and `pricing_card` (171) are tracked. No tracking on navigation links, feature interactions, journal actions, AI coach usage, or social features.

**Gap 7: Date filtering is inconsistent**
The analytics page date selector filters device/browser breakdowns but fetches the same 1,000 most-recent rows for page views, subscribers, contacts, and clicks regardless of date range.

### UX & Feature Gaps

**Gap 8: Admin dashboard "Recent Sales" and "New Leads" widgets are hardcoded placeholders**
They display fake static data rather than pulling from actual WHOP payment events or cohort applications.

**Gap 9: No conversion funnel visualization**
Rich conversion data exists (1,699 modal_opened → 558 modal_closed → 96 form_submitted → 78 subscriptions) but no funnel chart displays this pipeline.

**Gap 10: "Total Members" on dashboard counts subscribers, not auth users**
The label says "Total Members" but queries the `subscribers` table (78 email signups), not `auth.users` (10 actual registered members). These are fundamentally different audiences.

**Gap 11: No AI Coach analytics visible to admin**
444 sessions and 1,087 messages exist but no admin surface shows AI coach usage trends, popular topics, session duration, or user engagement.

**Gap 12: No revenue/payment analytics**
Despite WHOP integration handling payments, there's no revenue dashboard, MRR tracking, churn rate, or payment history visible to admins.

**Gap 13: No member engagement/retention metrics**
No DAU/WAU/MAU charts, no cohort retention analysis, no feature adoption tracking, no session duration analysis despite having session data with `first_seen`/`last_seen` timestamps.

**Gap 14: No page views over time chart**
Daily page view data exists (the DB shows clear traffic patterns) but the analytics page only shows a raw table of the last 20 views — no time-series visualization.

**Gap 15: Browser breakdown chart exists in code but is never rendered**
The `browserData` variable is computed (line 115-118 of analytics/page.tsx) but there's no chart component for it in the JSX.

---

## 4. Improvement Recommendations

### Priority 1: Wire Up Existing Infrastructure (Low effort, High impact)

1. **Call `get_admin_analytics` from the Command Center page** — Replace the scattered client-side queries with a single RPC call. This gives you total members (from auth.users, not subscribers), new members, journal entries, AI coach stats, and shared trades in one query.

2. **Add a daily cron/edge function to populate `chat_analytics`** — Aggregate from `chat_conversations` and `chat_messages` daily. The schema is already perfect.

3. **Populate `member_analytics_events`** — Add event tracking in the members area for key actions: journal entry created, AI coach session started, trade shared, lesson completed. Wire up the existing `Analytics.trackEvent()` pattern.

4. **Log admin actions to `admin_activity_log`** — Add middleware or explicit calls when admins approve/reject leads, edit courses, broadcast notifications, or change settings.

5. **Fix "Total Members" to query auth.users** — One-line fix: change the query from `subscribers` to call the `get_admin_analytics` RPC which correctly counts `auth.users`.

### Priority 2: Fix Data Quality Issues (Medium effort, High impact)

6. **Track page views across all routes** — Add a `usePathname()` effect in the members layout that calls `Analytics.trackPageView()` on every route change. Currently only the landing page is tracked.

7. **Expand click tracking** — Add tracking to: navigation items, journal actions (add trade, analyze, export), AI coach interactions, social features (share, like), academy progress actions.

8. **Fix date filtering on analytics page** — Pass the date range to `getPageViews`, `getClickEvents`, `getSubscribers`, and `getContactSubmissions` as a `created_at` filter so the entire page responds to the date selector.

9. **Remove the 1,000 row limit** — Use count queries or server-side aggregation instead of fetching raw rows client-side. At 5,310 page views and growing, the current approach won't scale.

### Priority 3: New Analytics Features (Higher effort, High value)

10. **Conversion funnel chart** — Visualize the existing `conversion_events` data as a funnel: modal_opened → modal_closed → form_submitted → subscription. The data already exists.

11. **Page views over time chart** — Add a line/area chart showing daily page views. The data is there (19 days of history), just needs a time-series visualization.

12. **AI Coach usage dashboard** — Show sessions/day, messages/session average, peak usage hours, trending topics from `ai_coach_sessions` and `ai_coach_messages`.

13. **Revenue dashboard** — Integrate WHOP webhook payment data (already stored via `payment.succeeded` events) into a revenue card showing MRR, total revenue, recent transactions.

14. **Member retention cohort chart** — Use `auth.users.created_at` + session/activity data to show weekly/monthly retention cohorts.

15. **Replace hardcoded dashboard widgets** — Wire "Recent Sales" to actual WHOP payment events and "New Leads" to the most recent `cohort_applications` (the data already exists in the Recent Applications card, so this is redundant — consider replacing with something more useful like "AI Coach Active Now" or "Today's Journal Entries").

16. **Render the browser breakdown chart** — The data is computed but never displayed. Add the PieChart component for browser data alongside the device breakdown chart.

---

## 5. Architecture Notes

The current analytics implementation has a split-brain problem: the `get_admin_analytics` RPC function was designed to be the single source of truth for admin metrics, but the actual admin pages bypass it entirely and run ad-hoc client-side queries using the anon key. This means:

- The RPC has proper security (admin-only via JWT check) while the client queries rely on RLS policies that may not restrict subscriber/contact data to admins.
- The RPC returns platform-level metrics (auth.users count, AI coach stats) that the client-side queries cannot access (the anon key can't query `auth.users`).
- The client-side approach won't scale — fetching 1,000 raw page_view rows to count them is inefficient vs. a `COUNT(*)` in the RPC.

**Recommended architecture:** Create a single `/api/admin/analytics` API route that calls `get_admin_analytics` with the service role key, and have both the Command Center and Analytics page consume it.
