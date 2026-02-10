-- ============================================================================
-- File: 20260313000000_academy_v2_schema.sql
-- Created: 2026-02-10
-- Purpose: TITM Academy V2 schema extension for chunk lessons, review queue,
--          saved items, competency tracking, and intelligence insights.
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE competency_key AS ENUM (
    'market_context',
    'entry_validation',
    'position_sizing',
    'trade_management',
    'exit_discipline',
    'review_reflection'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE mastery_stage AS ENUM ('awareness', 'applied', 'independent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE chunk_content_type AS ENUM (
    'video',
    'rich_text',
    'interactive',
    'annotated_chart',
    'scenario_walkthrough',
    'quick_check',
    'applied_drill',
    'reflection'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE review_status AS ENUM ('due', 'completed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lesson_type ADD VALUE IF NOT EXISTS 'chunk';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE activity_log_type ADD VALUE IF NOT EXISTS 'review_complete';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE activity_log_type ADD VALUE IF NOT EXISTS 'bookmark';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================================

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS chunk_data jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS competency_keys competency_key[] DEFAULT '{}'::competency_key[];
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS micro_lesson_extract jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS adaptive_variants jsonb DEFAULT '{}'::jsonb;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS competency_map jsonb DEFAULT '{}'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS common_mistakes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS social_proof_count integer DEFAULT 0;

-- ============================================================================
-- 3. REVIEW QUEUE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_key competency_key NOT NULL,
  source_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  source_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  question_data jsonb NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  interval_stage integer DEFAULT 0,
  status review_status NOT NULL DEFAULT 'due',
  difficulty_rating numeric DEFAULT 5.0,
  stability_days numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES review_queue_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_data jsonb NOT NULL,
  is_correct boolean NOT NULL,
  confidence_rating integer,
  latency_ms integer,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. SAVED ITEMS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('course', 'lesson')),
  entity_id uuid NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

-- ============================================================================
-- 5. COMPETENCY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_competency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_key competency_key NOT NULL,
  mastery_stage mastery_stage NOT NULL DEFAULT 'awareness',
  score numeric NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  assessments_count integer NOT NULL DEFAULT 0,
  last_assessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, competency_key)
);

-- ============================================================================
-- 6. INTELLIGENCE LAYER
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  insight_data jsonb NOT NULL,
  source_entity_id uuid,
  source_entity_type text,
  is_dismissed boolean NOT NULL DEFAULT false,
  is_acted_on boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- ============================================================================
-- 7. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_review_queue_user_due
  ON review_queue_items (user_id, due_at)
  WHERE status = 'due';

