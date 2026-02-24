-- ============================================================================
-- File: 20260224100001_academy_overhaul_phase1b.sql
-- Created: 2026-02-24
-- Purpose: Academy Overhaul Phase 1B — reporting/analytics aggregation tables:
--          lesson-level daily analytics, user competency mastery history, and
--          cohort-level daily metrics for admin dashboards and instructor views.
-- ============================================================================

-- ============================================================================
-- 1. LESSON ANALYTICS DAILY
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_lesson_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  date date NOT NULL,
  started_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  avg_time_minutes numeric,
  median_time_minutes numeric,
  drop_off_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, date)
);

-- ============================================================================
-- 2. USER COMPETENCY MASTERY HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_user_competency_mastery_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES academy_competencies(id) ON DELETE CASCADE,
  score_snapshot numeric NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. COHORT METRICS DAILY
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_cohort_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  active_users integer NOT NULL DEFAULT 0,
  lessons_started integer NOT NULL DEFAULT 0,
  lessons_completed integer NOT NULL DEFAULT 0,
  avg_session_minutes numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_academy_lesson_analytics_daily_lesson_date
  ON academy_lesson_analytics_daily(lesson_id, date);

CREATE INDEX IF NOT EXISTS idx_academy_user_competency_mastery_history_user_comp_eval
  ON academy_user_competency_mastery_history(user_id, competency_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_cohort_metrics_daily_date
  ON academy_cohort_metrics_daily(date);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE academy_lesson_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_competency_mastery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_cohort_metrics_daily ENABLE ROW LEVEL SECURITY;

-- ---- academy_lesson_analytics_daily: service role only, no public read ----

DROP POLICY IF EXISTS "academy_lesson_analytics_daily_service_role_all" ON academy_lesson_analytics_daily;
CREATE POLICY "academy_lesson_analytics_daily_service_role_all"
  ON academy_lesson_analytics_daily FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---- academy_user_competency_mastery_history: users SELECT own rows; service role full access ----

DROP POLICY IF EXISTS "academy_user_competency_mastery_history_user_select" ON academy_user_competency_mastery_history;
CREATE POLICY "academy_user_competency_mastery_history_user_select"
  ON academy_user_competency_mastery_history FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "academy_user_competency_mastery_history_service_role_all" ON academy_user_competency_mastery_history;
CREATE POLICY "academy_user_competency_mastery_history_service_role_all"
  ON academy_user_competency_mastery_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---- academy_cohort_metrics_daily: service role only, no public read ----

DROP POLICY IF EXISTS "academy_cohort_metrics_daily_service_role_all" ON academy_cohort_metrics_daily;
CREATE POLICY "academy_cohort_metrics_daily_service_role_all"
  ON academy_cohort_metrics_daily FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
