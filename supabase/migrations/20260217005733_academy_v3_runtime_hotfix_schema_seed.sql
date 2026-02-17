-- Emergency production hotfix for missing academy v3 runtime schema
-- Added: 2026-02-17
-- Purpose: restore /api/academy-v3/* runtime by creating required academy_* tables,
-- RLS policies, and a minimal seed program/module/lessons.

BEGIN;

DO $$ BEGIN
  CREATE TYPE academy_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_block_type AS ENUM ('hook','concept_explanation','worked_example','guided_practice','independent_practice','reflection');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_assessment_type AS ENUM ('diagnostic', 'formative', 'performance', 'summative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_assessment_item_type AS ENUM ('single_select','multi_select','ordered_steps','short_answer_rubric','scenario_branch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_enrollment_status AS ENUM ('active', 'completed', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_attempt_status AS ENUM ('in_progress', 'submitted', 'passed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_review_status AS ENUM ('due', 'completed', 'snoozed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE academy_learning_event_type AS ENUM ('lesson_started','block_completed','assessment_submitted','assessment_passed','assessment_failed','remediation_assigned','review_completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS academy_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES academy_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, code)
);

CREATE TABLE IF NOT EXISTS academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES academy_tracks(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  learning_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_minutes integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_id, code)
);

CREATE TABLE IF NOT EXISTS academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  learning_objective text NOT NULL,
  estimated_minutes integer NOT NULL DEFAULT 0,
  difficulty academy_difficulty NOT NULL DEFAULT 'beginner',
  prerequisite_lesson_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  block_type academy_block_type NOT NULL,
  position integer NOT NULL,
  title text,
  content_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, position)
);

CREATE TABLE IF NOT EXISTS academy_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  domain text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_lesson_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES academy_competencies(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, competency_id)
);

CREATE TABLE IF NOT EXISTS academy_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES academy_modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES academy_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  assessment_type academy_assessment_type NOT NULL,
  mastery_threshold numeric NOT NULL DEFAULT 0.75,
  max_attempts integer,
  is_published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (module_id IS NOT NULL OR lesson_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS academy_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES academy_assessments(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES academy_competencies(id) ON DELETE SET NULL,
  item_type academy_assessment_item_type NOT NULL,
  prompt text NOT NULL,
  answer_key_json jsonb NOT NULL,
  rubric_json jsonb,
  position integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, position)
);

CREATE TABLE IF NOT EXISTS academy_user_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES academy_programs(id) ON DELETE CASCADE,
  status academy_enrollment_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);

CREATE TABLE IF NOT EXISTS academy_user_lesson_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  status academy_attempt_status NOT NULL DEFAULT 'in_progress',
  progress_percent numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS academy_user_assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES academy_assessments(id) ON DELETE CASCADE,
  status academy_attempt_status NOT NULL DEFAULT 'submitted',
  score numeric,
  competency_scores_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_user_competency_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES academy_competencies(id) ON DELETE CASCADE,
  current_score numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz,
  needs_remediation boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, competency_id)
);

CREATE TABLE IF NOT EXISTS academy_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES academy_competencies(id) ON DELETE CASCADE,
  source_lesson_id uuid REFERENCES academy_lessons(id) ON DELETE SET NULL,
  source_assessment_item_id uuid REFERENCES academy_assessment_items(id) ON DELETE SET NULL,
  prompt_json jsonb NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  interval_days integer NOT NULL DEFAULT 1,
  priority_weight numeric NOT NULL DEFAULT 1,
  status academy_review_status NOT NULL DEFAULT 'due',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES academy_review_queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_json jsonb NOT NULL,
  is_correct boolean NOT NULL,
  confidence_rating integer,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type academy_learning_event_type NOT NULL,
  lesson_id uuid REFERENCES academy_lessons(id) ON DELETE SET NULL,
  module_id uuid REFERENCES academy_modules(id) ON DELETE SET NULL,
  assessment_id uuid REFERENCES academy_assessments(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_tracks_program_position ON academy_tracks(program_id, position);
CREATE INDEX IF NOT EXISTS idx_academy_modules_track_position ON academy_modules(track_id, position);
CREATE INDEX IF NOT EXISTS idx_academy_lessons_module_position ON academy_lessons(module_id, position);
CREATE INDEX IF NOT EXISTS idx_academy_mastery_user ON academy_user_competency_mastery(user_id, needs_remediation);
CREATE INDEX IF NOT EXISTS idx_academy_review_queue_user_due ON academy_review_queue(user_id, due_at) WHERE status = 'due';

ALTER TABLE academy_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lesson_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lesson_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_lesson_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_competency_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_review_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academy_public_read_programs ON academy_programs;
CREATE POLICY academy_public_read_programs ON academy_programs FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS academy_public_read_tracks ON academy_tracks;
CREATE POLICY academy_public_read_tracks ON academy_tracks FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS academy_public_read_modules ON academy_modules;
CREATE POLICY academy_public_read_modules ON academy_modules FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS academy_public_read_lessons ON academy_lessons;
CREATE POLICY academy_public_read_lessons ON academy_lessons FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS academy_public_read_blocks ON academy_lesson_blocks;
CREATE POLICY academy_public_read_blocks ON academy_lesson_blocks FOR SELECT USING (
  EXISTS (SELECT 1 FROM academy_lessons l WHERE l.id = academy_lesson_blocks.lesson_id AND l.is_published = true)
);

DROP POLICY IF EXISTS academy_public_read_competencies ON academy_competencies;
CREATE POLICY academy_public_read_competencies ON academy_competencies FOR SELECT USING (true);

DROP POLICY IF EXISTS academy_public_read_lesson_competencies ON academy_lesson_competencies;
CREATE POLICY academy_public_read_lesson_competencies ON academy_lesson_competencies FOR SELECT USING (true);

DROP POLICY IF EXISTS academy_public_read_assessments ON academy_assessments;
CREATE POLICY academy_public_read_assessments ON academy_assessments FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS academy_public_read_assessment_items ON academy_assessment_items;
CREATE POLICY academy_public_read_assessment_items ON academy_assessment_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM academy_assessments a WHERE a.id = academy_assessment_items.assessment_id AND a.is_published = true)
);

DROP POLICY IF EXISTS academy_users_manage_enrollments ON academy_user_enrollments;
CREATE POLICY academy_users_manage_enrollments ON academy_user_enrollments FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_manage_lesson_attempts ON academy_user_lesson_attempts;
CREATE POLICY academy_users_manage_lesson_attempts ON academy_user_lesson_attempts FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_manage_assessment_attempts ON academy_user_assessment_attempts;
CREATE POLICY academy_users_manage_assessment_attempts ON academy_user_assessment_attempts FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_manage_mastery ON academy_user_competency_mastery;
CREATE POLICY academy_users_manage_mastery ON academy_user_competency_mastery FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_manage_review_queue ON academy_review_queue;
CREATE POLICY academy_users_manage_review_queue ON academy_review_queue FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_manage_review_attempts ON academy_review_attempts;
CREATE POLICY academy_users_manage_review_attempts ON academy_review_attempts FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_read_own_events ON academy_learning_events;
CREATE POLICY academy_users_read_own_events ON academy_learning_events FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS academy_users_insert_own_events ON academy_learning_events;
CREATE POLICY academy_users_insert_own_events ON academy_learning_events FOR INSERT WITH CHECK (user_id = auth.uid());

INSERT INTO academy_programs (code, title, description, is_active, metadata)
VALUES ('titm-core-program', 'TITM Trader Development Program', 'Competency-based program for options execution, risk, and review discipline', true, '{}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO academy_tracks (program_id, code, title, description, position, is_active, metadata)
VALUES (
  (SELECT id FROM academy_programs WHERE code = 'titm-core-program'),
  'foundations',
  'Foundations',
  '',
  1,
  true,
  '{}'::jsonb
)
ON CONFLICT (program_id, code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  position = EXCLUDED.position,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO academy_modules (track_id, slug, code, title, description, learning_outcomes, estimated_minutes, position, is_published, metadata)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id WHERE p.code = 'titm-core-program' AND t.code = 'foundations'),
  'market-context-core',
  'market-context-core',
  'Market Context Fundamentals',
  'Learn to identify session context before entering risk.',
  '["Classify trend, range, and transition sessions","Define invalidation zones before entry","Select setups aligned to session context"]'::jsonb,
  70,
  1,
  true,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES
(
  (SELECT id FROM academy_modules WHERE slug = 'market-context-core'),
  'session-framing-for-options',
  'Session Framing for Options',
  'Build a repeatable pre-trade context checklist before opening a position.',
  18,
  'beginner'::academy_difficulty,
  '{}'::uuid[],
  1,
  true,
  '{"competenciesTargeted":["market_context","entry_validation"]}'::jsonb
),
(
  (SELECT id FROM academy_modules WHERE slug = 'market-context-core'),
  'invalidations-and-levels',
  'Invalidations and Key Levels',
  'Mark invalidation and target levels that define whether a trade remains valid.',
  16,
  'beginner'::academy_difficulty,
  '{}'::uuid[],
  2,
  true,
  '{"competenciesTargeted":["market_context","trade_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  learning_objective = EXCLUDED.learning_objective,
  estimated_minutes = EXCLUDED.estimated_minutes,
  difficulty = EXCLUDED.difficulty,
  prerequisite_lesson_ids = EXCLUDED.prerequisite_lesson_ids,
  position = EXCLUDED.position,
  is_published = EXCLUDED.is_published,
  metadata = EXCLUDED.metadata,
  updated_at = now();

UPDATE tab_configurations
SET path = '/members/academy-v3/modules'
WHERE tab_id = 'library'
  AND path <> '/members/academy-v3/modules';

COMMIT;
