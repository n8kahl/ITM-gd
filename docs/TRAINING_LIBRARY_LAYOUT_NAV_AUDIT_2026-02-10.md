# Training Library Layout, Design, and Navigation Audit

Date: 2026-02-10
Scope: Member Training Library / Academy UX flows (`/members/library`, `/members/academy/*`)

## Audit Method

- Reviewed page routes, layout wrappers, navigation components, and academy feature components.
- Traced all user-facing links/buttons for Home, Library, Continue, Course, Lesson, Review Queue, and Saved surfaces.
- Reviewed relevant API contracts for dashboard/current lesson/course/lesson progress logic.
- Executed Playwright academy layout spec for regression context.

Command executed:
- `pnpm playwright test e2e/specs/members/academy-layout.spec.ts --reporter=list`
- Result: `8 passed`

## 1. Current Route Architecture (As Implemented)

### Canonical and Alias Routes

- Member sidebar and mobile bottom nav library tab route to `/members/library`.
- `/members/library` immediately redirects to `/members/academy/courses`.
- Academy has a separate local sub-nav under `/members/academy/*`:
  - `/members/academy` (Home)
  - `/members/academy/courses` (Library)
  - `/members/academy/continue`
  - `/members/academy/review`
  - `/members/academy/saved`

### Route Graph

- `Member Sidebar/BtmNav -> /members/library -> redirect -> /members/academy/courses`
- `Academy Home -> Continue card -> /members/academy/learn/:lessonId`
- `Library -> Course card -> /members/academy/courses/:slug`
- `Course -> Start/Continue -> /members/academy/learn/:lessonId`
- `Lesson -> Primary action -> /members/academy/learn/:nextId` or `/members/academy/courses/:slug`
- `Course complete -> /members/academy/review`

## 2. Complete Interaction and Button Inventory

## 2.1 Global Member Navigation Affecting Training Library

| Surface | Control | Type | Route / Action | Notes |
|---|---|---|---|---|
| Desktop sidebar | `Training Library` | Link | `/members/library` | Alias route, not academy-canonical |
| Mobile bottom nav | `Library` | Link | `/members/library` | Same alias route |
| Mobile bottom nav | Active state logic | UI state | `pathname === href || startsWith(href/)` | Does not treat `/members/academy/*` as Library-active |

## 2.2 Academy Local Sub-Nav

| Control | Route | Behavior |
|---|---|---|
| `Home` | `/members/academy` | Academy dashboard/home |
| `Library` | `/members/academy/courses` | Treated active for courses + course detail + lesson pages |
| `Continue` | `/members/academy/continue` | In-progress course listing |
| `Review Queue` | `/members/academy/review` | Placeholder page |
| `Saved` | `/members/academy/saved` | Placeholder page |

## 2.3 Academy Home (`/members/academy`)

| Control | Type | Route / Action |
|---|---|---|
| `Resume` (Continue card) | Link | `/members/academy/learn/:lessonId` |
| `View all` | Link | `/members/academy/courses` |
| Recommended course card | Link | `/members/academy/courses/:slug` |
| `Open course catalog` (empty state) | Link | `/members/academy/courses` |

## 2.4 Library (`/members/academy/courses`)

| Control | Type | Route / Action |
|---|---|---|
| Search input | Input | Client-side filter |
| Search clear (`X`) | Button | Clear search |
| `Filters` | Button | Toggle filter panel |
| Density toggle (grid/list icons) | Button | `comfortable` / `compact` |
| Filter pills | Button set | Set filters |
| `Clear filters` | Button | Reset filters |
| Course card (entire card) | Link | `/members/academy/courses/:slug` |
| `Refresh` (no-courses state) | Button | `window.location.reload()` |
| `Reset filters` (empty results) | Button | Reset filters |

## 2.5 Course Detail (`/members/academy/courses/:slug`)

