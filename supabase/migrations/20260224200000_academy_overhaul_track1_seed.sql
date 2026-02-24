-- ============================================================================
-- File: 20260224200000_academy_overhaul_track1_seed.sql
-- Phase: Academy Overhaul – Phase 2, Slice 2A
-- Purpose: Add Module 1.3 (Psychology of Trading) and Module 1.4 (First Steps
--          in Trading) with all lessons, blocks, competency links, and
--          per-lesson assessments to the existing 'foundations' track.
-- Idempotency: all INSERTs use ON CONFLICT DO NOTHING / DO UPDATE.
--              Parent records are referenced by slug/code, never by
--              hard-coded UUIDs.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENSURE COMPETENCIES EXIST (trading_psychology already seeded in Phase 1A;
--    repeat here with DO NOTHING so this file is self-contained)
-- ============================================================================

INSERT INTO academy_competencies (key, title, description, domain, metadata)
VALUES
  ('trading_psychology', 'Trading Psychology', 'Manage emotions and cognitive biases to execute the trading plan consistently.', 'mindset',     '{}'::jsonb),
  ('market_context',     'Market Context',     'Evaluate session structure and context before taking risk.',               'analysis',    '{}'::jsonb),
  ('entry_validation',   'Entry Validation',   'Confirm setup quality and invalidation before execution.',                 'execution',   '{}'::jsonb),
  ('exit_discipline',    'Exit Discipline',    'Execute planned exits under pressure without drift.',                      'risk',        '{}'::jsonb),
  ('review_reflection',  'Review Reflection',  'Use post-trade review to improve repeatability.',                         'improvement', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. MODULE 1.3 — Psychology of Trading
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id
   FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'foundations'),
  'psychology-of-trading',
  'psychology-of-trading',
  'Psychology of Trading',
  'Understand the emotional forces that derail disciplined execution and build routines that keep you on-plan.',
  '["Identify the four primary trading emotions and their impact","Recognise emotional cascade patterns in real trade scenarios","Design a pre-market and post-market routine for consistent execution"]'::jsonb,
  33,
  3,
  true,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ============================================================================
-- 3. LESSON 1.3.1 — Understanding Trading Emotions
-- ============================================================================

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'psychology-of-trading'),
  'understanding-trading-emotions',
  'Understanding Trading Emotions',
  'Identify the key emotions that influence trading decisions and develop awareness strategies',
  15,
  'beginner'::academy_difficulty,
  '{}'::uuid[],
  0,
  true,
  '{"competenciesTargeted":["trading_psychology","review_reflection"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title                   = EXCLUDED.title,
  learning_objective      = EXCLUDED.learning_objective,
  estimated_minutes       = EXCLUDED.estimated_minutes,
  difficulty              = EXCLUDED.difficulty,
  prerequisite_lesson_ids = EXCLUDED.prerequisite_lesson_ids,
  position                = EXCLUDED.position,
  is_published            = EXCLUDED.is_published,
  metadata                = EXCLUDED.metadata,
  updated_at              = now();

