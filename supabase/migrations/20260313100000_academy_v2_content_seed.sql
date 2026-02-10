-- ============================================================================
-- File: 20260313100000_academy_v2_content_seed.sql
-- Purpose: TITM Academy V2 curriculum seed (9 courses, 53 lessons) and
--          normalization of published lessons to chunk-based format.
-- Idempotent by design: ON CONFLICT upserts and safe UPDATE transforms.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) LEARNING PATHS (V2 canonical paths)
-- ============================================================================

INSERT INTO learning_paths (
  name,
  slug,
  description,
  tier_required,
  difficulty_level,
  estimated_hours,
  display_order,
  is_published,
  icon_name
)
VALUES
  (
    'Onboarding',
    'onboarding',
    'Get started with TradeITM and understand the academy workflow.',
    'core',
    'beginner',
    1.5,
    0,
    true,
    'rocket'
  ),
  (
    'Foundations',
    'foundations',
    'Build your options trading foundation with core mechanics and risk control.',
    'core',
    'beginner',
    9.0,
    1,
    true,
    'book-open'
  ),
  (
    'Core Strategies',
    'core-strategies',
    'Master the TITM execution framework for SPX and alerts-driven trading.',
    'core',
    'intermediate',
    9.0,
    2,
    true,
    'target'
  ),
  (
    'Advanced Trading',
    'advanced',
    'Advance into LEAPS positioning and durable trading psychology.',
    'pro',
    'advanced',
    6.0,
    3,
    true,
    'brain'
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tier_required = EXCLUDED.tier_required,
  difficulty_level = EXCLUDED.difficulty_level,
  estimated_hours = EXCLUDED.estimated_hours,
  display_order = EXCLUDED.display_order,
  is_published = EXCLUDED.is_published,
  icon_name = EXCLUDED.icon_name;

-- ============================================================================
-- 2) COURSES (9-course V2 architecture)
-- ============================================================================

