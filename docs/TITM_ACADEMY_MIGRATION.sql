-- TITM Academy Training System - Complete Database Migration
-- This migration creates all necessary tables, types, functions, policies, and indexes
-- for the training platform with learning paths, progress tracking, XP system, and achievements.

-- ============================================================================
-- 1. CREATE CUSTOM ENUMS
-- ============================================================================

CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE lesson_type AS ENUM ('video', 'text', 'interactive', 'scenario', 'practice', 'guided');
CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE achievement_type AS ENUM ('track_complete', 'course_complete', 'milestone', 'streak', 'rank_up');
CREATE TYPE activity_log_type AS ENUM (
  'lesson_view', 'lesson_complete', 'quiz_attempt', 'quiz_pass', 'course_complete',
  'track_complete', 'tutor_question', 'achievement_earned', 'streak_day'
);

-- ============================================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================================

-- Add columns to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty_level difficulty_level DEFAULT 'beginner';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_path_id uuid;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS estimated_hours numeric;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS passing_score int DEFAULT 70;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisites uuid[] DEFAULT '{}';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tier_required text DEFAULT 'core' REFERENCES pricing_tiers(id);

-- Add columns to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS lesson_type lesson_type DEFAULT 'text';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS quiz_data jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS activity_data jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS ai_tutor_context text;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS ai_tutor_chips text[] DEFAULT '{}';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS estimated_minutes int;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS key_takeaways text[];

-- ============================================================================
-- 3. CREATE NEW TABLES
-- ============================================================================

CREATE TABLE learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  tier_required text NOT NULL DEFAULT 'core' REFERENCES pricing_tiers(id),
  difficulty_level difficulty_level DEFAULT 'beginner',
  estimated_hours numeric,
  display_order int DEFAULT 0,
  is_published bool DEFAULT false,
  icon_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE learning_path_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sequence_order int NOT NULL,
  is_required bool DEFAULT true,
  UNIQUE(learning_path_id, course_id),
  UNIQUE(learning_path_id, sequence_order)
);

CREATE TABLE user_learning_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_level text DEFAULT 'never',
  learning_goals text[] DEFAULT '{}',
  weekly_time_minutes int DEFAULT 30,
  broker_status text DEFAULT 'choosing',
  current_learning_path_id uuid REFERENCES learning_paths(id),
  onboarding_completed bool DEFAULT false,
  onboarding_data jsonb,
  preferred_lesson_type lesson_type DEFAULT 'video',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE user_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status progress_status DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  time_spent_seconds int DEFAULT 0,
  quiz_score int,
  quiz_attempts int DEFAULT 0,
  quiz_responses jsonb,
  activity_completed bool DEFAULT false,
  notes text,
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE user_course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status progress_status DEFAULT 'not_started',
  lessons_completed int DEFAULT 0,
  total_lessons int DEFAULT 0,
  overall_quiz_average numeric,
  started_at timestamptz,
  completed_at timestamptz,
  certificate_issued bool DEFAULT false,
  UNIQUE(user_id, course_id)
);

CREATE TABLE user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type achievement_type NOT NULL,
  achievement_key text NOT NULL,
  achievement_data jsonb DEFAULT '{}',
  xp_earned int DEFAULT 0,
  trade_card_image_url text,
  verification_code text UNIQUE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

CREATE TABLE user_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp int DEFAULT 0,
  current_rank text DEFAULT 'Rookie',
  current_streak int DEFAULT 0,
  longest_streak int DEFAULT 0,
  last_activity_date date,
  lessons_completed_count int DEFAULT 0,
  courses_completed_count int DEFAULT 0,
  quizzes_passed_count int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE user_learning_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type activity_log_type NOT NULL,
  entity_id uuid,
  entity_type text,
  xp_earned int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_user_lesson_progress_user_id ON user_lesson_progress(user_id);
CREATE INDEX idx_user_lesson_progress_lesson_id ON user_lesson_progress(lesson_id);
CREATE INDEX idx_user_lesson_progress_user_course ON user_lesson_progress(user_id, course_id);

CREATE INDEX idx_user_course_progress_user_id ON user_course_progress(user_id);
CREATE INDEX idx_user_course_progress_course_id ON user_course_progress(course_id);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_verification ON user_achievements(verification_code);

CREATE INDEX idx_user_xp_total_xp_desc ON user_xp(total_xp DESC);

CREATE INDEX idx_activity_log_user_created ON user_learning_activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_type ON user_learning_activity_log(activity_type);

CREATE INDEX idx_learning_paths_slug ON learning_paths(slug);
CREATE INDEX idx_learning_paths_tier ON learning_paths(tier_required);

