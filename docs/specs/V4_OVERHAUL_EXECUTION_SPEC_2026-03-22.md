# V4 Overhaul Execution Spec

> **Date:** 2026-03-22
> **Governing Audit:** `docs/audits/2026-03-22-v4-overhaul-audit.md`
> **Autonomous Protocol:** `docs/specs/V4_OVERHAUL_AUTONOMOUS_PROTOCOL_2026-03-22.md`
> **Deprecation Plan:** `docs/specs/V4_OVERHAUL_LEGACY_DEPRECATION_PLAN_2026-03-22.md`

---

## Objective

Overhaul TradeITM platform across 6 phases: modernize admin CMS, revolutionize content pipeline, add interactive learning activities, implement gamification, harden platform integrations, and deprecate all legacy debt. Each phase is independently deployable and produces measurable value.

---

## Constraints

1. **No regressions** — Every phase must pass existing test suites before merge.
2. **Dark mode only** — All new UI follows The Emerald Standard (Section 2, CLAUDE.md).
3. **TypeScript strict** — Zero `any` types in new code.
4. **Phase-gated** — Each phase is a separate session family per Section 14 of CLAUDE.md.
5. **Backward compatible** — No breaking API changes without migration path documented.
6. **RLS required** — Every new table must have Row Level Security policies.

---

## Phase 1: Admin CMS Overhaul

**Objective:** Extract monolithic admin pages into composable components, add missing API validation, establish admin test baseline.

**Duration:** 2 sprints (4 weeks)

### Scope

| Slice | Description | Target Files | Acceptance Criteria |
|-------|-------------|-------------|-------------------|
| 1.1 | Extract Member Access page into 4 components | `app/admin/members-access/page.tsx`, `components/admin/members-access/` | Page < 400 lines, each extracted component < 500 lines |
| 1.2 | Extract Chat page into 3 components | `app/admin/chat/page.tsx`, `components/admin/chat/` | Page < 400 lines |
| 1.3 | Add Zod validation to all admin API routes | `app/api/admin/*/route.ts` | Every POST/PATCH/DELETE route validates input with Zod |
| 1.4 | Add admin API route unit tests | `app/api/admin/**/__tests__/` | At least 1 happy-path + 1 auth-failure test per route group (6 groups) |
| 1.5 | Admin E2E test baseline | `e2e/specs/admin/` | Critical-path tests: login, course CRUD, member access view (minimum 10 tests) |
| 1.6 | Admin operational runbook | `docs/specs/ADMIN_CMS_RUNBOOK_2026-03-22.md` | Covers: access control, diagnostics, alert console, trade review workflow |

### Out of Scope

- New admin features (Phase 2+)
- Database schema changes
- Backend route changes

### Risks

| Risk | Mitigation |
|------|-----------|
| Component extraction breaks existing functionality | Run full E2E suite after each extraction |
| Zod schemas mismatch existing API contracts | Read existing route handlers before writing schemas |

### Validation Gates

```bash
# Slice-level
pnpm exec eslint app/admin/ components/admin/ app/api/admin/
pnpm exec tsc --noEmit

# Phase-level
pnpm run build
pnpm exec playwright test e2e/specs/admin/ --project=chromium --workers=1
```

---

## Phase 2: Content Revolution

**Objective:** Upgrade content pipeline with draft/publish workflow, content versioning, bulk import/export, and enhanced AI generation.

**Duration:** 2 sprints (4 weeks)

### Scope

| Slice | Description | Target Files | Acceptance Criteria |
|-------|-------------|-------------|-------------------|
| 2.1 | Add content draft/publish workflow | `lib/academy-v3/services/`, `app/api/academy-v3/` | Lessons have `draft` → `review` → `published` states; only `published` visible to members |
| 2.2 | Content versioning (immutable history) | `supabase/migrations/`, `lib/academy-v3/` | Every publish creates an immutable version record; rollback to any previous version |
| 2.3 | Bulk content import/export (JSON) | `app/api/admin/academy/`, `components/admin/academy/` | Export entire curriculum as JSON; import JSON to create/update lessons |
| 2.4 | Enhanced AI content generator | `components/admin/academy/content-generator.tsx` | Generate full lesson with blocks, activities, and quiz from a topic prompt |
| 2.5 | Content preview mode | `components/academy/`, `app/members/academy/` | Admin can preview unpublished content with a `?preview=true` flag |
| 2.6 | Content analytics dashboard | `components/admin/academy/learning-analytics.tsx` | Per-lesson completion rates, time-on-page, drop-off points |

### Out of Scope

- New activity types (Phase 3)
- Gamification changes (Phase 4)
- Public-facing content (members only)

### Database Changes

```sql
-- New columns on academy_lessons
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published'));
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id);

-- New table: lesson version history
CREATE TABLE academy_lesson_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_id, version_number)
);
```

### Validation Gates

```bash
pnpm exec eslint lib/academy-v3/ app/api/academy-v3/ components/admin/academy/
pnpm exec tsc --noEmit
pnpm vitest run lib/academy-v3/__tests__/
pnpm exec playwright test e2e/specs/members/academy*.spec.ts --project=chromium --workers=1
```