WITH course_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'welcome-tradeitm',
        'Welcome to TradeITM',
        'Get fully oriented with platform navigation, account setup, AI coaching, journaling, and your learning path.',
        'beginner'::difficulty_level,
        1.5::numeric,
        70,
        'core',
        'onboarding',
        '{"market_context":"awareness","review_reflection":"awareness"}'::jsonb,
        '[{"mistake":"Skipping setup","correction":"Complete onboarding steps before trading live."},{"mistake":"Ignoring journaling","correction":"Capture each trade to build repeatable edge."}]'::jsonb,
        10,
        1
      ),
      (
        'options-101',
        'Options 101: Understanding the Basics',
        'Master calls, puts, strikes, expiration, chain reading, and order execution with risk-aware paper practice.',
        'beginner'::difficulty_level,
        3.0::numeric,
        70,
        'core',
        'foundations',
        '{"market_context":"awareness","entry_validation":"awareness"}'::jsonb,
        '[{"mistake":"Confusing rights and obligations","correction":"Buyers have rights; sellers take obligations."},{"mistake":"Ignoring spread cost","correction":"Always evaluate bid-ask quality before entry."}]'::jsonb,
        22,
        1
      ),
      (
        'the-greeks-decoded',
        'The Greeks Decoded',
        'Understand delta, gamma, theta, and vega behavior in real SPX/NDX workflows and risk decisions.',
        'beginner'::difficulty_level,
        3.0::numeric,
        70,
        'core',
        'foundations',
        '{"market_context":"applied","entry_validation":"applied","trade_management":"awareness"}'::jsonb,
        '[{"mistake":"Using delta alone","correction":"Read the full Greek stack before sizing."},{"mistake":"Ignoring theta regime","correction":"Match hold-time to decay profile."}]'::jsonb,
        18,
        2
      ),
      (
        'risk-management-fundamentals',
        'Risk Management Fundamentals',
        'Build position sizing rules, daily risk limits, stop logic, and checklist discipline for consistent execution.',
        'beginner'::difficulty_level,
        3.0::numeric,
        75,
        'core',
        'foundations',
        '{"position_sizing":"applied","exit_discipline":"awareness","review_reflection":"awareness"}'::jsonb,
        '[{"mistake":"Over-sizing on conviction","correction":"Cap per-trade risk and follow process."},{"mistake":"No daily loss stop","correction":"Predefine max daily drawdown before open."}]'::jsonb,
        20,
        3
      ),
      (
        'titm-day-trading-methodology',
        'TITM Day Trading Methodology',
        'Apply the TITM framework from market structure read to disciplined entry, management, and exit.',
        'intermediate'::difficulty_level,
        3.0::numeric,
        75,
        'core',
        'core-strategies',
        '{"market_context":"independent","entry_validation":"independent","trade_management":"applied","exit_discipline":"applied"}'::jsonb,
        '[{"mistake":"Entering before confirmation","correction":"Validate structure, trigger, and risk before click."},{"mistake":"Late exits","correction":"Use predefined invalidation and target logic."}]'::jsonb,
        26,
        1
      ),
      (
        'reading-the-alerts',
        'Reading the Alerts',
        'Translate TITM alerts into actionable, risk-adjusted entries with context, conviction, and timing discipline.',
        'intermediate'::difficulty_level,
        3.0::numeric,
        75,
        'core',
        'core-strategies',
        '{"market_context":"independent","entry_validation":"independent","position_sizing":"applied"}'::jsonb,
        '[{"mistake":"Blindly copying alerts","correction":"Map alert context to your own setup criteria."},{"mistake":"Ignoring size guidance","correction":"Scale based on conviction and account risk."}]'::jsonb,
        24,
        2
      ),
      (
        'spx-execution-mastery',
        'SPX Execution Mastery',
        'Sharpen SPX contract selection, timeframe choice, spread logic, scaling, and weekly process review.',
        'intermediate'::difficulty_level,
        3.0::numeric,
        80,
        'core',
        'core-strategies',
        '{"entry_validation":"independent","trade_management":"independent","exit_discipline":"independent"}'::jsonb,
        '[{"mistake":"Wrong contract selection","correction":"Align strike/expiry to thesis and hold horizon."},{"mistake":"Averaging losers","correction":"Manage risk first; scale only by rules."}]'::jsonb,
        19,
        3
      ),
      (
        'leaps-long-term-positioning',
        'LEAPS and Long-Term Positioning',
        'Construct durable LEAPS positions with strike/expiry logic, portfolio allocation, and rolling plans.',
        'advanced'::difficulty_level,
        3.0::numeric,
        80,
        'pro',
        'advanced',
        '{"market_context":"independent","position_sizing":"independent","trade_management":"applied"}'::jsonb,
        '[{"mistake":"Overpaying for far OTM LEAPS","correction":"Prioritize quality delta and thesis durability."},{"mistake":"No roll plan","correction":"Define roll triggers before entry."}]'::jsonb,
        12,
        1
      ),
      (
        'trading-psychology-performance',
        'Trading Psychology and Performance',
        'Train emotional control, routine consistency, and reflective review to compound execution quality.',
        'advanced'::difficulty_level,
        3.0::numeric,
        80,
        'pro',
        'advanced',
        '{"review_reflection":"independent","exit_discipline":"independent"}'::jsonb,
        '[{"mistake":"Revenge trading after loss","correction":"Pause and reset to checklist before next trade."},{"mistake":"No routine","correction":"Use repeatable pre/post-market process blocks."}]'::jsonb,
        14,
        2
      )
  ) AS t(
    slug,
    title,
    description,
    difficulty_level,
    estimated_hours,
    passing_score,
    tier_required,
    path_slug,
    competency_map,
    common_mistakes,
    social_proof_count,
    sequence_order
  )
),
path_lookup AS (
  SELECT id, slug
  FROM learning_paths
  WHERE slug IN ('onboarding', 'foundations', 'core-strategies', 'advanced')
)
INSERT INTO courses (
  id,
  title,
  slug,
  description,
  difficulty_level,
  estimated_hours,
  passing_score,
  tier_required,
  is_published,
  learning_path_id,
  competency_map,
  common_mistakes,
  social_proof_count,
  display_order
)
SELECT
  gen_random_uuid(),
  cs.title,
  cs.slug,
  cs.description,
  cs.difficulty_level,
  cs.estimated_hours,
  cs.passing_score,
  cs.tier_required,
  true,
  pl.id,
  cs.competency_map,
  cs.common_mistakes,
  cs.social_proof_count,
  cs.sequence_order
