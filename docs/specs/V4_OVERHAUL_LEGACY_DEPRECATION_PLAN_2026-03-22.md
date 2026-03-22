# V4 Overhaul — Legacy Deprecation Plan

> **Date:** 2026-03-22
> **Governing Spec:** `docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md` (Phase 6)
> **Audit Reference:** `docs/audits/2026-03-22-v4-overhaul-audit.md`

---

## Overview

This plan catalogs every legacy artifact to be removed, renamed, or dropped as part of the V4 Overhaul Phase 6. Each item includes: what it is, why it's deprecated, what replaced it, verification steps, and rollback path.

**Totals:** 28 files to delete/rename, 16 database tables to soft-deprecate then drop.

---

## Part A: Files to Delete (20 files)

### A1. Root-Level Word Documents (4 files)

These Word docs were working documents superseded by markdown specs in `docs/specs/`.

| # | File | Size | Replaced By | Verification |
|---|------|------|-------------|-------------|
| 1 | `TITM_Trade_Journal_Spec_v1.docx` | 48K | `docs/specs/TRADE_JOURNAL_V2_SPEC.md` | Grep for imports: none expected |
| 2 | `TITM_Academy_Redesign_Strategy_v2.docx` | 33K | `docs/specs/ACADEMY_OVERHAUL_EXECUTION_SPEC_2026-02-24.md` | Grep for imports: none expected |
| 3 | `SPX-Command-Center-Spatial-HUD-Spec-v2.docx` | 26K | `docs/specs/SPX_COMMAND_CENTER_*.md` | Grep for imports: none expected |
| 4 | `ACADEMY_V3_DEV_SPEC.docx` | 23K | `docs/specs/ACADEMY_OVERHAUL_*.md` | Grep for imports: none expected |

**Delete command:**
```bash
git rm TITM_Trade_Journal_Spec_v1.docx TITM_Academy_Redesign_Strategy_v2.docx \
  SPX-Command-Center-Spatial-HUD-Spec-v2.docx ACADEMY_V3_DEV_SPEC.docx
```

**Rollback:** `git checkout HEAD~1 -- <file>` (files recoverable from git history)

---

### A2. Redirect Stub Pages (4 files)

These pages exist solely to redirect users from deprecated URLs. Remove after confirming zero traffic via analytics.

| # | File | Lines | Redirects To | Grace Period |
|---|------|-------|-------------|-------------|
| 5 | `app/members/library/page.tsx` | 5 | `/members/academy` | 90 days (since 2026-02-17) — **EXPIRED** |
| 6 | `app/members/academy-v3/page.tsx` | 5 | `/members/academy` | 90 days (since 2026-03-19) — expires 2026-06-17 |
| 7 | `app/members/academy-v3/[...path]/page.tsx` | 30 | `/members/academy/*` | Same as above |
| 8 | `app/money-maker/page.tsx` | 5 | `/members/money-maker` | 30 days — check traffic |

**Pre-condition:** Run analytics query to confirm zero traffic:
```sql
SELECT path, count(*) FROM member_analytics_events
WHERE path LIKE '/members/library%' OR path LIKE '/members/academy-v3%' OR path = '/money-maker'
AND created_at > now() - interval '30 days'
GROUP BY path;
```

**Delete command:**
```bash
git rm app/members/library/page.tsx
git rm -r app/members/academy-v3/
git rm app/money-maker/page.tsx
```

**Rollback:** `git checkout HEAD~1 -- <path>`

---

### A3. Orphaned & Misnamed Files (4 files)

| # | File | Lines | Issue | Action |
|---|------|-------|-------|--------|
| 9 | `components/ai-coach/__tests__/widget-action-bar-v2.test.ts` | 55 | Tests non-v2 component; misleading name | **Delete** (orphaned test) |
| 10 | `supabase-analytics-schema-v2.sql` | ~150 | Root-level schema doc, not a migration; unreferenced | **Delete** |
| 11 | `public/placeholder-logo.svg` | 3.2K | Real logo exists at `public/logo.png` | **Delete** |
| 12 | `public/placeholder-logo.png` | 568B | Same as above | **Delete** |

**Verification before delete:**
```bash
# Confirm no imports reference these
grep -r "placeholder-logo" --include="*.ts" --include="*.tsx" .
grep -r "widget-action-bar-v2" --include="*.ts" --include="*.tsx" .
grep -r "supabase-analytics-schema-v2" .
```

---

### A4. Completed Planning Documents (6 files → archive)

Move to `docs/archive/` rather than delete (preserves audit trail).

| # | File | Reason |
|---|------|--------|
| 13 | `docs/specs/academy-v3-baseline.md` | V3 is live; planning phase complete |
| 14 | `docs/specs/academy-v3-cleanup-manifest.md` | Cleanup completed |
| 15 | `docs/specs/academy-v3-cleanup-api-audit.md` | API audit completed |
| 16 | `docs/specs/academy-v3-phase1-progress.md` | Phase 1 shipped |
| 17 | `docs/specs/academy-v3-phase2-3-progress.md` | Phases 2-3 shipped |
| 18 | `e2e/specs/members/academy-v3-mocks.ts` | Only if no active tests import it |

