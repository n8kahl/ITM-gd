<!--
File: docs/ACADEMY_V2_ARCHITECTURE.md
Created: 2026-02-10
Purpose: Academy V2 architecture reference for schema, APIs, UI composition, data flow, and content authoring.
-->

# TITM Academy V2 Architecture

## 1. Scope

This document describes the production Academy V2 architecture implemented in this repository:

- Stack: Next.js App Router + TypeScript + Tailwind CSS 4 + Supabase.
- Learning model: competency-based progression + chunk lessons + spaced repetition review.
- Academy V2 additions: review queue (FSRS), saved items, competency scoring, learning insights, AI resume.

## 2. System Overview

Academy V2 is composed of five primary layers:

1. Content layer (`courses`, `lessons`, `learning_paths`) with chunk-capable lessons.
2. Progress and gamification layer (`user_*` progress tables, XP, activity log, achievements).
3. Reinforcement layer (`review_queue_items`, `review_attempts`) with interval updates.
4. Personalization layer (`user_competency_scores`, `user_learning_insights`, resume/insights APIs).
5. Delivery layer (member pages + academy API routes + shared components).

## 3. Database Schema

### 3.1 Academy V2 enums

- `competency_key`: `market_context`, `entry_validation`, `position_sizing`, `trade_management`, `exit_discipline`, `review_reflection`
- `mastery_stage`: `awareness`, `applied`, `independent`
- `chunk_content_type`: `video`, `rich_text`, `interactive`, `annotated_chart`, `scenario_walkthrough`, `quick_check`, `applied_drill`, `reflection`
- `review_status`: `due`, `completed`, `skipped`
- Existing enum extensions:
- `lesson_type` includes `chunk`
- `activity_log_type` includes `review_complete` and `bookmark`

### 3.2 Core content tables

#### `learning_paths`

- `id`: UUID primary key
- `name`: path name shown in UI
- `slug`: stable path identifier
- `description`: path summary
- `tier_required`: minimum tier (`core`, `pro`, `executive`)
- `difficulty_level`: path difficulty enum
- `estimated_hours`: estimated completion time
- `display_order`: ordering in catalog
- `is_published`: visibility flag
- `icon_name`: icon hint
- `created_at`, `updated_at`: audit timestamps

#### `courses`

- `id`: UUID primary key
- `title`, `slug`, `description`: core display metadata
- `thumbnail_url`: hero image URL
- `discord_role_required`: optional role restriction metadata
- `is_published`: publication flag
- `display_order`: ordering for course lists
- `created_at`, `updated_at`: audit timestamps
- `difficulty_level`: course difficulty enum
- `learning_path_id`: FK to `learning_paths`
- `estimated_hours`: expected time
- `passing_score`: pass threshold for course-level completion
- `prerequisites`: UUID array of prerequisite courses
- `tier_required`: required member tier
- `competency_map`: JSONB competency target map
- `common_mistakes`: JSONB list of frequent errors
- `social_proof_count`: integer social signal

#### `learning_path_courses`

- `id`: UUID primary key
- `learning_path_id`: FK to `learning_paths`
- `course_id`: FK to `courses`
- `sequence_order`: course position inside path
- `is_required`: required/optional marker

#### `lessons`

- `id`: UUID primary key
- `course_id`: FK to `courses`
- `title`, `slug`: lesson identity
- `video_url`: optional media URL
- `content_markdown`: legacy markdown body
- `is_free_preview`: preview marker
- `duration_minutes`: legacy duration field
- `display_order`: lesson order in course
- `created_at`, `updated_at`: audit timestamps
- `lesson_type`: lesson mode (`text`, `video`, `interactive`, `scenario`, `practice`, `guided`, `chunk`)
- `quiz_data`: JSONB quiz payload
- `activity_data`: JSONB interactive payload
- `ai_tutor_context`: authored tutor guidance
- `ai_tutor_chips`: short context hints
- `estimated_minutes`: preferred duration field
- `key_takeaways`: takeaway bullets
- `is_published`: publication flag
- `chunk_data`: JSONB chunk array (Academy V2)
- `competency_keys`: `competency_key[]` tags for scoring/review seeding
- `micro_lesson_extract`: JSONB micro-summary for quick resume/surface cards
- `adaptive_variants`: JSONB variants for adaptive coaching content

