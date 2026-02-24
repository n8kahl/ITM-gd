-- ============================================================================
-- File: 20260224200003_academy_overhaul_achievements_validation.sql
-- Created: 2026-02-24
-- Phase: Academy Overhaul — Phase 2, Slice 2D
-- Purpose: Seed 30 achievement definitions for the gamification system.
--          Uses ON CONFLICT (key) DO NOTHING so this is safe to re-apply.
-- ============================================================================

-- ============================================================================
-- 1. COMPLETION ACHIEVEMENTS (13 total: lesson milestones + track completions + full program)
-- ============================================================================

INSERT INTO academy_achievements
  (key, title, description, icon_url, category, unlock_criteria, xp_reward)
VALUES
  (
    'first_lesson',
    'First Steps',
    'Complete your first lesson.',
    '/academy-media/badges/first_lesson.svg',
    'completion',
    '{"type": "lessons_completed", "count": 1}'::jsonb,
    50
  ),
  (
    'five_lessons',
    'Getting Serious',
    'Complete 5 lessons.',
    '/academy-media/badges/five_lessons.svg',
    'completion',
    '{"type": "lessons_completed", "count": 5}'::jsonb,
    100
  ),
  (
    'ten_lessons',
    'Dedicated Student',
    'Complete 10 lessons.',
    '/academy-media/badges/ten_lessons.svg',
    'completion',
    '{"type": "lessons_completed", "count": 10}'::jsonb,
    200
  ),
  (
    'twenty_five_lessons',
    'Quarter Century',
    'Complete 25 lessons.',
    '/academy-media/badges/twenty_five_lessons.svg',
    'completion',
    '{"type": "lessons_completed", "count": 25}'::jsonb,
    300
  ),
  (
    'fifty_lessons',
    'Half Century',
    'Complete 50 lessons.',
    '/academy-media/badges/fifty_lessons.svg',
    'completion',
    '{"type": "lessons_completed", "count": 50}'::jsonb,
    500
  ),
  (
    'all_lessons',
    'Completionist',
    'Complete all 80 lessons.',
    '/academy-media/badges/all_lessons.svg',
    'completion',
    '{"type": "lessons_completed", "count": 80}'::jsonb,
    2000
  ),
  (
    'track_complete_1',
    'Foundations Graduate',
    'Complete Trading Foundations track.',
    '/academy-media/badges/track_complete_1.svg',
    'completion',
    '{"type": "track_completed", "trackCode": "foundations"}'::jsonb,
    500
  ),
  (
    'track_complete_2',
    'Technical Analyst',
    'Complete Technical Analysis track.',
    '/academy-media/badges/track_complete_2.svg',
    'completion',
    '{"type": "track_completed", "trackCode": "technical-analysis"}'::jsonb,
    500
  ),
  (
    'track_complete_3',
    'Options Specialist',
    'Complete Options Mastery track.',
    '/academy-media/badges/track_complete_3.svg',
    'completion',
    '{"type": "track_completed", "trackCode": "options-mastery"}'::jsonb,
    500
  ),
  (
    'track_complete_4',
    'SPX Expert',
    'Complete SPX Specialization track.',
    '/academy-media/badges/track_complete_4.svg',
    'completion',
    '{"type": "track_completed", "trackCode": "spx-specialization"}'::jsonb,
    500
  ),
  (
    'track_complete_5',
    'Advanced Strategist',
    'Complete Advanced Strategies track.',
    '/academy-media/badges/track_complete_5.svg',
    'completion',
    '{"type": "track_completed", "trackCode": "advanced-strategies"}'::jsonb,
    500
  ),
  (
    'track_complete_6',
    'Psychology Pro',
    'Complete Trading Psychology track.',
    '/academy-media/badges/track_complete_6.svg',
    'completion',
    '{"type": "track_completed", "trackCode": "trading-psychology"}'::jsonb,
    500
  ),
  (
    'full_program',
    'Master Trader',
    'Complete all 6 tracks.',
    '/academy-media/badges/full_program.svg',
    'completion',
    '{"type": "program_completed"}'::jsonb,
    5000
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. STREAK ACHIEVEMENTS (3 total)
-- ============================================================================

INSERT INTO academy_achievements
  (key, title, description, icon_url, category, unlock_criteria, xp_reward)
VALUES
  (
    'streak_7',
    'Week Warrior',
    'Maintain a 7-day streak.',
    '/academy-media/badges/streak_7.svg',
    'streak',
    '{"type": "streak_days", "count": 7}'::jsonb,
    100
  ),
  (
    'streak_30',
    'Monthly Marathoner',
    'Maintain a 30-day streak.',
    '/academy-media/badges/streak_30.svg',
    'streak',
    '{"type": "streak_days", "count": 30}'::jsonb,
    500
  ),
  (
    'streak_100',
    'Centurion',
    'Maintain a 100-day streak.',
    '/academy-media/badges/streak_100.svg',
    'streak',
    '{"type": "streak_days", "count": 100}'::jsonb,
    2000
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. MASTERY ACHIEVEMENTS (11 total: 10 competency + 1 perfect assessment)
-- ============================================================================

INSERT INTO academy_achievements
  (key, title, description, icon_url, category, unlock_criteria, xp_reward)
VALUES
  (
    'competency_master_market_context',
    'Market Reader',
    'Master market context analysis.',
    '/academy-media/badges/competency_master_market_context.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "market_context", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_entry_validation',
    'Entry Expert',
    'Master entry validation.',
    '/academy-media/badges/competency_master_entry_validation.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "entry_validation", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_trade_management',
    'Trade Commander',
    'Master trade management.',
    '/academy-media/badges/competency_master_trade_management.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "trade_management", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_position_sizing',
    'Size Strategist',
    'Master position sizing.',
    '/academy-media/badges/competency_master_position_sizing.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "position_sizing", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_exit_discipline',
    'Exit Architect',
    'Master exit discipline.',
    '/academy-media/badges/competency_master_exit_discipline.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "exit_discipline", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_review_reflection',
    'Self Analyst',
    'Master review and reflection.',
    '/academy-media/badges/competency_master_review_reflection.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "review_reflection", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_volatility_mechanics',
    'Volatility Virtuoso',
    'Master volatility mechanics.',
    '/academy-media/badges/competency_master_volatility_mechanics.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "volatility_mechanics", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_spx_specialization',
    'SPX Master',
    'Master SPX specialization.',
    '/academy-media/badges/competency_master_spx_specialization.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "spx_specialization", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_portfolio_management',
    'Portfolio Guardian',
    'Master portfolio management.',
    '/academy-media/badges/competency_master_portfolio_management.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "portfolio_management", "minScore": 90}'::jsonb,
    300
  ),
  (
    'competency_master_trading_psychology',
    'Mental Fortress',
    'Master trading psychology.',
    '/academy-media/badges/competency_master_trading_psychology.svg',
    'mastery',
    '{"type": "competency_mastery", "competencyKey": "trading_psychology", "minScore": 90}'::jsonb,
    300
  ),
  (
    'first_perfect',
    'Perfectionist',
    'Score 100% on any assessment.',
    '/academy-media/badges/first_perfect.svg',
    'mastery',
    '{"type": "perfect_assessment"}'::jsonb,
    100
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. ACTIVITY ACHIEVEMENTS (4 total)
-- ============================================================================

INSERT INTO academy_achievements
  (key, title, description, icon_url, category, unlock_criteria, xp_reward)
VALUES
  (
    'chain_reader',
    'Chain Reader',
    'Complete 10 options chain activities.',
    '/academy-media/badges/chain_reader.svg',
    'activity',
    '{"type": "activity_count", "blockType": "options_chain_simulator", "count": 10}'::jsonb,
    200
  ),
  (
    'diagram_builder',
    'Diagram Builder',
    'Complete 10 payoff diagram activities.',
    '/academy-media/badges/diagram_builder.svg',
    'activity',
    '{"type": "activity_count", "blockType": "payoff_diagram_builder", "count": 10}'::jsonb,
    200
  ),
  (
    'speed_demon',
    'Speed Demon',
    'Score 100% on a timed challenge.',
    '/academy-media/badges/speed_demon.svg',
    'activity',
    '{"type": "perfect_score", "blockType": "timed_challenge"}'::jsonb,
    150
  ),
  (
    'perfect_week',
    'Perfect Week',
    'Complete all daily activities for 7 consecutive days.',
    '/academy-media/badges/perfect_week.svg',
    'activity',
    '{"type": "consecutive_daily_completion", "count": 7}'::jsonb,
    300
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 5. VALIDATION — confirm seeded counts and category coverage
-- ============================================================================

DO $$
DECLARE
  v_total_count    integer;
  v_category_count integer;
  v_categories     text;
BEGIN
  -- Total achievement count
  SELECT COUNT(*) INTO v_total_count
  FROM academy_achievements
  WHERE is_active = true;

  RAISE NOTICE 'academy_achievements total active rows: %', v_total_count;

  -- Category distribution
  SELECT string_agg(category || ': ' || cnt::text, ', ' ORDER BY category)
  INTO v_categories
  FROM (
    SELECT category, COUNT(*) AS cnt
    FROM academy_achievements
    WHERE is_active = true
    GROUP BY category
  ) sub;

  RAISE NOTICE 'academy_achievements by category — %', v_categories;

  -- Distinct category count
  SELECT COUNT(DISTINCT category) INTO v_category_count
  FROM academy_achievements
  WHERE is_active = true;

  RAISE NOTICE 'academy_achievements distinct categories: %', v_category_count;

  -- Confirm all expected categories are present
  IF NOT EXISTS (
    SELECT 1 FROM academy_achievements WHERE category = 'completion' AND is_active = true
  ) THEN
    RAISE WARNING 'VALIDATION FAILED: no achievements with category = completion';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM academy_achievements WHERE category = 'streak' AND is_active = true
  ) THEN
    RAISE WARNING 'VALIDATION FAILED: no achievements with category = streak';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM academy_achievements WHERE category = 'mastery' AND is_active = true
  ) THEN
    RAISE WARNING 'VALIDATION FAILED: no achievements with category = mastery';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM academy_achievements WHERE category = 'activity' AND is_active = true
  ) THEN
    RAISE WARNING 'VALIDATION FAILED: no achievements with category = activity';
  END IF;

  RAISE NOTICE 'Validation complete. All expected categories are present.';
END $$;