| Control | Type | Route / Action |
|---|---|---|
| Breadcrumb `Training Library` | Link | `/members/academy/courses` |
| Primary CTA `Start Course` / `Continue` | Link | `/members/academy/learn/:nextLessonId` |
| Primary CTA `Course Complete` | Link | `/members/academy/review` |
| Micro-learning quick win item | Link | `/members/academy/learn/:lessonId` |
| Lesson list unlocked row | Link | `/members/academy/learn/:lessonId` |
| Lesson list locked row | Link prevented | No navigation |
| `Browse all courses` (not-found state) | Link | `/members/academy/courses` |

## 2.6 Lesson Player (`/members/academy/learn/:id`)

| Area | Control | Type | Route / Action |
|---|---|---|---|
| Breadcrumb | `Training Library` | Link | `/members/academy/courses` |
| Breadcrumb | Course title | Link | `/members/academy/courses/:slug` |
| Header | Mobile sidebar toggle | Button | Show/hide lesson sidebar |
| Left sidebar | `Back to course` | Link | `/members/academy/courses/:slug` |
| Left sidebar | Lesson row (unlocked) | Link | `/members/academy/learn/:lessonId` |
| Left sidebar | `Mark as Complete` | Button | POST `/api/academy/lessons/:id/progress` with `action=complete` |
| Content footer | `Previous` | Button | Push `/members/academy/learn/:previousId` |
| Content footer | Primary (`Complete & Next Lesson`, etc.) | Button | Complete (if needed), then next lesson or course page |
| Quiz | Option choices | Buttons | Submit local answer state |
| Quiz | `Next Question` / `See Results` | Button | Advance/complete quiz |
| Quiz result | `Try Again` | Button | Reset quiz state |
| AI Tutor | Floating green button | Button | Open tutor panel |
| AI Tutor panel | Close (`X`) | Button | Close panel |
| AI Tutor panel | Suggested prompt buttons | Button | Prefill input |
| AI Tutor panel | Send button | Button | POST `/api/academy/tutor/session` |

## 2.7 Continue, Review, Saved

| Page | Control | Type | Route / Action |
|---|---|---|---|
| Continue | In-progress course card | Link | `/members/academy/courses/:slug` |
| Continue (empty) | `Browse Library` | Link | `/members/academy/courses` |
| Review | `Continue in Library` | Link | `/members/academy/courses` |
| Saved | `Explore Library` | Link | `/members/academy/courses` |

## 3. Current-State Findings

## P0

1. Hidden/cropped bottom action in lesson view (matches reported hidden green button behavior).
- Root cause: lesson sidebar wrapper applies `top-14` even on desktop while container is clipped by `overflow-hidden`; this shifts sidebar content down and can hide footer CTA.
- Impact: `Mark as Complete` can be partially hidden at the bottom of the lesson layout.

## P1

1. Dual route namespace creates navigation inconsistency.
- Library entry in member nav uses `/members/library`, while academy experience lives in `/members/academy/*`.
- Global nav active-state logic does not recognize academy routes as library context.

2. “Continue” means different things across surfaces.
- Home continue card goes directly to a lesson.
- Continue tab shows in-progress courses (extra click to resume lesson).
- Course page continue jumps to first unlocked incomplete lesson.
- Lesson primary action handles complete+next semantics.

3. Parallel completion controls in lesson view can feel redundant.
- Sidebar `Mark as Complete` and in-content primary completion action both mutate progress.

## P2

1. Review Queue and Saved are placeholder-only states.
- Navigable tabs exist but primary workflows are not implemented; this increases perceived dead ends.

2. Test coverage misses sidebar footer visibility.
- Existing tests validate in-content lesson action visibility and academy tab state, but not sidebar bottom CTA visibility against layout clipping cases.

3. Saved page lacks any save action on upstream surfaces.
- There is no save/bookmark action in lesson/course UI feeding the Saved tab yet.

## 4. Continue Logic (Documented)

