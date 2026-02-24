-- ============================================================================
-- File: 20260224200001_academy_overhaul_tracks2_3_seed.sql
-- Phase: Academy Overhaul – Phase 2, Slice 2B
-- Purpose: Seed Track 2 (technical-analysis) and Track 3 (options-mastery)
--          with modules, lessons (3 blocks each), and competency links.
-- Idempotency: ON CONFLICT (slug) DO UPDATE for modules/lessons;
--              ON CONFLICT DO NOTHING for blocks and competency links.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTEND ENUM: add text_explanation and key_concept block types
-- ============================================================================

ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'text_explanation';
ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'key_concept';

-- ============================================================================
-- 2. COMPETENCIES (idempotent)
-- ============================================================================

INSERT INTO academy_competencies (key, title, description, domain, metadata)
VALUES
  ('market_context',      'Market Context',       'Evaluate session structure and context before taking risk.',                'analysis',  '{}'::jsonb),
  ('entry_validation',    'Entry Validation',     'Confirm setup quality and invalidation before execution.',                  'execution', '{}'::jsonb),
  ('exit_discipline',     'Exit Discipline',      'Execute planned exits under pressure without drift.',                       'risk',      '{}'::jsonb),
  ('review_reflection',   'Review Reflection',    'Use post-trade review to improve repeatability.',                          'improvement','{}'::jsonb),
  ('volatility_mechanics','Volatility Mechanics', 'Understand IV, VIX, skew, and term structure.',                            'analysis',  '{}'::jsonb),
  ('options_pricing',     'Options Pricing',      'Model and interpret option premiums, intrinsic/extrinsic value.',           'options',   '{}'::jsonb),
  ('options_strategies',  'Options Strategies',   'Select and manage options structures for defined-risk outcomes.',           'options',   '{}'::jsonb),
  ('risk_management',     'Risk Management',      'Size positions and manage portfolio risk within defined limits.',           'risk',      '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. TRACK 2: TECHNICAL ANALYSIS
-- ============================================================================

INSERT INTO academy_tracks (program_id, code, title, description, position, is_active, metadata)
VALUES (
  (SELECT id FROM academy_programs WHERE code = 'titm-core-program'),
  'technical-analysis',
  'Technical Analysis',
  'Master chart reading, indicators, and price-action patterns for high-probability setups.',
  2, true, '{}'::jsonb
)
ON CONFLICT (program_id, code) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  position    = EXCLUDED.position,
  is_active   = EXCLUDED.is_active,
  updated_at  = now();

-- ============================================================================
-- MODULE 2.1: Chart Reading Fundamentals (position 0)
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'technical-analysis'),
  'chart-reading-fundamentals',
  'chart-reading-fundamentals',
  'Chart Reading Fundamentals',
  'Build the foundation of chart literacy: candlesticks, levels, trends, and volume.',
  '["Interpret candlestick anatomy and basic patterns","Identify support and resistance zones","Recognize trend structure across time frames","Read volume to confirm or question price moves"]'::jsonb,
  48, 0, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ---- Lesson 2.1.1: candlestick-anatomy (position 0, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'candlestick-anatomy',
  'Candlestick Anatomy',
  'Identify the four OHLC components of a candlestick and interpret basic single-candle signals',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["market_context","entry_validation"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A candlestick shows four price points for a single time period: **Open**, **High**, **Low**, and **Close**. The body (rectangle) spans from open to close; the wicks extend to the high and low. A green/bullish candle means close > open; red/bearish means close < open. The size of the body relative to the wicks reveals the strength of buying or selling pressure during that period."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
    'key_concept'::academy_block_type,
    '{"title": "Three Candles Every Trader Must Know", "summary": "The **Doji** (open ≈ close) signals indecision. The **Hammer** (small body, long lower wick at support) signals potential bullish reversal. The **Engulfing** (second candle body fully covers the first) signals a momentum shift. All three gain significance only at key price levels."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
    'flashcard_deck'::academy_block_type,
    '{"config": {"cards": [{"front": "Green candle with no upper wick and a long lower wick at support", "back": "Bullish Hammer — signals potential reversal; buyers absorbed all selling pressure"}, {"front": "Two candles: small red followed by large green that fully covers it", "back": "Bullish Engulfing — buyers overpowered sellers; high-probability reversal signal at support"}, {"front": "Candle where open and close are identical", "back": "Doji — indecision; neither side won the period"}]}, "instructions": "Flip each card and identify the candlestick pattern from the description."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.1.2: support-and-resistance (position 1, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'support-and-resistance',
  'Support and Resistance',
  'Identify horizontal support and resistance zones and understand polarity flips',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["market_context","entry_validation"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
    'text_explanation'::academy_block_type,
    '{"markdown": "**Support** is a price level where buying pressure historically halts a decline. **Resistance** is where selling pressure halts an advance. These levels form because of market memory — traders recall where they entered or exited. A level grows stronger with each additional price test. When a resistance level is broken convincingly, it often becomes new support — this is called a **polarity flip**."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
    'key_concept'::academy_block_type,
    '{"title": "Grading Level Strength", "summary": "Not all levels are equal. A strong level has: (1) at least 3 prior touches, (2) significant volume at those touches, (3) a clean reaction (not gradual), and (4) alignment with round numbers or prior significant swing highs/lows. Weak levels — especially those only visible on 1-minute charts — should be ignored in favor of higher time frame structure."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
    'market_context_tagger'::academy_block_type,
    '{"config": {"chart": "SPX_daily_annotated", "levelTypes": ["strong_support", "weak_support", "strong_resistance", "weak_resistance"]}, "instructions": "Tag each highlighted price zone on the SPX chart as strong support, weak support, strong resistance, or weak resistance. Justify your classification based on number of touches and volume."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.1.3: trend-identification (position 2, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'trend-identification',
  'Trend Identification',
  'Define uptrends, downtrends, and ranges using swing highs and lows',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["market_context","entry_validation"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'trend-identification'),
    'text_explanation'::academy_block_type,
    '{"markdown": "An **uptrend** is a series of higher highs (HH) and higher lows (HL). A **downtrend** is lower lows (LL) and lower highs (LH). A **range** is when price oscillates between two horizontal levels without forming a clear sequence of HH/HL or LL/LH. The trend is determined by the **most recent completed swing**, not by drawing a line from the lowest to the highest point."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'trend-identification'),
    'key_concept'::academy_block_type,
    '{"title": "Trend Changes Start with a Break of Structure", "summary": "An uptrend is broken when price makes a **Lower Low** — breaking below the most recent HL. This is called a Break of Structure (BOS). Until that happens, the trend is still up regardless of how \"extended\" price looks. Trading with the trend on the higher time frame dramatically improves probability on lower time frame entries."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'trend-identification'),
    'timed_challenge'::academy_block_type,
    '{"config": {"timeSeconds": 60, "questions": [{"chart": "SPX_5min_1", "question": "Is this chart showing an uptrend, downtrend, or range?", "answer": "uptrend", "hint": "Look for the sequence of swing highs and lows"}, {"chart": "SPX_5min_2", "question": "Has a Break of Structure occurred?", "answer": "yes", "hint": "Did price break the most recent higher low?"}]}, "instructions": "Classify each chart in under 60 seconds. Speed builds the pattern recognition muscle used in live trading."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.1.4: volume-analysis (position 3, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'volume-analysis',
  'Volume Analysis',
  'Use volume to confirm price moves and detect divergences',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["market_context","entry_validation"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'volume-analysis'),
    'text_explanation'::academy_block_type,
    '{"markdown": "Volume is the number of shares or contracts traded in a given period. **Rising price + rising volume** confirms institutional participation — the move is likely to continue. **Rising price + falling volume** signals weakening conviction — a potential reversal or consolidation ahead. Volume spikes at key levels (breakouts, bounces) indicate a decision point where large players are active."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'volume-analysis'),
    'key_concept'::academy_block_type,
    '{"title": "Volume Profile and VWAP", "summary": "Volume Profile maps traded volume at each price level, not each time bar. The **Point of Control (POC)** — the price with the most volume — acts as a magnet. **VWAP** (Volume-Weighted Average Price) is the average price weighted by volume; institutional algorithms often use it as a fair-value reference. Price above VWAP is bullish bias intraday; below is bearish bias."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'volume-analysis'),
    'what_went_wrong'::academy_block_type,
    '{"config": {"scenario": "A trader enters a long position as SPX breaks above 4500. The breakout candle closes above the level, but volume is 40% below the 20-period average. The trade fails within 3 bars.", "errorOptions": ["Stop was too wide", "Volume did not confirm the breakout", "Entry was at resistance not support", "Position size was too large"], "correctError": "Volume did not confirm the breakout"}, "instructions": "Analyze the failed trade scenario and identify the primary reason it did not work."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MODULE 2.2: Indicators and Oscillators (position 1)
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'technical-analysis'),
  'indicators-and-oscillators',
  'indicators-and-oscillators',
  'Indicators and Oscillators',
  'Apply moving averages, RSI, MACD, and multi-indicator setups to identify high-probability entries.',
  '["Use moving averages for trend and dynamic S/R","Apply RSI and MACD for momentum confirmation","Build a non-redundant indicator stack"]'::jsonb,
  48, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ---- Lesson 2.2.1: moving-averages (position 0, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'moving-averages',
  'Moving Averages',
  'Distinguish SMA from EMA and apply them as trend filters and dynamic support/resistance',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["market_context","entry_validation"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A **Simple Moving Average (SMA)** is the arithmetic mean of the last N closes. An **Exponential Moving Average (EMA)** weights recent prices more heavily, making it more reactive. The **20 EMA** tracks short-term trend; the **50 SMA** is intermediate; the **200 SMA** is long-term. Price above the 200 SMA = bullish macro bias. Moving averages also act as **dynamic support/resistance** — trending stocks often bounce off the 20 EMA."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
    'key_concept'::academy_block_type,
    '{"title": "Golden Cross and Death Cross", "summary": "A **Golden Cross** — 50 SMA crossing above 200 SMA — is a lagging but reliable bullish signal. A **Death Cross** is the reverse, bearish. These are not timing tools but trend confirmation tools. Use them to set your macro bias, then use shorter-period MAs (20 EMA, 8 EMA) to time entries in the direction of the cross."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
    'flashcard_deck'::academy_block_type,
    '{"config": {"cards": [{"front": "50 SMA crosses above the 200 SMA", "back": "Golden Cross — bullish signal; suggests long-term trend may be shifting upward"}, {"front": "Price is above the 20 EMA in a trending market and pulls back to touch it", "back": "Pullback-to-EMA setup — a common high-probability long entry in uptrends"}, {"front": "SMA vs EMA: which reacts faster to recent price changes?", "back": "EMA — because it weights recent closes more heavily than older closes"}]}, "instructions": "Review each card and test your recall of moving average concepts."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.2.2: rsi-and-momentum (position 1, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'rsi-and-momentum',
  'RSI and Momentum',
  'Use RSI to gauge momentum, spot divergences, and avoid overbought/oversold traps',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["entry_validation","review_reflection"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'rsi-and-momentum'),
    'text_explanation'::academy_block_type,
    '{"markdown": "**RSI (Relative Strength Index)** measures the speed and change of price movements on a 0–100 scale. Above 70 = traditionally overbought; below 30 = oversold. However, in strong trends RSI can remain extreme for extended periods — so use these levels as alerts, not automatic trade signals. The real power of RSI is in **divergence**: when price makes a new high but RSI makes a lower high, momentum is fading and a reversal is more likely."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'rsi-and-momentum'),
    'key_concept'::academy_block_type,
    '{"title": "RSI Divergence as a Trade Filter", "summary": "**Bearish divergence**: price makes higher highs, RSI makes lower highs — momentum weakening, avoid new longs. **Bullish divergence**: price makes lower lows, RSI makes higher lows — selling is exhausting, consider longs at support. Divergences are higher quality when they form on 1H or 4H charts and align with a key S/R level."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'rsi-and-momentum'),
    'timed_challenge'::academy_block_type,
    '{"config": {"timeSeconds": 90, "questions": [{"chart": "RSI_divergence_1", "question": "Does this chart show bullish or bearish RSI divergence?", "answer": "bearish", "hint": "Price made a higher high — did RSI also?"}, {"chart": "RSI_divergence_2", "question": "RSI is at 72 in a strong uptrend. Should you immediately sell?", "answer": "no", "hint": "Overbought can stay overbought in a strong trend"}]}, "instructions": "Identify the RSI condition in each chart within 90 seconds."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.2.3: macd-deep-dive (position 2, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'macd-deep-dive',
  'MACD Deep Dive',
  'Interpret MACD line, signal line, and histogram to confirm trend direction and momentum shifts',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["entry_validation","market_context"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'macd-deep-dive'),
    'text_explanation'::academy_block_type,
    '{"markdown": "MACD has three components: the **MACD line** (12 EMA minus 26 EMA), the **Signal line** (9-period EMA of MACD), and the **Histogram** (MACD minus Signal). MACD above zero = bullish (short-term average above long-term). A **bullish crossover** — MACD crossing above the signal line — is an entry trigger. The **histogram** shows momentum: growing bars = accelerating move; shrinking bars = slowing move, potential reversal."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'macd-deep-dive'),
    'key_concept'::academy_block_type,
    '{"title": "MACD Works Best in Trends, Not Ranges", "summary": "In a sideways market, MACD produces frequent false crossovers. Always check if the market is trending before using MACD signals. Combine it with a trend filter (price vs 50 SMA) to eliminate range noise. MACD crossovers below zero (in bearish territory) are more reliable short signals; crossovers above zero are more reliable long signals."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'macd-deep-dive'),
    'strategy_matcher'::academy_block_type,
    '{"config": {"scenarios": [{"id": "s1", "description": "MACD crosses above signal line while both are above zero; histogram expanding", "correctStrategy": "High-probability long entry — trend and momentum aligned"}, {"id": "s2", "description": "MACD crosses above signal line in a sideways range; price at mid-range", "correctStrategy": "Low-probability — avoid; MACD unreliable in ranges"}, {"id": "s3", "description": "Histogram shrinking for 3 consecutive bars while price still rising", "correctStrategy": "Early warning of momentum fade — tighten stops on longs"}]}, "instructions": "Match each MACD scenario to the correct trading interpretation."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.2.4: combining-indicators (position 3, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'combining-indicators',
  'Combining Indicators',
  'Build a non-redundant indicator stack by combining trend, momentum, and volume categories',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["entry_validation","review_reflection"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
    'text_explanation'::academy_block_type,
    '{"markdown": "Indicators fall into four categories: **Trend** (MA, MACD), **Momentum** (RSI, Stochastic), **Volatility** (Bollinger Bands, ATR), and **Volume** (VWAP, OBV). Using two from the same category — RSI and Stochastic — adds no new information. A non-redundant stack picks one from different categories. A classic setup: 20 EMA (trend) + RSI (momentum) + VWAP (volume-weighted value). Three independent lenses pointing the same direction = high confluence."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
    'key_concept'::academy_block_type,
    '{"title": "The Law of Diminishing Returns", "summary": "Adding more indicators does not make a setup more reliable — it adds complexity and conflict. Studies consistently show traders with 2–3 indicators outperform those with 6+. The goal is **confluence** (independent signals agreeing), not redundancy. If your indicators frequently contradict each other, you have too many or you are using the wrong ones for your time frame."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
    'strategy_matcher'::academy_block_type,
    '{"config": {"scenarios": [{"id": "s1", "description": "RSI + Stochastic both showing oversold on 5M chart", "correctStrategy": "Redundant — both are momentum oscillators; only one needed"}, {"id": "s2", "description": "20 EMA (trend) + RSI 14 (momentum) + VWAP (volume reference)", "correctStrategy": "Non-redundant stack — each indicator provides unique information"}, {"id": "s3", "description": "50 SMA + 200 SMA + 20 EMA all below price", "correctStrategy": "Redundant trend filters — all confirm the same thing with no additional edge"}]}, "instructions": "Classify each indicator combination as redundant or non-redundant and explain why."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MODULE 2.3: Price Action Patterns (position 2)
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'technical-analysis'),
  'price-action-patterns',
  'price-action-patterns',
  'Price Action Patterns',
  'Recognize reversal and continuation patterns, trade breakouts, and identify traps.',
  '["Identify reversal patterns at key levels","Trade continuation patterns with measured-move targets","Distinguish true breakouts from false breakouts"]'::jsonb,
  48, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ---- Lesson 2.3.1: reversal-patterns (position 0, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'reversal-patterns',
  'Reversal Patterns',
  'Identify double tops, double bottoms, and head & shoulders patterns at key levels',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["entry_validation","exit_discipline"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
    'text_explanation'::academy_block_type,
    '{"markdown": "Reversal patterns form at the end of a trend. A **double top** (M shape) forms when price tests the same resistance twice and fails — confirmed by a break below the neckline. A **double bottom** (W shape) is the inverse at support. The **head and shoulders** is the most reliable reversal: three peaks with the middle (head) being the highest, flanked by two lower shoulders. Target = head-to-neckline distance projected below the neckline."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
    'key_concept'::academy_block_type,
    '{"title": "Volume Confirms Reversal", "summary": "A reversal pattern is much more reliable when volume **decreases** on the second test of resistance (showing sellers are losing conviction) and then **expands** on the neckline breakdown. Low-volume second tests with high-volume breakdowns signal institutional distribution. Without volume confirmation, reversal patterns fail frequently."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
    'timed_challenge'::academy_block_type,
    '{"config": {"timeSeconds": 90, "questions": [{"chart": "reversal_1", "question": "Name this reversal pattern and state whether it is bullish or bearish", "answer": "Head and shoulders — bearish"}, {"chart": "reversal_2", "question": "Is the double bottom confirmed? What is the trigger?", "answer": "Not yet — needs a neckline breakout with volume"}]}, "instructions": "Identify each reversal pattern and determine if/how it is confirmed."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.3.2: continuation-patterns (position 1, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'continuation-patterns',
  'Continuation Patterns',
  'Trade flags, pennants, and ascending triangles with measured-move targets',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["entry_validation","exit_discipline"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
    'text_explanation'::academy_block_type,
    '{"markdown": "After a sharp directional move (the pole), price often consolidates before continuing. A **bull flag** is a downward-sloping channel after an upward pole — volume decreases during the flag and expands on the breakout. A **pennant** is a small symmetrical triangle after the pole. An **ascending triangle** is a flat top resistance with rising lows. The measured-move target for each equals the pole length added to the breakout point."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
    'key_concept'::academy_block_type,
    '{"title": "The Pole-to-Target Rule", "summary": "Every continuation pattern has a **measured move**: the length of the initial pole (impulse move) added to the breakout level. Example: SPX rallies 50 points (pole), consolidates in a flag, then breaks out. Target = breakout level + 50 points. This gives you a pre-planned exit with a defined R:R before you enter. Always calculate the measured move before the entry."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
    'what_went_wrong'::academy_block_type,
    '{"config": {"scenario": "A trader buys a bull flag breakout at 4500. The pole was 30 points up. The flag resolved sideways, not down, on above-average volume. The trade immediately reverses after entry.", "errorOptions": ["Position size too large", "The pattern was not a bull flag — sideways consolidation on high volume is distribution, not a flag", "Target was set incorrectly", "Entry was too early"], "correctError": "The pattern was not a bull flag — sideways consolidation on high volume is distribution, not a flag"}, "instructions": "Identify the primary reason this continuation pattern trade failed."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.3.3: breakout-trading (position 2, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'breakout-trading',
  'Breakout Trading',
  'Execute breakout entries with confirmation and retest strategies to minimize false breakouts',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["entry_validation","exit_discipline"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A **valid breakout** has three hallmarks: (1) a **candle close** beyond the level — not just a wick, (2) **volume expansion** showing institutional participation, and (3) **prior compression** — the tighter the range before the break, the more powerful the move. The **retest entry** waits for price to break, pull back to the broken level (former resistance = new support), and bounce — reducing false breakout risk significantly."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
    'key_concept'::academy_block_type,
    '{"title": "False Breakouts Are Tradeable Too", "summary": "A **false breakout** occurs when price briefly breaches a level, traps breakout buyers, then reverses sharply. They are most common at obvious levels with many retail stops clustered. Experienced traders watch for this: if a breakout immediately stalls and reverses on high volume, that itself is a signal — fade the breakout in the opposite direction with a tight stop above the wick."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
    'market_context_tagger'::academy_block_type,
    '{"config": {"scenarios": [{"id": "b1", "chart": "breakout_valid", "tags": ["valid_breakout", "false_breakout", "retest_entry", "no_signal"]}, {"id": "b2", "chart": "breakout_false", "tags": ["valid_breakout", "false_breakout", "retest_entry", "no_signal"]}, {"id": "b3", "chart": "breakout_retest", "tags": ["valid_breakout", "false_breakout", "retest_entry", "no_signal"]}]}, "instructions": "Tag each chart scenario with the breakout type. Justify your classification using volume and candle close criteria."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 2.3.4: failed-patterns-and-traps (position 3, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'failed-patterns-and-traps',
  'Failed Patterns and Traps',
  'Recognize when patterns fail and use the failure signal as a high-probability trade in the opposite direction',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["entry_validation","review_reflection"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'failed-patterns-and-traps'),
    'text_explanation'::academy_block_type,
    '{"markdown": "**Pattern failure is information.** When a well-known pattern like a bull flag or double bottom fails to follow through, it tells you that the expected buyers are not there — or worse, that smart money is selling into them. Failed patterns often produce fast, violent moves in the opposite direction because trapped traders rush to exit. Recognizing failure early lets you either exit quickly or trade the fade."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'failed-patterns-and-traps'),
    'key_concept'::academy_block_type,
    '{"title": "The Stop-Hunt Trap", "summary": "The most common trap is the **stop hunt**: price briefly breaks a key level (triggering retail stops), then immediately reverses. This is engineered by large players accumulating inventory at the best prices. The tell: a single wick through the level with immediate rejection, often on average or below-average volume. After a stop hunt, the subsequent move in the original direction is often fast and clean."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'failed-patterns-and-traps'),
    'what_went_wrong'::academy_block_type,
    '{"config": {"scenario": "A head and shoulders pattern forms on SPX 1H. The neckline is at 4480. Price breaks below the neckline, traders short. Within 2 bars, price snaps back above 4480 and accelerates to 4510.", "errorOptions": ["The target calculation was wrong", "This was a failed H&S — the break was a stop hunt below the neckline; the correct response is to exit short immediately and potentially reverse long", "The stop was too tight", "The entry candle was too large"], "correctError": "This was a failed H&S — the break was a stop hunt below the neckline; the correct response is to exit short immediately and potentially reverse long"}, "instructions": "Identify what happened and what the correct response to the pattern failure was."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 4. TRACK 3: OPTIONS MASTERY
-- ============================================================================

INSERT INTO academy_tracks (program_id, code, title, description, position, is_active, metadata)
VALUES (
  (SELECT id FROM academy_programs WHERE code = 'titm-core-program'),
  'options-mastery',
  'Options Mastery',
  'From contract basics through the Greeks and into multi-leg strategies for any market environment.',
  3, true, '{}'::jsonb
)
ON CONFLICT (program_id, code) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  position    = EXCLUDED.position,
  is_active   = EXCLUDED.is_active,
  updated_at  = now();

-- ============================================================================
-- MODULE 3.1: Options Fundamentals (position 0)
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'options-mastery'),
  'options-fundamentals',
  'options-fundamentals',
  'Options Fundamentals',
  'Understand what options are, how they are priced, and how to navigate the options chain.',
  '["Define calls, puts, and the buyer/seller relationship","Explain intrinsic and extrinsic value","Read and interpret a real options chain"]'::jsonb,
  48, 0, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ---- Lesson 3.1.1: what-are-options (position 0, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'what-are-options',
  'What Are Options?',
  'Define an option contract and explain the rights and obligations of buyers vs sellers',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["options_pricing","volatility_mechanics"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
    'text_explanation'::academy_block_type,
    '{"markdown": "An option is a contract granting the buyer the **right, but not the obligation**, to buy (call) or sell (put) an underlying asset at a specified **strike price** before the **expiration date**. The buyer pays a **premium** for this right. The seller (writer) collects the premium but takes on the corresponding obligation. One standard equity options contract covers **100 shares**. Buyers have defined, limited risk (the premium); sellers have potentially larger risk."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
    'key_concept'::academy_block_type,
    '{"title": "Four Positions: Long/Short Call and Long/Short Put", "summary": "**Long call**: right to buy — bullish, limited risk. **Short call**: obligation to sell — bearish/neutral, unlimited risk. **Long put**: right to sell — bearish, limited risk. **Short put**: obligation to buy — bullish/neutral, limited upside. The buyer always has the right; the seller always has the obligation. Risk profiles are asymmetric between buyers and sellers."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
    'flashcard_deck'::academy_block_type,
    '{"config": {"cards": [{"front": "You buy a call option. What is your maximum loss?", "back": "The premium paid — nothing more. Buyers have defined risk."}, {"front": "You sell a naked call. What is your maximum loss?", "back": "Theoretically unlimited — the stock can rise indefinitely."}, {"front": "Does the option buyer have an obligation to exercise?", "back": "No — the buyer has the right but not the obligation. They can let it expire worthless."}]}, "instructions": "Test your understanding of option buyer vs seller dynamics."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.1.2: calls-and-puts (position 1, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'calls-and-puts',
  'Calls and Puts',
  'Describe the payoff profiles of long and short calls and puts at expiration',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["options_pricing","options_strategies"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'calls-and-puts'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A **call option** profits when the underlying rises above the strike. At expiration, intrinsic value = max(0, stock price − strike). A **put option** profits when the underlying falls below the strike. At expiration, intrinsic value = max(0, strike − stock price). If the option expires out of the money (OTM), the buyer loses the entire premium. These payoff profiles are the building blocks for every options strategy."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'calls-and-puts'),
    'key_concept'::academy_block_type,
    '{"title": "In the Money, At the Money, Out of the Money", "summary": "A call is **ITM** when stock price > strike. A put is ITM when stock price < strike. **ATM** = stock price ≈ strike. **OTM** = no intrinsic value. ITM options are more expensive but have higher delta. OTM options are cheaper but need a larger move to profit. ATM options are the most sensitive to time and volatility changes."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'calls-and-puts'),
    'options_chain_simulator'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "expirationDays": 7, "strikesToShow": [4450, 4475, 4500, 4525, 4550], "task": "identify_itm_atm_otm"}, "instructions": "Using the simulated SPX options chain, identify which call and put strikes are ITM, ATM, and OTM at the current price of 4500."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.1.3: options-pricing-basics (position 2, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'options-pricing-basics',
  'Options Pricing Basics',
  'Explain intrinsic value, extrinsic value, and the five factors that drive option premiums',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["options_pricing","volatility_mechanics"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'options-pricing-basics'),
    'text_explanation'::academy_block_type,
    '{"markdown": "An option premium = **Intrinsic Value** + **Extrinsic Value**. Intrinsic = how much it is currently ITM. Extrinsic (time value) = the rest — it represents the probability of the option gaining more value before expiration. Five factors drive premiums: (1) underlying price vs strike, (2) time to expiration, (3) **implied volatility (IV)** — the most tradeable factor, (4) interest rates, (5) dividends. Higher IV inflates both calls and puts."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'options-pricing-basics'),
    'key_concept'::academy_block_type,
    '{"title": "Implied Volatility Is the Market''s Price of Uncertainty", "summary": "IV is derived from the option price itself — it is what the market implies about future volatility. High IV = expensive options (good for sellers). Low IV = cheap options (good for buyers). **IV Rank** (IVR) compares current IV to its 52-week range. IVR above 50 favors selling premium; below 20 favors buying. Understanding IV is what separates professional options traders from amateurs."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'options-pricing-basics'),
    'payoff_diagram_builder'::academy_block_type,
    '{"config": {"instrument": "long_call", "underlying": "SPX", "strike": 4500, "premium": 30, "expiration": "7DTE"}, "instructions": "Use the payoff diagram builder to visualize the P&L of a long 4500 call at different SPX prices at expiration. Identify the breakeven point and the maximum loss."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.1.4: the-options-chain (position 3, beginner) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'the-options-chain',
  'The Options Chain',
  'Navigate a real options chain to find strikes, expirations, bid/ask, and open interest',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["options_pricing","options_strategies"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'the-options-chain'),
    'text_explanation'::academy_block_type,
    '{"markdown": "The **options chain** displays all available contracts for an underlying, organized by expiration and strike. Each row shows: **Bid** (what buyers will pay), **Ask** (what sellers want), **Last** price, **Volume** (today''s trades), **Open Interest** (total outstanding contracts), and the **Greeks** (Delta, Gamma, Theta, Vega). Always use limit orders at or near the **mid-price** (bid + ask ÷ 2). Low open interest or a wide bid-ask spread indicates an illiquid contract to avoid."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'the-options-chain'),
    'key_concept'::academy_block_type,
    '{"title": "How to Choose the Right Expiration", "summary": "Short expirations (0–7 DTE) have fast theta decay — better for sellers, very risky for buyers. 30–60 DTE is the sweet spot for directional buyers: enough time for the thesis to play out without overpaying. For earnings trades, use the expiration immediately after the event to capture the IV expansion. Always check that the expiration has **adequate open interest** before trading."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'the-options-chain'),
    'options_chain_simulator'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "expirations": ["0DTE", "7DTE", "30DTE"], "task": "select_appropriate_contract", "scenario": "You are bullish on SPX for the next 2 weeks. IV Rank is 20 (low)."}, "instructions": "Using the simulated options chain, select the expiration and strike that best fits the scenario. Explain why you chose that contract."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MODULE 3.2: The Greeks (position 1)
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'options-mastery'),
  'the-greeks',
  'the-greeks',
  'The Greeks',
  'Master Delta, Gamma, Theta, and Vega to manage options positions with precision.',
  '["Calculate and interpret Delta, Gamma, Theta, Vega","Use Greeks to quantify and manage position risk","Anticipate how Greeks shift with price, time, and volatility changes"]'::jsonb,
  48, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ---- Lesson 3.2.1: delta-and-gamma (position 0, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'delta-and-gamma',
  'Delta and Gamma',
  'Explain delta as directional exposure and gamma as the acceleration of that exposure',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["options_pricing","volatility_mechanics"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
    'text_explanation'::academy_block_type,
    '{"markdown": "**Delta** measures how much an option price changes per $1 move in the underlying. Calls have positive delta (0 to +1); puts have negative delta (0 to −1). An ATM call has delta ≈ 0.50. Delta also approximates the probability of expiring ITM. Portfolio delta = sum of all position deltas = your net directional exposure. **Gamma** is the rate at which delta changes — high gamma near expiration means delta can shift dramatically on small moves."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
    'key_concept'::academy_block_type,
    '{"title": "Gamma Risk in the Final Week", "summary": "Gamma spikes in the final 7 days before expiration, especially for ATM options. A 0.50-delta ATM option can go to 0.90 delta on a 5-point move in the last day. This amplifies gains but also losses. Short gamma positions (option sellers) face explosive losses when held into expiration during large moves. Long gamma (option buyers) benefit from large moves near expiry."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
    'greeks_dashboard'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "contract": {"type": "call", "strike": 4500, "dte": 7}, "task": "observe_delta_gamma_shift", "priceMovements": [-20, -10, 0, 10, 20, 30]}, "instructions": "Use the Greeks dashboard to observe how delta and gamma change as SPX moves from -20 to +30 points relative to the 4500 strike. Note when gamma peaks."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.2.2: theta-and-time-decay (position 1, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'theta-and-time-decay',
  'Theta and Time Decay',
  'Quantify how theta erodes option value over time and use this to inform entry timing',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["options_pricing","risk_management"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'theta-and-time-decay'),
    'text_explanation'::academy_block_type,
    '{"markdown": "**Theta** is the daily dollar decay of an option''s extrinsic value, all else equal. ATM options have the highest theta because they have the most extrinsic value. Theta decay is **non-linear** — it accelerates sharply in the final 2 weeks before expiration (the theta curve is convex). An option losing $1/day at 30 DTE might lose $3+/day at 5 DTE. Theta is the primary income source for option sellers and the primary enemy of option buyers."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'theta-and-time-decay'),
    'key_concept'::academy_block_type,
    '{"title": "The 30-60 DTE Sweet Spot for Sellers", "summary": "Premium sellers typically target 30–60 DTE because theta decay is meaningful but not yet at maximum acceleration. They plan to close at 50% profit (typically in 15–30 days) before gamma risk grows. This is why the most popular income strategies (credit spreads, iron condors) use monthly expirations in the 30–45 DTE window — it balances premium collected vs time to react to adverse moves."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'theta-and-time-decay'),
    'greeks_dashboard'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "contract": {"type": "call", "strike": 4500, "iv": 0.15}, "task": "observe_theta_decay", "dteValues": [45, 30, 21, 14, 7, 3, 1]}, "instructions": "Observe how the ATM 4500 call''s theta changes as DTE decreases from 45 to 1 day. Identify the DTE at which theta acceleration becomes most pronounced."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.2.3: vega-and-volatility (position 2, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'vega-and-volatility',
  'Vega and Volatility',
  'Measure vega sensitivity and anticipate how IV changes affect position value',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["volatility_mechanics","options_pricing"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'vega-and-volatility'),
    'text_explanation'::academy_block_type,
    '{"markdown": "**Vega** measures how much an option''s price changes for a 1-percentage-point change in implied volatility. Long options are **long vega** (benefit when IV rises); short options are **short vega** (benefit when IV falls). IV inflates before binary events (earnings, FOMC) and collapses after — the \"**IV crush**\". Buying options before earnings expecting a big move can still lose money if the move is smaller than the IV implied — the crush destroys extrinsic value faster than delta gains."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'vega-and-volatility'),
    'key_concept'::academy_block_type,
    '{"title": "IV Rank and the Sell/Buy Decision", "summary": "**IV Rank (IVR)** = (current IV − 52-week low) ÷ (52-week high − 52-week low) × 100. IVR 80+ means IV is near its yearly high — sell premium. IVR 20 or below means IV is near its yearly low — buy premium. Trading vega with IVR awareness is arguably the single most important edge in options over equity trading."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'vega-and-volatility'),
    'greeks_dashboard'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "contract": {"type": "call", "strike": 4500, "dte": 30}, "task": "observe_vega_iv_impact", "ivValues": [0.10, 0.15, 0.20, 0.25, 0.30]}, "instructions": "Use the Greeks dashboard to observe how the option premium and vega change as IV moves from 10% to 30%. Note how much the premium changes per 1% IV move (that is the vega)."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.2.4: greeks-in-practice (position 3, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'greeks-in-practice',
  'Greeks in Practice',
  'Apply all four Greeks together to manage a live position and make adjustment decisions',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["options_pricing","risk_management"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
    'text_explanation'::academy_block_type,
    '{"markdown": "Professional traders manage positions by monitoring aggregate Greeks. **Net delta** = directional bias. **Net gamma** = how quickly exposure will change on a move. **Net theta** = daily P&L from time decay. **Net vega** = IV sensitivity. A delta-neutral, theta-positive position (e.g., short straddle) profits from time passing without large moves. Adjustments are triggered when any Greek drifts outside a predefined acceptable range."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
    'key_concept'::academy_block_type,
    '{"title": "Greeks Change as Market Conditions Change", "summary": "Greeks are not static — they shift as price, time, and IV change. Delta increases as an option goes deeper ITM. Gamma spikes near expiration. Theta accelerates in the final week. Vega decreases as expiration approaches. This means a position that was low-risk at entry can become high-risk if held too long or through a volatility spike. Review your Greeks daily on any open position."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
    'position_builder'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "availableLegs": [{"type": "long_call", "strike": 4500, "dte": 30}, {"type": "short_call", "strike": 4530, "dte": 30}, {"type": "long_put", "strike": 4470, "dte": 30}, {"type": "short_put", "strike": 4440, "dte": 30}], "task": "build_delta_neutral_position"}, "instructions": "Using the position builder, combine the available option legs to create a delta-neutral position. Observe the combined Greeks and describe how the position would be affected by a 20-point SPX move."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MODULE 3.3: Basic Options Strategies (position 2)
-- ============================================================================

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t
   JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'options-mastery'),
  'basic-options-strategies',
  'basic-options-strategies',
  'Basic Options Strategies',
  'Learn covered calls, protective puts, vertical spreads, and how to choose the right strategy.',
  '["Execute covered calls and cash-secured puts","Build vertical debit and credit spreads","Select the appropriate strategy for any outlook and IV environment"]'::jsonb,
  48, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position          = EXCLUDED.position,
  is_published      = EXCLUDED.is_published,
  updated_at        = now();

-- ---- Lesson 3.3.1: covered-calls (position 0, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'covered-calls',
  'Covered Calls',
  'Construct and manage a covered call to generate income from an existing long stock position',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["options_strategies","risk_management"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'covered-calls'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A **covered call** means selling an OTM call against 100 shares you already own. You collect the premium upfront. If the stock stays below the strike at expiration, you keep the premium and the shares. If the stock rises above the strike, your shares get called away at the strike price — you keep the premium but miss the upside. Best used in sideways to slightly bullish markets when IV is elevated to maximize premium collected."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'covered-calls'),
    'key_concept'::academy_block_type,
    '{"title": "Maximum Profit, Loss, and Breakeven", "summary": "**Max profit** = (strike − purchase price) + premium collected. **Max loss** = purchase price − premium collected (same as owning the stock, just reduced by premium). **Breakeven** = purchase price − premium. The covered call lowers your cost basis but caps your upside. The ideal scenario: stock slowly rises toward the strike over time without exceeding it."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'covered-calls'),
    'payoff_diagram_builder'::academy_block_type,
    '{"config": {"strategy": "covered_call", "stockPurchasePrice": 4500, "callStrike": 4530, "callPremium": 15, "underlying": "SPX"}, "instructions": "Build the payoff diagram for this covered call. Identify: (1) the maximum profit, (2) the maximum loss, and (3) the breakeven price at expiration."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.3.2: protective-puts (position 1, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'protective-puts',
  'Protective Puts',
  'Use a protective put to hedge downside risk on a long stock or index position',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["options_strategies","risk_management"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'protective-puts'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A **protective put** is owning a put option against a long stock or index position — essentially portfolio insurance. If the stock falls below the put strike, your put gains value, offsetting losses in the stock. The cost is the put premium paid. A protective put is most valuable (and most expensive) during low-IV environments or ahead of uncertain events. The \"**married put**\" is a variant: buying a put simultaneously with stock purchase to define risk from the start."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'protective-puts'),
    'key_concept'::academy_block_type,
    '{"title": "Insurance vs Speculation", "summary": "A protective put is insurance, not a trade. You hope it expires worthless (like home insurance you hope never to claim). The strike determines your \"deductible\": a 5% OTM put lets the stock fall 5% before protection kicks in, at lower cost than an ATM put. The further OTM, the cheaper but the more loss you absorb before the hedge helps. Balance protection level vs cost based on your risk tolerance."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'protective-puts'),
    'payoff_diagram_builder'::academy_block_type,
    '{"config": {"strategy": "protective_put", "stockPurchasePrice": 4500, "putStrike": 4450, "putPremium": 20, "underlying": "SPX"}, "instructions": "Build the payoff diagram for this protective put. Identify: (1) the maximum loss (floor), (2) the breakeven price, and (3) how the diagram compares to simply owning the stock without the put."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.3.3: vertical-spreads (position 2, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'vertical-spreads',
  'Vertical Spreads',
  'Construct bull call spreads and bear put spreads for defined-risk directional trades',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["options_strategies","risk_management"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
    'text_explanation'::academy_block_type,
    '{"markdown": "A **vertical spread** involves buying one option and selling another at a different strike in the same expiration. **Bull call spread (debit)**: buy a lower-strike call, sell a higher-strike call. Max profit = width minus premium paid; max loss = premium paid. **Bear put spread (debit)**: buy a higher-strike put, sell a lower-strike put. Both are defined-risk. **Credit spreads** (bull put, bear call) collect premium upfront — max profit is the credit; max loss is width minus credit."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
    'key_concept'::academy_block_type,
    '{"title": "Debit vs Credit Spreads: When to Use Each", "summary": "**Debit spreads** (buy premium): better when IV is low. You pay less and the position benefits from IV expansion. **Credit spreads** (sell premium): better when IV is high. You collect more and the position benefits from IV contraction and time decay. The structure is nearly the same — only the direction of premium flow changes. Many professional traders prefer credit spreads for their theta-positive nature."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
    'position_builder'::academy_block_type,
    '{"config": {"underlying": "SPX", "currentPrice": 4500, "task": "build_bull_call_spread", "availableStrikes": [4480, 4490, 4500, 4510, 4520, 4530], "expiration": "30DTE"}, "instructions": "Use the position builder to construct a bull call spread targeting a 1:2 risk-reward ratio. Show the max profit, max loss, breakeven, and the spread width you selected."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;

-- ---- Lesson 3.3.4: choosing-right-strategy (position 3, intermediate) ----

INSERT INTO academy_lessons (
  module_id, slug, title, learning_objective,
  estimated_minutes, difficulty, prerequisite_lesson_ids,
  position, is_published, metadata
)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'choosing-right-strategy',
  'Choosing the Right Strategy',
  'Select the appropriate options strategy based on directional outlook, IV environment, and risk tolerance',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["options_strategies","risk_management"]}'::jsonb
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

INSERT INTO academy_lesson_blocks (lesson_id, block_type, content_json, position)
VALUES
  (
    (SELECT id FROM academy_lessons WHERE slug = 'choosing-right-strategy'),
    'text_explanation'::academy_block_type,
    '{"markdown": "Strategy selection is driven by three factors: (1) **Directional outlook** — bullish, bearish, or neutral; (2) **IV environment** — high IV favors selling premium, low IV favors buying; (3) **Risk tolerance** — defined risk (spreads) or undefined (naked). Framework: Bullish + Low IV = long call or call debit spread. Bullish + High IV = bull put spread (credit). Bearish + Low IV = long put or put debit spread. Bearish + High IV = bear call spread (credit). Neutral + High IV = iron condor."}'::jsonb,
    0
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'choosing-right-strategy'),
    'key_concept'::academy_block_type,
    '{"title": "Start With Defined Risk. Always.", "summary": "Until you have a proven edge across 100+ trades and a robust risk management system, use only **defined-risk strategies**. Naked options (undefined risk) can produce losses that dwarf your account size on a single move. Spreads cap your loss and force disciplined trade sizing. The limitation on upside is a small price to pay for the protection on the downside during your learning phase."}'::jsonb,
    1
  ),
  (
    (SELECT id FROM academy_lessons WHERE slug = 'choosing-right-strategy'),
    'strategy_matcher'::academy_block_type,
    '{"config": {"scenarios": [{"id": "sc1", "description": "Bullish on SPX over next 30 days. IV Rank = 15 (low). Want defined risk.", "correctStrategy": "Long call or bull call spread (debit)"}, {"id": "sc2", "description": "Neutral on SPX for next 3 weeks. IV Rank = 75 (high). Want to collect premium.", "correctStrategy": "Iron condor (credit spread on both sides)"}, {"id": "sc3", "description": "Bearish after FOMC. IV Rank = 85 (very high, about to crush). Want credit.", "correctStrategy": "Bear call spread (credit) — benefits from move down AND IV crush"}]}, "instructions": "Match each market scenario to the most appropriate options strategy. Explain your reasoning."}'::jsonb,
    2
  )
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 5. COMPETENCY LINKS — Track 2 (Technical Analysis)
-- ============================================================================

-- Module 2.1 lessons
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
   (SELECT id FROM academy_competencies WHERE key = 'market_context'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
   (SELECT id FROM academy_competencies WHERE key = 'market_context'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'trend-identification'),
   (SELECT id FROM academy_competencies WHERE key = 'market_context'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'trend-identification'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'volume-analysis'),
   (SELECT id FROM academy_competencies WHERE key = 'market_context'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'volume-analysis'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- Module 2.2 lessons
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
   (SELECT id FROM academy_competencies WHERE key = 'market_context'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'rsi-and-momentum'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'rsi-and-momentum'),
   (SELECT id FROM academy_competencies WHERE key = 'review_reflection'), 0.5)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'macd-deep-dive'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'macd-deep-dive'),
   (SELECT id FROM academy_competencies WHERE key = 'market_context'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
   (SELECT id FROM academy_competencies WHERE key = 'review_reflection'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- Module 2.3 lessons
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
   (SELECT id FROM academy_competencies WHERE key = 'exit_discipline'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
   (SELECT id FROM academy_competencies WHERE key = 'exit_discipline'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
   (SELECT id FROM academy_competencies WHERE key = 'exit_discipline'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'failed-patterns-and-traps'),
   (SELECT id FROM academy_competencies WHERE key = 'entry_validation'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'failed-patterns-and-traps'),
   (SELECT id FROM academy_competencies WHERE key = 'review_reflection'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- ============================================================================
-- 6. COMPETENCY LINKS — Track 3 (Options Mastery)
-- ============================================================================

-- Module 3.1 lessons
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
   (SELECT id FROM academy_competencies WHERE key = 'volatility_mechanics'), 0.4)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'calls-and-puts'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'calls-and-puts'),
   (SELECT id FROM academy_competencies WHERE key = 'options_strategies'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'options-pricing-basics'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'options-pricing-basics'),
   (SELECT id FROM academy_competencies WHERE key = 'volatility_mechanics'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'the-options-chain'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'the-options-chain'),
   (SELECT id FROM academy_competencies WHERE key = 'options_strategies'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- Module 3.2 lessons
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
   (SELECT id FROM academy_competencies WHERE key = 'volatility_mechanics'), 0.6)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'theta-and-time-decay'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'theta-and-time-decay'),
   (SELECT id FROM academy_competencies WHERE key = 'risk_management'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'vega-and-volatility'),
   (SELECT id FROM academy_competencies WHERE key = 'volatility_mechanics'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'vega-and-volatility'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
   (SELECT id FROM academy_competencies WHERE key = 'options_pricing'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
   (SELECT id FROM academy_competencies WHERE key = 'risk_management'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

-- Module 3.3 lessons
INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'covered-calls'),
   (SELECT id FROM academy_competencies WHERE key = 'options_strategies'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'covered-calls'),
   (SELECT id FROM academy_competencies WHERE key = 'risk_management'), 0.7)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'protective-puts'),
   (SELECT id FROM academy_competencies WHERE key = 'options_strategies'), 0.9)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'protective-puts'),
   (SELECT id FROM academy_competencies WHERE key = 'risk_management'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
   (SELECT id FROM academy_competencies WHERE key = 'options_strategies'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
   (SELECT id FROM academy_competencies WHERE key = 'risk_management'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'choosing-right-strategy'),
   (SELECT id FROM academy_competencies WHERE key = 'options_strategies'), 1.0)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'choosing-right-strategy'),
   (SELECT id FROM academy_competencies WHERE key = 'risk_management'), 0.8)
ON CONFLICT (lesson_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight;

COMMIT;
