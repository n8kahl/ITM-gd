# Academy V3 Phase 2-3 Progress

Date: February 16, 2026  
Branch: `codex/academy-v3-phase0`

## Implemented in this execution window

### 1) Extended service/repository architecture
1. Added progression, assessment, review, mastery, recommendation service layer coverage.
2. Added dedicated repositories for attempts, assessments, mastery, review queue, and learning events.
3. Kept route handlers thin: auth -> parse -> service -> typed response/error.

### 2) Added/validated v3 endpoint surface
1. `POST /api/academy-v3/lessons/[id]/start`
2. `POST /api/academy-v3/lessons/[id]/complete-block`
3. `POST /api/academy-v3/assessments/[id]/submit`
4. `GET /api/academy-v3/review`
5. `POST /api/academy-v3/review/[queueId]/submit`
6. `GET /api/academy-v3/mastery`
7. `GET /api/academy-v3/recommendations`

### 3) Contract and logic improvements
1. Expanded API zod contracts for review submit, mastery, and recommendations.
2. Added deterministic progression helpers (`completedBlockIds`, progress %, next block).
3. Added assessment scoring engine for mixed item types and competency aggregation.

### 4) Data-policy adjustment
1. Updated v3 schema migration to allow authenticated users to insert their own learning events:
   - policy: `academy_users_insert_own_events` on `academy_learning_events`.

### 5) Test additions
1. Added unit tests:
   - `lib/academy-v3/services/__tests__/progression-logic.test.ts`
   - `lib/academy-v3/services/__tests__/assessment-scoring.test.ts`
2. Verified all unit tests pass including new tests.

### 6) Content quality gate tooling
1. Added curriculum validator script:
   - `scripts/academy-v3/validate-content.mjs`
2. Validation command run:
   - `node scripts/academy-v3/validate-content.mjs docs/specs/academy-content`
3. Result: pass for current seed blueprint set.
4. Added CI execution gate:
   - `.github/workflows/e2e-tests.yml` now runs `pnpm academy:v3:validate-content`.

### 7) Frontend IA cutover + v2 decommission completion
1. Added academy-v3 member IA scaffold:
   - `/members/academy-v3` (`Plan`)
   - `/members/academy-v3/modules`
   - `/members/academy-v3/review`
   - `/members/academy-v3/progress`
2. Hard-deleted legacy member academy runtime routes (`/members/academy/*`).
3. Hard-deleted legacy academy API handlers (`/api/academy/*`).
4. Updated canonical academy nav path to `/members/academy-v3/modules` in navigation fallbacks and redirect entry points.
5. Added cleanup artifacts:
   - `docs/specs/academy-v3-cleanup-api-audit.md`
   - `docs/specs/academy-v3-cleanup-manifest.md`

### 8) Remaining cleanup execution completed
1. Migrated academy Playwright coverage to v3 contracts/routes:
   - added `e2e/specs/members/academy-v3-mocks.ts`
   - rewrote `e2e/specs/members/academy-*.spec.ts` to `/api/academy-v3/*`
2. Removed deprecated academy v2 component tree:
   - deleted `components/academy/*`
   - replaced shared markdown usage with `components/academy-v3/shared/academy-markdown.tsx`
3. Removed stale academy e2e helper:
   - deleted `e2e/helpers/academy-helpers.ts`
4. Added nav path migration:
   - `supabase/migrations/20260321000000_library_tab_academy_v3_path.sql`
5. Hard-deleted academy-v2 API surface:
   - removed `app/api/academy/**`
6. Removed legacy `/api/academy` compatibility checks from `proxy.ts`.
7. Hard-deleted legacy member academy pages:
   - removed `app/members/academy/**`
8. Updated academy Playwright routes to use canonical `/members/academy-v3/*` entry points.

## Verification results

1. `pnpm lint`: pass (warnings only, no errors)
2. `pnpm test`: pass (`111` passed, `3` skipped)
3. `pnpm build`: pass
4. `pnpm playwright test e2e/specs/members/academy-*.spec.ts --reporter=list`: pass (`18` passed)

## Remaining high-priority execution items

1. Update archival docs/specs that still document v2 academy paths as canonical.
