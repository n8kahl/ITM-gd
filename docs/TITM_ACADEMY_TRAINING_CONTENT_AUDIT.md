# TITM Training Academy — Training Content Audit & Upgrade Plan

> Archive note (February 17, 2026): This document audits Academy V2-era implementation details.  
> Active runtime now uses Academy V3 endpoints/routes (`/api/academy-v3/*`, `/members/academy-v3/*`).

Date: 2026-02-11

This audit covers:
- **Curriculum/content in Supabase** (courses, lessons, chunks, quizzes, key takeaways)
- **Member lesson experience** (rendering, interactions, completion flow)
- **Reinforcement loop** (review queue + spaced repetition mechanics)

## 1) What exists today (Supabase)

**Curriculum footprint (current DB state):**
- **Learning paths:** Onboarding, Foundations, Core Strategies, Advanced
- **Courses:** 9 total
- **Lessons:** 53 total (all published)

**Lesson schema highlights (V2):**
- `lessons.chunk_data` (JSON array): chunk-based lesson flow
- `lessons.quiz_data` (JSON array): inline quiz questions
- `lessons.key_takeaways` (text array)
- `lessons.competency_keys` (enum array; 6 competency domains)
- Review system tables: `review_queue_items`, `review_attempts`, `user_competency_scores`

**Interaction coverage (current seed patterns):**
- 53/53 lessons include: `rich_text` + `applied_drill` + `reflection`
- 52/53 lessons include: `quick_check`
- 4 lessons include: `scenario_walkthrough`
- 4 lessons include: `annotated_chart`
- 3 lessons include: `interactive` tools

## 2) Content quality (why it can feel “generic”)

The content is consistently structured (which is good), but the consistency can read as “template-like” when:
- **Chunk titles and format are uniform** (“Concept Brief / Quick Check / Applied Drill / Reflection”) across nearly every lesson.
- **Most lessons have exactly the same interaction mix**, with “scenario” and “annotated chart” being rare.
- **Drills and reflections are not persisted** as first-class learning artifacts (they feel like “tasks” more than “personalized coaching”).
- **Reinforcement is present in schema**, but users may not feel it until completion events trigger review seeding.

## 3) UX/HTML presentation issues that reduce “premium” feel

Observed issues from the code paths used by members:
- **Chunk lessons were labeled as “Video + Reading”** due to the `contentType` fallback mapping.
- **Markdown rendering was inconsistent across lesson surfaces**, so spacing/tables/images can look “stock”.
- **Finish flow for chunk lessons didn’t clearly transition into the next “premium” moment** (quiz + takeaways + completion).
- **Key takeaways existed in the DB but weren’t shown in the lesson UI**, reducing the “polished close” feeling.

## 4) Reinforcement loop audit (spaced repetition)

What’s implemented:
- `seed_review_items_for_lesson(p_user_id, p_lesson_id)` inserts up to 3 review items per competency from `lesson.quiz_data`
- Review scheduling function `calculate_next_review_interval(...)` adjusts difficulty/stability and returns next due date
- Member UI surfaces exist: `/members/academy/review`, `/api/academy/review`, `/api/academy/review/submit`

What’s missing for “felt” reinforcement:
- **Seeding is currently triggered on lesson completion**, not on quiz pass (so users who read + quiz but don’t “complete” can miss the reinforcement loop).
- **No “review queue preview” is shown inside the lesson close-out**, so the loop doesn’t feel connected to the lesson you just finished.

## 5) Changes implemented now (premium UX improvements)

These changes are in the repo and can be tried immediately:

### Premium markdown renderer
- Added a dedicated renderer that standardizes typography, tables, images, links, and code styling:
  - `components/academy/academy-markdown.tsx`
- Wired into:
  - `components/academy/lesson-player.tsx`
  - `components/academy/lesson-chunk-renderer.tsx`

### Better chunk lesson finish flow
- `LessonChunkRenderer` now supports `onFinish` to scroll the user into the closing section (quiz + takeaways + completion).
- The last button is now “Continue” (not “Finish Lesson”) to reduce the “dead end” feeling.

### Quiz is now part of the lesson’s scroll experience
- Moved quiz rendering into the `LessonPlayer` footer so it’s always reachable within the lesson reading surface:
  - `app/members/academy/learn/[id]/page.tsx`

### Key takeaways now appear in the lesson close-out
- The lesson page now renders `keyTakeaways` (from Supabase) as a premium “closing card”.
- Lesson API now returns `keyTakeaways` and `competencyKeys`:
  - `app/api/academy/lessons/[id]/route.ts`

### Fix misleading lesson type labels
- Chunk lessons now present as “Guided Lesson” (instead of “Video + Reading”):
  - `app/api/academy/lessons/[id]/route.ts`
  - `components/academy/lesson-player.tsx`
  - `app/api/academy/courses/[slug]/route.ts`
  - `app/members/academy/courses/[slug]/page.tsx`

### Data quality migration (content_markdown newline escaping)
- Added a migration to fix lessons whose `content_markdown` contains literal `\\n` sequences:
  - `supabase/migrations/20260316000000_academy_content_markdown_newline_normalize.sql`

## 6) High-impact next improvements (recommended)

### A) Make lessons feel less template-like without losing structure
- Rotate chunk “skins” by competency (same pedagogy, different feel):
  - Market Context: scenario-first + chart annotation
  - Entry Validation: checklist + “spot the mistake” interactions
  - Position Sizing: calculator + constraint drills
  - Trade Management: branching walkthroughs
  - Exit Discipline: decision journaling + “stop logic simulator”
  - Review & Reflection: retrospectives + “pattern tagging”

### B) Persist drill/reflection outputs (make it feel coached)
- Save reflections/drill confirmations into a lightweight table (or `user_lesson_progress.metadata`) and surface them back:
  - “Your last reflection on this concept…”
  - “You tend to struggle with X—review is scheduled.”

### C) Tighten reinforcement loop integration
- Seed review items on **quiz pass** (and/or after first “view + quiz”).
- In the lesson close-out, show:
  - “Review scheduled: tomorrow at 9:00am”
  - “Weak competency: Entry Validation — +3 points if you ace the next review”

### D) Upgrade content markup with premium callouts (no MDX required)
- Support a callout syntax in markdown (e.g., `> [!RULE]`, `> [!MISTAKE]`) and render as luxury cards.
- Use it to highlight TITM’s “house rules” and common failure modes.

### E) Restore progression gating (optional)
- Lock lessons until the previous is completed or quiz is passed (configurable per path).
- Keeps the academy from feeling like a loose content library.