CREATE INDEX idx_courses_learning_path_id ON courses(learning_path_id);
CREATE INDEX idx_courses_tier_required ON courses(tier_required);

-- ============================================================================
-- 5. CREATE UTILITY FUNCTIONS
-- ============================================================================

-- Handle updated_at timestamp trigger (checks if it exists first)
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Increment user XP and recalculate rank
CREATE OR REPLACE FUNCTION increment_user_xp(p_user_id uuid, p_xp int)
RETURNS void AS $$
DECLARE
  v_new_total_xp int;
  v_new_rank text;
BEGIN
  INSERT INTO user_xp (user_id, total_xp, current_rank)
  VALUES (p_user_id, p_xp, 'Rookie')
  ON CONFLICT (user_id) DO UPDATE
  SET total_xp = user_xp.total_xp + EXCLUDED.total_xp,
      updated_at = now();

  SELECT total_xp INTO v_new_total_xp FROM user_xp WHERE user_id = p_user_id;

  -- Calculate rank based on XP thresholds
  v_new_rank := CASE
    WHEN v_new_total_xp >= 4000 THEN 'Elite Operator'
    WHEN v_new_total_xp >= 1500 THEN 'Certified Sniper'
    WHEN v_new_total_xp >= 500 THEN 'Sniper Apprentice'
    WHEN v_new_total_xp >= 100 THEN 'Rising Bull'
    ELSE 'Rookie'
  END;

  UPDATE user_xp
  SET current_rank = v_new_rank
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Update user streak on learning activity
CREATE OR REPLACE FUNCTION update_streak(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_last_activity date;
  v_current_streak int;
  v_longest_streak int;
BEGIN
  INSERT INTO user_xp (user_id, current_streak, longest_streak, last_activity_date)
  VALUES (p_user_id, 1, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE
  SET last_activity_date = EXCLUDED.last_activity_date;

  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_activity, v_current_streak, v_longest_streak
  FROM user_xp WHERE user_id = p_user_id;

  IF v_last_activity = CURRENT_DATE THEN
    -- Already active today, no-op
    RETURN;
  ELSIF v_last_activity = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak continues
    UPDATE user_xp
    SET current_streak = v_current_streak + 1,
        longest_streak = GREATEST(v_longest_streak, v_current_streak + 1),
        last_activity_date = CURRENT_DATE,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Streak broken
    UPDATE user_xp
    SET current_streak = 1,
        longest_streak = GREATEST(v_longest_streak, 1),
        last_activity_date = CURRENT_DATE,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Get course progress stats for a user
CREATE OR REPLACE FUNCTION get_course_progress_stats(p_user_id uuid, p_course_id uuid)
RETURNS TABLE(lessons_completed int, total_lessons int, quiz_average numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(COUNT(CASE WHEN ulp.status = 'completed' THEN 1 END), 0)::int,
    COALESCE(COUNT(*), 0)::int,
    COALESCE(AVG(ulp.quiz_score)::numeric, 0)
  FROM lessons l
  LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = p_user_id
  WHERE l.course_id = p_course_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. CREATE TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS tr_learning_paths_updated_at ON learning_paths;
CREATE TRIGGER tr_learning_paths_updated_at
BEFORE UPDATE ON learning_paths
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tr_user_learning_profiles_updated_at ON user_learning_profiles;
CREATE TRIGGER tr_user_learning_profiles_updated_at
BEFORE UPDATE ON user_learning_profiles
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tr_user_xp_updated_at ON user_xp;
CREATE TRIGGER tr_user_xp_updated_at
BEFORE UPDATE ON user_xp
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- 7. ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_activity_log ENABLE ROW LEVEL SECURITY;

-- learning_paths policies
DROP POLICY IF EXISTS "SELECT published learning_paths" ON learning_paths;
CREATE POLICY "SELECT published learning_paths" ON learning_paths
FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Service role all learning_paths" ON learning_paths;
CREATE POLICY "Service role all learning_paths" ON learning_paths
FOR ALL USING (auth.role() = 'service_role');

-- learning_path_courses policies
DROP POLICY IF EXISTS "SELECT learning_path_courses for authenticated" ON learning_path_courses;
CREATE POLICY "SELECT learning_path_courses for authenticated" ON learning_path_courses
FOR SELECT USING (
  EXISTS (SELECT 1 FROM learning_paths WHERE id = learning_path_id AND is_published = true)
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Service role all learning_path_courses" ON learning_path_courses;
CREATE POLICY "Service role all learning_path_courses" ON learning_path_courses
FOR ALL USING (auth.role() = 'service_role');

-- user_learning_profiles policies
DROP POLICY IF EXISTS "SELECT own learning profile" ON user_learning_profiles;
CREATE POLICY "SELECT own learning profile" ON user_learning_profiles
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "INSERT own learning profile" ON user_learning_profiles;
CREATE POLICY "INSERT own learning profile" ON user_learning_profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "UPDATE own learning profile" ON user_learning_profiles;
CREATE POLICY "UPDATE own learning profile" ON user_learning_profiles
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all user_learning_profiles" ON user_learning_profiles;
CREATE POLICY "Service role all user_learning_profiles" ON user_learning_profiles
FOR ALL USING (auth.role() = 'service_role');

-- user_lesson_progress policies
DROP POLICY IF EXISTS "SELECT own lesson progress" ON user_lesson_progress;
CREATE POLICY "SELECT own lesson progress" ON user_lesson_progress
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "INSERT own lesson progress" ON user_lesson_progress;
CREATE POLICY "INSERT own lesson progress" ON user_lesson_progress
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "UPDATE own lesson progress" ON user_lesson_progress;
CREATE POLICY "UPDATE own lesson progress" ON user_lesson_progress
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all user_lesson_progress" ON user_lesson_progress;
CREATE POLICY "Service role all user_lesson_progress" ON user_lesson_progress
FOR ALL USING (auth.role() = 'service_role');

-- user_course_progress policies
DROP POLICY IF EXISTS "SELECT own course progress" ON user_course_progress;
CREATE POLICY "SELECT own course progress" ON user_course_progress
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "INSERT own course progress" ON user_course_progress;
CREATE POLICY "INSERT own course progress" ON user_course_progress
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "UPDATE own course progress" ON user_course_progress;
CREATE POLICY "UPDATE own course progress" ON user_course_progress
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all user_course_progress" ON user_course_progress;
CREATE POLICY "Service role all user_course_progress" ON user_course_progress
FOR ALL USING (auth.role() = 'service_role');

-- user_achievements policies (read-only for users, server-controlled)
DROP POLICY IF EXISTS "SELECT own achievements" ON user_achievements;
CREATE POLICY "SELECT own achievements" ON user_achievements
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all user_achievements" ON user_achievements;
CREATE POLICY "Service role all user_achievements" ON user_achievements
FOR ALL USING (auth.role() = 'service_role');

-- user_xp policies
DROP POLICY IF EXISTS "SELECT own xp" ON user_xp;
CREATE POLICY "SELECT own xp" ON user_xp
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all user_xp" ON user_xp;
CREATE POLICY "Service role all user_xp" ON user_xp
FOR ALL USING (auth.role() = 'service_role');

-- user_learning_activity_log policies
DROP POLICY IF EXISTS "SELECT own activity log" ON user_learning_activity_log;
CREATE POLICY "SELECT own activity log" ON user_learning_activity_log
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "INSERT own activity" ON user_learning_activity_log;
CREATE POLICY "INSERT own activity" ON user_learning_activity_log
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role all activity log" ON user_learning_activity_log;
CREATE POLICY "Service role all activity log" ON user_learning_activity_log
FOR ALL USING (auth.role() = 'service_role');

-- Add RLS policy to lessons for authenticated users to read course lessons
DROP POLICY IF EXISTS "Authenticated read course lessons" ON lessons;
CREATE POLICY "Authenticated read course lessons" ON lessons
FOR SELECT USING (
  auth.role() = 'authenticated'
  AND EXISTS (SELECT 1 FROM courses WHERE id = course_id AND is_published = true)
);

-- ============================================================================
-- 8. CREATE ACHIEVEMENT TIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievement_tiers (
  tier VARCHAR(20) PRIMARY KEY,
  primary_color VARCHAR(7) NOT NULL,
  secondary_color VARCHAR(7) NOT NULL,
  glow_color VARCHAR(7) NOT NULL,
  label VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SEED DATA: Achievement Tiers (TITM Brand Colors)
-- =============================================
INSERT INTO achievement_tiers (tier, primary_color, secondary_color, glow_color, label) VALUES
  ('core', '#10B981', '#047857', '#34d399', 'Core Sniper'),
  ('pro', '#F3E5AB', '#E8D992', '#F8F0CD', 'Pro Sniper'),
  ('executive', '#E8E4D9', '#A1A1AA', '#E4E4E7', 'Executive Sniper')
ON CONFLICT (tier) DO NOTHING;

-- ============================================================================
-- 9. END OF MIGRATION
-- ============================================================================