- Home continue source: dashboard API selects latest `in_progress` lesson by `started_at`.
- Continue tab source: courses API list filtered on client to `completedLessons > 0 && < totalLessons`.
- Course continue source: first lesson with `!isCompleted && !isLocked`.
- Lesson primary source: immediate next lesson after completion when available.

Result: no single canonical “resume pointer”; multiple heuristics produce different user journeys.

## 5. Proposed Upgrade Plan (Streamlined Navigation + UX)

## Phase 0 (Hotfix, immediate)

1. Fix lesson sidebar positioning in desktop lesson layout.
- Change sidebar wrapper to mobile-only offsets (`top-14 left-0 bottom-0`) and reset at `lg` (`lg:top-0 lg:left-auto lg:bottom-auto`).
- Validate `Mark as Complete` is fully visible at common desktop heights.

2. Add regression test for sidebar footer visibility.
- New Playwright assertion for `Mark as Complete` bounding box visibility at desktop viewport.

## Phase 1 (Route normalization)

1. Make `/members/academy/courses` the primary library route in nav config.
- Keep `/members/library` as legacy redirect only.

2. Update global nav active-state rules.
- Treat `/members/academy`, `/members/academy/courses/*`, `/members/academy/learn/*`, `/members/academy/continue`, `/members/academy/review`, `/members/academy/saved` as library-active context where appropriate.

3. Align mobile bottom nav active logic with academy namespace.

## Phase 2 (Single Continue model)

1. Introduce one canonical resume API (`/api/academy/resume`) returning:
- `next_lesson_id`
- `course_slug`
- `source_reason` (last_in_progress, next_unlocked, etc.)

2. Make all “Continue” CTAs resolve through this shared resume pointer.
- Home `Resume`
- Continue tab primary CTA
- Course-level continue

3. Reframe Continue tab to “Resume Queue” at lesson level (not course cards only).

## Phase 3 (Lesson action simplification)

1. Consolidate completion actions into one primary sticky action rail in main content.
- Keep sidebar focus on syllabus/navigation only.

2. Move sidebar `Mark as Complete` to a secondary text action or remove.

3. Keep primary flow explicit:
- `Mark complete` -> `Next lesson` -> `Course complete`.

## Phase 4 (Complete currently placeholder tabs)

1. Implement Saved workflow.
- Add Save/Unsave actions on lesson and course surfaces.
- Populate `/members/academy/saved` from persisted saved items.

2. Implement Review Queue MVP.
- Due-item list, start review session, completion summary.

## Phase 5 (Instrumentation + UX hardening)

1. Add event tracking for every key CTA.
2. Add keyboard/focus-path pass for nav + quiz + tutor panel.
3. Add route-state consistency tests across desktop/mobile for global nav + academy sub-nav.

## 6. Recommended Acceptance Criteria for Upgrade

- Any user can resume with one tap from Home and one tap from Continue.
- Only one visible primary completion path per lesson.
- No clipped or partially visible CTA at any viewport in QA matrix.
- Global member nav and academy sub-nav both correctly represent active location.
- Review/Saved tabs contain functional, non-placeholder workflows.

## 7. File-Level Evidence (Primary References)

- Redirect alias:
  - `app/members/library/page.tsx`
- Global nav route + active logic:
  - `components/members/member-sidebar.tsx`
  - `components/members/mobile-bottom-nav.tsx`
  - `app/api/config/tabs/route.ts`
- Academy sub-nav and local route model:
  - `components/academy/academy-sub-nav.tsx`
  - `app/members/academy/layout.tsx`
- Continue variants and route behavior:
  - `components/academy/continue-learning-card.tsx`
  - `app/members/academy/continue/page.tsx`
  - `app/members/academy/courses/[slug]/page.tsx`
  - `app/members/academy/learn/[id]/page.tsx`
  - `app/api/academy/dashboard/route.ts`
- Hidden bottom button root cause area:
  - `app/members/academy/learn/[id]/page.tsx`
  - `components/academy/lesson-sidebar.tsx`
- Current test coverage:
  - `e2e/specs/members/academy-layout.spec.ts`