FROM course_seed cs
JOIN path_lookup pl ON pl.slug = cs.path_slug
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  difficulty_level = EXCLUDED.difficulty_level,
  estimated_hours = EXCLUDED.estimated_hours,
  passing_score = EXCLUDED.passing_score,
  tier_required = EXCLUDED.tier_required,
  is_published = EXCLUDED.is_published,
  learning_path_id = EXCLUDED.learning_path_id,
  competency_map = EXCLUDED.competency_map,
  common_mistakes = EXCLUDED.common_mistakes,
  social_proof_count = EXCLUDED.social_proof_count,
  display_order = EXCLUDED.display_order;

-- ============================================================================
-- 3) LEARNING PATH <-> COURSE LINKS
-- ============================================================================

WITH mapping AS (
  SELECT *
  FROM (
    VALUES
      ('onboarding', 'welcome-tradeitm', 1),
      ('foundations', 'options-101', 1),
      ('foundations', 'the-greeks-decoded', 2),
      ('foundations', 'risk-management-fundamentals', 3),
      ('core-strategies', 'titm-day-trading-methodology', 1),
      ('core-strategies', 'reading-the-alerts', 2),
      ('core-strategies', 'spx-execution-mastery', 3),
      ('advanced', 'leaps-long-term-positioning', 1),
      ('advanced', 'trading-psychology-performance', 2)
  ) AS t(path_slug, course_slug, sequence_order)
),
path_lookup AS (
  SELECT id, slug FROM learning_paths
),
course_lookup AS (
  SELECT id, slug FROM courses
)
INSERT INTO learning_path_courses (
  id,
  learning_path_id,
  course_id,
  sequence_order,
  is_required
)
SELECT
  gen_random_uuid(),
  pl.id,
  c.id,
  m.sequence_order,
  true
FROM mapping m
JOIN path_lookup pl ON pl.slug = m.path_slug
JOIN course_lookup c ON c.slug = m.course_slug
ON CONFLICT (learning_path_id, course_id) DO UPDATE
SET
  sequence_order = EXCLUDED.sequence_order,
  is_required = EXCLUDED.is_required;

-- ============================================================================
-- 4) LESSONS (53 lessons) - chunk/quiz/competency-native
-- ============================================================================

