# Academy V3 Phase 0 Baseline

Captured: 2026-02-16 21:50:56 UTC  
Branch: `codex/academy-v3-phase0`

## 1. Scope Snapshot

### Member academy routes (9)
- `app/members/academy/page.tsx`
- `app/members/academy/layout.tsx`
- `app/members/academy/courses/page.tsx`
- `app/members/academy/courses/[slug]/page.tsx`
- `app/members/academy/learn/[id]/page.tsx`
- `app/members/academy/continue/page.tsx`
- `app/members/academy/review/page.tsx`
- `app/members/academy/saved/page.tsx`
- `app/members/academy/onboarding/page.tsx`

### Academy API routes (20)
- `app/api/academy/courses/route.ts`
- `app/api/academy/courses/[slug]/route.ts`
- `app/api/academy/lessons/[id]/route.ts`
- `app/api/academy/lessons/[id]/progress/route.ts`
- `app/api/academy/lessons/[id]/quiz/route.ts`
- `app/api/academy/dashboard/route.ts`
- `app/api/academy/resume/route.ts`
- `app/api/academy/review/route.ts`
- `app/api/academy/review/submit/route.ts`
- `app/api/academy/saved/route.ts`
- `app/api/academy/onboarding/route.ts`
- `app/api/academy/onboarding-status/route.ts`
- `app/api/academy/recommendations/route.ts`
- `app/api/academy/competency-scores/route.ts`
- `app/api/academy/insights/route.ts`
- `app/api/academy/paths/route.ts`
- `app/api/academy/tutor/session/route.ts`
- `app/api/academy/achievements/route.ts`
- `app/api/academy/achievements/[code]/route.ts`
- `app/api/academy/trade-cards/generate/route.ts`

### Academy UI components (29)
- `components/academy/academy-hub.tsx`
- `components/academy/academy-markdown.tsx`
- `components/academy/academy-sub-nav.tsx`
- `components/academy/achievement-card.tsx`
- `components/academy/ai-resume-card.tsx`
- `components/academy/ai-tutor-panel.tsx`
- `components/academy/annotated-chart-renderer.tsx`
- `components/academy/chunk-progress-dots.tsx`
- `components/academy/continue-learning-card.tsx`
- `components/academy/course-card.tsx`
- `components/academy/course-catalog.tsx`
- `components/academy/interactive/greek-visualizer.tsx`
- `components/academy/interactive/index.ts`
- `components/academy/interactive/options-chain-trainer.tsx`
- `components/academy/interactive/position-sizer.tsx`
- `components/academy/lesson-chunk-renderer.tsx`
- `components/academy/lesson-player.tsx`
- `components/academy/lesson-sidebar.tsx`
- `components/academy/mastery-arc.tsx`
- `components/academy/onboarding-wizard.tsx`
- `components/academy/progress-ring.tsx`
- `components/academy/quiz-engine.tsx`
- `components/academy/quiz-question.tsx`
- `components/academy/review-session-header.tsx`
- `components/academy/review-session.tsx`
- `components/academy/review-summary.tsx`
- `components/academy/scenario-walkthrough-renderer.tsx`
- `components/academy/streak-calendar.tsx`
- `components/academy/xp-display.tsx`

### Academy libs/types
- `lib/academy/achievement-events.ts`
- `lib/academy/api-utils.ts`
- `lib/academy/black-scholes.ts`
- `lib/academy/course-images.ts`
- `lib/academy/get-user-tier.ts`
- `lib/academy/resume.ts`
- `lib/academy/trade-card-generator.ts`
- `lib/academy/xp-utils.ts`
- `lib/types/academy.ts`

## 2. Dependency Map Baseline

Query scope: `app components lib hooks contexts e2e` for references to academy route/component/lib surfaces.

- Total references found: `237`
- High coupling files:
  - `app/members/academy/learn/[id]/page.tsx`
  - `app/members/academy/courses/[slug]/page.tsx`
  - `e2e/specs/members/academy-layout.spec.ts`
  - `e2e/specs/members/academy-saved.spec.ts`
- External surface dependencies:
  - `app/members/profile/page.tsx` consumes `/api/academy/dashboard`
  - `app/members/library/page.tsx` redirects to `/members/academy/courses`

## 3. Test and Quality Baseline

### Command: `pnpm lint`
Status: PASS (warnings only)

- Result: `0 errors`, `27 warnings`
- Notable warning categories:
  - React hook dependency warnings
  - Next.js `no-img-element` warnings
  - Unused eslint-disable directives

### Command: `pnpm test`
Status: PASS

- Test files: `22 passed`, `1 skipped`
- Tests: `90 passed`, `3 skipped`

### Command: `pnpm playwright test e2e/specs/members/academy-*.spec.ts`
Status: FAIL (baseline pre-existing failures)

- Result: `28 passed`, `6 failed`
- Failing spec file: `e2e/specs/members/academy-layout.spec.ts`
- Failing cases:
  - `keeps completion actions visible and navigates to the next lesson` (chromium + mobile-members)
  - `shows all five academy tabs and keeps active state across routes` (chromium + mobile-members)
  - `mobile bottom nav highlights Library when browsing academy` (chromium + mobile-members)
- Immediate failure signature:
  - Expected `Explore` link in main nav not found.
  - Expected `Library` link with `aria-current="page"` not found.

## 4. Known Risks Entering Phase 1

1. Academy layout/nav tests are currently red in baseline and may represent expected navigation drift from prior UI naming.
2. Node engine mismatch warning exists (`wanted >=22`, current `v20.19.5`), but baseline commands still run.
3. Academy scope is broadly coupled (`237` references), so cleanup/removal requires staged decommission with reference scans.

## 5. Legacy Cleanup Readiness Notes

1. Cleanup is now a required phase in v3 spec (`Phase 8: Legacy cleanup and decommission`).
2. Removal gates will use `rg` scan checks plus typecheck/tests to prevent orphan imports.
3. API and file-level decommission manifests are required deliverables before completion.