### 3.3 User profile, progress, and XP tables

#### `user_learning_profiles`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `experience_level`: self-reported experience
- `learning_goals`: goals array
- `weekly_time_minutes`: available weekly time
- `broker_status`: setup status
- `current_learning_path_id`: recommended path FK
- `onboarding_completed`: onboarding completion flag
- `onboarding_data`: raw onboarding JSON
- `preferred_lesson_type`: content mode preference
- `created_at`, `updated_at`: audit timestamps

#### `user_lesson_progress`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `lesson_id`: FK to `lessons`
- `course_id`: FK to `courses`
- `status`: `progress_status` (`not_started`, `in_progress`, `completed`)
- `started_at`, `completed_at`: lifecycle timestamps
- `time_spent_seconds`: accumulated time
- `quiz_score`: best quiz score
- `quiz_attempts`: count of quiz attempts
- `quiz_responses`: JSONB answer history
- `activity_completed`: interactive completion flag
- `notes`: optional learner notes

#### `user_course_progress`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `course_id`: FK to `courses`
- `status`: `progress_status`
- `lessons_completed`: completed lesson count
- `total_lessons`: total lesson count snapshot
- `overall_quiz_average`: numeric average
- `started_at`, `completed_at`: lifecycle timestamps
- `certificate_issued`: certificate status

#### `user_xp`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `total_xp`: XP balance
- `current_rank`: rank label
- `current_streak`: active day streak
- `longest_streak`: best streak
- `last_activity_date`: date of last XP event
- `lessons_completed_count`: counter
- `courses_completed_count`: counter
- `quizzes_passed_count`: counter
- `updated_at`: audit timestamp

#### `user_learning_activity_log`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `activity_type`: `activity_log_type` enum
- `entity_id`: optional related entity UUID
- `entity_type`: related entity type text
- `xp_earned`: XP awarded by event
- `metadata`: JSONB event payload
- `created_at`: event timestamp

### 3.4 Academy V2 reinforcement and personalization tables

#### `review_queue_items`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `competency_key`: competency attached to prompt
- `source_lesson_id`: optional source lesson FK
- `source_course_id`: optional source course FK
- `question_data`: JSONB prompt/options/correct answer payload
- `due_at`: next review due time
- `interval_stage`: stage index used by interval progression
- `status`: review lifecycle state (`due`, `completed`, `skipped`)
- `difficulty_rating`: numeric difficulty estimate
- `stability_days`: numeric memory stability estimate
- `created_at`, `updated_at`: audit timestamps

#### `review_attempts`

- `id`: UUID primary key
- `queue_item_id`: FK to `review_queue_items`
- `user_id`: FK to `auth.users`
- `answer_data`: JSONB submitted answer payload
- `is_correct`: grading result
- `confidence_rating`: self-reported confidence (1-5)
- `latency_ms`: response latency
- `created_at`: attempt timestamp

#### `user_saved_items`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `entity_type`: `course` or `lesson`
- `entity_id`: saved entity UUID
- `notes`: optional user note
- `created_at`: save timestamp
- Unique key: `(user_id, entity_type, entity_id)`

#### `user_competency_scores`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `competency_key`: competency being tracked
- `mastery_stage`: `awareness`, `applied`, or `independent`
- `score`: numeric 0-100 score
- `assessments_count`: number of scored interactions
- `last_assessed_at`: last score update timestamp
- `created_at`, `updated_at`: audit timestamps
- Unique key: `(user_id, competency_key)`

#### `user_learning_insights`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `insight_type`: classifier for insight card behavior
- `insight_data`: JSONB content payload
- `source_entity_id`: optional source entity UUID
- `source_entity_type`: optional source type
- `is_dismissed`: dismissed flag
- `is_acted_on`: acted flag
- `created_at`: creation timestamp
- `expires_at`: optional expiration timestamp

