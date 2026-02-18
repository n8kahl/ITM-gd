# Academy Systems Audit & Consolidation Plan

**Date:** 2026-02-17
**Status:** Two parallel systems exist. One must be retired.

---

## Executive Summary

The TradeITM Academy currently has **two completely separate data systems** serving the same curriculum, plus **dead frontend routes** from a partially completed migration. The old system has real user progress data but a weaker architecture. The V3 system has richer content (blocks, assessments, competencies, spaced repetition) but zero user data. The admin panel writes to the old tables while the member-facing UI reads from V3 tables. Content edits made in admin are invisible to members.

---

## System Inventory

### System A: "Old Academy" (courses/lessons tables)

**Created:** Feb 10, 2026
**Tables:** 9
**Status:** Still receives admin writes. Has real user progress. No active member-facing frontend.

| Table | Rows | Purpose |
|---|---|---|
| `courses` | 9 | Course catalog (same 9 titles as V3 modules) |
| `lessons` | 53 | Lessons with `video_url`, `quiz_data`, `ai_tutor_context`, `chunk_data` |
| `learning_paths` | 4 | Track groupings: Onboarding, Foundations, Core Strategies, Advanced Trading |
| `learning_path_courses` | 9 | Join table linking paths to courses |
| `user_course_progress` | 1 | Course-level progress (1 real record) |
| `user_lesson_progress` | 28 | Lesson-level progress (28 real records, 2 users) |
| `user_learning_activity_log` | 44 | Activity events with XP tracking |
| `user_learning_insights` | 0 | Empty |
| `user_learning_profiles` | 0 | Empty |

**Key columns in `lessons` not present in V3:**
- `video_url` — video content per lesson
- `quiz_data` (jsonb) — inline quiz questions
- `ai_tutor_context` — AI coach context string
- `ai_tutor_chips` — suggested AI coach prompts
- `chunk_data` (jsonb) — chunked content blocks
- `micro_lesson_extract` (jsonb) — micro-learning extracts
- `adaptive_variants` (jsonb) — difficulty variants
- `competency_keys` — competency tags (enum array)
- `is_free_preview` — paywall flag

**Key columns in `courses` not present in V3:**
- `discord_role_required` — access gating
- `tier_required` — membership tier gating
- `passing_score` — completion threshold
- `competency_map` (jsonb) — competency mapping
- `common_mistakes` (jsonb) — pedagogical metadata
- `social_proof_count` — engagement count

### System B: "Academy V3" (academy_* tables)

**Created:** Feb 10, 2026 (same day, seeded separately)
**Tables:** 16
**Status:** Member-facing frontend reads from these. Zero user progress data.

| Table | Rows | Purpose |
|---|---|---|
| `academy_programs` | 1 | Top-level program: "TITM Core Program" |
| `academy_tracks` | 5 | 4 active + 1 inactive ("Legacy Academy Library") |
| `academy_modules` | 10 | Same 9 courses + 1 new module ("Market Context Fundamentals") |
| `academy_lessons` | 55 | Same lessons, different IDs, with `learning_objective` |
| `academy_lesson_blocks` | 275 | 5 blocks per lesson (hook → concept → worked example → guided practice → independent practice) |
| `academy_competencies` | 6 | Competency domains |
| `academy_lesson_competencies` | 53 | Lesson-to-competency mapping with weights |
| `academy_assessments` | 15 | Diagnostic (1), formative (10), summative (4) |
| `academy_assessment_items` | 113 | Quiz questions with answer keys and rubrics |
| `academy_learning_events` | 0 | Event log (empty) |
| `academy_review_queue` | 0 | Spaced repetition queue (empty) |
| `academy_review_attempts` | 0 | Review attempt records (empty) |
| `academy_user_enrollments` | 0 | Program enrollment records (empty) |
| `academy_user_lesson_attempts` | 0 | Lesson attempt records (empty) |
| `academy_user_assessment_attempts` | 0 | Assessment attempt records (empty) |
| `academy_user_competency_mastery` | 0 | Competency score records (empty) |