-- Block 1/6 — hook
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  'hook'::academy_block_type,
  1,
  'The $50,000 Mistake',
  '{
    "title": "The $50,000 Mistake",
    "content": "A seasoned trader with 15 years of experience watched his best position turn against him. Instead of following his rules, fear took over. He doubled down, then tripled down. By market close, what started as a small loss became a $50,000 devastation. The irony? The market reversed the next day...",
    "scenario": "Fear-driven revenge trading after an initial loss",
    "keyTakeaways": [
      "Emotions are the #1 account killer",
      "Self-awareness precedes self-control"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 2/6 — concept_explanation
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  'concept_explanation'::academy_block_type,
  2,
  'The Emotional Cycle of Trading',
  '{
    "title": "The Emotional Cycle of Trading",
    "content": "Every trader experiences a predictable emotional cycle: excitement during entry, anxiety during drawdowns, euphoria during wins, and depression during losses. Understanding this cycle is the first step to breaking free from emotional decision-making.\n\nThe four primary trading emotions are:\n1. **Fear** — Causes premature exits, missed entries, and overhedging\n2. **Greed** — Leads to oversizing, removing stops, and holding too long\n3. **Hope** — The most dangerous: holding losers hoping they recover\n4. **Regret** — Chasing missed trades and revenge trading",
    "keyTakeaways": [
      "Four primary emotions: fear, greed, hope, regret",
      "Awareness is the first step to control"
    ],
    "proTip": "Keep an emotion journal alongside your trade journal. Rate your emotional state 1-10 before each trade."
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 3/6 — worked_example
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  'worked_example'::academy_block_type,
  3,
  'Anatomy of an Emotional Trade',
  '{
    "title": "Anatomy of an Emotional Trade",
    "steps": [
      "1. Trader enters SPX 0DTE put at 9:35 AM based on valid setup",
      "2. Position moves against immediately — loss hits $200",
      "3. Fear kicks in: I should cut this before it gets worse",
      "4. Exits at -$200, but 10 minutes later the trade would have hit target for +$500",
      "5. Regret triggers: re-enters with double size, no setup",
      "6. Second trade loses -$600, total damage: -$800 vs original plan of -$200 max loss"
    ],
    "tradeSetup": {
      "instrument": "SPX 0DTE Put",
      "entry": "4,520",
      "stop": "4,530",
      "target": "4,500"
    },
    "keyTakeaways": [
      "Emotional cascade: fear then exit then regret then revenge",
      "Following the plan limits damage to predefined risk"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 4/6 — guided_practice
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  'guided_practice'::academy_block_type,
  4,
  'Identify the Emotion in Each Scenario',
  '{
    "title": "Identify the Emotion in Each Scenario",
    "exercise": "Identify the dominant emotion in each of 3 trade scenarios",
    "hints": [
      "Look at the action, not the justification",
      "What would the trading plan say to do?"
    ],
    "correctAnswer": {
      "scenario1": "fear",
      "scenario2": "greed",
      "scenario3": "hope"
    },
    "scenarios": [
      {
        "id": "scenario1",
        "description": "A trader cuts a position 5 minutes after entry because price dipped $50 — well before the defined stop. The setup was still valid."
      },
      {
        "id": "scenario2",
        "description": "A trader hits the initial profit target but removes the limit order, reasoning this could run much further today."
      },
      {
        "id": "scenario3",
        "description": "A trader holds a losing position well past the stop level, telling themselves it always comes back, I just need to give it time."
      }
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 5/6 — independent_practice
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  'independent_practice'::academy_block_type,
  5,
  'Audit Your Last 5 Trades for Emotion',
  '{
    "title": "Audit Your Last 5 Trades for Emotion",
    "challenge": "Review your last 5 trades and identify the emotional state for each entry and exit",
    "rubric": {
      "criteria": [
        "Honest self-assessment",
        "Identified specific emotions",
        "Connected emotions to actions",
        "Proposed mitigation strategies"
      ],
      "maxScore": 4
    },
    "template": {
      "fields": ["trade_date", "instrument", "emotion_at_entry", "emotion_at_exit", "did_emotion_change_outcome", "mitigation_for_next_time"]
    }
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 6/6 — reflection
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  'reflection'::academy_block_type,
  6,
  'Your Most Costly Emotion',
  '{
    "title": "Your Most Costly Emotion",
    "journalPrompt": "What is your most recurring trading emotion? How has it affected your P&L this month?",
    "selfAssessmentQuestions": [
      "Can I identify fear vs greed in real-time?",
      "Do I have a pre-trade emotional checklist?",
      "Have I ever revenge traded? What triggered it?"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- ============================================================================
-- 4. LESSON 1.3.2 — Building a Trading Routine
-- ============================================================================

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'psychology-of-trading'),
  'building-a-trading-routine',
  'Building a Trading Routine',
  'Design a structured pre-market and post-market routine that promotes disciplined execution',
  18,
  'beginner'::academy_difficulty,
  '{}'::uuid[],
  1,
  true,
  '{"competenciesTargeted":["trading_psychology","market_context"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title                   = EXCLUDED.title,
  learning_objective      = EXCLUDED.learning_objective,
  estimated_minutes       = EXCLUDED.estimated_minutes,
  difficulty              = EXCLUDED.difficulty,
  prerequisite_lesson_ids = EXCLUDED.prerequisite_lesson_ids,
  position                = EXCLUDED.position,
  is_published            = EXCLUDED.is_published,
  metadata                = EXCLUDED.metadata,
  updated_at              = now();

-- Block 1/6 — hook
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  'hook'::academy_block_type,
  1,
  'The Trader Who Never Prepared',
  '{
    "title": "The Trader Who Never Prepared",
    "content": "Two traders open their platforms at 9:29 AM. Trader A has spent 45 minutes reviewing overnight news, marking key levels, and checking VIX. Trader B opens the app mid-coffee, no prep. By 10:15 AM, Trader A has one clean profitable trade. Trader B has three reactive losers — all taken on impulse because she had no plan.",
    "scenario": "Contrast between a prepared and unprepared trader on the same morning",
    "keyTakeaways": [
      "Preparation converts randomness into process",
      "Routines reduce cognitive load under live-market pressure"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 2/6 — concept_explanation
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  'concept_explanation'::academy_block_type,
  2,
  'The Three-Part Trading Day',
  '{
    "title": "The Three-Part Trading Day",
    "content": "A professional trading day has three distinct phases — each with its own focus:\n\n**1. Pre-Market Preparation (60-30 min before open)**\n- Review overnight futures and key macro events\n- Mark HTF support/resistance levels\n- Set watchlist with trigger prices\n- Check VIX/IV rank for sizing context\n- Set daily max loss and profit target\n- Rate emotional readiness (1-10)\n\n**2. Active Session (Market hours)**\n- Execute only pre-planned setups\n- Log entry rationale in real-time\n- Apply time-stop rules (no new entries after 11:30 AM for 0DTE)\n\n**3. Post-Market Review (30 min after close)**\n- Grade each trade against the plan\n- Record emotional state at key decision points\n- Identify one improvement for tomorrow\n- Update trade journal",
    "keyTakeaways": [
      "Three phases: preparation, execution, review",
      "Emotional readiness rating before every session"
    ],
    "proTip": "Block your calendar. Treat pre-market prep as a non-negotiable appointment. Traders who skip prep consistently underperform their backtest results."
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 3/6 — worked_example
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  'worked_example'::academy_block_type,
  3,
  'A Model Trading Day',
  '{
    "title": "A Model Trading Day",
    "schedule": [
      { "time": "8:00 AM", "activity": "Review SPX overnight range and gap direction" },
      { "time": "8:15 AM", "activity": "Check economic calendar — any Fed speakers, CPI, jobs data?" },
      { "time": "8:30 AM", "activity": "Mark daily and weekly key levels on chart" },
      { "time": "8:45 AM", "activity": "Check VIX: above 20 means reduce size; below 15 means standard size" },
      { "time": "8:55 AM", "activity": "Write today bias and two scenario plans (bull/bear)" },
      { "time": "9:00 AM", "activity": "Rate emotional state 1-10. If below 6, reduce to 50% size" },
      { "time": "9:30 AM", "activity": "Market opens — wait for 5-min candle to close before first entry" },
      { "time": "11:30 AM", "activity": "No new 0DTE entries after this time" },
      { "time": "4:30 PM", "activity": "Journal: grade trades, record emotions, write one lesson learned" }
    ],
    "keyTakeaways": [
      "Start with macro, zoom into micro",
      "Emotional check at 9:00 AM gates your sizing for the day"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 4/6 — guided_practice
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  'guided_practice'::academy_block_type,
  4,
  'Sequence Your Morning Checklist',
  '{
    "title": "Sequence Your Morning Checklist",
    "exercise": "Drag the following 6 pre-market tasks into the correct order of priority",
    "items": [
      "Check VIX and IV rank for position sizing",
      "Mark key S/R levels on the chart",
      "Review overnight futures gap",
      "Rate your emotional readiness",
      "Check macro calendar for scheduled events",
      "Write your bias and two scenario plans"
    ],
    "correctOrder": [
      "Review overnight futures gap",
      "Check macro calendar for scheduled events",
      "Mark key S/R levels on the chart",
      "Check VIX and IV rank for position sizing",
      "Write your bias and two scenario plans",
      "Rate your emotional readiness"
    ],
    "hints": [
      "Start with the broadest context (macro) before narrowing to technicals",
      "Emotional check is last — it gates everything that follows"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 5/6 — independent_practice
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  'independent_practice'::academy_block_type,
  5,
  'Build Your Personal Trading Routine',
  '{
    "title": "Build Your Personal Trading Routine",
    "challenge": "Draft your own pre-market and post-market routine with specific times and tasks",
    "rubric": {
      "criteria": [
        "Pre-market routine covers macro, levels, and emotional check",
        "Active session includes time-stop or cutoff rules",
        "Post-market includes trade grading and one-lesson reflection",
        "Routine is realistic and time-bounded"
      ],
      "maxScore": 4
    },
    "template": {
      "premarketTasks": [],
      "activeSessionRules": [],
      "postmarketTasks": [],
      "totalTimeRequired": ""
    }
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 6/6 — reflection
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  'reflection'::academy_block_type,
  6,
  'What Does Your Current Routine Miss?',
  '{
    "title": "What Does Your Current Routine Miss?",
    "journalPrompt": "Compare your current pre-market preparation to the model routine. What is the single most important step you have been skipping, and what would change if you added it consistently?",
    "selfAssessmentQuestions": [
      "Do I have a consistent start time for pre-market prep?",
      "Have I defined a daily max loss and stuck to it?",
      "Do I review my trades within 30 minutes of market close?"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- ============================================================================
-- 5. MODULE 1.4 — First Steps in Trading
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id
   FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'foundations'),
  'first-steps-in-trading',
  'first-steps-in-trading',
  'First Steps in Trading',
  'Apply foundational concepts in a risk-free environment through structured paper trading.',
  '["Execute a complete paper trade lifecycle from setup to review","Use simulator tools to practice entry, management, and exit","Perform an honest post-trade review using a grading rubric"]'::jsonb,
  20,
  4,
  true,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ============================================================================
-- 6. LESSON 1.4.1 — Your First Paper Trade
-- ============================================================================

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'first-steps-in-trading'),
  'your-first-paper-trade',
  'Your First Paper Trade',
  'Execute a complete paper trade from setup identification through exit and review',
  20,
  'beginner'::academy_difficulty,
  '{}'::uuid[],
  0,
  true,
  '{"competenciesTargeted":["entry_validation","exit_discipline","review_reflection"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title                   = EXCLUDED.title,
  learning_objective      = EXCLUDED.learning_objective,
  estimated_minutes       = EXCLUDED.estimated_minutes,
  difficulty              = EXCLUDED.difficulty,
  prerequisite_lesson_ids = EXCLUDED.prerequisite_lesson_ids,
  position                = EXCLUDED.position,
  is_published            = EXCLUDED.is_published,
  metadata                = EXCLUDED.metadata,
  updated_at              = now();

-- Block 1/6 — hook
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  'hook'::academy_block_type,
  1,
  'Why Paper Trading Is Not Practice — It Is Proof',
  '{
    "title": "Why Paper Trading Is Not Practice — It Is Proof",
    "content": "Most traders skip paper trading because it feels fake. But paper trading is not about simulating profit — it is about proving your process. If you cannot execute a clean paper trade (correct sizing, defined stop, planned exit), you will not execute a clean real trade. The market does not reward improvisation. It rewards systems.",
    "scenario": "A new trader rushes to live trading after watching tutorials, skips all paper trading, and blows 20% of their account in the first two weeks because their entries and exits were reactive, not planned.",
    "keyTakeaways": [
      "Paper trading validates your process, not your emotions",
      "A messy paper trade predicts a costly real trade"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 2/6 — concept_explanation
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  'concept_explanation'::academy_block_type,
  2,
  'The Five Stages of a Complete Paper Trade',
  '{
    "title": "The Five Stages of a Complete Paper Trade",
    "content": "A complete paper trade has five stages — each one must be planned before execution begins:\n\n**Stage 1: Setup Identification**\nDefine the technical and contextual criteria that justify the trade. What session mode is it? What is your directional bias? What level is your trigger?\n\n**Stage 2: Trade Planning**\nBefore touching the simulator, write down: entry price, stop price, target price, position size, and maximum dollar risk.\n\n**Stage 3: Entry Execution**\nEnter the position in your simulator at or near the planned price. Note the exact fill. Slippage is real even in paper trading.\n\n**Stage 4: Trade Management**\nMonitor against your plan. Do not move stops. Do not add to losers. If price hits your stop, exit. If price hits your target, exit (or scale per plan).\n\n**Stage 5: Post-Trade Review**\nGrade the trade: Did you follow the plan? What was the R:R outcome? What would you change?",
    "keyTakeaways": [
      "All five stages must be completed for a valid paper trade",
      "Planning before entry is the most important stage"
    ],
    "proTip": "Screenshot your chart at entry and at exit. Attach both to your journal entry. Visual evidence holds you accountable."
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 3/6 — worked_example
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  'worked_example'::academy_block_type,
  3,
  'A Complete SPX Paper Trade Walkthrough',
  '{
    "title": "A Complete SPX Paper Trade Walkthrough",
    "tradeSetup": {
      "date": "2026-02-10",
      "instrument": "SPX 0DTE Call",
      "sessionMode": "Trending — gap up, holding above prior day high",
      "bias": "Bullish",
      "trigger": "Breakout and retest of 5,050 on 5-min chart"
    },
    "tradePlan": {
      "entry": "5,052 (after retest confirmation candle closes)",
      "stop": "5,044 (below retest low — 8 points risk)",
      "target1": "5,068 (1:2 R:R — 16 points)",
      "target2": "5,080 (1:3.5 R:R — 28 points)",
      "size": "2 contracts at $1.40 premium = $280 total risk at stop"
    },
    "execution": {
      "actualEntry": "5,052 — filled at plan",
      "managementNote": "Price consolidated for 8 minutes, then broke higher",
      "exit": "Scaled: 1 contract at T1 ($168 gain), 1 contract at T2 ($280 gain)",
      "totalPnL": "+$448 paper profit"
    },
    "review": {
      "planFollowed": true,
      "emotionNotes": "Mild impatience during consolidation — resisted urge to exit early",
      "grade": "A — clean execution, both targets hit",
      "improvement": "Add time check: if no movement after 15 min, re-evaluate"
    },
    "keyTakeaways": [
      "The plan was written before entry — execution just followed the script",
      "Scaling at T1 removed pressure to hold the full position to T2"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 4/6 — guided_practice
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  'guided_practice'::academy_block_type,
  4,
  'Plan a Paper Trade From a Given Setup',
  '{
    "title": "Plan a Paper Trade From a Given Setup",
    "scenario": {
      "description": "SPX is in a trending session. Price has pulled back to the 20-period moving average on the 5-min chart at 5,100. Previous resistance at 5,095 has flipped to support after a 15-minute consolidation. VIX is at 14 (low volatility).",
      "question": "Complete the trade plan fields below before looking at the suggested answer."
    },
    "fields": ["entry_price", "stop_price", "target1_price", "position_size_rationale", "max_dollar_risk"],
    "suggestedAnswer": {
      "entry_price": "5,102 (confirmation close above 5,100)",
      "stop_price": "5,093 (below the consolidation low — 9 points risk)",
      "target1_price": "5,120 (2:1 R:R minimum)",
      "position_size_rationale": "Low VIX = standard size; risk $200 max = ~2 contracts at typical premium",
      "max_dollar_risk": "$200"
    },
    "hints": [
      "Your stop goes below structure, not at an arbitrary dollar amount",
      "Target must be at least 1.5x your risk distance to be worth taking"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 5/6 — independent_practice
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  'independent_practice'::academy_block_type,
  5,
  'Execute and Review Your First Paper Trade',
  '{
    "title": "Execute and Review Your First Paper Trade",
    "challenge": "Open a paper trading simulator, identify one valid setup, execute the full five-stage paper trade lifecycle, and complete the review rubric",
    "rubric": {
      "criteria": [
        "Setup was identified before entry — not after price moved",
        "Entry, stop, and target were all defined before execution",
        "Trade was managed per the plan (no stop moves, no impulse exits)",
        "Post-trade review completed within 30 minutes of exit"
      ],
      "maxScore": 4
    },
    "submissionInstructions": "Attach your entry screenshot, exit screenshot, and completed trade plan to your journal entry. Grade yourself honestly using the rubric above.",
    "simulatorOptions": [
      "ThinkorSwim Paper Money",
      "Tastytrade Sandbox",
      "TradeStation Sim"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- Block 6/6 — reflection
INSERT INTO academy_lesson_blocks (lesson_id, block_type, position, title, content_json)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  'reflection'::academy_block_type,
  6,
  'What the Paper Trade Revealed About Your Process',
  '{
    "title": "What the Paper Trade Revealed About Your Process",
    "journalPrompt": "After completing your first paper trade, what was the hardest part of following your plan? What would you do differently on the next paper trade to make the process cleaner?",
    "selfAssessmentQuestions": [
      "Did I write down all five trade plan components before entering?",
      "Did I exit at my stop, or did I hold hoping for a recovery?",
      "Did I review the trade within 30 minutes and grade it honestly?"
    ]
  }'::jsonb
)
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type   = EXCLUDED.block_type,
  title        = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at   = now();

-- ============================================================================
-- 7. COMPETENCY LINKS
-- ============================================================================

-- Lesson: understanding-trading-emotions
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  (SELECT id FROM academy_competencies WHERE key = 'trading_psychology'),
  1.0
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'understanding-trading-emotions'),
  (SELECT id FROM academy_competencies WHERE key = 'review_reflection'),
  0.5
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- Lesson: building-a-trading-routine
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  (SELECT id FROM academy_competencies WHERE key = 'trading_psychology'),
  1.0
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'building-a-trading-routine'),
  (SELECT id FROM academy_competencies WHERE key = 'market_context'),
  0.5
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- Lesson: your-first-paper-trade
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  (SELECT id FROM academy_competencies WHERE key = 'entry_validation'),
  0.8
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  (SELECT id FROM academy_competencies WHERE key = 'exit_discipline'),
  0.8
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES (
  (SELECT id FROM academy_lessons WHERE slug = 'your-first-paper-trade'),
  (SELECT id FROM academy_competencies WHERE key = 'review_reflection'),
  0.5
)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- ============================================================================
-- 8. ASSESSMENTS AND ASSESSMENT ITEMS
--
-- One formative assessment per lesson with 3 items each.
-- Assessment records use SELECT + NOT EXISTS to avoid duplicates.
-- Items use UNIQUE (assessment_id, position) with ON CONFLICT DO UPDATE.
-- ============================================================================

-- ── Lesson: understanding-trading-emotions ────────────────────────────────────

INSERT INTO academy_assessments (lesson_id, title, assessment_type, mastery_threshold, is_published, metadata)
SELECT
  l.id,
  'Understanding Trading Emotions — Check',
  'formative'::academy_assessment_type,
  0.75,
  true,
  '{}'::jsonb
FROM academy_lessons l
WHERE l.slug = 'understanding-trading-emotions'
  AND NOT EXISTS (
    SELECT 1 FROM academy_assessments a
    WHERE a.lesson_id = l.id
      AND a.title = 'Understanding Trading Emotions — Check'
  );

-- Item 1/3 — single_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'trading_psychology'),
  'single_select'::academy_assessment_item_type,
  'A trader has a profitable position open. The trade has hit its first target and their plan calls for taking half off. Instead, they cancel the limit order thinking this could double. Which primary trading emotion is driving this decision?',
  '{
    "options": [
      { "id": "A", "text": "Fear" },
      { "id": "B", "text": "Greed" },
      { "id": "C", "text": "Hope" },
      { "id": "D", "text": "Regret" }
    ],
    "correct": "B",
    "explanation": "Greed causes traders to override profit targets and hold positions beyond the plan in pursuit of larger gains."
  }'::jsonb,
  1,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'understanding-trading-emotions'
  AND a.title = 'Understanding Trading Emotions — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- Item 2/3 — multi_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'trading_psychology'),
  'multi_select'::academy_assessment_item_type,
  'Which of the following behaviors are signs of fear-driven trading? (Select all that apply)',
  '{
    "options": [
      { "id": "A", "text": "Exiting a position 2 minutes after entry because price dipped $30, well before the stop" },
      { "id": "B", "text": "Adding contracts to a winning position at a new breakout level" },
      { "id": "C", "text": "Skipping a valid setup because last week similar setup lost" },
      { "id": "D", "text": "Holding a loser past the stop while telling yourself it will recover" },
      { "id": "E", "text": "Reducing size by 50% despite no change in setup quality after a recent losing day" }
    ],
    "correct": ["A", "C", "E"],
    "explanation": "Fear manifests as premature exits (A), avoidance of valid setups after losses (C), and irrational size reduction (E). Adding to a winner (B) can be systematic, not fear-driven. Holding a loser past stop (D) is driven by hope, not fear."
  }'::jsonb,
  2,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'understanding-trading-emotions'
  AND a.title = 'Understanding Trading Emotions — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- Item 3/3 — single_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'review_reflection'),
  'single_select'::academy_assessment_item_type,
  'According to the lesson, what is the FIRST step toward controlling trading emotions?',
  '{
    "options": [
      { "id": "A", "text": "Setting tighter stops so losses are automatically capped" },
      { "id": "B", "text": "Trading smaller size to reduce emotional pressure" },
      { "id": "C", "text": "Developing real-time awareness of your emotional state" },
      { "id": "D", "text": "Only trading when VIX is below 20" }
    ],
    "correct": "C",
    "explanation": "The lesson states that awareness is the first step to control. Without recognising which emotion is active, no mitigation strategy can be applied."
  }'::jsonb,
  3,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'understanding-trading-emotions'
  AND a.title = 'Understanding Trading Emotions — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- ── Lesson: building-a-trading-routine ───────────────────────────────────────

INSERT INTO academy_assessments (lesson_id, title, assessment_type, mastery_threshold, is_published, metadata)
SELECT
  l.id,
  'Building a Trading Routine — Check',
  'formative'::academy_assessment_type,
  0.75,
  true,
  '{}'::jsonb
FROM academy_lessons l
WHERE l.slug = 'building-a-trading-routine'
  AND NOT EXISTS (
    SELECT 1 FROM academy_assessments a
    WHERE a.lesson_id = l.id
      AND a.title = 'Building a Trading Routine — Check'
  );

-- Item 1/3 — single_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'trading_psychology'),
  'single_select'::academy_assessment_item_type,
  'According to the Three-Part Trading Day framework, when should a trader rate their emotional readiness?',
  '{
    "options": [
      { "id": "A", "text": "Immediately after the first trade of the session" },
      { "id": "B", "text": "During pre-market preparation, before the market opens" },
      { "id": "C", "text": "Only if they have suffered a losing trade the prior day" },
      { "id": "D", "text": "After reviewing the economic calendar but before marking chart levels" }
    ],
    "correct": "B",
    "explanation": "The emotional readiness check is the final pre-market step and gates position sizing for the entire session. It must happen before the market opens."
  }'::jsonb,
  1,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'building-a-trading-routine'
  AND a.title = 'Building a Trading Routine — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- Item 2/3 — multi_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'market_context'),
  'multi_select'::academy_assessment_item_type,
  'Which of the following are components of an effective pre-market preparation routine? (Select all that apply)',
  '{
    "options": [
      { "id": "A", "text": "Reviewing overnight futures direction and gap" },
      { "id": "B", "text": "Checking social media for other traders opinions" },
      { "id": "C", "text": "Marking key support and resistance levels on the chart" },
      { "id": "D", "text": "Checking VIX for position sizing context" },
      { "id": "E", "text": "Writing a directional bias and two scenario plans" },
      { "id": "F", "text": "Setting a daily max loss limit" }
    ],
    "correct": ["A", "C", "D", "E", "F"],
    "explanation": "All listed options except (B) are valid pre-market components. Checking social media for other traders opinions introduces noise and can override your own objective analysis."
  }'::jsonb,
  2,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'building-a-trading-routine'
  AND a.title = 'Building a Trading Routine — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- Item 3/3 — single_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'trading_psychology'),
  'single_select'::academy_assessment_item_type,
  'A trader rates their emotional readiness at 4 out of 10 before the open. According to the model routine, what is the appropriate action?',
  '{
    "options": [
      { "id": "A", "text": "Skip trading entirely for the day" },
      { "id": "B", "text": "Trade normal size but set tighter stops" },
      { "id": "C", "text": "Reduce position size to 50% of standard" },
      { "id": "D", "text": "Wait until 10:30 AM to see if the feeling improves before deciding" }
    ],
    "correct": "C",
    "explanation": "The model routine states: emotional readiness below 6 means reduce to 50% size. This keeps the trader engaged while limiting damage from potentially impaired decision-making."
  }'::jsonb,
  3,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'building-a-trading-routine'
  AND a.title = 'Building a Trading Routine — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- ── Lesson: your-first-paper-trade ───────────────────────────────────────────