### 3.5 Tutor session tables used by Academy lesson tutor

#### `ai_coach_sessions`

- `id`: UUID primary key
- `user_id`: FK to `auth.users`
- `title`: session title
- `message_count`: message counter
- `created_at`, `updated_at`: audit timestamps
- `ended_at`: optional end marker
- `metadata`: JSONB session context (includes lesson/chunk fields in Academy V2)
- `expires_at`: retention window
- `archived_at`: archive marker

#### `ai_coach_messages`

- `id`: UUID primary key
- `session_id`: FK to `ai_coach_sessions`
- `user_id`: FK to `auth.users`
- `role`: `system`, `user`, `assistant`, etc.
- `content`: message body
- `function_call`: optional JSONB tool call
- `function_response`: optional JSONB tool result
- `tokens_used`: optional token count
- `created_at`: message timestamp

### 3.6 Core Academy V2 database functions

- `calculate_next_review_interval(p_difficulty, p_stability, p_is_correct, p_confidence)`
- Returns `next_due_at`, `new_difficulty`, `new_stability`.
- Used by `/api/academy/review/submit`.

- `seed_review_items_for_lesson(p_user_id, p_lesson_id)`
- Reads lesson `quiz_data` + `competency_keys`.
- Seeds up to three review items per competency.
- Uses idempotent insertion (`ON CONFLICT DO NOTHING`).

### 3.7 RLS and indexes

- RLS enabled on all Academy V2 tables:
- `review_queue_items`
- `review_attempts`
- `user_saved_items`
- `user_competency_scores`
- `user_learning_insights`
- User-scoped read/write policies plus service-role policies are present.
- `review_queue_items` indexed by `(user_id, due_at)` for due queue retrieval.

## 4. API Surface

All Academy endpoints return a standard envelope:

- Success: `{ success: true, data: ... }`
- Error: `{ success: false, error: string }`

All endpoints require authenticated members except the public achievement verification route.

### 4.1 Endpoints

| Endpoint | Method | Request | Success response (data) |
|---|---|---|---|
| `/api/academy/onboarding-status` | GET | none | `completed`, `profile_id`, `tier`, `learning_path_id`, `learning_path_name` |
| `/api/academy/onboarding` | POST | onboarding profile fields (`experience_level`, `learning_goals`, `weekly_time_minutes`, `broker_status`, `preferred_lesson_type`) | `profile_id`, `learning_path_id`, `learning_path_name`, `tier`, `xp_earned` |
| `/api/academy/dashboard` | GET | none | `stats`, `currentLesson`, `resumeInsight`, `recommendedCourses`, `recentAchievements` |
| `/api/academy/courses` | GET | query: `path_id`, `difficulty`, `competency`, `max_minutes`, `sort` | `courses`, `paths`, `trending`, `micro_lessons` |
| `/api/academy/courses/[slug]` | GET | path param: `slug` | course detail, lesson list, progress totals, `resumeLessonId` |
| `/api/academy/paths` | GET | none | published paths with `user_progress` |
| `/api/academy/recommendations` | GET | none | prioritized lesson recommendations |
| `/api/academy/resume` | GET | optional query: `course_slug` | canonical resume fields + normalized `target` object |
| `/api/academy/lessons/[id]` | GET | path param: lesson UUID | lesson payload (`content`, `chunkData`, `quiz`, sidebar metadata) |
| `/api/academy/lessons/[id]/quiz` | POST | `answers[]` (`question_id`, `selected_answer`) | score, pass/fail, attempts, XP, per-question results |
| `/api/academy/lessons/[id]/progress` | POST | `action` (`view` or `complete`), optional time spent | lesson progress update + XP/time summary |
| `/api/academy/competency-scores` | GET | none | six-key `scores` object for radar chart |
| `/api/academy/review` | GET | query: `limit`, optional `competency` | due `items[]` + queue `stats` (`total_due`, minutes, weak competencies) |
| `/api/academy/review/submit` | POST | `queue_item_id`, `answer_data`, `is_correct`, `confidence`, `latency_ms` | next due interval fields + updated competency/XP results |
| `/api/academy/saved` | GET | none | `items`, `courses`, `lessons` saved by user |
| `/api/academy/saved` | POST | `entity_type` (`course`/`lesson`), `entity_id` (UUID or slug) | toggle result `{ saved: boolean }` |
| `/api/academy/insights` | GET | query: `limit`, optional `type` | active, non-dismissed insight items |
| `/api/academy/insights` | PATCH | `id`, and/or `is_dismissed`, `is_acted_on` | updated insight record |
| `/api/academy/tutor/session` | POST | `lesson_id`, optional `session_id`, `question`, `chunk_id`, `competency_key`, `last_quiz_error`, `user_journal_context` | tutor session metadata + optional first AI response |
| `/api/academy/achievements` | GET | query: `page`, `limit`, optional `category` | paginated achievements + summary |
| `/api/academy/achievements/[code]` | GET | path param verification code | public verification payload (`verified`, achievement and earner data) |
| `/api/academy/trade-cards/generate` | POST | `achievementId` | generated card URLs + verification code |

