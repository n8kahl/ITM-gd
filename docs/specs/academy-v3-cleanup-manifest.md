# Academy V3 Cleanup Manifest

Date: February 16, 2026  
Branch: `codex/academy-v3-phase0`

## Objective
Execute v2 academy decommission steps with no backward-compatibility requirement and full hard-delete of legacy academy-v2 runtime surfaces.

## Decommissioned Surfaces

### 1) Legacy member academy routes removed
Files changed:
1. `app/members/academy/page.tsx`
2. `app/members/academy/continue/page.tsx`
3. `app/members/academy/onboarding/page.tsx`
4. `app/members/academy/review/page.tsx`
5. `app/members/academy/saved/page.tsx`
6. `app/members/academy/courses/page.tsx`
7. `app/members/academy/courses/[slug]/page.tsx`
8. `app/members/academy/learn/[id]/page.tsx`
9. `app/members/academy/layout.tsx`

Behavior:
1. The `/members/academy/*` route surface has been deleted from runtime.
2. Canonical member training routes are now only under `/members/academy-v3/*`.

### 2) Legacy academy v2 API removed
Files changed:
1. Deleted `app/api/academy/**` (all academy-v2 API routes).

### 3) Canonical navigation cutover to v3
Files changed:
1. `app/members/library/page.tsx`
2. `proxy.ts`
3. `lib/member-navigation.ts`
4. `components/members/mobile-bottom-nav.tsx`
5. `components/members/mobile-top-bar.tsx`
6. `app/api/config/tabs/route.ts`

Behavior:
1. Library canonical target is now `/members/academy-v3/modules`.
2. Library tab active-state is anchored to `/members/library` and `/members/academy-v3/*` only.

### 4) Legacy data flow cleanup in active experiences
Files changed:
1. `app/members/profile/page.tsx`
2. `lib/academy/resume.ts`
3. `lib/academy-v3/services/recommendation-service.ts`

Behavior:
1. Profile academy card now pulls v3 mastery-based data instead of deprecated `/api/academy/dashboard`.
2. Resume/recommendation links now route into academy-v3.

### 5) Legacy academy component tree removed
Files changed:
1. Removed `components/academy/*` (all legacy academy-v2 UI components).
2. Added shared markdown renderer replacement:
   - `components/academy-v3/shared/academy-markdown.tsx`
3. Updated admin generator import:
   - `components/admin/academy/content-generator.tsx`

Behavior:
1. No active runtime imports reference `components/academy/*`.
2. Admin lesson generator continues to render markdown previews via academy-v3 shared renderer.

### 6) Academy e2e suite migrated to v3
Files changed:
1. Added `e2e/specs/members/academy-v3-mocks.ts`.
2. Replaced academy spec coverage in:
   - `e2e/specs/members/academy-layout.spec.ts`
   - `e2e/specs/members/academy-review-queue.spec.ts`
   - `e2e/specs/members/academy-saved.spec.ts`
   - `e2e/specs/members/academy-chunks.spec.ts`
   - `e2e/specs/members/academy-resume-ui.spec.ts`
3. Updated resolver contract expectation:
   - `e2e/specs/members/academy-resume-resolver.spec.ts`
4. Removed stale helper:
   - `e2e/helpers/academy-helpers.ts`

Behavior:
1. Academy Playwright tests now mock `/api/academy-v3/*` only.
2. Academy Playwright specs now use `/members/academy-v3/*` canonical entry points; no runtime dependency on `/members/academy/*`.

### 7) Nav seed path migration for v3
Files changed:
1. Added `supabase/migrations/20260321000000_library_tab_academy_v3_path.sql`

Behavior:
1. Canonical `tab_configurations` library path is updated to `/members/academy-v3/modules`.

## Next Cleanup Gate
1. Update archival root-level specs that still document `/members/academy/*` and `/api/academy/*`.