INSERT INTO academy_assessments (lesson_id, title, assessment_type, mastery_threshold, is_published, metadata)
SELECT
  l.id,
  'Your First Paper Trade — Check',
  'formative'::academy_assessment_type,
  0.75,
  true,
  '{}'::jsonb
FROM academy_lessons l
WHERE l.slug = 'your-first-paper-trade'
  AND NOT EXISTS (
    SELECT 1 FROM academy_assessments a
    WHERE a.lesson_id = l.id
      AND a.title = 'Your First Paper Trade — Check'
  );

-- Item 1/3 — single_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'entry_validation'),
  'single_select'::academy_assessment_item_type,
  'According to the Five Stages of a Complete Paper Trade, which stages must be completed BEFORE touching the simulator?',
  '{
    "options": [
      { "id": "A", "text": "Stage 1: Setup Identification only" },
      { "id": "B", "text": "Stages 1 and 2: Setup Identification AND Trade Planning" },
      { "id": "C", "text": "Stage 3: Entry Execution" },
      { "id": "D", "text": "Stage 5: Post-Trade Review" }
    ],
    "correct": "B",
    "explanation": "Both Stage 1 (identifying the setup) and Stage 2 (writing down entry, stop, target, size, and max dollar risk) must be completed before opening the simulator. Entering without a written plan is not a structured paper trade."
  }'::jsonb,
  1,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'your-first-paper-trade'
  AND a.title = 'Your First Paper Trade — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- Item 2/3 — single_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'exit_discipline'),
  'single_select'::academy_assessment_item_type,
  'During a paper trade, price moves to your stop level. What should you do?',
  '{
    "options": [
      { "id": "A", "text": "Move the stop 10 points lower to give the trade more room" },
      { "id": "B", "text": "Hold the position — paper trading losses are not real" },
      { "id": "C", "text": "Exit the position at the stop as planned" },
      { "id": "D", "text": "Add more contracts to lower your average cost" }
    ],
    "correct": "C",
    "explanation": "The purpose of paper trading is to practice following your plan. Exiting at the stop in paper trading builds the reflex that will save your account in live trading. Options A, B, and D all represent exactly the behaviors paper trading is designed to eliminate."
  }'::jsonb,
  2,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'your-first-paper-trade'
  AND a.title = 'Your First Paper Trade — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- Item 3/3 — multi_select