## 5. Component Tree

### 5.1 Route composition

```text
app/members/academy/layout.tsx
  -> AcademySubNav

app/members/academy/page.tsx
  -> AcademyHub
     -> AIResumeCard
     -> CourseCard (recommended grid)
     -> MasteryArc
     -> XpDisplay
     -> StreakCalendar
     -> AchievementCard

app/members/academy/courses/page.tsx
  -> CourseCatalog
     -> CourseCard (bookmark enabled)

app/members/academy/continue/page.tsx
  -> Continue panel + CourseCard grid

app/members/academy/learn/[id]/page.tsx
  -> LessonPlayer
     -> LessonChunkRenderer (if chunk_data present)
        -> ChunkProgressDots
     -> Markdown/video fallback (legacy lessons)
  -> LessonSidebar
  -> QuizEngine
  -> AiTutorPanel

app/members/academy/review/page.tsx
  -> ReviewSessionHeader
  -> ReviewSession
  -> ReviewSummary

app/members/academy/saved/page.tsx
  -> Saved courses section
  -> Saved lessons section
```

### 5.2 Navigation behavior

- Academy sub-nav supports `Home`, `Explore`, `Continue`, `Review`, `Saved`.
- Sidebar and mobile bottom nav resolve academy namespace routes as active under library.
- `/members/library` canonically redirects to `/members/academy/courses`.

## 6. Data Flow

### 6.1 Onboarding to personalized path

1. Member posts onboarding preferences to `/api/academy/onboarding`.
2. API upserts `user_learning_profiles` and marks `onboarding_completed=true`.
3. API resolves preferred path, sets `current_learning_path_id`, awards onboarding XP.
4. `/api/academy/onboarding-status` and `/api/academy/dashboard` drive first-visit routing and home data.

### 6.2 Lesson completion to review queue seeding

1. Lesson page posts to `/api/academy/lessons/[id]/progress` with `action=complete`.
2. API marks `user_lesson_progress` completed and awards lesson XP.
3. API updates streak (`update_streak`) and syncs `user_course_progress`.
4. API calls `seed_review_items_for_lesson(user_id, lesson_id)`:
   - Reads lesson `quiz_data`.
   - Iterates lesson `competency_keys`.
   - Inserts due review items for +24h.
5. If course reaches complete state, API awards course-completion XP.

### 6.3 Review loop and competency updates

1. Review page fetches due queue from `/api/academy/review`.
2. Member submits answer to `/api/academy/review/submit`.
3. API inserts `review_attempts` row.
4. API calls `calculate_next_review_interval` to compute next due time and stability changes.
5. API updates `review_queue_items` with new interval values.
6. API updates `user_competency_scores` (`score`, `mastery_stage`, `assessments_count`).
7. API awards review XP and logs `review_complete` in `user_learning_activity_log`.

