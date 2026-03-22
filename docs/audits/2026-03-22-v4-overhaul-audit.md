# V4 Overhaul System Audit

> **Date:** 2026-03-22
> **Scope:** Admin CMS, Member Academy, Gamification, Content Pipeline, Integrations, Legacy Debt
> **Auditor:** Claude Code (Opus 4.6)
> **Branch:** `claude/improve-code-quality-Inxjl`

---

## Executive Summary

Full-system audit of TradeITM platform surfaces to inform the V4 Overhaul execution spec. The codebase is **architecturally sound** with clean TypeScript, consistent Emerald Standard styling, and proper RLS policies. The primary issues are **legacy fragmentation** (3 academy schema versions coexisting), **orphaned assets**, and **missing test coverage** across admin surfaces.

---

## 1. Admin CMS Audit

### 1.1 Surface Inventory

| Metric | Count | Lines |
|--------|-------|-------|
| Admin Pages | 18 | 10,091 |
| Admin Components | 17 | 6,226 |
| API Routes | 52 | ~4,500 |
| Type Files (admin-related) | 3 | 718 |
| **Total** | **~90 files** | **~21,535** |

### 1.2 Pages by Feature Area

**Growth & Sales:**
- Leads Pipeline (`/admin/leads`) — 607 lines
- Notifications (`/admin/notifications`) — 577 lines
- Live Chat (`/admin/chat`) — 1,513 lines (largest)
- Packages (`/admin/packages`) — 452 lines

**Product & Content:**
- Course Library (`/admin/courses`) — 268 lines
- Knowledge Base (`/admin/knowledge-base`) — 520 lines
- Alert Console (`/admin/alerts`) — 16 lines (delegates to component)
- Trade Review (`/admin/trade-review`) — 282 lines + detail view
- Studio Hub (`/admin/studio`) — 50 lines

**System Administration:**
- Command Center (`/admin`) — 564 lines
- Analytics (`/admin/analytics`) — 504 lines
- Member Access Control (`/admin/members-access`) — 1,565 lines (second largest)
- Role Permissions (`/admin/roles`) — 601 lines
- Member Tabs (`/admin/tabs`) — 587 lines
- Settings (`/admin/settings`) — 873 lines
- System & Ops (`/admin/system`) — 337 lines
- Team (`/admin/team`) — 705 lines

### 1.3 Key Findings

- **Security:** All routes gated with `isAdminUser()` server-side check in layout.tsx. RLS policies on all sensitive tables.
- **Code Quality:** No bare `any` types, consistent shadcn/UI + glass-card-heavy styling, Emerald/Champagne theme throughout.
- **Large Pages:** Member Access (1,565 lines) and Chat (1,513 lines) could benefit from component extraction.
- **Missing Tests:** Zero E2E tests for admin pages, zero unit tests for admin API routes.
- **Missing Docs:** No admin-specific execution spec or operational runbook.

### 1.4 API Route Coverage

52 route files spanning: Trade Review (9), Courses & Academy (6), Alerts/Discord (14), Member Management (12), System & Config (11).

---

## 2. Member Academy Audit

### 2.1 Surface Inventory

| Layer | Files | Lines |
|-------|-------|-------|
| Frontend Pages | 8 routes | ~1,200 |
| Core Components | 11 | 1,846 |
| Activity Components | 11 | ~2,500 |
| Catalog Components | 3 | ~500 |
| Progress Components | 4 | ~800 |
| API Routes (academy-v3) | 15+ | ~2,000 |
| Backend Services | 6 | ~3,000 |
| Lib/Repositories | 4 | ~1,500 |
| **Total** | **~62 files** | **~13,346** |

### 2.2 Curriculum Structure

- **9 modules**, 55 lessons across core/intermediate/advanced tiers
- **Programs → Tracks → Modules → Lessons → Blocks** hierarchy (V3)
- **13 interactive activity types:** flashcard, options chain simulator, payoff diagram builder, trade scenario tree, strategy matcher, position builder, timed challenge, market context tagger, order entry simulator, what went wrong, journal prompt, greeks dashboard
- Content stored as `content_markdown` (text) + `content_json` (activities)

