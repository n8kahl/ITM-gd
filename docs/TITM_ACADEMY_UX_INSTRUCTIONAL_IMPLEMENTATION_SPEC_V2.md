# TITM Academy UX + Instructional Design Implementation Spec (V2)
## Build-Ready Screen and Component Requirements

**Version:** 2.0  
**Date:** February 10, 2026  
**Status:** Implemented in production codebase (Academy V2)  
**Owner:** Product + Design + Frontend Engineering

---

## Implementation Status (2026-02-10)

This specification has been implemented in the Academy V2 rebuild. Primary implementation references:

- Navigation and layout: `components/academy/academy-sub-nav.tsx`, `components/members/member-sidebar.tsx`, `components/members/mobile-bottom-nav.tsx`
- Lesson rendering and chunk flow: `components/academy/lesson-player.tsx`, `components/academy/lesson-chunk-renderer.tsx`, `components/academy/chunk-progress-dots.tsx`, `app/members/academy/learn/[id]/page.tsx`
- Competency and mastery visualization: `components/academy/mastery-arc.tsx`, `app/api/academy/competency-scores/route.ts`, `components/academy/academy-hub.tsx`
- Review queue system: `app/members/academy/review/page.tsx`, `components/academy/review-session.tsx`, `components/academy/review-session-header.tsx`, `components/academy/review-summary.tsx`, `app/api/academy/review/route.ts`, `app/api/academy/review/submit/route.ts`
- Saved items system: `app/members/academy/saved/page.tsx`, `app/api/academy/saved/route.ts`, `components/academy/course-card.tsx`
- Tutor context and intelligence: `app/api/academy/tutor/session/route.ts`, `app/api/academy/insights/route.ts`, `components/academy/ai-resume-card.tsx`

---

## 1. Objective

Deliver a production-grade Training Library that is:
- Seamlessly navigable on mobile and desktop.
- Optimized for screen real estate and completion flow.
- Instructionally effective (mastery, retrieval, transfer).
- On-brand with TITM visual system.
- Fully data-backed from Supabase without blank states caused by null/partial content.

This specification extends existing Academy docs and adds concrete UX + learning requirements that can be implemented directly.

---

## 2. Product Decisions (Locked)

- Content is **not tier-gated** at the library UX level. All members can browse all training content.
- Progress and recommendations are personalized, but catalog visibility is universal.
- Learning progression is **competency-based**, not only lesson-complete based.
- Every lesson must support micro-learning entry points (5-10 minute chunks).
- Every screen must have explicit empty, loading, and error states.

---

## 3. Learning Model (Instructional Design)

### 3.1 Competency Framework

Each course and lesson must map to one or more competencies:
- Market Context Reading
- Entry Validation
- Position Sizing and Risk
- Trade Management
- Exit Discipline
- Review and Reflection

Each competency has three mastery stages:
- `awareness`
- `applied`
- `independent`

### 3.2 Lesson Arc (Mandatory)

Every lesson is structured as:
1. `Preview` (what learner will be able to do)
2. `Concept` (core explanation)
3. `Worked Example` (annotated chart/trade)
4. `Quick Check` (1-3 scenario questions)
5. `Applied Drill` (do-now exercise)
6. `Reflection` (journal prompt)

### 3.3 Learning Science Methods Required in UI

- Retrieval practice: periodic checks in lesson and review queue.
- Spacing: automatic resurfacing at 24h, 72h, and 7d.
- Interleaving: mixed concept checks from prior competencies.
- Error-first coaching: show common mistake cards with correction patterns.

---

## 4. Information Architecture and Navigation

### 4.1 Top-Level Academy Navigation

Add a local Academy sub-nav (desktop tabs + mobile segmented control):
- `Home`
- `Library`
- `Continue`
- `Review Queue`
- `Saved`

### 4.2 Navigation Rules

- Any target lesson must be reachable in <= 2 taps from `Library`.
- Current lesson must be visible above fold on `Home` and `Continue`.
- Breadcrumbs required on course and lesson detail:
  - `Training Library / Course / Lesson`

### 4.3 Mobile Behavior

- Single primary scroll direction per screen.
- Secondary content (syllabus, AI helper, resources) is collapsible bottom sheet or drawer.
- No full-screen blocking overlays for default learning flow.

---

## 5. Responsive Layout System

### 5.1 Breakpoint Targets

- `320-374`: compact mobile
- `375-767`: standard mobile
- `768-1023`: tablet
- `1024-1279`: laptop
- `1280+`: desktop

### 5.2 Layout Rules

- Replace fixed max content widths with fluid containers and clamp spacing.
- Desktop uses two-column learning layout only when secondary panel adds value.
- Mobile defaults to one-column with sticky progress/header and collapsible utilities.
- Card grids support adaptive density mode:
  - mobile: 1-up
  - tablet: 2-up
  - desktop: 3-up or 4-up depending on card density

---

## 6. Screen Specifications