### 6.4 Saved items and insight interactions

1. Member toggles bookmark via `/api/academy/saved` POST.
2. API inserts/deletes from `user_saved_items`; save actions create `bookmark` activity events.
3. Saved page loads full materialized course/lesson references via `/api/academy/saved` GET.
4. Insight cards load from `/api/academy/insights` and state transitions use PATCH.

### 6.5 Tutor context flow

1. Lesson/Tutor UI posts to `/api/academy/tutor/session` with lesson + optional chunk context.
2. API composes a lesson-scoped system prompt from:
   - lesson markdown/chunk/takeaways,
   - user profile/rank context,
   - optional chunk/quiz/journal hints.
3. API writes `ai_coach_sessions` + `ai_coach_messages` system message.
4. If an initial question is provided, API proxies to AI Coach backend and returns first response.

## 7. Content Authoring Guide

### 7.1 Course authoring checklist

When inserting/updating courses:

- Set `slug`, `title`, `description`, `difficulty_level`, `tier_required`, `is_published`.
- Provide `learning_path_id` mapping or maintain `learning_path_courses`.
- Populate `competency_map` with six-key mastery targets.
- Populate `common_mistakes` JSON array for coaching/error-first UI cards.

### 7.2 Lesson authoring checklist

Minimum fields for a published lesson:

- `course_id`, `slug`, `title`, `display_order`, `is_published=true`
- `lesson_type` set appropriately:
- `chunk` for chunk-first lesson flow
- `text`/`video`/other legacy types for backward compatibility
- `estimated_minutes` (preferred) and/or `duration_minutes`
- `competency_keys` (required for review seeding and mastery updates)
- `quiz_data` (required for spaced repetition seeding)
- `ai_tutor_context` and `key_takeaways` for tutor quality

### 7.3 `chunk_data` format (JSONB array)

```json
[
  {
    "id": "chunk-1",
    "title": "Identify the setup",
    "content_type": "rich_text",
    "content": "Short markdown-supported content...",
    "duration_minutes": 6,
    "order_index": 1
  },
  {
    "id": "chunk-2",
    "title": "Quick check",
    "content_type": "quick_check",
    "content": "{\"question\":\"What confirms entry?\",\"options\":[\"VWAP reclaim\",\"Random candle\"],\"correct_index\":0,\"explanation\":\"Need structure + trigger.\"}",
    "duration_minutes": 2,
    "order_index": 2,
    "quick_check": {
      "question": "What confirms entry?",
      "options": ["VWAP reclaim", "Random candle"],
      "correct_index": 0,
      "explanation": "Need structure + trigger."
    }
  }
]
```

Supported chunk content types:

- `video`
- `rich_text`
- `interactive`
- `annotated_chart`
- `scenario_walkthrough`
- `quick_check`
- `applied_drill`
- `reflection`

### 7.4 `quiz_data` accepted formats

Academy runtime supports both:

1. Flat array format (preferred for V2 seeded content):

```json
[
  {
    "question": "Where is invalidation?",
    "options": ["Above prior high", "At random"],
    "correct_index": 0,
    "explanation": "Invalidation must map to structure."
  }
]
```

2. Object format with `questions[]`:

```json
{
  "passing_score": 70,
  "questions": [
    {
      "id": "q1",
      "text": "Best entry signal?",
      "options": [{ "id": "a", "text": "Confirmed reclaim" }],
      "correct_answer": "a",
      "explanation": "Wait for confirmation."
    }
  ]
}
```

### 7.5 Idempotent seed/migration rules

For all Academy content migrations:

- Use `INSERT ... ON CONFLICT ... DO UPDATE` for mutable seed rows.
- Use `ON CONFLICT DO NOTHING` for additive linking/seeding operations.
- For lessons, upsert with conflict target `(course_id, slug)` (not global `slug`).

### 7.6 Current seeded content target

Academy V2 content seed targets:

- 9 published courses
- 53 published lessons
- all seeded lessons include valid `chunk_data` and `competency_keys`

