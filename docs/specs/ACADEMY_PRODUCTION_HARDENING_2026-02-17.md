# Academy Production Hardening (2026-02-17)

## Scope Completed

This pass hardens Academy routing/navigation consistency, admin cutover to academy_v3,
legacy progress backfill, and runtime cleanup of remaining legacy progress references.

### 1. Canonical Academy entry route

- Library tab now resolves to `/members/academy-v3` (Plan page) instead of `/members/academy-v3/modules`.
- Legacy `/members/library` now redirects to `/members/academy-v3`.
- Added migration to align `tab_configurations.path` for `library` to `/members/academy-v3`.
- Updated middleware/proxy canonical redirect and fallback tab API path to the same target.

Changed files:
- `/Users/natekahl/ITM-gd/lib/member-navigation.ts`
- `/Users/natekahl/ITM-gd/components/members/mobile-bottom-nav.tsx`
- `/Users/natekahl/ITM-gd/components/members/mobile-top-bar.tsx`
- `/Users/natekahl/ITM-gd/app/members/library/page.tsx`
- `/Users/natekahl/ITM-gd/proxy.ts`
- `/Users/natekahl/ITM-gd/app/api/config/tabs/route.ts`
- `/Users/natekahl/ITM-gd/supabase/migrations/20260322000000_library_tab_academy_v3_plan_path.sql`

### 2. Shared sub-nav standardization

- Academy sub-nav now composes shared `FeatureSubNav` for consistency with other member features.

Changed file:
- `/Users/natekahl/ITM-gd/components/academy-v3/academy-v3-sub-nav.tsx`

### 3. Dead route cleanup

- Removed empty legacy route directories under `/Users/natekahl/ITM-gd/app/members/academy`.
- Removed empty legacy component directory `/Users/natekahl/ITM-gd/components/academy`.

### 4. Admin API cutover to Academy V3

- Rewrote admin course CRUD API to read/write `academy_modules` while preserving existing admin UI response shape (`Course` contract).
- Rewrote admin lesson CRUD API to read/write `academy_lessons` + `academy_lesson_blocks` while preserving existing admin UI response shape (`Lesson` contract).
- Updated AI lesson generation persistence endpoint to write generated lesson data into `academy_lessons` and `academy_lesson_blocks` (no legacy `lessons` writes).
- Updated admin academy analytics and seed-health endpoints to query `academy_*` user/content tables.
- Fixed lesson completion counting in admin academy analytics to use `academy_user_lesson_attempts.status = 'passed'`.

Changed files:
- `/Users/natekahl/ITM-gd/app/api/admin/courses/route.ts`
- `/Users/natekahl/ITM-gd/app/api/admin/lessons/route.ts`
- `/Users/natekahl/ITM-gd/app/api/admin/academy/generate-lesson/route.ts`
- `/Users/natekahl/ITM-gd/app/api/admin/academy/analytics/route.ts`
- `/Users/natekahl/ITM-gd/app/api/admin/academy/seed-health/route.ts`

### 5. Legacy user progress backfill to Academy V3

- Added idempotent migration that backfills:
  - `academy_user_enrollments` from legacy user footprint across course/lesson/activity data.
  - `academy_user_lesson_attempts` by slug-matching legacy `courses`/`lessons` to `academy_modules`/`academy_lessons`.
  - `academy_learning_events` from `user_learning_activity_log` with event-type mapping and dedupe by legacy activity id marker.
- Added verification SQL for post-migration sanity checks (footprint parity, mappable rows, dedupe checks, and backfilled counts).

Added files:
- `/Users/natekahl/ITM-gd/supabase/migrations/20260322010000_academy_v3_legacy_progress_backfill.sql`
- `/Users/natekahl/ITM-gd/docs/specs/ACADEMY_V3_LEGACY_BACKFILL_VERIFICATION.sql`

### 6. Runtime cleanup of legacy progress references

- Refactored academy resume resolver to query:
  - `academy_modules`
  - `academy_lessons`
  - `academy_user_lesson_attempts`