### 2.3 Schema Version Fragmentation (Critical)

Three coexisting academy schema versions:

| Version | Tables | Status | Migration |
|---------|--------|--------|-----------|
| V1 | `courses`, `lessons`, `learning_paths` | **ARCHIVED** → `academy_legacy_archive` schema | `20260322020000` |
| V2 | 9 courses, 53 lessons, chunk-based | **RETIRED** → data backfilled to V3 | `20260322010000` |
| V3 | 25+ tables, competency-based | **ACTIVE** (canonical) | `20260319000000` |

**Risk:** Legacy V1/V2 tables still physically exist in the database. App code references V3 exclusively but the dead tables add schema noise and migration complexity.

### 2.4 Key Findings

- **API Layer Active:** `/api/academy-v3/*` is the canonical API (53 files import from `lib/academy-v3`). The "v3" in the path is the current version, not legacy.
- **UI Routes Deprecated:** `/members/academy-v3` and `/members/library` redirect to `/members/academy` (canonical).
- **Zod Validation:** All API boundaries protected by Zod schemas.
- **No Dead Code:** All components, services, and utilities have active imports.
- **Activity Scoring:** 11 block types with deterministic pure-function scorers; answer keys server-only.

---

## 3. Gamification Audit

### 3.1 System Components

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| XP Service | `backend/src/services/academy-xp.ts` | ~200 | Active |
| Scoring Service | `backend/src/services/academy-scoring.ts` | ~400 | Active |
| Gamification Routes | `backend/src/routes/academy-gamification.ts` | ~150 | Active |
| Activity Routes | `backend/src/routes/academy-activities.ts` | ~200 | Active |

### 3.2 Progression System

**5-Rank System:**

| Rank | XP Threshold |
|------|-------------|
| Rookie | 0 |
| Rising Bull | 100 |
| Sniper Apprentice | 500 |
| Certified Sniper | 1,500 |
| Elite Operator | 4,000 |

**XP Awards:**

| Action | XP |
|--------|-----|
| Onboarding | 50 |
| Lesson View | 5 |
| Lesson Complete | 10 |
| Quiz Pass (first) | 50 |
| Quiz Pass (retake) | 25 |
| Quiz Perfect | 100 |
| Course Complete | 100 |
| Track Complete | 500 |
| Streak Day | 5 |
| Tutor Question | 2 |

### 3.3 Database Tables

- `academy_user_xp` — XP total + level
- `academy_user_streaks` — Daily streak with freeze mechanic
- `academy_achievements` — 30+ achievement definitions
- `academy_user_achievements` — Unlock records
- `academy_learning_events` — Event stream for XP triggers

### 3.4 Key Findings

- **Functional and complete** — XP, levels, streaks, achievements all working.
- **Leaderboards pre-computed:** Daily snapshot tables avoid real-time rank calculation.
- **Streak freeze mechanic:** 1-day gap bridging implemented.
- **Milestone bonuses:** 7, 30, 100-day streak milestones award bonus XP.
- **Non-fatal logging:** XP recorded even if event log write fails (resilient).

---

## 4. Content Pipeline Audit

### 4.1 Content Management

| Tool | File | Purpose |
|------|------|---------|
| Course Editor | `components/admin/course-editor-sheet.tsx` | Course CRUD (318 lines) |
| Lesson Manager | `components/admin/lesson-manager-sheet.tsx` | Lesson CRUD (473 lines) |
| Content Generator | `components/admin/academy/content-generator.tsx` | AI-powered lesson generation (446 lines) |
| Learning Analytics | `components/admin/academy/learning-analytics.tsx` | Learner tracking (595 lines) |

### 4.2 Content Storage Pattern

- Lesson content: `content_markdown` (plain text, rendered client-side)
- Activity content: `content_json` (structured JSON with embedded `answer_key`)
- Answer keys: Server-only, never sent to client
- Images: `next/image` with course image utilities in `lib/academy/course-images.ts`

### 4.3 Key Findings