## 6.1 Screen: Library (`/members/academy/courses`)

### Purpose
Enable fast discovery, immediate continuation, and informed selection.

### Components to Update
- `components/academy/course-catalog.tsx`
- `components/academy/course-card.tsx`
- `app/members/academy/courses/page.tsx`

### Component Requirements

`LibraryHeader`
- Includes academy sub-nav context, search, and quick filter chips.
- Always shows total available courses and user completion ratio.

`LibrarySearch`
- Debounced search (250ms).
- Search title, skill tags, and lesson outcomes.

`FilterChips`
- Single-row horizontal chips on mobile.
- Expanded faceted panel on tablet/desktop.
- Supported facets: competency, duration, difficulty, format, status.

`CourseGrid`
- Adaptive card density (`comfortable` and `compact`).
- First row reserves slot for `Continue Learning` card if active lesson exists.

`CourseCardV2`
- Required fields: title, skill outcomes, duration, lesson count, difficulty, progress.
- Add `Micro-Learning Available` indicator.
- Add `Last Updated` and `Est. Time to First Win`.

`EmptyState`
- If no results, show reset filters action + suggested competencies.

### Acceptance Criteria

Functional:
- Library loads without blocking on optional fields.
- Null dates and null metadata do not crash rendering.
- Search + filters complete in under 150ms client update after response.

UX:
- Continue CTA appears above fold on mobile and desktop if in-progress lesson exists.
- User reaches any lesson from library in <= 2 interactions.

Accessibility:
- Search and chips keyboard navigable.
- Cards expose semantic heading and action labels.

Performance:
- Initial library render under 2.5s on 4G mid-tier mobile profile.

---

## 6.2 Screen: Course Detail (`/members/academy/courses/[slug]`)

### Purpose
Convert interest into structured learning and immediate start.

### Components to Update
- `app/members/academy/courses/[slug]/page.tsx`
- `components/academy/lesson-sidebar.tsx`

### Component Requirements

`CourseHero`
- Displays course value proposition, competencies taught, prerequisites, total time.
- Shows primary CTA: `Start` or `Resume`.

`SkillMap`
- Visual competency map showing stage targets (`awareness`, `applied`, `independent`).

`LessonPlan`
- Organized by module and micro-unit duration.
- Each lesson row includes: objective, duration, completion state, quick check count.

`MicroLearningRail`
- Dedicated section for 5-10 minute quick wins.
- Accessible directly from course page without full sequence commitment.

`CommonMistakesPanel`
- Highlights top 3 mistakes for this course with corrective strategy.

### Acceptance Criteria

Functional:
- Course page handles missing optional media and still renders full curriculum.
- Resume logic selects next incomplete micro-unit.

UX:
- Key metadata visible above fold: outcome, time, level, resume/start CTA.
- Micro-learning entry point visible before first full lesson list fold.

Accessibility:
- Syllabus sections are collapsible and keyboard operable.

Performance:
- No layout shift when lesson list async data resolves.

---

## 6.3 Screen: Lesson Player (`/members/academy/learn/[id]`)

### Purpose
Maximize comprehension, retention, and transfer to trading behavior.

### Components to Update
- `app/members/academy/learn/[id]/page.tsx`
- `components/academy/lesson-player.tsx`
- `components/academy/quiz-engine.tsx`
- `components/academy/ai-tutor-panel.tsx`

### Component Requirements

`LessonHeader`
- Shows breadcrumb, lesson objective, competency tag, and progress.
- Includes `Mark complete` only when required checks are passed.

`LessonChunkStream`
- Lesson content segmented into micro-units.
- Each unit ends with a quick check prompt and optional applied drill.

`QuickCheckInline`
- 1-3 scenario questions per chunk.
- Immediate explanation for correct and incorrect answers.

`AppliedDrill`
- Action prompt linked to journal/simulator context.
- Save response state and time spent.

`ReflectionPrompt`
- End-of-lesson structured prompt with optional journal handoff.

`SyllabusDrawer`
- Mobile bottom sheet, desktop side panel.
- Must not block reading flow by default.

`AICoachDockedPanel`
- Context-aware help seeded with lesson id, chunk id, and user errors.
- Opens in dock/slide panel, not modal takeover.

### Acceptance Criteria

Functional:
- No runtime errors on null timestamps, null metadata, or missing optional chunk media.
- Lesson completion logic requires quick check participation.
- AI coach opens with context payload tied to current lesson chunk.

UX:
- Primary reading/watch area remains stable while utilities open/close.
- Mobile one-hand navigation supports next/previous chunk and open syllabus.

Accessibility:
- Inline quiz options reachable via keyboard and screen reader labels.
- Focus management returns to content after panel interactions.

Performance:
- Chunk transitions under 100ms local UI response.
- No blocking re-renders of full page when opening AI panel.

---

## 6.4 Screen: Review Queue (`/members/academy/review`)

### Purpose
Drive retention through spaced repetition and weak-skill reinforcement.

