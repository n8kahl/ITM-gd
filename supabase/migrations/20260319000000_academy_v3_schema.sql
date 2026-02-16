-- ============================================================================
-- File: 20260319000000_academy_v3_schema.sql
-- Created: 2026-02-16
-- Purpose: TITM Academy v3 competency-based schema foundation.
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE academy_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_block_type AS ENUM (
    'hook',
    'concept_explanation',
    'worked_example',
    'guided_practice',
    'independent_practice',
    'reflection'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_assessment_type AS ENUM ('diagnostic', 'formative', 'performance', 'summative');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_assessment_item_type AS ENUM (
    'single_select',
    'multi_select',
    'ordered_steps',
    'short_answer_rubric',
    'scenario_branch'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_enrollment_status AS ENUM ('active', 'completed', 'paused', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_attempt_status AS ENUM ('in_progress', 'submitted', 'passed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_review_status AS ENUM ('due', 'completed', 'snoozed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE academy_learning_event_type AS ENUM (
    'lesson_started',
    'block_completed',
    'assessment_submitted',
    'assessment_passed',
    'assessment_failed',
    'remediation_assigned',
    'review_completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. CORE CURRICULUM TABLES
-- ============================================================================

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

-- ============================================================================
-- 3. COMPETENCIES + ASSESSMENTS
-- ============================================================================

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

-- ============================================================================
-- 4. USER PROGRESSION
-- ============================================================================

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

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_academy_tracks_program_position
  ON academy_tracks(program_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_modules_track_position
  ON academy_modules(track_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_lessons_module_position
  ON academy_lessons(module_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_blocks_lesson_position
  ON academy_lesson_blocks(lesson_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_assessments_module
  ON academy_assessments(module_id);

CREATE INDEX IF NOT EXISTS idx_academy_assessments_lesson
  ON academy_assessments(lesson_id);

CREATE INDEX IF NOT EXISTS idx_academy_assessment_items_assessment
  ON academy_assessment_items(assessment_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_user_enrollments_user
  ON academy_user_enrollments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_academy_user_lesson_attempts_user
  ON academy_user_lesson_attempts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_academy_user_assessment_attempts_user
  ON academy_user_assessment_attempts(user_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_academy_mastery_user
  ON academy_user_competency_mastery(user_id, needs_remediation);

CREATE INDEX IF NOT EXISTS idx_academy_review_queue_user_due
  ON academy_review_queue(user_id, due_at)
  WHERE status = 'due';

CREATE INDEX IF NOT EXISTS idx_academy_learning_events_user_time
  ON academy_learning_events(user_id, occurred_at DESC);

-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'handle_updated_at'
      AND pg_function_is_visible(oid)
  ) THEN
    DROP TRIGGER IF EXISTS tr_academy_programs_updated_at ON academy_programs;
    CREATE TRIGGER tr_academy_programs_updated_at
      BEFORE UPDATE ON academy_programs
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_tracks_updated_at ON academy_tracks;
    CREATE TRIGGER tr_academy_tracks_updated_at
      BEFORE UPDATE ON academy_tracks
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_modules_updated_at ON academy_modules;
    CREATE TRIGGER tr_academy_modules_updated_at
      BEFORE UPDATE ON academy_modules
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_lessons_updated_at ON academy_lessons;
    CREATE TRIGGER tr_academy_lessons_updated_at
      BEFORE UPDATE ON academy_lessons
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_lesson_blocks_updated_at ON academy_lesson_blocks;
    CREATE TRIGGER tr_academy_lesson_blocks_updated_at
      BEFORE UPDATE ON academy_lesson_blocks
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_competencies_updated_at ON academy_competencies;
    CREATE TRIGGER tr_academy_competencies_updated_at
      BEFORE UPDATE ON academy_competencies
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_assessments_updated_at ON academy_assessments;
    CREATE TRIGGER tr_academy_assessments_updated_at
      BEFORE UPDATE ON academy_assessments
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_assessment_items_updated_at ON academy_assessment_items;
    CREATE TRIGGER tr_academy_assessment_items_updated_at
      BEFORE UPDATE ON academy_assessment_items
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_user_enrollments_updated_at ON academy_user_enrollments;
    CREATE TRIGGER tr_academy_user_enrollments_updated_at
      BEFORE UPDATE ON academy_user_enrollments
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_user_lesson_attempts_updated_at ON academy_user_lesson_attempts;
    CREATE TRIGGER tr_academy_user_lesson_attempts_updated_at
      BEFORE UPDATE ON academy_user_lesson_attempts
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_user_assessment_attempts_updated_at ON academy_user_assessment_attempts;
    CREATE TRIGGER tr_academy_user_assessment_attempts_updated_at
      BEFORE UPDATE ON academy_user_assessment_attempts
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_user_competency_mastery_updated_at ON academy_user_competency_mastery;
    CREATE TRIGGER tr_academy_user_competency_mastery_updated_at
      BEFORE UPDATE ON academy_user_competency_mastery
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_review_queue_updated_at ON academy_review_queue;
    CREATE TRIGGER tr_academy_review_queue_updated_at
      BEFORE UPDATE ON academy_review_queue
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 7. RLS
-- ============================================================================

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

DROP POLICY IF EXISTS "academy_public_read_programs" ON academy_programs;
CREATE POLICY "academy_public_read_programs"
  ON academy_programs FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "academy_public_read_tracks" ON academy_tracks;
CREATE POLICY "academy_public_read_tracks"
  ON academy_tracks FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "academy_public_read_modules" ON academy_modules;
CREATE POLICY "academy_public_read_modules"
  ON academy_modules FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "academy_public_read_lessons" ON academy_lessons;
CREATE POLICY "academy_public_read_lessons"
  ON academy_lessons FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "academy_public_read_blocks" ON academy_lesson_blocks;
CREATE POLICY "academy_public_read_blocks"
  ON academy_lesson_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM academy_lessons l
      WHERE l.id = academy_lesson_blocks.lesson_id
        AND l.is_published = true
    )
  );

DROP POLICY IF EXISTS "academy_public_read_competencies" ON academy_competencies;
CREATE POLICY "academy_public_read_competencies"
  ON academy_competencies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "academy_public_read_lesson_competencies" ON academy_lesson_competencies;
CREATE POLICY "academy_public_read_lesson_competencies"
  ON academy_lesson_competencies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "academy_public_read_assessments" ON academy_assessments;
CREATE POLICY "academy_public_read_assessments"
  ON academy_assessments FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "academy_public_read_assessment_items" ON academy_assessment_items;
CREATE POLICY "academy_public_read_assessment_items"
  ON academy_assessment_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM academy_assessments a
      WHERE a.id = academy_assessment_items.assessment_id
        AND a.is_published = true
    )
  );

DROP POLICY IF EXISTS "academy_users_manage_enrollments" ON academy_user_enrollments;
CREATE POLICY "academy_users_manage_enrollments"
  ON academy_user_enrollments FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_manage_lesson_attempts" ON academy_user_lesson_attempts;
CREATE POLICY "academy_users_manage_lesson_attempts"
  ON academy_user_lesson_attempts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_manage_assessment_attempts" ON academy_user_assessment_attempts;
CREATE POLICY "academy_users_manage_assessment_attempts"
  ON academy_user_assessment_attempts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_manage_mastery" ON academy_user_competency_mastery;
CREATE POLICY "academy_users_manage_mastery"
  ON academy_user_competency_mastery FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_manage_review_queue" ON academy_review_queue;
CREATE POLICY "academy_users_manage_review_queue"
  ON academy_review_queue FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_manage_review_attempts" ON academy_review_attempts;
CREATE POLICY "academy_users_manage_review_attempts"
  ON academy_review_attempts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_read_own_events" ON academy_learning_events;
CREATE POLICY "academy_users_read_own_events"
  ON academy_learning_events FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_users_insert_own_events" ON academy_learning_events;
CREATE POLICY "academy_users_insert_own_events"
  ON academy_learning_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_programs;
CREATE POLICY "academy_service_role_all"
  ON academy_programs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_tracks;
CREATE POLICY "academy_service_role_all"
  ON academy_tracks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_modules;
CREATE POLICY "academy_service_role_all"
  ON academy_modules FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_lessons;
CREATE POLICY "academy_service_role_all"
  ON academy_lessons FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_lesson_blocks;
CREATE POLICY "academy_service_role_all"
  ON academy_lesson_blocks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_competencies;
CREATE POLICY "academy_service_role_all"
  ON academy_competencies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_lesson_competencies;
CREATE POLICY "academy_service_role_all"
  ON academy_lesson_competencies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_assessments;
CREATE POLICY "academy_service_role_all"
  ON academy_assessments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_assessment_items;
CREATE POLICY "academy_service_role_all"
  ON academy_assessment_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_enrollments;
CREATE POLICY "academy_service_role_all"
  ON academy_user_enrollments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_lesson_attempts;
CREATE POLICY "academy_service_role_all"
  ON academy_user_lesson_attempts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_assessment_attempts;
CREATE POLICY "academy_service_role_all"
  ON academy_user_assessment_attempts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_competency_mastery;
CREATE POLICY "academy_service_role_all"
  ON academy_user_competency_mastery FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_review_queue;
CREATE POLICY "academy_service_role_all"
  ON academy_review_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_review_attempts;
CREATE POLICY "academy_service_role_all"
  ON academy_review_attempts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_learning_events;
CREATE POLICY "academy_service_role_all"
  ON academy_learning_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