- **Markdown-first:** Simple, proven pattern. No MDX complexity.
- **AI Generation:** OpenAI integration for lesson content generation (admin-only).
- **Analytics Pipeline:** Daily aggregation of lessons, cohort metrics, mastery data via `academy-aggregation.ts`.
- **No draft/publish workflow for lessons:** Lessons have `is_published` boolean but no staging/preview environment for content authors.

---

## 5. Integrations Audit

### 5.1 External Services

| Service | Config | Status |
|---------|--------|--------|
| Massive.com | `backend/src/config/massive.ts` | Active — market data |
| OpenAI | `backend/src/config/openai.ts` | Active — AI Coach + content gen |
| FRED | `backend/src/config/fred.ts` | Active — economic indicators |
| FMP | `backend/src/config/fmp.ts` | Active — financial modeling |
| Redis | `backend/src/config/redis.ts` | Active — caching + rate limiting |
| Sentry | `backend/src/config/sentry.ts` | Active — error tracking |
| Discord | `backend/src/services/discord/` (6 files) | Active — bot, roles, alerts |
| Web Push | `lib/web-push-service.ts` | Active — browser notifications |

### 5.2 Webhook Handlers

| Route | Status |
|-------|--------|
| `/api/webhooks/whop` | **DEPRECATED** — returns `{ deprecated: true }` |

### 5.3 Edge Functions (11)

`aggregate-chat-analytics`, `analyze-trade-screenshot`, `chat-visitor-sync`, `compute-leaderboards`, `create-team-member`, `cron-archive-conversations`, `handle-chat-message`, `notify-team-lead`, `send-chat-transcript`, `send-push-notification`, `sync-discord-roles`

### 5.4 Key Findings

- **WHOP webhook retired** but route still exists returning deprecated status.
- **Discord integration is modular** — 6 separate service files with test suite.
- **All configs are env-var driven** — no hardcoded secrets.
- **Single-process Massive WebSocket constraint** documented and enforced.

---

## 6. Legacy Debt Inventory

### 6.1 Files to Delete (28 candidates)

**Root-level Word docs (superseded by markdown specs):**
1. `TITM_Trade_Journal_Spec_v1.docx` (48K)
2. `TITM_Academy_Redesign_Strategy_v2.docx` (33K)
3. `SPX-Command-Center-Spatial-HUD-Spec-v2.docx` (26K)
4. `ACADEMY_V3_DEV_SPEC.docx` (23K)

**Redirect stub files (can be removed after grace period):**
5. `app/members/library/page.tsx` (5 lines — permanentRedirect)
6. `app/members/academy-v3/page.tsx` (5 lines — permanentRedirect)
7. `app/members/academy-v3/[...path]/page.tsx` (30 lines — catch-all redirect)
8. `app/money-maker/page.tsx` (5 lines — soft redirect)

**Orphaned/misnamed test files:**
9. `components/ai-coach/__tests__/widget-action-bar-v2.test.ts` (55 lines — tests non-v2 component)

**Orphaned schema documentation:**
10. `supabase-analytics-schema-v2.sql` (6.8K — root level, unused)

**Orphaned placeholder assets:**
11. `public/placeholder-logo.svg` (3.2K — real logo exists)
12. `public/placeholder-logo.png` (568B — real logo exists)

**Completed academy v3 planning docs (archive candidates):**
13–20. `docs/specs/academy-v3-baseline.md`, `academy-v3-cleanup-manifest.md`, `academy-v3-cleanup-api-audit.md`, `academy-v3-phase1-progress.md`, `academy-v3-phase2-3-progress.md`, and related phase reports

**Deprecated backend endpoint:**
21. `GET /api/journal/trades` — returns HTTP 410 (intentional, keep until client migration confirmed)

**E2E mock files for deprecated routes:**
22. `e2e/specs/members/academy-v3-mocks.ts` (~100 lines — if no active tests import it)

**Legacy v2 naming (rename, not delete):**
23. `components/academy/catalog/academy-module-card-v2.tsx` → rename to `academy-module-card.tsx`
24. `lib/spx/coach-alert-state-v2.ts` → rename to `coach-alert-state.ts`
25. `lib/spx/__tests__/coach-alert-state-v2.test.ts` → rename to `coach-alert-state.test.ts`