WITH lesson_seed AS (
  SELECT *
  FROM (
    VALUES
      -- Onboarding (5)
      ('welcome-tradeitm', 1, 'Platform Tour', 'market_context'::competency_key, 'Navigate members dashboard, academy home, and journal surfaces with confidence.'),
      ('welcome-tradeitm', 2, 'Setting Up Your Account', 'review_reflection'::competency_key, 'Connect Discord, confirm role access, and configure profile and notification settings.'),
      ('welcome-tradeitm', 3, 'Meet Your AI Coach', 'review_reflection'::competency_key, 'Use context-rich prompts to ask tactical questions tied to your active lesson.'),
      ('welcome-tradeitm', 4, 'Your First Journal Entry', 'review_reflection'::competency_key, 'Capture setup, execution, and post-trade notes in a structured journal workflow.'),
      ('welcome-tradeitm', 5, 'Your Learning Path', 'market_context'::competency_key, 'Understand tiered paths, competency arc, review queue, and saved-item flow.'),

      -- Foundations: Options 101 (6)
      ('options-101', 1, 'What Are Options?', 'market_context'::competency_key, 'Define options as contracts with rights, obligations, and expiration mechanics.'),
      ('options-101', 2, 'Calls vs Puts', 'market_context'::competency_key, 'Map directional thesis to call and put structures using payoff intuition.'),
      ('options-101', 3, 'Strike Prices and Expiration', 'market_context'::competency_key, 'Select strikes and expirations based on thesis horizon and expected move.'),
      ('options-101', 4, 'Reading an Options Chain', 'entry_validation'::competency_key, 'Read bid-ask, volume, open interest, and liquidity for practical execution.'),
      ('options-101', 5, 'Order Types That Matter', 'entry_validation'::competency_key, 'Use limit, stop, and conditional orders to control fill quality and slippage.'),
      ('options-101', 6, 'Your First Paper Trade', 'review_reflection'::competency_key, 'Execute a full paper trade with entry plan, risk plan, and review notes.'),

      -- Foundations: Greeks (6)
      ('the-greeks-decoded', 1, 'Delta and Directional Risk', 'entry_validation'::competency_key, 'Use delta to estimate directional exposure and probability context.'),
      ('the-greeks-decoded', 2, 'Gamma and Acceleration', 'trade_management'::competency_key, 'Understand gamma expansion near expiry and impact on position behavior.'),
      ('the-greeks-decoded', 3, 'Theta and Time Decay', 'trade_management'::competency_key, 'Manage hold-time and timing windows where theta damage accelerates.'),
      ('the-greeks-decoded', 4, 'Vega and Volatility Regimes', 'market_context'::competency_key, 'Adapt strategies to implied volatility expansion and contraction regimes.'),
      ('the-greeks-decoded', 5, 'Combined Greeks Reading', 'trade_management'::competency_key, 'Read delta-gamma-theta interactions before and during active trades.'),
      ('the-greeks-decoded', 6, 'Greek Risk Scenarios', 'exit_discipline'::competency_key, 'Rehearse contingency decisions under fast volatility and directional shifts.'),

      -- Foundations: Risk management (6)
      ('risk-management-fundamentals', 1, 'Position Sizing Principles', 'position_sizing'::competency_key, 'Translate account risk into contract count with hard downside limits.'),
      ('risk-management-fundamentals', 2, 'Account Risk Rules', 'position_sizing'::competency_key, 'Define per-trade, daily, and weekly drawdown ceilings with no exceptions.'),
      ('risk-management-fundamentals', 3, 'Stop Loss Strategies', 'exit_discipline'::competency_key, 'Set invalidation-based exits and honor stops without emotional overrides.'),
      ('risk-management-fundamentals', 4, 'Risk Reward Ratios', 'position_sizing'::competency_key, 'Evaluate asymmetric payoffs before entry and reject poor expectancy setups.'),
      ('risk-management-fundamentals', 5, 'Correlation Risk', 'market_context'::competency_key, 'Avoid hidden concentration by checking correlated index and sector exposure.'),
      ('risk-management-fundamentals', 6, 'Building a Risk Checklist', 'review_reflection'::competency_key, 'Create a pre-trade checklist that blocks impulse entries.'),

      -- Core strategies: TITM methodology (6)
      ('titm-day-trading-methodology', 1, 'Market Structure Reading', 'market_context'::competency_key, 'Identify trend, balance, and transition states before selecting setups.'),
      ('titm-day-trading-methodology', 2, 'Key Levels: Support, Resistance, VWAP', 'entry_validation'::competency_key, 'Anchor entries around objective levels and avoid mid-range noise.'),
      ('titm-day-trading-methodology', 3, 'TITM Setup Criteria', 'entry_validation'::competency_key, 'Confirm setup quality using the TITM checklist and disqualifiers.'),
      ('titm-day-trading-methodology', 4, 'Entry Validation Checklist', 'entry_validation'::competency_key, 'Validate trigger, liquidity, and risk before order submission.'),
      ('titm-day-trading-methodology', 5, 'Trade Management Rules', 'trade_management'::competency_key, 'Scale, trail, and de-risk positions using predefined management rules.'),
      ('titm-day-trading-methodology', 6, 'Exit Discipline', 'exit_discipline'::competency_key, 'Execute planned exits quickly when thesis is invalidated or target is met.'),

      -- Core strategies: alerts (6)
      ('reading-the-alerts', 1, 'Alert Anatomy', 'market_context'::competency_key, 'Parse alert components: symbol, thesis, trigger, risk, and timeframe.'),
      ('reading-the-alerts', 2, 'GEX Interpretation', 'market_context'::competency_key, 'Interpret gamma exposure context and how it shapes expected market behavior.'),
      ('reading-the-alerts', 3, 'Conviction Levels', 'position_sizing'::competency_key, 'Map conviction tiers to position size and management aggressiveness.'),
      ('reading-the-alerts', 4, 'Entry Timing from Alerts', 'entry_validation'::competency_key, 'Align alert timing with real-time confirmation before execution.'),
      ('reading-the-alerts', 5, 'Position Sizing from Alerts', 'position_sizing'::competency_key, 'Size consistently when following alerts under changing volatility.'),
      ('reading-the-alerts', 6, 'Alert-to-Execution Workflow', 'review_reflection'::competency_key, 'Build a repeatable workflow from alert intake to journal review.'),

      -- Core strategies: SPX execution (6)
      ('spx-execution-mastery', 1, 'SPX Contract Selection', 'entry_validation'::competency_key, 'Choose strike/expiry structures that match objective and hold duration.'),
      ('spx-execution-mastery', 2, '0DTE vs Swing Timeframes', 'market_context'::competency_key, 'Select timeframe context to avoid thesis mismatch and overtrading.'),
      ('spx-execution-mastery', 3, 'Spread Strategies', 'trade_management'::competency_key, 'Deploy debit/credit spreads to shape payoff, margin, and risk limits.'),
      ('spx-execution-mastery', 4, 'Scaling In and Out', 'trade_management'::competency_key, 'Scale entries and exits systematically without averaging emotional risk.'),
      ('spx-execution-mastery', 5, 'Managing Losers', 'exit_discipline'::competency_key, 'Reduce loss velocity by acting on invalidation signals immediately.'),
      ('spx-execution-mastery', 6, 'Weekly Review Process', 'review_reflection'::competency_key, 'Run weekly review loops to refine setup quality and execution consistency.'),

      -- Advanced: LEAPS (6)
      ('leaps-long-term-positioning', 1, 'LEAPS Fundamentals', 'market_context'::competency_key, 'Understand long-dated option mechanics and thesis duration alignment.'),
      ('leaps-long-term-positioning', 2, 'Strike and Expiry Selection', 'position_sizing'::competency_key, 'Select strikes and expiries balancing capital efficiency and staying power.'),
      ('leaps-long-term-positioning', 3, 'Portfolio LEAPS Allocation', 'position_sizing'::competency_key, 'Allocate LEAPS exposure within portfolio risk and correlation limits.'),
      ('leaps-long-term-positioning', 4, 'Rolling Strategies', 'trade_management'::competency_key, 'Roll proactively based on delta drift, theta profile, and thesis durability.'),
      ('leaps-long-term-positioning', 5, 'Tax Considerations', 'review_reflection'::competency_key, 'Track holding periods and reporting considerations for long-dated structures.'),
      ('leaps-long-term-positioning', 6, 'LEAPS Case Studies', 'review_reflection'::competency_key, 'Review case studies to compare thesis quality versus realized outcomes.'),

      -- Advanced: Psychology (6)
      ('trading-psychology-performance', 1, 'Emotional Patterns in Trading', 'review_reflection'::competency_key, 'Identify recurring emotional triggers that degrade execution quality.'),
      ('trading-psychology-performance', 2, 'Dealing with Losses', 'exit_discipline'::competency_key, 'Recover process control quickly after losses without revenge behavior.'),
      ('trading-psychology-performance', 3, 'FOMO and Revenge Trading', 'review_reflection'::competency_key, 'Interrupt urgency loops and return to checklist-based decisions.'),
      ('trading-psychology-performance', 4, 'Building a Trading Routine', 'review_reflection'::competency_key, 'Create pre-market, intraday, and post-market routine anchors.'),
      ('trading-psychology-performance', 5, 'Performance Journaling', 'review_reflection'::competency_key, 'Use structured journaling to surface edge and recurring mistakes.'),
      ('trading-psychology-performance', 6, 'The Professional Mindset', 'review_reflection'::competency_key, 'Operate with repeatability, patience, and probabilistic thinking.' )
  ) AS t(course_slug, lesson_order, lesson_title, competency_key, focus_note)
),
course_lookup AS (
  SELECT id, slug, title
  FROM courses
  WHERE slug IN (
    'welcome-tradeitm',
    'options-101',
    'the-greeks-decoded',
    'risk-management-fundamentals',
    'titm-day-trading-methodology',
    'reading-the-alerts',
    'spx-execution-mastery',
    'leaps-long-term-positioning',
    'trading-psychology-performance'
  )
),
lesson_materialized AS (
  SELECT
    cl.id AS course_id,
    cl.title AS course_title,
    ls.course_slug,
    ls.lesson_order,
    ls.lesson_title,
    trim(both '-' FROM lower(regexp_replace(ls.course_slug || '-' || ls.lesson_title, '[^a-zA-Z0-9]+', '-', 'g'))) AS lesson_slug,
    ls.competency_key,
    ls.focus_note
  FROM lesson_seed ls
  JOIN course_lookup cl ON cl.slug = ls.course_slug
),
payload AS (
  SELECT
    lm.course_id,
    lm.lesson_title AS title,
    lm.lesson_slug AS slug,
    format(
      '## %s\n\n%s\n\nIn this lesson from **%s**, you will apply the TITM risk-first process to options execution. Focus on precise entry criteria, measured position sizing, and disciplined exits. Use SPX/NDX examples to keep concepts anchored in real trading decisions.',
      lm.lesson_title,
      lm.focus_note,
      lm.course_title
    ) AS content_markdown,
    'chunk'::lesson_type AS lesson_type,
    CASE WHEN lm.lesson_order IN (1, 2) THEN 14 ELSE 12 END AS estimated_minutes,
    lm.lesson_order AS display_order,
    true AS is_published,
    ARRAY[lm.competency_key]::competency_key[] AS competency_keys,
    jsonb_build_array(
      jsonb_build_object(
        'id', format('%s-c1', lm.lesson_slug),
        'title', 'Concept Brief',
        'content_type', 'rich_text',
        'content', format('## Core Concept\n\n%s\n\nFrame the setup in terms of risk, reward, and execution quality. Avoid entries that fail your checklist even if momentum is strong.', lm.focus_note),
        'duration_minutes', 4,
        'order_index', 0
      ),
      jsonb_build_object(
        'id', format('%s-c2', lm.lesson_slug),
        'title', 'Quick Check',
        'content_type', 'quick_check',
        'content', '',
        'duration_minutes', 3,
        'order_index', 1,
        'quick_check', jsonb_build_object(
          'question', format('In "%s", what is the primary objective?', lm.lesson_title),
          'options', jsonb_build_array(
            'Memorize terminology only',
            'Execute the TITM rule with defined risk',
            'Ignore risk when conviction is high',
            'Trade without a written plan'
          ),
          'correct_index', 1,
          'explanation', 'TITM execution always starts with defined risk and process alignment before order entry.'
        )
      ),
      jsonb_build_object(
        'id', format('%s-c3', lm.lesson_slug),
        'title', 'Applied Drill',
        'content_type', 'applied_drill',
        'content', format('## Applied Drill\n\nOpen your trading platform and simulate one setup linked to **%s**. Document entry trigger, stop, target, and position size before placing the order.', lm.lesson_title),
        'duration_minutes', 3,
        'order_index', 2
      ),
      jsonb_build_object(
        'id', format('%s-c4', lm.lesson_slug),
        'title', 'Reflection',
        'content_type', 'reflection',
        'content', '## Reflection\n\nWhat mistake is most likely for you on this concept, and what checklist line prevents it?',
        'duration_minutes', 2,
        'order_index', 3
      )
    ) AS chunk_data,
    jsonb_build_array(
      jsonb_build_object(
        'question', format('Which action best reflects the goal of "%s"?', lm.lesson_title),
        'options', jsonb_build_array(
          'Trade faster than everyone else',
          'Apply the checklist with defined risk',
          'Increase size after one win',
          'Override stops during volatility'
        ),
        'correct_index', 1,
        'explanation', 'The objective is process-consistent execution with pre-defined risk controls.'
      ),
      jsonb_build_object(
        'question', format('Which competency is primarily trained in "%s"?', lm.lesson_title),
        'options', jsonb_build_array(
          initcap(replace(lm.competency_key::text, '_', ' ')),
          'Broker onboarding speed',
          'News headline prediction',
          'Social media reaction time'
        ),
        'correct_index', 0,
        'explanation', 'Each lesson is tagged to one primary competency to support mastery tracking and review scheduling.'
      )
    ) AS quiz_data,
    ARRAY[
      format('Apply %s using checklist-first execution.', lm.lesson_title),
      'Define risk before entry and respect invalidation.',
      'Capture outcome in journal for feedback loops.'
    ] AS key_takeaways,
    format(
      'The learner is studying "%s" inside "%s". Teach with practical SPX/NDX options examples, keep answers concise, and emphasize risk-first execution and post-trade reflection.',
      lm.lesson_title,
      lm.course_title
    ) AS ai_tutor_context,
    ARRAY[
      format('What is the most important rule in %s?', lm.lesson_title),
      'How do I apply this to SPX 0DTE execution?',
      'What is the most common mistake on this topic?',
      'Give me a pre-trade checklist for this concept.'
    ] AS ai_tutor_chips
  FROM lesson_materialized lm
),
updated AS (
  UPDATE lessons l
  SET
    course_id = p.course_id,
    title = p.title,
    content_markdown = p.content_markdown,
    lesson_type = p.lesson_type,
    estimated_minutes = p.estimated_minutes,
    display_order = p.display_order,
    is_published = p.is_published,
    competency_keys = p.competency_keys,
    chunk_data = p.chunk_data,
    quiz_data = p.quiz_data,
    key_takeaways = p.key_takeaways,
    ai_tutor_context = p.ai_tutor_context,
    ai_tutor_chips = p.ai_tutor_chips
  FROM payload p
  WHERE l.slug = p.slug
  RETURNING l.slug
)
INSERT INTO lessons (
  id,
  course_id,
  title,
  slug,
  content_markdown,
  lesson_type,
  estimated_minutes,
  display_order,
  is_published,
  competency_keys,
  chunk_data,
  quiz_data,
  key_takeaways,
  ai_tutor_context,
  ai_tutor_chips
)
SELECT
  gen_random_uuid(),
  p.course_id,
  p.title,
  p.slug,
  p.content_markdown,
  p.lesson_type,
  p.estimated_minutes,
  p.display_order,
  p.is_published,
  p.competency_keys,
  p.chunk_data,
  p.quiz_data,
  p.key_takeaways,
  p.ai_tutor_context,
  p.ai_tutor_chips
