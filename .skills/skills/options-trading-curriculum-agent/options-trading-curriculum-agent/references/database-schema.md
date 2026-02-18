# Academy V3 Database Schema Reference

## Table of Contents
1. [Curriculum Tables](#curriculum-tables)
2. [Competency System](#competency-system)
3. [Assessment System](#assessment-system)
4. [User Progress Tables](#user-progress-tables)
5. [Spaced Repetition](#spaced-repetition)
6. [Enum Types](#enum-types)
7. [SQL Insert Patterns](#sql-insert-patterns)

---

## Curriculum Tables

### academy_programs
The top-level container. Currently one program: "TITM Core Program" (code: `titm-core-program`).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| code | text (UNIQUE) | e.g. `titm-core-program` |
| title | text | |
| description | text | |
| is_active | boolean | |
| metadata | jsonb | |
| created_at / updated_at | timestamptz | |

### academy_tracks
Learning pathways within a program. Ordered by `position`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| program_id | uuid (FK → programs) | |
| code | text | UNIQUE within program |
| title | text | |
| description | text | |
| position | integer | Display/progression order |
| metadata | jsonb | |
| is_active | boolean | |

### academy_modules
Thematic units within a track. Ordered by `position` within track.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| track_id | uuid (FK → tracks) | |
| slug | text (UNIQUE) | URL-safe identifier |
| code | text | UNIQUE within track |
| title | text | |
| description | text | |
| learning_outcomes | jsonb | Array of strings |
| estimated_minutes | integer | Total module duration |
| position | integer | Order within track |
| is_published | boolean | |
| metadata | jsonb | |

### academy_lessons
Individual learning sessions within a module. Ordered by `position`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| module_id | uuid (FK → modules) | |
| slug | text (UNIQUE) | Format: `{module-code}-{lesson-slug}` |
| title | text | |
| learning_objective | text | Single sentence |
| estimated_minutes | integer | |
| difficulty | academy_difficulty | beginner/intermediate/advanced |
| prerequisite_lesson_ids | uuid[] | Array of lesson IDs |
| position | integer | Order within module |
| is_published | boolean | |
| metadata | jsonb | |

### academy_lesson_blocks
Content blocks within a lesson. Ordered by `position`. Each lesson should have 4-5 blocks.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| lesson_id | uuid (FK → lessons) | |
| block_type | academy_block_type | See enum |
| position | integer | UNIQUE within lesson |
| title | text | |
| content_json | jsonb | Structure varies by block_type |

**Standard block sequence per lesson:**
1. `hook` (position 1) — "Concept Brief" — Rich text intro, 5-6 min
2. `concept_explanation` (position 2) — "Quick Check" — Verification prompt, 2 min
3. `worked_example` (position 3) — Scenario walkthrough or applied drill, 5 min
4. `guided_practice` (position 4) — "Reflection" — Reflective question, 2 min
5. `independent_practice` (position 5) — Optional deeper drill, 5 min

**content_json structure:**
```json
{
  "title": "Block title",
  "source": "academy_v3",
  "content": "Markdown content string or JSON for scenarios",
  "imageUrl": "/academy/illustrations/{category}.svg",
  "quick_check": null,
  "content_type": "rich_text|quick_check|scenario_walkthrough|applied_drill|reflection",
  "duration_minutes": "5"
}
```

**For worked_example scenario blocks, content should be a PARSED JSON object (not stringified):**
```json
{
  "title": "Scenario Title",
  "description": "Scenario setup",
  "steps": [
    {
      "prompt": "The situation...",
      "context": "Step 1: What to evaluate",
      "choices": [
        {"label": "Choice text", "feedback": "Why this is right/wrong", "next_step_index": 1, "is_correct": true},
        {"label": "Wrong choice", "feedback": "Explanation", "next_step_index": 1, "is_correct": false},
        {"label": "Suboptimal", "feedback": "Why", "next_step_index": 1, "is_correct": false, "is_suboptimal": true}
      ]
    }
  ]
}
```

---

## Competency System

### academy_competencies
Skills that are measured and tracked. Currently 6 competencies.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| key | text (UNIQUE) | e.g. `entry_validation` |
| title | text | e.g. "Entry Validation" |
| description | text | |
| domain | text | Category (e.g. "execution", "analysis") |
| metadata | jsonb | |

### academy_lesson_competencies
Junction table linking lessons to competencies with weight.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| lesson_id | uuid (FK → lessons) | |
| competency_id | uuid (FK → competencies) | |
| weight | numeric | 0.0-1.0, how much this lesson contributes |

---

## Assessment System

### academy_assessments
Assessments can be linked to a module (formative/summative) or standalone (diagnostic).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| module_id | uuid (FK → modules) | NULL for diagnostic |
| lesson_id | uuid (FK → lessons) | NULL for module-level |
| title | text | |
| assessment_type | academy_assessment_type | diagnostic/formative/performance/summative |
| mastery_threshold | numeric | Default 0.75 (75%) |
| max_attempts | integer | |
| is_published | boolean | |
| metadata | jsonb | |

### academy_assessment_items
Individual questions within an assessment.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| assessment_id | uuid (FK → assessments) | |
| competency_id | uuid (FK → competencies) | Which skill this tests |
| item_type | academy_assessment_item_type | See enum |
| prompt | text | The question text |
| answer_key_json | jsonb | Correct answer(s) |
| rubric_json | jsonb | Scoring criteria |
| position | integer | UNIQUE within assessment |
| metadata | jsonb | |

**item_type formats:**

**single_select:**
```json
// answer_key_json
{ "correct_index": 0, "options": ["Option A", "Option B", "Option C", "Option D"] }
// rubric_json
{ "points": 1 }
```

**multi_select:**
```json
// answer_key_json
{ "correct_indices": [0, 2], "options": ["A", "B", "C", "D"] }
// rubric_json
{ "points": 1, "partial_credit": true }
```

**ordered_steps:**
```json
// answer_key_json
{ "correct_order": ["Check context", "Validate setup", "Size position", "Set stop", "Enter"] }
// rubric_json
{ "points": 2, "partial_credit": true }
```

**short_answer_rubric:**
```json
// answer_key_json
{ "key_concepts": ["risk per trade", "account percentage", "stop distance"] }
// rubric_json
{ "points": 3, "criteria": ["Mentions position sizing formula", "References risk percentage", "Includes stop loss in calculation"] }
```

**scenario_branch:**
```json
// answer_key_json
{ "optimal_path": [0, 1, 0, 2], "scenario": { /* same structure as worked_example scenarios */ } }
// rubric_json
{ "points": 5, "per_step_points": true }
```

---

## User Progress Tables

### academy_user_enrollments
| user_id | program_id | status (active/completed/paused/archived) | started_at | completed_at |

### academy_user_lesson_attempts
| user_id | lesson_id | status (in_progress/submitted/passed/failed) | progress_percent | started_at | completed_at |

### academy_user_assessment_attempts
| user_id | assessment_id | status | score | competency_scores_json | answers_json | feedback_json |

### academy_user_competency_mastery
| user_id | competency_id | current_score (0-1) | confidence (0-1) | needs_remediation (bool) |

---

## Spaced Repetition

### academy_review_queue
| user_id | competency_id | source_lesson_id | source_assessment_item_id | prompt_json | due_at | interval_days | priority_weight | status (due/completed/snoozed/skipped) |

### academy_review_attempts
| queue_id | user_id | answer_json | is_correct | confidence_rating (1-5) | latency_ms |

---

## Enum Types

```sql
academy_difficulty:          beginner, intermediate, advanced
academy_block_type:          hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection
academy_assessment_type:     diagnostic, formative, performance, summative
academy_assessment_item_type: single_select, multi_select, ordered_steps, short_answer_rubric, scenario_branch
academy_attempt_status:      in_progress, submitted, passed, failed
academy_enrollment_status:   active, completed, paused, archived
academy_review_status:       due, completed, snoozed, skipped
academy_learning_event_type: lesson_started, block_completed, assessment_submitted, assessment_passed, assessment_failed, remediation_assigned, review_completed
```

---

## SQL Insert Patterns

### Insert a new track
```sql
INSERT INTO academy_tracks (id, program_id, code, title, description, position, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_programs WHERE code = 'titm-core-program'),
  'strategy-execution',
  'Strategy & Execution',
  'Active trading skills...',
  2,
  true
);
```

### Insert a module
```sql
INSERT INTO academy_modules (id, track_id, slug, code, title, description, learning_outcomes, estimated_minutes, position, is_published)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_tracks WHERE code = 'strategy-execution'),
  'spx-weekly-strategies',
  'spx-weekly-strategies',
  'SPX Weekly Strategies',
  'Description...',
  '["Outcome 1", "Outcome 2", "Outcome 3"]'::jsonb,
  1,
  180,
  true
);
```

### Insert a lesson
```sql
INSERT INTO academy_lessons (id, module_id, slug, title, learning_objective, estimated_minutes, difficulty, position, is_published)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_modules WHERE slug = 'spx-weekly-strategies'),
  'spx-weekly-strategies-reading-spx-flow',
  'Reading SPX Flow',
  'Interpret SPX options flow to identify institutional positioning',
  14,
  'intermediate',
  1,
  true
);
```

### Insert a content block
```sql
INSERT INTO academy_lesson_blocks (id, lesson_id, block_type, position, title, content_json)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_lessons WHERE slug = 'spx-weekly-strategies-reading-spx-flow'),
  'hook',
  1,
  'Concept Brief',
  '{
    "title": "Concept Brief",
    "source": "academy_v3",
    "content": "**Markdown content here...**",
    "imageUrl": "/academy/illustrations/market-context.svg",
    "content_type": "rich_text",
    "duration_minutes": "5"
  }'::jsonb
);
```

### Insert an assessment with items
```sql
-- Assessment
INSERT INTO academy_assessments (id, module_id, title, assessment_type, mastery_threshold, max_attempts, is_published)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_modules WHERE slug = 'spx-weekly-strategies'),
  'SPX Weekly Strategies Assessment',
  'formative',
  0.75,
  3,
  true
);

-- Assessment item
INSERT INTO academy_assessment_items (id, assessment_id, competency_id, item_type, prompt, answer_key_json, rubric_json, position)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_assessments WHERE title = 'SPX Weekly Strategies Assessment'),
  (SELECT id FROM academy_competencies WHERE key = 'entry_validation'),
  'single_select',
  'SPX is at 5200 and VIX is at 28. Which approach is most appropriate for a 0DTE call entry?',
  '{"correct_index": 2, "options": ["Buy ATM calls aggressively", "Sell naked puts for premium", "Use a vertical spread to limit vega risk", "Wait for VIX to drop below 20"]}'::jsonb,
  '{"points": 1}'::jsonb,
  1
);
```

### Link a lesson to a competency
```sql
INSERT INTO academy_lesson_competencies (id, lesson_id, competency_id, weight)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM academy_lessons WHERE slug = '...'),
  (SELECT id FROM academy_competencies WHERE key = 'entry_validation'),
  0.8
);
```
