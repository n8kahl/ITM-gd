-- ============================================================================
-- File: 20260224200001_academy_overhaul_tracks2_3_seed.sql
-- Phase: Academy Overhaul – Phase 2, Slice 2B
-- Purpose: Seed Tracks 2 (Technical Analysis) and 3 (Options Mastery)
--          with modules, lessons, and content blocks.
-- Idempotency: ON CONFLICT DO NOTHING / DO UPDATE
-- ============================================================================

BEGIN;

-- ============================================================================
-- COMPETENCIES (idempotent, overlap with other seeds)
-- ============================================================================

INSERT INTO academy_competencies (key, title, description, domain, metadata)
VALUES
  ('chart_reading',       'Chart Reading',        'Read and interpret price charts with speed and accuracy.',                  'analysis',    '{}'::jsonb),
  ('indicator_fluency',   'Indicator Fluency',    'Apply oscillators and indicators to confirm setups.',                      'analysis',    '{}'::jsonb),
  ('pattern_recognition', 'Pattern Recognition',  'Identify actionable price-action and candlestick patterns.',               'analysis',    '{}'::jsonb),
  ('options_literacy',    'Options Literacy',      'Understand options contracts, pricing, and basic mechanics.',              'options',     '{}'::jsonb),
  ('greeks_mastery',      'Greeks Mastery',        'Apply Delta, Gamma, Theta, Vega in position management.',                 'options',     '{}'::jsonb),
  ('strategy_selection',  'Strategy Selection',    'Choose the right options strategy for a given outlook and IV environment.','options',     '{}'::jsonb),
  ('trading_psychology',  'Trading Psychology',    'Manage emotions and cognitive biases to execute the trading plan.',        'mindset',     '{}'::jsonb),
  ('risk_management',     'Risk Management',       'Size positions and manage portfolio risk within defined limits.',          'risk',        '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TRACK 2: TECHNICAL ANALYSIS
-- ============================================================================

-- ---------- Module 2.1: Chart Reading Fundamentals ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'technical-analysis'),
  'chart-reading-fundamentals',
  'chart-reading-fundamentals',
  'Chart Reading Fundamentals',
  'Learn to read candlestick charts, identify support/resistance, and understand time frames.',
  '["Read candlestick charts with confidence","Identify support and resistance levels","Understand multiple time frame analysis"]'::jsonb,
  45, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 2.1.1: Candlestick Anatomy
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'candlestick-anatomy', 'Candlestick Anatomy',
  'Understand the components of a candlestick and interpret basic patterns',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
   'candlestick-anatomy-b1', 'text_explanation', 'What Is a Candlestick?',
   'A candlestick is a visual representation of price action over a specific time period. Each candle shows four data points: the **open**, **high**, **low**, and **close** (OHLC). The rectangular body represents the range between open and close, while the thin lines (wicks or shadows) show the highs and lows beyond the body. A green/white candle means close > open (bullish); a red/black candle means close < open (bearish).', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
   'candlestick-anatomy-b2', 'key_concept', 'Key Patterns to Know',
   'Single-candle patterns include the **Doji** (open ≈ close, indecision), **Hammer** (small body, long lower wick, potential reversal at support), and **Engulfing** (two-candle pattern where the second body completely "engulfs" the first). These patterns gain significance when they appear at key support/resistance levels.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'candlestick-anatomy'),
   'candlestick-anatomy-b3', 'quiz_single', 'Candlestick Quiz',
   'A candle with a very small body and a long lower shadow appearing at a support level is called a:', 2,
   '{"options":["Doji","Hammer","Engulfing","Spinning Top"],"correctIndex":1,"explanation":"A Hammer has a small body near the top and a long lower shadow, signaling potential bullish reversal at support."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.1.2: Support & Resistance
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'support-and-resistance', 'Support & Resistance',
  'Identify horizontal and dynamic support/resistance levels on charts',
  15, 'beginner'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["chart_reading","pattern_recognition"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
   'support-resistance-b1', 'text_explanation', 'Finding Key Levels',
   'Support is a price level where buying pressure tends to prevent further decline. Resistance is where selling pressure prevents further advance. These levels form because of **market memory** — traders remember prices where they made or lost money. Look for areas where price has bounced multiple times. The more touches, the more significant the level. Round numbers ($100, $200, $4500 on SPX) often act as psychological support/resistance.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
   'support-resistance-b2', 'worked_example', 'Drawing S/R on SPX',
   'Step 1: Zoom out to a daily chart. Step 2: Identify at least 3 touches at a similar price level. Step 3: Draw a horizontal line through the cluster of touches. Step 4: Note that a broken resistance often becomes new support (polarity flip). On SPX, the 4500 level served as resistance in Q3, was broken in Q4, and then held as support on the January retest.', 1, '{"steps":3}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'support-and-resistance'),
   'support-resistance-b3', 'quiz_multi', 'Support/Resistance Check',
   'Which of the following increase the significance of a support/resistance level? (Select all that apply)', 2,
   '{"options":["Multiple touches over time","High volume at the level","Round number","Only appearing on 1-minute charts"],"correctIndices":[0,1,2],"explanation":"Multiple touches, high volume, and round numbers all strengthen S/R levels. One-minute-only levels are weak and unreliable."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.1.3: Time Frame Analysis
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'time-frame-analysis', 'Time Frame Analysis',
  'Use multiple time frames to build a complete market picture',
  15, 'beginner'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["chart_reading","pattern_recognition"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'time-frame-analysis'),
   'time-frame-b1', 'text_explanation', 'The Top-Down Approach',
   'Multiple time frame (MTF) analysis means checking higher time frames before zooming in. A common stack: **Daily** → trend direction and key levels; **4H/1H** → current structure and momentum; **15M/5M** → entry timing. The higher time frame always has priority. If the daily is bearish, a bullish 5-minute setup is lower probability. Think of it as context → structure → trigger.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'time-frame-analysis'),
   'time-frame-b2', 'key_concept', 'Time Frame Alignment',
   'A trade setup has the highest probability when all three time frames agree on direction. This is called **time frame alignment** or confluence. When the daily trend is up, the 1H structure shows a higher low forming at support, and the 5M shows a bullish engulfing — that is a high-confluence long setup.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'time-frame-analysis'),
   'time-frame-b3', 'reflection', 'Your Time Frame Stack',
   'Think about the instruments you trade most. What time frame stack makes sense for your style? Write down your primary (trend), secondary (structure), and tertiary (entry) time frames and why you chose them.', 2,
   '{"minWords":30}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.1.4: Volume Analysis Basics
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'chart-reading-fundamentals'),
  'volume-analysis-basics', 'Volume Analysis Basics',
  'Interpret volume to confirm price moves and identify divergences',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'volume-analysis-basics'),
   'volume-b1', 'text_explanation', 'Volume Confirms Price',
   'Volume measures the number of shares or contracts traded in a period. **Rising price + rising volume** = strong move, likely to continue. **Rising price + falling volume** = weakening move, potential reversal ahead. Volume spikes at key levels (breakouts, reversals) show institutional participation. Low volume at a resistance test suggests the breakout may fail.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'volume-analysis-basics'),
   'volume-b2', 'key_concept', 'Volume Profile',
   'Volume profile shows traded volume at each price level (not each time period). The **Point of Control (POC)** is the price with the most volume — it acts as a magnet. **High Volume Nodes** are areas of acceptance; **Low Volume Nodes** are areas price moves through quickly. Volume profile is especially useful for SPX intraday trading.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'volume-analysis-basics'),
   'volume-b3', 'quiz_single', 'Volume Quiz',
   'Price is breaking above resistance with declining volume. What does this suggest?', 2,
   '{"options":["Strong breakout, go long","Weak breakout, likely to fail","Volume does not matter at resistance","Wait for a pullback to go short"],"correctIndex":1,"explanation":"Declining volume on a breakout suggests lack of conviction. The breakout is more likely to fail or produce a false breakout/trap."}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 2.2: Indicators & Oscillators ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'technical-analysis'),
  'indicators-and-oscillators',
  'indicators-and-oscillators',
  'Indicators & Oscillators',
  'Master the most widely used technical indicators and learn when each is appropriate.',
  '["Apply moving averages for trend identification","Use RSI and MACD for momentum analysis","Combine indicators without redundancy"]'::jsonb,
  40, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 2.2.1: Moving Averages
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'moving-averages', 'Moving Averages',
  'Use SMA and EMA to identify trends and dynamic support/resistance',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["indicator_fluency","chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
   'ma-b1', 'text_explanation', 'SMA vs EMA',
   'A **Simple Moving Average (SMA)** calculates the mean of the last N closing prices. An **Exponential Moving Average (EMA)** weights recent prices more heavily, making it more responsive. The 20 EMA is popular for short-term trend, the 50 SMA for intermediate trend, and the 200 SMA for long-term trend. Price above the 200 SMA is generally considered bullish; below is bearish.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
   'ma-b2', 'key_concept', 'Golden & Death Cross',
   'A **Golden Cross** occurs when the 50 SMA crosses above the 200 SMA — a bullish signal. A **Death Cross** is when the 50 SMA crosses below the 200 SMA — bearish. These are lagging signals but useful for confirming trend changes. Moving averages also act as dynamic support/resistance — price often bounces off the 20 EMA in trending markets.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'moving-averages'),
   'ma-b3', 'quiz_single', 'MA Quiz',
   'Which moving average crossover is considered a bullish signal?', 2,
   '{"options":["50 SMA crossing below 200 SMA","50 SMA crossing above 200 SMA","20 EMA crossing below 50 SMA","200 SMA crossing below 50 SMA"],"correctIndex":1,"explanation":"The Golden Cross (50 SMA crossing above 200 SMA) is a widely-followed bullish signal indicating potential long-term trend change."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.2.2: RSI & Stochastic
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'rsi-and-stochastic', 'RSI & Stochastic',
  'Apply RSI and Stochastic oscillators to identify overbought/oversold conditions',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["indicator_fluency"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'rsi-and-stochastic'),
   'rsi-b1', 'text_explanation', 'Understanding RSI',
   'The **Relative Strength Index (RSI)** measures the speed and magnitude of recent price changes on a scale of 0-100. Readings above 70 suggest overbought conditions; below 30 suggest oversold. However, in strong trends, RSI can remain overbought/oversold for extended periods. **RSI divergence** — where price makes a new high but RSI makes a lower high — is a powerful reversal signal.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'rsi-and-stochastic'),
   'rsi-b2', 'worked_example', 'RSI Divergence Trade',
   'SPX makes a new intraday high at 4520, but 14-period RSI peaks at 65, below its prior peak of 72. This bearish divergence signals weakening momentum. A trader might: (1) Avoid new longs, (2) Tighten stops on existing longs, (3) Look for a short entry if price breaks below the most recent swing low on increased volume.', 1, '{"steps":3}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'rsi-and-stochastic'),
   'rsi-b3', 'quiz_single', 'RSI Quiz',
   'Price makes a new high but RSI makes a lower high. This is called:', 2,
   '{"options":["Bullish confirmation","Bearish divergence","RSI reset","Momentum convergence"],"correctIndex":1,"explanation":"When price and RSI diverge (price higher, RSI lower), it is bearish divergence — a warning that momentum is weakening."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.2.3: MACD
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'macd-indicator', 'MACD: Trend & Momentum',
  'Use MACD for trend direction, momentum shifts, and signal line crossovers',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["indicator_fluency","chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'macd-indicator'),
   'macd-b1', 'text_explanation', 'MACD Components',
   'MACD (Moving Average Convergence Divergence) consists of three parts: the **MACD line** (12 EMA - 26 EMA), the **Signal line** (9-period EMA of the MACD line), and the **Histogram** (difference between MACD and Signal). When MACD crosses above the signal line, it is a bullish signal. When the histogram bars grow, momentum is increasing. The zero line represents the point where the 12 and 26 EMAs converge.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'macd-indicator'),
   'macd-b2', 'key_concept', 'MACD Best Practices',
   'MACD works best in **trending** markets, not ranges. Use it to confirm trend direction (MACD above zero = bullish, below = bearish) and to spot momentum shifts via histogram changes. Avoid taking every crossover — filter with price structure and volume. MACD divergence (like RSI divergence) is more reliable than simple crossovers.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'macd-indicator'),
   'macd-b3', 'quiz_single', 'MACD Quiz',
   'The MACD histogram shrinking while price continues higher suggests:', 2,
   '{"options":["Accelerating momentum","Slowing momentum","No change in trend","Bearish reversal confirmed"],"correctIndex":1,"explanation":"A shrinking MACD histogram while price rises means the rate of change is slowing, even though the trend is still up. This is early warning, not confirmation of reversal."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.2.4: Combining Indicators
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'indicators-and-oscillators'),
  'combining-indicators', 'Combining Indicators Without Redundancy',
  'Build an indicator stack that provides non-redundant confirmation signals',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["indicator_fluency","chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
   'combining-b1', 'text_explanation', 'Indicator Categories',
   'Indicators fall into categories: **Trend** (MA, MACD), **Momentum** (RSI, Stochastic), **Volatility** (Bollinger Bands, ATR), and **Volume** (OBV, VWAP). Using two indicators from the same category (e.g., RSI + Stochastic) is redundant. Instead, combine one from each category for true confirmation. A good basic stack: 20 EMA (trend) + RSI 14 (momentum) + VWAP (volume/value area).', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
   'combining-b2', 'key_concept', 'The Confluence Principle',
   'The more independent signals that agree, the higher the probability of the trade. A buy signal is strong when: (1) Price is above the 20 EMA (trend up), (2) RSI bounces from 40 level (momentum support), (3) Price is at VWAP (fair value). Three independent categories confirming = high-probability setup. But remember: no amount of indicators can guarantee a trade.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'combining-indicators'),
   'combining-b3', 'reflection', 'Design Your Indicator Stack',
   'Based on what you have learned, design a 3-indicator stack for your trading style. For each indicator, explain which category it belongs to and why you chose it over alternatives in that category.', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 2.3: Price Action Patterns ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'technical-analysis'),
  'price-action-patterns',
  'price-action-patterns',
  'Price Action Patterns',
  'Recognize and trade the most reliable chart patterns and candlestick formations.',
  '["Identify continuation and reversal chart patterns","Trade breakout and retest setups","Combine price action with volume for confirmation"]'::jsonb,
  40, 3, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 2.3.1: Continuation Patterns
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'continuation-patterns', 'Continuation Patterns',
  'Identify flags, pennants, and wedges that signal trend continuation',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["pattern_recognition","chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
   'continuation-b1', 'text_explanation', 'Flags and Pennants',
   'After a sharp move (the "pole"), price often consolidates in a small channel (flag) or triangle (pennant) before continuing. **Bull flags** slope downward against the trend; **bear flags** slope upward. Pennants are small symmetrical triangles. The key is the pole — a strong, high-volume move. The breakout from the flag/pennant should occur on rising volume and typically targets a measured move equal to the pole length.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
   'continuation-b2', 'worked_example', 'Bull Flag on SPX',
   'SPX rallies from 4450 to 4500 on heavy volume (the pole = 50 pts). Price then drifts lower in a tight channel to 4485 over 3 bars on declining volume. This is the flag. Entry: break above 4500 on increased volume. Stop: below 4480 (flag low). Target: 4485 + 50 = 4535 (measured move). Risk:Reward ≈ 1:2.5.', 1, '{"steps":4}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'continuation-patterns'),
   'continuation-b3', 'quiz_single', 'Continuation Quiz',
   'A bull flag is characterized by:', 2,
   '{"options":["A sharp rally followed by an upward-sloping consolidation","A sharp rally followed by a downward-sloping consolidation","A sharp decline followed by a downward-sloping consolidation","A sideways range after a large gap"],"correctIndex":1,"explanation":"A bull flag forms when price drifts lower (downward slope) against the prior uptrend, typically on declining volume, before breaking out higher."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.3.2: Reversal Patterns
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'reversal-patterns', 'Reversal Patterns',
  'Recognize double tops/bottoms, head & shoulders, and key reversals',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["pattern_recognition"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
   'reversal-b1', 'text_explanation', 'Double Top & Double Bottom',
   'A **double top** forms when price hits the same resistance twice and fails — an M shape. The neckline is the support between the two peaks. A confirmed break below the neckline targets a measured move equal to the pattern height. A **double bottom** is the inverse W pattern at support. Volume typically decreases on the second test, showing weakening momentum in the prior trend direction.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
   'reversal-b2', 'key_concept', 'Head & Shoulders',
   'The **head and shoulders** (H&S) is the most reliable reversal pattern. It consists of three peaks: a higher middle peak (head) flanked by two lower peaks (shoulders). The neckline connects the troughs. Confirmation: price breaks below the neckline with volume. Target: neckline minus the distance from head to neckline. Inverse H&S at bottoms is equally powerful for bullish reversals.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'reversal-patterns'),
   'reversal-b3', 'quiz_single', 'Reversal Quiz',
   'In a head & shoulders pattern, the neckline connects:', 2,
   '{"options":["The tops of the two shoulders","The bottoms of the two troughs between the peaks","The head and the right shoulder","The left shoulder and the head"],"correctIndex":1,"explanation":"The neckline in a head and shoulders pattern connects the two troughs (lows) between the left shoulder/head and head/right shoulder."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 2.3.3: Breakout Trading
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'price-action-patterns'),
  'breakout-trading', 'Breakout & Retest Trading',
  'Execute breakout trades with proper confirmation and manage false breakouts',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["pattern_recognition","chart_reading"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
   'breakout-b1', 'text_explanation', 'Breakout Confirmation',
   'Not every break of a level is a valid breakout. Look for: (1) **Volume expansion** — a real breakout has institutional participation, (2) **Candle close** beyond the level (not just a wick), (3) **Prior compression** — the tighter the range before breakout, the more powerful the move. Many traders wait for the **retest** — price breaks out, pulls back to the broken level (old resistance = new support), and bounces.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
   'breakout-b2', 'key_concept', 'False Breakout Traps',
   'False breakouts (or "fakeouts") occur when price breaks a level briefly, traps traders, then reverses. They are especially common at obvious levels where many stops are clustered. To avoid: (1) Wait for the candle to **close** beyond the level, (2) Require **volume confirmation**, (3) Consider the **retest entry** instead of chasing the initial break. False breakouts can actually be traded in the opposite direction by experienced traders.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'breakout-trading'),
   'breakout-b3', 'quiz_single', 'Breakout Quiz',
   'The safest way to trade a breakout is typically to:', 2,
   '{"options":["Buy immediately when price touches the resistance level","Wait for a candle close above resistance with volume, then enter on the retest","Use maximum position size since breakouts are high probability","Ignore volume and focus only on price"],"correctIndex":1,"explanation":"Waiting for a close above resistance with volume confirmation, then entering on the retest of the broken level, reduces false breakout risk."}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TRACK 3: OPTIONS MASTERY
-- ============================================================================

-- ---------- Module 3.1: Options Fundamentals ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'options-mastery'),
  'options-fundamentals',
  'options-fundamentals',
  'Options Fundamentals',
  'Understand what options are, how they are priced, and the mechanics of buying and selling contracts.',
  '["Define calls and puts and their payoff profiles","Explain intrinsic vs extrinsic value","Understand the impact of expiration and strike selection"]'::jsonb,
  45, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 3.1.1: What Are Options?
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'what-are-options', 'What Are Options?',
  'Define calls and puts and understand the buyer/seller relationship',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["options_literacy"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
   'options-intro-b1', 'text_explanation', 'Calls and Puts',
   'An option is a contract giving the buyer the **right, but not the obligation**, to buy (call) or sell (put) an underlying asset at a specific price (strike) by a specific date (expiration). The **buyer** pays a premium and has limited risk (the premium paid). The **seller** (writer) collects the premium but takes on the obligation and potentially unlimited risk (for naked calls). One standard equity option contract represents 100 shares.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
   'options-intro-b2', 'key_concept', 'Intrinsic vs Extrinsic Value',
   'An option price has two components: **Intrinsic value** = how much it is in the money (ITM). For a call: max(0, stock price - strike). **Extrinsic value** (time value) = premium - intrinsic value. This represents the probability of the option gaining more value before expiration. At-the-money (ATM) options have the most extrinsic value. As expiration approaches, extrinsic value decays (theta decay).', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'what-are-options'),
   'options-intro-b3', 'quiz_single', 'Options Basics Quiz',
   'A call option buyer has:', 2,
   '{"options":["The obligation to buy at the strike price","The right to buy at the strike price","The obligation to sell at the strike price","Unlimited risk"],"correctIndex":1,"explanation":"The buyer of a call has the RIGHT (not obligation) to buy the underlying at the strike price. The buyer''s risk is limited to the premium paid."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.1.2: Option Pricing Mechanics
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'option-pricing-mechanics', 'Option Pricing Mechanics',
  'Understand the factors that drive option premiums and the basics of Black-Scholes',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["options_literacy","greeks_mastery"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'option-pricing-mechanics'),
   'pricing-b1', 'text_explanation', 'Five Pricing Factors',
   'Option premiums are driven by five main factors: (1) **Underlying price** relative to strike, (2) **Time to expiration** — more time = more premium, (3) **Implied volatility (IV)** — higher IV = higher premium, (4) **Interest rates** — minor effect, raises call prices slightly, (5) **Dividends** — reduce call prices, increase put prices. The Black-Scholes model quantifies these relationships mathematically, though real markets deviate from the model assumptions.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'option-pricing-mechanics'),
   'pricing-b2', 'worked_example', 'Pricing Example',
   'SPX is at 4500. The 4500 call (ATM) expiring in 30 days is $45. This is all extrinsic value (intrinsic = $0 since it is exactly ATM). If IV increases from 15% to 20%, the premium might jump to $60 without SPX moving. If 15 days pass with no SPX move, the premium might decay to $32 (theta ate ~$13). Understanding these dynamics is critical for options trading profitability.', 1, '{"steps":2}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'option-pricing-mechanics'),
   'pricing-b3', 'quiz_single', 'Pricing Quiz',
   'All else being equal, which factor would INCREASE a call option premium?', 2,
   '{"options":["Decrease in implied volatility","Passage of time","Increase in implied volatility","Increase in dividends"],"correctIndex":2,"explanation":"Higher implied volatility increases both call and put premiums, as it implies a greater expected range of price movement."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.1.3: Strike Selection & Expiration
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'strike-and-expiration', 'Strike Selection & Expiration',
  'Choose appropriate strikes and expirations based on market outlook and risk tolerance',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["options_literacy","strategy_selection"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'strike-and-expiration'),
   'strike-b1', 'text_explanation', 'ITM, ATM, OTM Trade-offs',
   'Strike selection involves trade-offs. **ITM** options have higher delta (more stock-like), less extrinsic value at risk, but cost more. **ATM** options offer the best balance of leverage and probability. **OTM** options are cheap but have low probability of profit — they need a large move. For directional trades, slightly ITM or ATM options offer the best risk/reward. For income strategies, OTM options are preferred to collect premium with higher probability of expiring worthless.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'strike-and-expiration'),
   'strike-b2', 'key_concept', 'Expiration Selection',
   'Shorter expirations (0-7 DTE) have rapid theta decay — great for sellers, terrible for buyers. 30-60 DTE is the sweet spot for most directional buyers: enough time for the thesis to play out without excessive premium. For earnings plays, use the closest expiration after the event. A critical concept: **gamma risk** increases dramatically in the last week before expiration, making positions more volatile.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'strike-and-expiration'),
   'strike-b3', 'quiz_single', 'Strike Selection Quiz',
   'For a directional call trade with 30 days to expiration, the most balanced strike choice is typically:', 2,
   '{"options":["Deep OTM for maximum leverage","Slightly ITM or ATM for best risk/reward","Deep ITM to avoid all time decay","It does not matter"],"correctIndex":1,"explanation":"Slightly ITM or ATM strikes offer the best balance of delta exposure, reasonable cost, and manageable theta decay for 30-day directional trades."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.1.4: Order Types & Execution
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'options-fundamentals'),
  'order-types-and-execution', 'Order Types & Execution',
  'Place options orders correctly using limit orders, spreads, and proper execution practices',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 3, true,
  '{"competenciesTargeted":["options_literacy"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'order-types-and-execution'),
   'order-types-b1', 'text_explanation', 'Limit Orders Are Essential',
   'Always use **limit orders** for options — never market orders. The bid-ask spread on options can be wide, and a market order guarantees you get the worst price. Start with the **mid-price** (halfway between bid and ask) and adjust if needed. For spreads, submit as a single order with a net debit/credit, not as individual legs. Trading during the first and last 15 minutes of the session can result in poor fills due to wide spreads.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'order-types-and-execution'),
   'order-types-b2', 'key_concept', 'The Bid-Ask Spread',
   'The **bid** is what buyers will pay; the **ask** is what sellers want. The spread is the difference. Wide spreads = illiquid options. Tight spreads = liquid (SPX, SPY, QQQ, AAPL). Always check **open interest** and **volume** before trading an options contract. A rule of thumb: avoid options with fewer than 100 open interest or a spread wider than 10% of the premium.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'order-types-and-execution'),
   'order-types-b3', 'quiz_single', 'Order Types Quiz',
   'Why should you avoid market orders for options?', 2,
   '{"options":["They are not supported by brokers","The bid-ask spread can cause significant slippage","Market orders are slower","They require more margin"],"correctIndex":1,"explanation":"Wide bid-ask spreads on options mean market orders can fill at significantly worse prices than expected, eating into your trade edge."}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 3.2: The Greeks ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'options-mastery'),
  'the-greeks',
  'the-greeks',
  'The Greeks',
  'Master Delta, Gamma, Theta, Vega, and Rho to manage options positions like a professional.',
  '["Calculate and interpret each Greek for any position","Use Greeks to manage portfolio risk","Anticipate how Greeks change with price, time, and volatility"]'::jsonb,
  50, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 3.2.1: Delta & Gamma
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'delta-and-gamma', 'Delta & Gamma',
  'Understand how delta measures directional exposure and gamma measures the rate of change',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["greeks_mastery","options_literacy"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
   'delta-gamma-b1', 'text_explanation', 'Delta Explained',
   '**Delta** measures how much an option price changes for a $1 move in the underlying. A call with delta 0.50 gains $0.50 per $1 up-move. Delta also approximates the probability of expiring ITM. Calls have positive delta (0 to +1), puts have negative delta (0 to -1). ATM options have ~0.50 delta. As options move deeper ITM, delta approaches 1.0 (or -1.0 for puts). Portfolio delta is the sum of all position deltas — it tells you your net directional exposure.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
   'delta-gamma-b2', 'key_concept', 'Gamma: Delta of Delta',
   '**Gamma** is the rate at which delta changes. High gamma means delta changes rapidly with price movement. ATM options near expiration have the highest gamma. This is why short-dated ATM options are so volatile near expiry — a small move causes a large delta shift, which amplifies P&L swings. Long gamma positions (buying options) profit from big moves; short gamma positions (selling options) profit from stability.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'delta-and-gamma'),
   'delta-gamma-b3', 'quiz_single', 'Delta Quiz',
   'An ATM call option typically has a delta of approximately:', 2,
   '{"options":["0.10","0.25","0.50","1.00"],"correctIndex":2,"explanation":"ATM options have approximately 0.50 delta, meaning they gain about $0.50 for every $1 move in the underlying. This also implies ~50% probability of expiring ITM."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.2.2: Theta & Vega
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'theta-and-vega', 'Theta & Vega',
  'Manage time decay and volatility exposure in your options positions',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["greeks_mastery"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'theta-and-vega'),
   'theta-vega-b1', 'text_explanation', 'Theta: The Time Tax',
   '**Theta** measures how much an option loses per day from time decay (all else equal). ATM options have the highest theta. Theta accelerates as expiration approaches — an option that loses $1/day at 30 DTE might lose $3/day at 5 DTE. Theta is the enemy of option buyers and the friend of option sellers. This is why many income strategies (credit spreads, iron condors) are fundamentally theta-positive: they profit from the passage of time.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'theta-and-vega'),
   'theta-vega-b2', 'key_concept', 'Vega: Volatility Sensitivity',
   '**Vega** measures how much an option price changes for a 1% change in implied volatility. Higher vega means more sensitivity to IV changes. Long options are long vega (benefit from IV increase); short options are short vega (benefit from IV decrease). Before earnings, IV inflates ("vol crush" risk after). Understanding vega is critical for managing trades around events and in high-IV environments.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'theta-and-vega'),
   'theta-vega-b3', 'quiz_single', 'Theta Quiz',
   'Theta decay accelerates most dramatically:', 2,
   '{"options":["60-90 days before expiration","30-45 days before expiration","In the final 7-10 days before expiration","It is constant throughout the option life"],"correctIndex":2,"explanation":"Theta decay is non-linear and accelerates sharply in the final 7-10 days before expiration, especially for ATM options."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.2.3: Greeks in Practice
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'the-greeks'),
  'greeks-in-practice', 'Greeks in Practice',
  'Apply the Greeks to manage real positions and make adjustment decisions',
  18, 'advanced'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["greeks_mastery","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
   'greeks-practice-b1', 'text_explanation', 'Portfolio Greeks Dashboard',
   'Professional traders monitor aggregate portfolio Greeks. **Net delta** = directional bias. **Net gamma** = how quickly exposure changes. **Net theta** = daily time decay P&L. **Net vega** = volatility exposure. The goal is often to be roughly delta-neutral (no directional bet) while being positive theta (collecting time decay). Adjustments are made when Greeks drift outside acceptable ranges.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
   'greeks-practice-b2', 'worked_example', 'Greeks Adjustment Scenario',
   'Your portfolio: Long 10 SPX 4500 calls (delta +500), Short 5 SPX 4550 calls (delta -200). Net delta = +300 (bullish). If you want to reduce directional risk, sell 3 more 4550 calls (delta -120) to bring net delta to +180. Or buy 3 SPX 4500 puts (delta -150) for a hedge. Each adjustment changes the full Greek profile, so recalculate theta and vega after each change.', 1, '{"steps":3}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'greeks-in-practice'),
   'greeks-practice-b3', 'reflection', 'Your Greeks Priorities',
   'Consider: Which Greek matters most for your trading style? If you are primarily a directional trader, delta is key. If you sell premium, theta and vega dominate. Write about which Greeks you monitor most and why, and describe a scenario where a secondary Greek surprised you.', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 3.3: Basic Options Strategies ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'options-mastery'),
  'basic-options-strategies',
  'basic-options-strategies',
  'Basic Options Strategies',
  'Learn the essential options strategies: long calls/puts, vertical spreads, and covered calls.',
  '["Execute vertical debit and credit spreads","Manage risk with defined-risk structures","Select the right strategy for a given market outlook"]'::jsonb,
  45, 3, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 3.3.1: Vertical Spreads
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'vertical-spreads', 'Vertical Spreads',
  'Build bull call spreads and bear put spreads for defined-risk directional trades',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["strategy_selection","options_literacy"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
   'verticals-b1', 'text_explanation', 'Debit Spreads',
   'A **bull call spread** (call debit spread) involves buying a call at a lower strike and selling a call at a higher strike, same expiration. The max profit is the width of the strikes minus the premium paid. The max loss is the premium paid. Example: Buy 4500 call for $20, sell 4520 call for $10. Net debit = $10. Max profit = $20 - $10 = $10 (at SPX 4520+). Max loss = $10 (at SPX 4500 or below). This is defined-risk: you know your worst case before entering.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
   'verticals-b2', 'key_concept', 'Credit Spreads',
   'A **bull put spread** (put credit spread) involves selling a higher-strike put and buying a lower-strike put. You collect net credit. Max profit = credit received (if both expire OTM). Max loss = width minus credit. Credit spreads profit from time decay and have probability on their side — but the risk/reward is asymmetric (small frequent wins, occasional larger losses). Risk management and position sizing are critical.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'vertical-spreads'),
   'verticals-b3', 'quiz_single', 'Vertical Spread Quiz',
   'A bull call spread with 4500/4520 strikes costs $10. What is the maximum profit?', 2,
   '{"options":["$10","$20","$30","Unlimited"],"correctIndex":0,"explanation":"Max profit = width ($20) minus cost ($10) = $10. This occurs when SPX is at or above 4520 at expiration."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.3.2: Covered Calls & Cash-Secured Puts
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'covered-calls-cash-secured-puts', 'Covered Calls & Cash-Secured Puts',
  'Generate income from existing positions or enter at better prices using options',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["strategy_selection","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'covered-calls-cash-secured-puts'),
   'covered-b1', 'text_explanation', 'Covered Call Strategy',
   'A **covered call** means selling a call against 100 shares you already own. You collect premium (income) in exchange for capping your upside at the strike price. Best used: (1) In sideways/slightly bullish markets, (2) On stocks you are willing to sell at the strike, (3) When IV is elevated (better premium). The risk: if the stock drops significantly, the premium collected only partially offsets the loss.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'covered-calls-cash-secured-puts'),
   'covered-b2', 'key_concept', 'Cash-Secured Put',
   'A **cash-secured put** means selling a put while holding enough cash to buy 100 shares if assigned. You collect premium while waiting to buy a stock at your target price. If the stock stays above the strike, you keep the premium. If it falls below, you buy the stock at a net cost of strike minus premium — effectively entering at a discount. This is the options-based version of a limit buy order that pays you to wait.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'covered-calls-cash-secured-puts'),
   'covered-b3', 'quiz_single', 'Covered Call Quiz',
   'When is a covered call most profitable?', 2,
   '{"options":["When the stock rises significantly above the call strike","When the stock stays near or slightly below the call strike","When the stock crashes","When volatility collapses after entry"],"correctIndex":1,"explanation":"A covered call is most profitable when the stock stays near or slightly below the strike — you keep the shares AND the full premium. If the stock rises far above the strike, you miss out on gains."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 3.3.3: Strategy Selection Framework
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'basic-options-strategies'),
  'strategy-selection-framework', 'Strategy Selection Framework',
  'Choose the right options strategy based on outlook, volatility, and risk tolerance',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["strategy_selection","options_literacy","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'strategy-selection-framework'),
   'selection-b1', 'text_explanation', 'The Decision Matrix',
   'Strategy selection starts with three questions: (1) **Direction** — Bullish, bearish, or neutral? (2) **Volatility** — Is IV high (sell premium) or low (buy premium)? (3) **Risk tolerance** — Defined risk (spreads) or undefined (naked)? A bullish outlook in low IV → buy calls or call debit spreads. A neutral outlook in high IV → sell iron condors or strangles. Always match the strategy to YOUR analysis, not to a feeling.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'strategy-selection-framework'),
   'selection-b2', 'key_concept', 'Quick Reference',
   '**Bullish + Low IV**: Long call, call debit spread. **Bullish + High IV**: Bull put spread (credit). **Bearish + Low IV**: Long put, put debit spread. **Bearish + High IV**: Bear call spread (credit). **Neutral + High IV**: Iron condor, short strangle. **Neutral + Low IV**: Calendar spread, butterfly. Always start with defined-risk strategies until you have a proven edge and risk management system.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'strategy-selection-framework'),
   'selection-b3', 'reflection', 'Your Strategy Playbook',
   'Based on your typical market outlook and risk tolerance, which 2-3 strategies will form your core playbook? Explain why each strategy fits your trading personality and goals.', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

COMMIT;