FROM payload p
WHERE NOT EXISTS (
  SELECT 1
  FROM lessons l
  WHERE l.slug = p.slug
);

-- ============================================================================
-- 5) NORMALIZE LEGACY PUBLISHED LESSONS FOR V2 COMPATIBILITY
--    Ensures all published lessons satisfy phase verification expectations.
-- ============================================================================

-- Convert legacy object quiz payloads to array payloads.
UPDATE lessons
SET quiz_data = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'question', COALESCE(q ->> 'text', 'Check your understanding of this lesson.'),
        'options', COALESCE(
          (
            SELECT jsonb_agg(COALESCE(opt ->> 'text', 'Option'))
            FROM jsonb_array_elements(COALESCE(q -> 'options', '[]'::jsonb)) opt
          ),
          jsonb_build_array('Review the lesson objective', 'Use checklist-first execution', 'Ignore risk controls', 'Trade without plan')
        ),
        'correct_index', COALESCE(
          (
            SELECT ord - 1
            FROM jsonb_array_elements(COALESCE(q -> 'options', '[]'::jsonb)) WITH ORDINALITY opt(value, ord)
            WHERE opt.value ->> 'id' = q ->> 'correct_answer'
            LIMIT 1
          ),
          0
        ),
        'explanation', COALESCE(q ->> 'explanation', 'Review the lesson and retry with risk-first logic.')
      )
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(lessons.quiz_data -> 'questions', '[]'::jsonb)) q
)
WHERE is_published = true
  AND quiz_data IS NOT NULL
  AND jsonb_typeof(quiz_data) = 'object'
  AND jsonb_typeof(quiz_data -> 'questions') = 'array';