**Archive command:**
```bash
mkdir -p docs/archive/academy-v3-planning
git mv docs/specs/academy-v3-baseline.md docs/archive/academy-v3-planning/
git mv docs/specs/academy-v3-cleanup-manifest.md docs/archive/academy-v3-planning/
git mv docs/specs/academy-v3-cleanup-api-audit.md docs/archive/academy-v3-planning/
git mv docs/specs/academy-v3-phase1-progress.md docs/archive/academy-v3-planning/
git mv docs/specs/academy-v3-phase2-3-progress.md docs/archive/academy-v3-planning/
```

---

### A5. Deprecated Routes & Endpoints (2 files)

| # | File | Lines | Current Behavior | Action |
|---|------|-------|-----------------|--------|
| 19 | `app/api/webhooks/whop/route.ts` | ~20 | Returns `{ deprecated: true }` | **Delete** route entirely |
| 20 | `backend/src/server.ts` (lines 159-163) | ~5 | Returns HTTP 410 for `GET /api/journal/trades` | **Remove** the 5-line handler |

**Pre-condition for WHOP:** Confirm WHOP dashboard no longer sends webhooks to this endpoint.

---

## Part B: Files to Rename (4 files)

These files have misleading "v2" suffixes. The v2 version IS the canonical version (v1 no longer exists).

| # | Current Path | New Path | References to Update |
|---|-------------|----------|---------------------|
| 21 | `components/academy/catalog/academy-module-card-v2.tsx` | `components/academy/catalog/academy-module-card.tsx` | `academy-track-section.tsx` (1 import) |
| 22 | `lib/spx/coach-alert-state-v2.ts` | `lib/spx/coach-alert-state.ts` | `ai-coach-feed.tsx` (1 import) |
| 23 | `lib/spx/__tests__/coach-alert-state-v2.test.ts` | `lib/spx/__tests__/coach-alert-state.test.ts` | Internal test import |
| 24 | `components/ai-coach/__tests__/widget-action-bar-v2.test.ts` | Already marked for deletion in A3 | N/A |

**Rename procedure (per file):**
```bash
# 1. Rename file
git mv <old-path> <new-path>

# 2. Update all imports
grep -rl "coach-alert-state-v2" --include="*.ts" --include="*.tsx" . | xargs sed -i 's/coach-alert-state-v2/coach-alert-state/g'
grep -rl "academy-module-card-v2" --include="*.ts" --include="*.tsx" . | xargs sed -i 's/academy-module-card-v2/academy-module-card/g'

# 3. Verify
pnpm exec tsc --noEmit
pnpm exec eslint <touched-files>
```

---

## Part C: Database Tables to Deprecate & Drop (16 tables)

### C1. Archived AI Coach Tables (5 tables) — DROP

These tables were renamed from their original names in migration `20260327060000` (March 27). Grace period: 25+ days. No active queries.

| # | Table | Original Name | Archived Since | Replacement |
|---|-------|--------------|----------------|-------------|
| 1 | `archived_ai_coach_alerts` | `ai_coach_alerts` | 2026-03-27 | `ai_coach_detected_setups` (v2) |
| 2 | `archived_ai_coach_watchlists` | `ai_coach_watchlists` | 2026-03-27 | `ai_coach_user_preferences` (v2) |
| 3 | `archived_ai_coach_tracked_setups` | `ai_coach_tracked_setups` | 2026-03-27 | `spx_setup_instances` |
| 4 | `archived_ai_coach_leaps_positions` | `ai_coach_leaps_positions` | 2026-03-27 | `ai_coach_positions` (consolidated) |
| 5 | `archived_ai_coach_opportunities` | `ai_coach_opportunities` | 2026-03-27 | No direct replacement (feature removed) |

**Verification before DROP:**
```sql
-- Confirm zero queries in last 30 days
SELECT schemaname, relname, seq_scan, idx_scan, last_seq_scan, last_idx_scan
FROM pg_stat_user_tables
WHERE relname LIKE 'archived_ai_coach_%';

-- Confirm zero rows or export data
SELECT 'archived_ai_coach_alerts' as tbl, count(*) FROM archived_ai_coach_alerts
UNION ALL SELECT 'archived_ai_coach_watchlists', count(*) FROM archived_ai_coach_watchlists
UNION ALL SELECT 'archived_ai_coach_tracked_setups', count(*) FROM archived_ai_coach_tracked_setups
UNION ALL SELECT 'archived_ai_coach_leaps_positions', count(*) FROM archived_ai_coach_leaps_positions
UNION ALL SELECT 'archived_ai_coach_opportunities', count(*) FROM archived_ai_coach_opportunities;
```