---

## Phase 3: Interactive Activities

**Objective:** Add new activity types, improve scoring feedback, and build activity analytics for content authors.

**Duration:** 1.5 sprints (3 weeks)

### Scope

| Slice | Description | Target Files | Acceptance Criteria |
|-------|-------------|-------------|-------------------|
| 3.1 | Payoff diagram builder activity | `components/academy/activities/academy-payoff-diagram-builder.tsx` | Interactive P&L chart builder with auto-scoring against answer key |
| 3.2 | Order entry simulator activity | `components/academy/activities/academy-order-entry-simulator.tsx` | Simulated order flow with limit/stop/market entries; scores on execution quality |
| 3.3 | Improved scoring feedback UI | `components/academy/activities/` | Every activity shows detailed breakdown: correct items, partial credit, hints for wrong answers |
| 3.4 | Activity retry with spaced repetition | `backend/src/services/academy-xp.ts`, `lib/academy-v3/` | Failed activities re-queue with increasing intervals (1d, 3d, 7d) |
| 3.5 | Activity analytics for admins | `components/admin/academy/`, `backend/src/routes/academy-admin.ts` | Per-activity pass rate, average score, time-to-complete, common wrong answers |
| 3.6 | Activity unit tests | `backend/src/services/__tests__/academy-scoring.test.ts` | 100% coverage on all scorer functions (11 types) |

### Out of Scope

- New lesson content (content team responsibility)
- Gamification XP changes (Phase 4)
- UI redesign of existing activities (only add new ones + feedback improvements)

### Validation Gates

```bash
pnpm exec eslint components/academy/activities/ backend/src/services/academy-scoring.ts
pnpm exec tsc --noEmit
pnpm vitest run backend/src/services/__tests__/academy-scoring
pnpm exec playwright test e2e/specs/members/academy-activities*.spec.ts --project=chromium --workers=1
```

---

## Phase 4: Gamification Enhancement

**Objective:** Expand gamification beyond academy to include trading performance, social engagement, and seasonal challenges.

**Duration:** 2 sprints (4 weeks)

### Scope

| Slice | Description | Target Files | Acceptance Criteria |
|-------|-------------|-------------|-------------------|
| 4.1 | Trading performance XP | `backend/src/services/academy-xp.ts`, `lib/types/academy.ts` | Earn XP for: journaling trades (10), profitable trades (25), discipline score > 80% (15) |
| 4.2 | Social engagement XP | `backend/src/routes/academy-gamification.ts` | Earn XP for: sharing trades (5), leaderboard participation (3), helpful comments (2) |
| 4.3 | Seasonal challenges | `supabase/migrations/`, `backend/src/routes/academy-gamification.ts` | Time-limited challenges (e.g., "Journal 5 trades this week") with bonus XP |
| 4.4 | Achievement badges UI overhaul | `components/academy/academy-achievements.tsx` | Visual badge grid with progress bars, rarity tiers, and unlock animations |
| 4.5 | Leaderboard categories expansion | `components/social/leaderboard-table.tsx` | Add categories: academy_xp, discipline_score, streak_length alongside existing win_rate/pnl |
| 4.6 | Notification system for achievements | `lib/web-push-service.ts`, `backend/src/services/` | Push notification when user unlocks achievement or reaches new rank |

### Database Changes

```sql
-- Seasonal challenges
CREATE TABLE academy_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('daily', 'weekly', 'monthly', 'seasonal')),
  criteria JSONB NOT NULL, -- { action: 'journal_trade', count: 5 }
  xp_reward INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE academy_user_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  challenge_id UUID NOT NULL REFERENCES academy_challenges(id),
  progress INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  xp_awarded BOOLEAN DEFAULT false,
  UNIQUE(user_id, challenge_id)
);
```

### Validation Gates

```bash
pnpm exec eslint backend/src/services/academy-xp.ts backend/src/routes/academy-gamification.ts components/academy/ components/social/
pnpm exec tsc --noEmit
pnpm vitest run backend/src/services/__tests__/academy-xp
pnpm exec playwright test e2e/specs/members/academy*.spec.ts --project=chromium --workers=1
```

---

## Phase 5: Platform Integration Hardening

**Objective:** Harden external service integrations, add circuit breakers, improve observability, and clean up deprecated webhooks.

**Duration:** 1.5 sprints (3 weeks)

### Scope

