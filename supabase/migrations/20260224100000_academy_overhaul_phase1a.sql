-- ============================================================================
-- File: 20260224100000_academy_overhaul_phase1a.sql
-- Created: 2026-02-24
-- Purpose: Academy Overhaul Phase 1A — gamification tables, new block types,
--          new learning event types, new competencies, and hero/cover image columns.
-- ============================================================================

-- ============================================================================
-- 1. EXTEND ENUMS
-- ============================================================================

-- New interactive block types for the overhaul content model
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'options_chain_simulator';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'payoff_diagram_builder';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'greeks_dashboard';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'trade_scenario_tree';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'strategy_matcher';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'position_builder';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'flashcard_deck';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'timed_challenge';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'market_context_tagger';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'order_entry_simulator';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'what_went_wrong';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'journal_prompt';

-- New gamification event types
ALTER TYPE academy_learning_event_type ADD VALUE IF NOT EXISTS 'activity_completed';
ALTER TYPE academy_learning_event_type ADD VALUE IF NOT EXISTS 'achievement_unlocked';
ALTER TYPE academy_learning_event_type ADD VALUE IF NOT EXISTS 'streak_milestone';
ALTER TYPE academy_learning_event_type ADD VALUE IF NOT EXISTS 'xp_earned';

-- ============================================================================
-- 2. GAMIFICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_user_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS academy_user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  last_activity_date date,
  streak_freeze_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS academy_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  icon_url text,
  category text NOT NULL DEFAULT 'general',
  unlock_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  xp_reward integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES academy_achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

-- ============================================================================
-- 3. NEW COMPETENCIES
-- ============================================================================

INSERT INTO academy_competencies (key, title, description, domain)
VALUES
  ('volatility_mechanics', 'Volatility Mechanics', 'Understand IV, VIX, skew, and term structure.', 'analysis'),
  ('spx_specialization', 'SPX Specialization', 'Master SPX-specific trading characteristics.', 'execution'),
  ('portfolio_management', 'Portfolio Management', 'Manage portfolio-level risk and hedging.', 'risk'),
  ('trading_psychology', 'Trading Psychology', 'Maintain discipline, manage emotions, build routines.', 'improvement')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. HERO / COVER IMAGE COLUMNS
-- ============================================================================

ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE academy_modules ADD COLUMN IF NOT EXISTS cover_image_url text;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_academy_user_xp_user_id
  ON academy_user_xp(user_id);

CREATE INDEX IF NOT EXISTS idx_academy_user_streaks_user_id
  ON academy_user_streaks(user_id);

CREATE INDEX IF NOT EXISTS idx_academy_user_achievements_user_achievement
  ON academy_user_achievements(user_id, achievement_id);

CREATE INDEX IF NOT EXISTS idx_academy_achievements_category_active
  ON academy_achievements(category, is_active);

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
    DROP TRIGGER IF EXISTS tr_academy_user_xp_updated_at ON academy_user_xp;
    CREATE TRIGGER tr_academy_user_xp_updated_at
      BEFORE UPDATE ON academy_user_xp
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();

    DROP TRIGGER IF EXISTS tr_academy_user_streaks_updated_at ON academy_user_streaks;
    CREATE TRIGGER tr_academy_user_streaks_updated_at
      BEFORE UPDATE ON academy_user_streaks
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE academy_user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_achievements ENABLE ROW LEVEL SECURITY;

-- academy_user_xp: users own their rows
DROP POLICY IF EXISTS "academy_users_manage_xp" ON academy_user_xp;
CREATE POLICY "academy_users_manage_xp"
  ON academy_user_xp FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- academy_user_streaks: users own their rows
DROP POLICY IF EXISTS "academy_users_manage_streaks" ON academy_user_streaks;
CREATE POLICY "academy_users_manage_streaks"
  ON academy_user_streaks FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- academy_achievements: public read for active achievements
DROP POLICY IF EXISTS "academy_public_read_achievements" ON academy_achievements;
CREATE POLICY "academy_public_read_achievements"
  ON academy_achievements FOR SELECT
  USING (is_active = true);

-- academy_user_achievements: users own their rows
DROP POLICY IF EXISTS "academy_users_manage_user_achievements" ON academy_user_achievements;
CREATE POLICY "academy_users_manage_user_achievements"
  ON academy_user_achievements FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role full access on all new tables
DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_xp;
CREATE POLICY "academy_service_role_all"
  ON academy_user_xp FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_streaks;
CREATE POLICY "academy_service_role_all"
  ON academy_user_streaks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_achievements;
CREATE POLICY "academy_service_role_all"
  ON academy_achievements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "academy_service_role_all" ON academy_user_achievements;
CREATE POLICY "academy_service_role_all"
  ON academy_user_achievements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