INSERT INTO academy_assessment_items (
  assessment_id, competency_id, item_type, prompt, answer_key_json, position, metadata
)
SELECT
  a.id,
  (SELECT id FROM academy_competencies WHERE key = 'review_reflection'),
  'multi_select'::academy_assessment_item_type,
  'Which of the following should be included in an effective post-trade paper trade review? (Select all that apply)',
  '{
    "options": [
      { "id": "A", "text": "Whether you followed your pre-defined entry, stop, and target" },
      { "id": "B", "text": "The total dollar profit made during the session" },
      { "id": "C", "text": "Your emotional state at the time of each key decision" },
      { "id": "D", "text": "One specific improvement you will apply on the next trade" },
      { "id": "E", "text": "A grade for plan adherence (not outcome)" }
    ],
    "correct": ["A", "C", "D", "E"],
    "explanation": "Effective review focuses on process, not just outcome. Plan adherence (A), emotional state (C), one improvement (D), and a process grade (E) are all process-oriented. Total dollar profit (B) in paper trading is secondary — it is not real money and can mislead if the process was poor."
  }'::jsonb,
  3,
  '{}'::jsonb
FROM academy_assessments a
JOIN academy_lessons l ON l.id = a.lesson_id
WHERE l.slug = 'your-first-paper-trade'
  AND a.title = 'Your First Paper Trade — Check'