- Refactored XP event writer utility to insert into `academy_learning_events` instead of legacy XP/activity RPC + table paths.
- Updated global admin analytics active learner computation to source from `academy_user_lesson_attempts`.

Changed files:
- `/Users/natekahl/ITM-gd/lib/academy/resume.ts`
- `/Users/natekahl/ITM-gd/lib/academy/xp-utils.ts`
- `/Users/natekahl/ITM-gd/app/api/admin/analytics/route.ts`

### 7. Legacy table retirement migration

- Added retirement migration to archive then drop legacy academy tables after cutover/backfill:
  - Archives data into `academy_legacy_archive.*`
  - Removes legacy function/FK dependencies tied to retired tables
  - Drops legacy tables:
    - `courses`
    - `lessons`
    - `learning_paths`
    - `learning_path_courses`
    - `user_course_progress`
    - `user_lesson_progress`
    - `user_learning_activity_log`
    - `user_learning_profiles`
    - `user_learning_insights`
- Added post-retirement verification SQL for schema existence and archive row-count checks.

Added files:
- `/Users/natekahl/ITM-gd/supabase/migrations/20260322020000_academy_legacy_table_retirement.sql`
- `/Users/natekahl/ITM-gd/docs/specs/ACADEMY_LEGACY_RETIREMENT_VERIFICATION.sql`
- `/Users/natekahl/ITM-gd/docs/specs/ACADEMY_CONSOLIDATION_RELEASE_RUNBOOK_2026-02-17.md`

### 8. Academy v3 performance index hardening

- Added FK covering indexes for academy_v3 tables flagged by database advisors to improve query planning and FK maintenance under load.

Added file:
- `/Users/natekahl/ITM-gd/supabase/migrations/20260322030000_academy_v3_fk_covering_indexes.sql`

## Tests Updated

- Updated Academy frontend contract test to validate `FeatureSubNav` composition.
- Added unit tests for library/academy navigation mapping behavior.
- Updated e2e routing expectation for `/members/library` redirect target.
- Added regression test to ensure migrated admin academy APIs no longer reference legacy academy tables.
- Added consolidation integrity test for runtime paths (`resume`, `xp-utils`, admin analytics) to prevent regressions to legacy academy tables.
- Added repo-wide runtime guardrail test that fails if legacy academy tables/RPCs are referenced in runtime source.

Changed files:
- `/Users/natekahl/ITM-gd/lib/academy-v3/__tests__/frontend-contracts.test.ts`
- `/Users/natekahl/ITM-gd/lib/__tests__/member-navigation.test.ts`
- `/Users/natekahl/ITM-gd/e2e/specs/members/academy-layout.spec.ts`
- `/Users/natekahl/ITM-gd/e2e/specs/members/academy-v3-mocks.ts`
- `/Users/natekahl/ITM-gd/lib/academy-v3/__tests__/admin-api-targets.test.ts`
- `/Users/natekahl/ITM-gd/lib/academy-v3/__tests__/consolidation-integrity.test.ts`
- `/Users/natekahl/ITM-gd/lib/academy-v3/__tests__/no-legacy-runtime-references.test.ts`

## Validation Commands

Run:

```bash
pnpm exec tsc --noEmit
```

```bash
pnpm exec vitest run lib/__tests__/member-navigation.test.ts lib/academy-v3/__tests__/frontend-contracts.test.ts lib/academy-v3/__tests__/admin-api-targets.test.ts lib/academy-v3/__tests__/consolidation-integrity.test.ts lib/academy-v3/__tests__/no-legacy-runtime-references.test.ts
```

Optional e2e check:

```bash
pnpm exec playwright test e2e/specs/members/academy-layout.spec.ts --project=chromium
```

## Remaining Production Cleanup (Next Pass)

- Execute the new retirement migration in target environments after final backup window and run both verification SQL scripts.
- Decide canonical URL migration (`/members/academy-v3/*` -> `/members/academy/*`) if required for product URL strategy.