**Capabilities V3 has that Old does not:**
- Hierarchical structure: Program → Track → Module → Lesson → Block
- 5-step pedagogical sequence per lesson (hook, concept, worked example, guided practice, independent practice)
- Formal assessment system with 5 item types (single_select, multi_select, ordered_steps, short_answer_rubric, scenario_branch)
- Competency-based mastery tracking with remediation flags
- Spaced repetition review queue with SM-2 style scheduling
- Adaptive recommendation engine
- RLS policies on all 16 tables

---

## Content Duplication Map

Every old course exists in V3 with the same slug and lesson count:

| Slug | Old Title | V3 Title | Old Lessons | V3 Lessons |
|---|---|---|---|---|
| `welcome-tradeitm` | Welcome to TradeITM | Welcome to TradeITM | 5 | 5 |
| `options-101` | Options 101: Understanding the Basics | Options 101: Understanding the Basics | 6 | 6 |
| `reading-the-alerts` | Reading the Alerts | Reading the Alerts | 6 | 6 |
| `titm-day-trading-methodology` | TITM Day Trading Methodology | TITM Day Trading Methodology | 6 | 6 |
| `spx-execution-mastery` | SPX Execution Mastery | SPX Execution Mastery | 6 | 6 |
| `risk-management-fundamentals` | Risk Management Fundamentals | Risk Management Fundamentals | 6 | 6 |
| `the-greeks-decoded` | The Greeks Decoded | The Greeks Decoded | 6 | 6 |
| `leaps-long-term-positioning` | LEAPS and Long-Term Positioning | LEAPS and Long-Term Positioning | 6 | 6 |
| `trading-psychology-performance` | Trading Psychology and Performance | Trading Psychology and Performance | 6 | 6 |

V3 has one additional module not in old system: **"Market Context Fundamentals"** (2 lessons).

**Track/Path grouping comparison:**

| Old Learning Path | V3 Track |
|---|---|
| Onboarding | *(no equivalent — Welcome module is in Foundations track)* |
| Foundations | Foundations |
| Core Strategies | Strategy & Execution |
| Advanced Trading | Risk & Analytics + Performance & Mastery |
| *(none)* | Legacy Academy Library *(inactive, position 2)* |

---

## Frontend Route Inventory

### Active Routes (V3)

| Route | Component | Data Source |
|---|---|---|
| `/members/academy-v3` | `PlanDashboard` | `academy_*` tables via `/api/academy-v3/plan` |
| `/members/academy-v3/modules` | `ModulesCatalog` | `academy_*` tables via `/api/academy-v3/plan`, `/modules/[slug]`, `/lessons/[id]` |
| `/members/academy-v3/review` | `ReviewWorkbench` | `academy_*` tables via `/api/academy-v3/review` |
| `/members/academy-v3/progress` | `ProgressOverview` | `academy_*` tables via `/api/academy-v3/mastery` |

### Dead/Redirect Routes

| Route | Status | Notes |
|---|---|---|
| `/members/library` | Redirect → `/members/academy-v3/modules` | `permanentRedirect()` |
| `/members/academy/continue` | Empty directory | No page.tsx |
| `/members/academy/courses` | Empty directory | No page.tsx |
| `/members/academy/learn` | Empty directory | No page.tsx |
| `/members/academy/onboarding` | Empty directory | No page.tsx |
| `/members/academy/review` | Empty directory | No page.tsx |
| `/members/academy/saved` | Empty directory | No page.tsx |

### Navigation Entry Points

| Location | Label | Links To |
|---|---|---|
| Desktop sidebar | "Academy" | `/members/academy-v3/modules` (skips Plan page) |
| Mobile bottom nav | "Academy" | `/members/academy-v3/modules` (skips Plan page) |
| V3 sub-nav | "Plan" tab | `/members/academy-v3` |