ON CONFLICT (assessment_id, position) DO UPDATE SET
  prompt          = EXCLUDED.prompt,
  answer_key_json = EXCLUDED.answer_key_json,
  updated_at      = now();

-- ============================================================================
-- 9. MODULE SUMMATIVE ASSESSMENTS
-- ============================================================================

INSERT INTO academy_assessments (module_id, title, assessment_type, mastery_threshold, is_published, metadata)
SELECT
  m.id,
  'Psychology of Trading Mastery Check',
  'summative'::academy_assessment_type,
  0.75,
  true,
  '{}'::jsonb
FROM academy_modules m
WHERE m.slug = 'psychology-of-trading'
  AND NOT EXISTS (
    SELECT 1 FROM academy_assessments a
    WHERE a.module_id = m.id
      AND a.title = 'Psychology of Trading Mastery Check'
      AND a.assessment_type = 'summative'::academy_assessment_type
  );

INSERT INTO academy_assessments (module_id, title, assessment_type, mastery_threshold, is_published, metadata)
SELECT
  m.id,
  'First Steps in Trading Mastery Check',
  'summative'::academy_assessment_type,
  0.75,
  true,
  '{}'::jsonb
FROM academy_modules m
WHERE m.slug = 'first-steps-in-trading'
  AND NOT EXISTS (
    SELECT 1 FROM academy_assessments a
    WHERE a.module_id = m.id
      AND a.title = 'First Steps in Trading Mastery Check'
      AND a.assessment_type = 'summative'::academy_assessment_type
  );

COMMIT;