| Slice | Description | Target Files | Acceptance Criteria |
|-------|-------------|-------------|-------------------|
| 5.1 | Circuit breaker for external APIs | `backend/src/middleware/`, `backend/src/config/` | Massive, OpenAI, FRED, FMP all wrapped with circuit breaker (open after 3 failures, half-open after 30s) |
| 5.2 | Integration health dashboard | `app/admin/system/page.tsx`, `app/api/admin/system/` | Real-time status of all external services: Massive, OpenAI, FRED, FMP, Discord, Redis, Supabase |
| 5.3 | Discord integration tests | `backend/src/services/discord/__tests__/` | Expand existing suite: add edge cases for rate limiting, reconnection, role sync failures |
| 5.4 | Edge function monitoring | `app/admin/system/`, `supabase/functions/` | Log execution time + error rate for all 11 edge functions; alert on failures |
| 5.5 | Dead letter queue processing | `backend/src/services/`, `supabase/migrations/` | Admin UI to view, retry, or dismiss failed events from `dead_letter_queue` |
| 5.6 | Integration runbook | `docs/specs/INTEGRATION_RUNBOOK_2026-03-22.md` | Covers: API key rotation, circuit breaker tuning, Discord bot restart, edge function redeployment |

### Out of Scope

- New integrations
- Broker integration (Tradier) — separate workstream
- Payment processing changes

### Validation Gates

```bash
pnpm exec eslint backend/src/middleware/ backend/src/config/ backend/src/services/
pnpm exec tsc --noEmit
npm --prefix backend test -- --runInBand
pnpm exec playwright test e2e/specs/admin/system*.spec.ts --project=chromium --workers=1
```

---

## Phase 6: Legacy Deprecation

**Objective:** Remove all legacy code, drop deprecated database tables, clean up file system, and finalize V4 documentation.

**Duration:** 1 sprint (2 weeks)

### Scope

| Slice | Description | Target Files | Acceptance Criteria |
|-------|-------------|-------------|-------------------|
| 6.1 | Delete root-level Word docs | 4 `.docx` files | Files removed, no imports broken |
| 6.2 | Delete redirect stubs (after traffic verification) | `app/members/library/`, `app/members/academy-v3/`, `app/money-maker/` | Routes removed; 404 for old paths (or nginx-level redirect if needed) |
| 6.3 | Drop archived AI Coach tables | `supabase/migrations/` | Migration: `DROP TABLE archived_ai_coach_*` (5 tables) |
| 6.4 | Drop academy legacy archive schema | `supabase/migrations/` | Migration: `DROP SCHEMA academy_legacy_archive CASCADE` (9 tables) |
| 6.5 | Rename v2 files to canonical names | 4 files (see audit §6.3) | All imports updated, tests pass |
| 6.6 | Remove deprecated WHOP webhook | `app/api/webhooks/whop/` | Route deleted, no references remain |
| 6.7 | Remove orphaned assets | `public/placeholder-logo.*`, `supabase-analytics-schema-v2.sql` | Files deleted |
| 6.8 | Archive completed spec docs | `docs/specs/academy-v3-*.md` | Move to `docs/archive/` directory |
| 6.9 | Remove deprecated backend endpoint | `backend/src/server.ts` line 159-163 | Remove `GET /api/journal/trades` 410 handler |
| 6.10 | V4 release notes + final validation | `docs/specs/V4_OVERHAUL_RELEASE_NOTES_2026-03-22.md` | Full build + test suite green; release notes document all changes |

### Database Changes (Destructive — Requires Backup)

```sql
-- 6.3: Drop archived AI Coach tables
DROP TABLE IF EXISTS archived_ai_coach_alerts;
DROP TABLE IF EXISTS archived_ai_coach_watchlists;
DROP TABLE IF EXISTS archived_ai_coach_tracked_setups;
DROP TABLE IF EXISTS archived_ai_coach_leaps_positions;
DROP TABLE IF EXISTS archived_ai_coach_opportunities;

-- 6.4: Drop legacy academy archive schema
DROP SCHEMA IF EXISTS academy_legacy_archive CASCADE;
```

### Pre-Conditions

- [ ] Verify zero traffic to legacy routes (analytics check)
- [ ] Verify archived tables have no active queries (Supabase query log)
- [ ] Database backup taken before destructive migrations
- [ ] All previous phases (1-5) are merged and deployed

### Validation Gates (Release-Level)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test --project=chromium --workers=1
```

---

## Timeline Summary

| Phase | Name | Duration | Dependencies |
|-------|------|----------|-------------|
| 1 | Admin CMS Overhaul | 4 weeks | None |
| 2 | Content Revolution | 4 weeks | Phase 1 (admin components) |
| 3 | Interactive Activities | 3 weeks | Phase 2 (content pipeline) |
| 4 | Gamification Enhancement | 4 weeks | Phase 3 (activity scoring) |
| 5 | Platform Integration Hardening | 3 weeks | None (parallel with 3-4) |
| 6 | Legacy Deprecation | 2 weeks | Phases 1-5 complete |

**Total estimated duration:** 14-16 weeks (with Phase 5 running parallel to 3-4)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Admin page max line count | 1,565 | < 500 |
| Admin API routes with Zod validation | ~30% | 100% |
| Admin E2E test count | 0 | 30+ |
| Activity types | 11 | 13+ |
| XP earning actions | 10 | 16+ |
| Legacy tables in DB | 14 | 0 |
| Legacy files in repo | 28 | 0 |
| External API circuit breakers | 0 | 4 |
| Integration health monitoring | Partial | Full (all services) |