---

## API Route Inventory

### V3 API Routes (read from `academy_*` tables)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/academy-v3/plan` | Fetch full learning plan |
| GET | `/api/academy-v3/modules/[slug]` | Fetch module with lessons |
| GET | `/api/academy-v3/lessons/[id]` | Fetch lesson with blocks |
| POST | `/api/academy-v3/lessons/[id]/start` | Start lesson attempt |
| POST | `/api/academy-v3/lessons/[id]/complete-block` | Complete a block |
| POST | `/api/academy-v3/assessments/[id]/submit` | Submit assessment |
| GET | `/api/academy-v3/review` | Fetch review queue |
| POST | `/api/academy-v3/review/[queueId]/submit` | Submit review answer |
| GET | `/api/academy-v3/mastery` | Fetch competency scores |
| GET | `/api/academy-v3/recommendations` | Fetch adaptive recommendations |

### Old Admin API Routes (write to `courses`/`lessons` tables)

| Method | Route | Purpose | **Problem** |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/admin/courses` | CRUD on `courses` table | **Writes go nowhere visible** |
| GET/POST/PATCH/DELETE | `/api/admin/lessons` | CRUD on `lessons` table | **Writes go nowhere visible** |
| POST | `/api/admin/academy/generate-lesson` | AI lesson generation | Targets old tables |
| GET | `/api/admin/academy/analytics` | Learning analytics | Queries old tables |
| GET | `/api/admin/academy/seed-health` | Data health check | Queries old tables |

### Other Code Referencing Old Tables

| File | References | Purpose |
|---|---|---|
| `lib/academy/resume.ts` | `courses`, `lessons`, `user_lesson_progress` | "Continue where you left off" logic |
| `lib/academy/xp-utils.ts` | `user_learning_activity_log` | XP/rank calculations |
| `lib/academy/achievement-events.ts` | `user_learning_activity_log` | Achievement creation |
| `components/profile/academy-progress-card.tsx` | XP/rank data (indirect) | Profile page progress card |

---

## User Progress Data at Risk

Two users have progress in the old system:

**User `d4be5d99`** — 27 lesson records across 8 courses. 1 completed lesson (LEAPS: Portfolio Allocation, Feb 13). Most are `in_progress` with minimal time spent (5–63 seconds). No quiz scores.

**User `ac20b7f0`** — 1 lesson record (Greeks: Delta and Directional Risk, `in_progress`, 15 seconds).

**User `d4be5d99` also has** 1 course progress record and there are 44 activity log entries.

This data is minimal but real — it would need to be mapped to V3 lesson IDs during migration (matchable by slug since both systems share identical slugs).

---

## RLS Policy Status

All tables in both systems have RLS enabled:

- **Old system:** `courses` and `lessons` allow public read of published content. `service_role` has full access. `learning_path_courses` requires authenticated role.
- **V3 system:** All content tables allow public read of published items. User-specific tables (`academy_user_*`, `academy_review_*`, `academy_learning_events`) enforce `user_id = auth.uid()`.

---

## Root Cause: How This Happened

Both systems were created on the same day (Feb 10, 2026). The old system (`courses`, `lessons`, `learning_paths`) was the original implementation with an admin CRUD panel, AI lesson generation, and a learning path structure. The V3 system (`academy_*`) was built as an architectural upgrade with a proper program/track/module/lesson/block hierarchy, competency tracking, and spaced repetition.

The migration was never completed:
1. V3 tables were created and seeded with the same content
2. The frontend was pointed at V3
3. The old frontend routes were emptied but not deleted
4. The admin panel was never updated to write to V3
5. The old tables were never dropped
6. The `lib/academy/resume.ts` still queries old tables for "continue learning" logic
7. The profile XP card still reads from old activity logs

---

## Consolidation Plan

### Phase 1: Data Migration
1. Map old `user_lesson_progress` records to V3 `academy_user_lesson_attempts` by matching lesson slugs between systems
2. Map old `user_course_progress` to V3 `academy_user_enrollments`
3. Map old `user_learning_activity_log` XP data to V3 `academy_learning_events`
4. Migrate any valuable `video_url`, `quiz_data`, `ai_tutor_context` from old `lessons` into V3 `academy_lesson_blocks.content_json` metadata

### Phase 2: Admin Panel Rewrite
5. Rewrite `/api/admin/courses` to read/write `academy_modules` instead of `courses`
6. Rewrite `/api/admin/lessons` to read/write `academy_lessons`/`academy_lesson_blocks` instead of `lessons`
7. Update admin UI components to work with V3 data structures
8. Update `/api/admin/academy/generate-lesson` to target V3 tables
9. Update `/api/admin/academy/analytics` to query V3 tables

### Phase 3: Frontend Cleanup
10. Delete empty directories: `app/members/academy/continue`, `courses`, `learn`, `onboarding`, `review`, `saved`
11. Refactor `lib/academy/resume.ts` to query `academy_user_lesson_attempts` + `academy_lessons`
12. Refactor `lib/academy/xp-utils.ts` to query `academy_learning_events`
13. Update `academy-progress-card.tsx` data source
14. Replace `AcademyV3SubNav` with the shared `FeatureSubNav` component to match app design
15. Update sidebar and mobile nav to link to `/members/academy-v3` (Plan page) instead of `/modules`

### Phase 4: Route Consolidation
16. Move V3 routes from `/members/academy-v3` to `/members/academy` (canonical URL)
17. Add redirect from `/members/academy-v3/*` to `/members/academy/*` for bookmarks
18. Keep existing `/members/library` redirect, update target to `/members/academy/modules`
19. Update all internal links, `getMemberTabHref`, and `CLAUDE.md`

### Phase 5: Old Table Retirement
20. Remove all foreign key references to old tables
21. Drop tables: `user_learning_insights`, `user_learning_profiles` (both empty, never used)
22. Drop tables: `learning_path_courses`, `learning_paths` (replaced by `academy_tracks`)
23. Archive then drop: `user_lesson_progress`, `user_course_progress`, `user_learning_activity_log` (after data migrated)
24. Archive then drop: `courses`, `lessons` (after admin rewrite and data migrated)

### Phase 6: Academy UI Redesign
25. Replace the developer scaffold (Step 1/2/3 drill-down) with a production learning experience
26. Build proper module cards with track grouping and progress indicators
27. Build a dedicated lesson viewer route with step-by-step block progression
28. Add completion tracking, progress bars, and assessment UI
29. Design system compliance: use `FeatureSubNav`, `glass-card-heavy`, emerald theme throughout

---

## Files to Delete (Dead Code)

```
app/members/academy/continue/        (empty directory)
app/members/academy/courses/          (empty directory)
app/members/academy/learn/            (empty directory)
app/members/academy/onboarding/       (empty directory)
app/members/academy/review/           (empty directory)
app/members/academy/saved/            (empty directory)
components/academy/interactive/       (empty directory)
```

## Files to Refactor

```
lib/academy/resume.ts                → query academy_user_lesson_attempts
lib/academy/xp-utils.ts              → query academy_learning_events
lib/academy/achievement-events.ts     → query academy_learning_events
app/api/admin/courses/route.ts        → target academy_modules
app/api/admin/lessons/route.ts        → target academy_lessons + academy_lesson_blocks
app/api/admin/academy/generate-lesson/route.ts → target V3 tables
app/api/admin/academy/analytics/route.ts       → target V3 tables
app/api/admin/academy/seed-health/route.ts     → target V3 tables
lib/member-navigation.ts             → update href and labels
components/academy-v3/academy-v3-sub-nav.tsx   → replace with FeatureSubNav
components/academy-v3/modules-catalog.tsx      → full redesign
components/academy-v3/plan-dashboard.tsx       → full redesign
```