### New Components
- `components/academy/review-queue-list.tsx`
- `components/academy/review-card.tsx`
- `components/academy/review-session-header.tsx`

### Data Requirements

Create/extend Supabase objects:
- `review_queue_items` table:
  - `id`, `user_id`, `competency_key`, `source_lesson_id`, `due_at`, `interval_stage`, `status`, `created_at`, `updated_at`
- `review_attempts` table:
  - `id`, `queue_item_id`, `user_id`, `result`, `latency_ms`, `created_at`

### Component Requirements

`ReviewSessionHeader`
- Displays due count, estimated completion time, weak competencies.

`ReviewCard`
- Presents 1 scenario question with confidence slider.
- Captures answer quality and self-rated confidence.

`IntervalEngineClient`
- Applies spacing logic for next due date:
  - low performance: +1 day
  - medium performance: +3 days
  - strong performance: +7 days

`SessionSummary`
- Shows recovered competencies and next scheduled review windows.

### Acceptance Criteria

Functional:
- Queue generation uses due-at ordering and weak-skill priority.
- Completing review session updates next due interval.

UX:
- User can complete a meaningful review session in <= 8 minutes.
- Review cards avoid repeated back-to-back same-competency clustering.

Accessibility:
- Confidence slider has accessible labels and keyboard support.

Performance:
- First queue render returns in <= 1.0s from API on typical broadband.

---

## 6.5 AI Coach Integration (Contextual)

### Purpose
Provide just-in-time coaching without breaking the lesson flow.

### Integration Points
- Lesson chunk help
- Quick check remediation
- Reflection-to-journal coaching
- Review queue weak-skill explanation

### API Contract Additions

`POST /api/academy/ai-context-help`
- Input:
  - `lesson_id`
  - `chunk_id`
  - `competency_key`
  - `error_type`
  - `user_response`
- Output:
  - concise explanation
  - one worked micro-example
  - one next action

### Acceptance Criteria

Functional:
- AI responses are contextual to current lesson or review item.
- Fallback UI appears when AI route errors and lesson remains usable.

UX:
- AI help opens in <= 300ms panel animation.
- Returning from AI panel restores exact lesson position.

Safety/Quality:
- Hallucination guardrails: show source context tags and confidence indicator.

---

## 7. Visual and Brand Requirements

- Maintain existing TITM palette and glass card treatment from global design system.
- Increase hierarchy clarity with stronger type scale for objective and action zones.
- Add image strategy:
  - course hero image ratio 16:9
  - lesson micro-image ratio 4:3
  - competency icons (line style) for quick scanning
- Every lesson chunk should include at least one visual artifact:
  - annotated chart, setup diagram, or risk table

---

## 8. Data Integrity and Seeding Requirements

### 8.1 Seed Completeness Checks (Must Pass)

For production readiness, verify:
- Courses seeded and published.
- Lessons seeded for every published course.
- Micro-unit metadata present or safely defaulted.
- Quiz/quick-check payload exists for every lesson.
- Competency mapping exists for every lesson.

### 8.2 Defensive Rendering Rules

- Null date fields must use safe formatting helpers.
- Optional arrays default to empty arrays.
- Optional numeric fields default to known sentinel values.
- API response shape validation required at route boundary.

---

## 9. Telemetry and Success Metrics

Track events:
- `academy_library_search_used`
- `academy_course_started`
- `academy_chunk_completed`
- `academy_quick_check_submitted`
- `academy_review_session_completed`
- `academy_ai_help_opened`

KPIs:
- Lesson completion rate per device class
- D+7 competency retention score
- Time-to-first-meaningful-learning action
- Review queue completion rate
- AI assist effectiveness (post-help answer improvement)

---

## 10. QA Matrix and Definition of Done

### 10.1 Device QA Matrix

Required QA coverage:
- iPhone SE width (375)
- iPhone Pro Max width (430)
- iPad portrait (768)
- iPad landscape (1024)
- Desktop 1280
- Desktop 1440+

### 10.2 Definition of Done

- All five target surfaces (`Library`, `Course`, `Lesson`, `Review`, `AI Help`) meet acceptance criteria.
- No blank screen or fatal runtime errors from null data.
- Accessibility pass for keyboard and screen reader basics.
- Performance budgets met on representative mobile profile.
- Supabase seed verification script reports complete curriculum and competency mappings.

---

## 11. Implementation Phasing

Phase 1: Layout and navigation foundation
- Sub-nav, responsive containers, breadcrumb, core card upgrades

Phase 2: Course and lesson instructional structure
- Skill map, chunked lesson stream, quick checks, reflection handoff

Phase 3: Review queue and spaced repetition
- Queue tables, review session UX, interval logic

Phase 4: AI contextual integration and hardening
- Context help route, docked AI panel, fallback/error handling

Phase 5: QA, performance, and seeding validation
- Device matrix pass, null-safety hardening, seed integrity checks