**Migration file:** `supabase/migrations/<timestamp>_drop_archived_ai_coach_tables.sql`
```sql
-- V4 Overhaul Phase 6: Drop archived AI Coach v1 tables
-- Pre-condition: Verified zero queries in 30 days, data exported if needed

DROP TABLE IF EXISTS archived_ai_coach_alerts;
DROP TABLE IF EXISTS archived_ai_coach_watchlists;
DROP TABLE IF EXISTS archived_ai_coach_tracked_setups;
DROP TABLE IF EXISTS archived_ai_coach_leaps_positions;
DROP TABLE IF EXISTS archived_ai_coach_opportunities;
```

**Rollback:** Restore from database backup taken before migration.

---

### C2. Academy Legacy Archive Schema (9 tables) — DROP SCHEMA

These tables were moved to the `academy_legacy_archive` schema in migration `20260322020000`. Data was backfilled to V3 tables in `20260322010000`. Grace period: 30+ days.

| # | Table (in `academy_legacy_archive` schema) | V3 Replacement |
|---|-------------------------------------------|----------------|
| 6 | `courses` | `academy_programs` + `academy_modules` |
| 7 | `lessons` | `academy_lessons` + `academy_lesson_blocks` |
| 8 | `learning_paths` | `academy_tracks` |
| 9 | `learning_path_courses` | `academy_tracks` (implicit via program→track→module) |
| 10 | `user_course_progress` | `academy_user_enrollments` + `academy_user_lesson_attempts` |
| 11 | `user_lesson_progress` | `academy_user_lesson_attempts` |
| 12 | `user_learning_activity_log` | `academy_learning_events` |
| 13 | `user_learning_profiles` | `academy_user_competency_mastery` |
| 14 | `user_learning_insights` | `academy_user_competency_mastery_history` |

**Verification before DROP:**
```sql
-- Confirm no references to academy_legacy_archive schema
SELECT * FROM pg_stat_user_tables WHERE schemaname = 'academy_legacy_archive';

-- Confirm V3 data completeness (user progress was migrated)
SELECT count(*) as v3_enrollments FROM academy_user_enrollments;
SELECT count(*) as v3_lesson_attempts FROM academy_user_lesson_attempts;
```

**Migration file:** `supabase/migrations/<timestamp>_drop_academy_legacy_archive.sql`
```sql
-- V4 Overhaul Phase 6: Drop legacy academy archive schema
-- Pre-condition: V3 data verified complete, zero queries to archive schema in 30 days

DROP SCHEMA IF EXISTS academy_legacy_archive CASCADE;
```

**Rollback:** Restore from database backup.

---

### C3. Already Dropped (Confirmed Gone) (2 tables)

These are documented for completeness — no action needed.

| # | Table | Dropped In | Replacement |
|---|-------|-----------|-------------|
| 15 | `affiliate_referrals` | `20260331000000` | WHOP integration |
| 16 | `admin_access_tokens` | `20260301000000` | Role-based RBAC |

---

## Execution Order

**Phase 6 must execute in this order:**

1. **Verify pre-conditions** (traffic analytics, query logs, data completeness)
2. **Take database backup**
3. **Slice 6.1:** Delete Word docs (zero risk)
4. **Slice 6.5:** Rename v2 files + update imports (low risk, lint/tsc verify)
5. **Slice 6.7:** Delete orphaned assets (zero risk)
6. **Slice 6.8:** Archive completed spec docs (zero risk)
7. **Slice 6.6:** Remove WHOP webhook route (low risk)
8. **Slice 6.9:** Remove deprecated backend endpoint (low risk)
9. **Slice 6.2:** Remove redirect stubs (medium risk — verify traffic first)
10. **Slice 6.3:** DROP archived AI Coach tables (high risk — backup required)
11. **Slice 6.4:** DROP academy legacy archive schema (high risk — backup required)
12. **Slice 6.10:** Full validation + release notes

---

## Rollback Strategy

| Action | Rollback |
|--------|----------|
| File deletion | `git checkout HEAD~1 -- <path>` |
| File rename | `git checkout HEAD~1 -- <old-path>` + fix imports |
| Schema archive move | `git mv` back to original location |
| DB table DROP | Restore from pre-migration backup |
| Redirect removal | Re-add redirect files (5-line stubs) |

---

## Sign-Off Checklist

- [ ] Analytics confirm zero traffic to legacy routes (30-day window)
- [ ] Supabase query logs confirm zero queries to archived tables (30-day window)
- [ ] Database backup taken and verified
- [ ] All V3 data completeness checks pass
- [ ] WHOP dashboard confirms no active webhook subscriptions
- [ ] `pnpm run build` passes after all deletions
- [ ] `pnpm exec tsc --noEmit` passes after all renames
- [ ] Full E2E suite passes
- [ ] Release notes updated