**Deprecated webhook route:**
26. `app/api/webhooks/whop/route.ts` (returns deprecated response)

**Legacy migration data files:**
27. `supabase/migrations/20260313000000_academy_v2_schema.sql` (V2 schema — keep as migration history)
28. `supabase/migrations/20260217010836_academy_v3_import_legacy_v2_curriculum.sql` (one-time backfill — keep as history)

### 6.2 Database Tables to Deprecate (16)

**Already archived (grace period → DROP):**
1. `archived_ai_coach_alerts`
2. `archived_ai_coach_watchlists`
3. `archived_ai_coach_tracked_setups`
4. `archived_ai_coach_leaps_positions`
5. `archived_ai_coach_opportunities`

**Legacy academy tables in `academy_legacy_archive` schema (→ DROP schema):**
6. `academy_legacy_archive.courses`
7. `academy_legacy_archive.lessons`
8. `academy_legacy_archive.learning_paths`
9. `academy_legacy_archive.learning_path_courses`
10. `academy_legacy_archive.user_course_progress`
11. `academy_legacy_archive.user_lesson_progress`
12. `academy_legacy_archive.user_learning_activity_log`
13. `academy_legacy_archive.user_learning_profiles`
14. `academy_legacy_archive.user_learning_insights`

**Already dropped (confirmed gone):**
15. `affiliate_referrals` (replaced by WHOP)
16. `admin_access_tokens` (replaced by RBAC)

### 6.3 Versioned Code Requiring Rename

| Current Name | Proposed Name | Reason |
|-------------|---------------|--------|
| `academy-module-card-v2.tsx` | `academy-module-card.tsx` | V2 is the only version |
| `coach-alert-state-v2.ts` | `coach-alert-state.ts` | V2 is canonical |
| `coach-alert-state-v2.test.ts` | `coach-alert-state.test.ts` | Match source file |
| `widget-action-bar-v2.test.ts` | `widget-action-bar.test.ts` | Tests non-v2 component |

---

## 7. Test Coverage Gaps

| Surface | Unit Tests | E2E Tests | Status |
|---------|-----------|-----------|--------|
| Admin Pages | 0 | 0 | **Critical gap** |
| Admin API Routes | 0 | 0 | **Critical gap** |
| Academy Components | 1 (media) | Partial | **High gap** |
| Academy Backend | Some (scoring) | Partial | Medium |
| Gamification | Some (XP) | 0 | **High gap** |
| Discord Integration | Yes (comprehensive) | 0 | Medium |
| SPX Command Center | Yes | Yes | Good |
| Trade Journal | Some | Yes (~49 tests) | Good |

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Academy schema fragmentation (3 versions) | High | Phase 6: Drop legacy tables after data verification |
| Zero admin test coverage | High | Phase 5: Add critical-path E2E tests |
| Large monolithic pages (1,500+ lines) | Medium | Phase 1: Extract components in CMS overhaul |
| WHOP webhook still responding (deprecated) | Low | Phase 6: Remove route after confirming no traffic |
| Legacy Word docs in repo root | Low | Phase 6: Delete in cleanup pass |
| Archived AI Coach tables consuming space | Medium | Phase 6: DROP after 30-day grace period verified |

---

## 9. Recommendations

1. **Phase the overhaul** — 6 phases matching the execution spec, with admin CMS first (highest organizational value).
2. **Kill legacy tables** — The 5 archived AI Coach tables and 9 academy legacy archive tables are confirmed dead. Schedule DROP.
3. **Add admin tests** — Zero test coverage on 52 API routes is the biggest quality risk.
4. **Extract large pages** — Member Access (1,565 lines) and Chat (1,513 lines) need component extraction.
5. **Rename v2 files** — 4 files with misleading "v2" suffixes should be renamed to their canonical names.
6. **Remove Word docs** — 4 root-level .docx files superseded by markdown specs.
7. **Delete redirect stubs** — After confirming analytics show zero traffic to legacy routes.