-- Enforce published lessons to use chunk format with competency and tutor metadata.
UPDATE lessons
SET
  lesson_type = 'chunk'::lesson_type,
  chunk_data = COALESCE(
    chunk_data,
    jsonb_build_array(
      jsonb_build_object(
        'id', format('legacy-%s-c1', id),
        'title', 'Lesson Overview',
        'content_type', 'rich_text',
        'content', COALESCE(content_markdown, format('## %s\n\nReview the core concept and identify the risk-first execution rule.', title)),
        'duration_minutes', GREATEST(3, COALESCE(estimated_minutes, duration_minutes, 12) / 3),
        'order_index', 0
      ),
      jsonb_build_object(
        'id', format('legacy-%s-c2', id),
        'title', 'Quick Check',
        'content_type', 'quick_check',
        'content', '',
        'duration_minutes', 2,
        'order_index', 1,
        'quick_check', jsonb_build_object(
          'question', format('What is the primary focus of "%s"?', title),
          'options', jsonb_build_array(
            'Apply the concept with defined risk',
            'Ignore stop logic during volatility',
            'Trade larger after one win',
            'Skip journaling and review'
          ),
          'correct_index', 0,
          'explanation', 'The focus is consistent execution with explicit risk controls and review discipline.'
        )
      ),
      jsonb_build_object(
        'id', format('legacy-%s-c3', id),
        'title', 'Applied Drill',
        'content_type', 'applied_drill',
        'content', format('## Applied Drill\n\nSimulate one trade that applies "%s" and record entry trigger, stop, target, and post-trade notes in your journal.', title),
        'duration_minutes', 2,
        'order_index', 2
      )
    )
  ),
  competency_keys = CASE
    WHEN competency_keys IS NULL OR competency_keys = '{}'::competency_key[] THEN ARRAY['market_context'::competency_key]
    ELSE competency_keys
  END,
  quiz_data = CASE
    WHEN quiz_data IS NULL OR jsonb_typeof(quiz_data) <> 'array' THEN
      jsonb_build_array(
        jsonb_build_object(
          'question', format('Which action best matches "%s"?', title),
          'options', jsonb_build_array(
            'Use checklist-first execution with defined risk',
            'Add size emotionally after losses',
            'Ignore invalidation levels',
            'Trade without documenting setup'
          ),
          'correct_index', 0,
          'explanation', 'Process consistency and risk limits are central to TITM execution quality.'
        ),
        jsonb_build_object(
          'question', 'What should you do after completing the setup?',
          'options', jsonb_build_array(
            'Journal the outcome and review mistakes',
            'Immediately double size on next trade',
            'Remove stop to avoid getting tagged',
            'Skip reflection to save time'
          ),
          'correct_index', 0,
          'explanation', 'Feedback loops from journaling and review drive performance improvements.'
        )
      )
    ELSE quiz_data
  END,
  key_takeaways = CASE
    WHEN key_takeaways IS NULL OR array_length(key_takeaways, 1) = 0 THEN
      ARRAY[
        format('Apply "%s" with risk-first discipline.', title),
        'Define entry, stop, and target before execution.',
        'Capture lessons learned in journal review.'
      ]
    ELSE key_takeaways
  END,
  ai_tutor_context = COALESCE(
    ai_tutor_context,
    format('Guide the learner through "%s" using practical SPX/NDX examples and strict risk controls.', title)
  ),
  ai_tutor_chips = CASE
    WHEN ai_tutor_chips IS NULL OR array_length(ai_tutor_chips, 1) = 0 THEN
      ARRAY[
        format('What is the key rule in %s?', title),
        'How do I apply this to SPX 0DTE?',
        'What checklist item prevents the most mistakes?',
        'How should I journal this setup?'
      ]
    ELSE ai_tutor_chips
  END,
  estimated_minutes = COALESCE(estimated_minutes, duration_minutes, 12)
WHERE is_published = true
  AND (
    chunk_data IS NULL
    OR competency_keys IS NULL
    OR competency_keys = '{}'::competency_key[]
    OR quiz_data IS NULL
    OR jsonb_typeof(quiz_data) <> 'array'
    OR key_takeaways IS NULL
    OR array_length(key_takeaways, 1) = 0
    OR ai_tutor_context IS NULL
    OR ai_tutor_chips IS NULL
    OR array_length(ai_tutor_chips, 1) = 0
    OR lesson_type <> 'chunk'::lesson_type
  );

COMMIT;