CREATE INDEX IF NOT EXISTS idx_review_queue_competency
  ON review_queue_items (competency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_queue_user_competency_question
  ON review_queue_items (user_id, competency_key, source_lesson_id, (md5(question_data::text)));

CREATE INDEX IF NOT EXISTS idx_review_attempts_item
  ON review_attempts (queue_item_id);

CREATE INDEX IF NOT EXISTS idx_saved_items_user
  ON user_saved_items (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_items_entity
  ON user_saved_items (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_competency_scores_user
  ON user_competency_scores (user_id);

CREATE INDEX IF NOT EXISTS idx_learning_insights_user
  ON user_learning_insights (user_id, is_dismissed)
  WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_learning_insights_expires
  ON user_learning_insights (expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 8. RLS
-- ============================================================================

ALTER TABLE review_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own review items" ON review_queue_items;
CREATE POLICY "Users read own review items"
  ON review_queue_items FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all review items" ON review_queue_items;
CREATE POLICY "Service role all review items"
  ON review_queue_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own review attempts" ON review_attempts;
CREATE POLICY "Users read own review attempts"
  ON review_attempts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own review attempts" ON review_attempts;
CREATE POLICY "Users insert own review attempts"
  ON review_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all review attempts" ON review_attempts;
CREATE POLICY "Service role all review attempts"
  ON review_attempts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own saved items" ON user_saved_items;
CREATE POLICY "Users manage own saved items"
  ON user_saved_items FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all saved items" ON user_saved_items;
CREATE POLICY "Service role all saved items"
  ON user_saved_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own competency scores" ON user_competency_scores;
CREATE POLICY "Users read own competency scores"
  ON user_competency_scores FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all competency scores" ON user_competency_scores;
CREATE POLICY "Service role all competency scores"
  ON user_competency_scores FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own insights" ON user_learning_insights;
CREATE POLICY "Users read own insights"
  ON user_learning_insights FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own insights" ON user_learning_insights;
CREATE POLICY "Users update own insights"
  ON user_learning_insights FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all insights" ON user_learning_insights;
CREATE POLICY "Service role all insights"
  ON user_learning_insights FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 9. FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_next_review_interval(
  p_difficulty numeric,
  p_stability numeric,
  p_is_correct boolean,
  p_confidence integer
) RETURNS TABLE(
  next_due_at timestamptz,
  new_difficulty numeric,
  new_stability numeric
) AS $$
DECLARE
  v_difficulty numeric := COALESCE(p_difficulty, 5.0);
  v_stability numeric := COALESCE(p_stability, 1.0);
  v_confidence integer := LEAST(5, GREATEST(1, COALESCE(p_confidence, 3)));
  v_interval_days numeric;
BEGIN
  IF p_is_correct THEN
    v_difficulty := GREATEST(1, v_difficulty - 0.5 * (v_confidence - 3));
    v_stability := v_stability * (1 + 0.5 * (11 - v_difficulty) / 10);
    v_interval_days := GREATEST(1, v_stability);
  ELSE
    v_difficulty := LEAST(10, v_difficulty + 1);
    v_stability := GREATEST(0.5, v_stability * 0.5);
    v_interval_days := 1;
  END IF;

  next_due_at := now() + make_interval(days => v_interval_days::integer);
  new_difficulty := v_difficulty;
  new_stability := v_stability;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION seed_review_items_for_lesson(
  p_user_id uuid,
  p_lesson_id uuid
) RETURNS void AS $$
DECLARE
  v_course_id uuid;
  v_quiz_data jsonb;
  v_competencies competency_key[];
  v_competency competency_key;
  v_question jsonb;
  v_inserted integer;
BEGIN
  SELECT course_id, quiz_data, competency_keys
  INTO v_course_id, v_quiz_data, v_competencies
  FROM lessons
  WHERE id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_quiz_data IS NULL OR v_competencies IS NULL OR COALESCE(array_length(v_competencies, 1), 0) = 0 THEN
    RETURN;
  END IF;

  FOREACH v_competency IN ARRAY v_competencies LOOP
    v_inserted := 0;

    IF jsonb_typeof(v_quiz_data) = 'array' THEN
      FOR v_question IN
        SELECT value FROM jsonb_array_elements(v_quiz_data)
      LOOP
        EXIT WHEN v_inserted >= 3;

        INSERT INTO review_queue_items (
          user_id,
          competency_key,
          source_lesson_id,
          source_course_id,
          question_data,
          due_at
        )
        VALUES (
          p_user_id,
          v_competency,
          p_lesson_id,
          v_course_id,
          v_question,
          now() + interval '24 hours'
        )
        ON CONFLICT DO NOTHING;

        v_inserted := v_inserted + 1;
      END LOOP;
    ELSIF jsonb_typeof(v_quiz_data) = 'object' AND jsonb_typeof(v_quiz_data -> 'questions') = 'array' THEN
      FOR v_question IN
        SELECT value FROM jsonb_array_elements(v_quiz_data -> 'questions')
      LOOP
        EXIT WHEN v_inserted >= 3;

        INSERT INTO review_queue_items (
          user_id,
          competency_key,
          source_lesson_id,
          source_course_id,
          question_data,
          due_at
        )
        VALUES (
          p_user_id,
          v_competency,
          p_lesson_id,
          v_course_id,
          v_question,
          now() + interval '24 hours'
        )
        ON CONFLICT DO NOTHING;

        v_inserted := v_inserted + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS tr_review_queue_updated_at ON review_queue_items;
CREATE TRIGGER tr_review_queue_updated_at
BEFORE UPDATE ON review_queue_items
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tr_competency_scores_updated_at ON user_competency_scores;
CREATE TRIGGER tr_competency_scores_updated_at
BEFORE UPDATE ON user_competency_scores
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
