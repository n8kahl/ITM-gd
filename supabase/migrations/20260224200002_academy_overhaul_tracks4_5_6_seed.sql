-- ============================================================================
-- File: 20260224200002_academy_overhaul_tracks4_5_6_seed.sql
-- Phase: Academy Overhaul – Phase 2, Slice 2C
-- Purpose: Seed Tracks 4 (SPX Specialization), 5 (Advanced Strategies),
--          and 6 (Trading Psychology Advanced)
--          with modules, lessons, and content blocks.
-- Idempotency: ON CONFLICT DO NOTHING / DO UPDATE
-- ============================================================================

BEGIN;

-- ============================================================================
-- COMPETENCIES (idempotent, overlap with other seeds)
-- ============================================================================

INSERT INTO academy_competencies (key, title, description, domain, metadata)
VALUES
  ('spx_structure',        'SPX Market Structure',   'Understand SPX index mechanics, expiration cycles, and settlement.',     'spx',          '{}'::jsonb),
  ('spx_strategies',       'SPX Trading Strategies', 'Apply 0DTE and swing strategies specific to SPX options.',              'spx',          '{}'::jsonb),
  ('risk_management',      'Risk Management',        'Size positions and manage portfolio risk within defined limits.',         'risk',         '{}'::jsonb),
  ('multi_leg',            'Multi-Leg Strategies',   'Construct and manage iron condors, butterflies, and calendar spreads.',  'options',      '{}'::jsonb),
  ('portfolio_management', 'Portfolio Management',    'Think at the portfolio level with correlation and sector awareness.',    'options',      '{}'::jsonb),
  ('mental_game',          'Mental Game',             'Develop psychological resilience and peak performance habits.',          'mindset',      '{}'::jsonb),
  ('performance_review',   'Performance Review',      'Systematically review and improve trading through journaling.',          'improvement',  '{}'::jsonb),
  ('trading_psychology',   'Trading Psychology',      'Manage emotions and cognitive biases to execute the trading plan.',      'mindset',      '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TRACK 4: SPX SPECIALIZATION
-- ============================================================================

-- ---------- Module 4.1: SPX Market Structure ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'spx-specialization'),
  'spx-market-structure',
  'spx-market-structure',
  'SPX Market Structure',
  'Understand the unique mechanics of SPX options including settlement, expirations, and index behavior.',
  '["Explain European-style settlement and cash settlement","Navigate SPX expiration cycles (monthly, weekly, 0DTE)","Understand the role of market makers in SPX options"]'::jsonb,
  45, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 4.1.1: SPX Options Basics
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-market-structure'),
  'spx-options-basics', 'SPX Options Basics',
  'Understand how SPX options differ from equity options in settlement and exercise',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["spx_structure"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-options-basics'),
   'spx-basics-b1', 'text_explanation', 'SPX vs SPY Options',
   'SPX options are **European-style** (exercise only at expiration) and **cash-settled** (no stock assignment, just cash P&L). SPY options are American-style and physically settled. SPX trades at approximately 10x SPY. One SPX option contract controls ~$450,000 notional (at SPX 4500). SPX options have favorable tax treatment: 60% long-term, 40% short-term capital gains regardless of holding period (Section 1256 contracts).', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-options-basics'),
   'spx-basics-b2', 'key_concept', 'Expiration Cycles',
   'SPX now has expirations **every day** (Monday through Friday). Standard monthly options expire on the 3rd Friday. Weekly options (SPXW) expire on other days. **0DTE** (zero days to expiration) trading has exploded in popularity, with same-day expiration options offering pure gamma plays. AM-settled vs PM-settled: Standard monthly SPX settles at the open (AM); SPXW settles at the close (PM). This distinction matters for holding positions to expiration.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-options-basics'),
   'spx-basics-b3', 'quiz_single', 'SPX Quiz',
   'SPX options are settled by:', 2,
   '{"options":["Physical delivery of S&P 500 shares","Cash settlement","Delivery of SPY ETF shares","Automatic rollover to next expiration"],"correctIndex":1,"explanation":"SPX options are cash-settled. At expiration, the difference between the settlement price and the strike is paid in cash. There is no stock or ETF assignment."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 4.1.2: SPX Session Structure
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-market-structure'),
  'spx-session-structure', 'SPX Session Structure',
  'Understand intraday SPX behavior patterns including the open, VWAP, and key time zones',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["spx_structure","spx_strategies"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-session-structure'),
   'session-b1', 'text_explanation', 'Intraday Time Zones',
   'The SPX trading day has distinct personality zones: **9:30-10:00** — Opening range volatility, institutional order flow, gap fill or gap continuation. **10:00-11:30** — Trend establishment, often the highest conviction moves of the day. **11:30-14:00** — Lunch doldrums, lower volume, choppy action (avoid new entries). **14:00-15:00** — Afternoon reversal zone, institutions rebalance. **15:00-16:00** — Power hour, heavy volume, 0DTE gamma effects amplify moves.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-session-structure'),
   'session-b2', 'key_concept', 'VWAP as Intraday Compass',
   'Volume Weighted Average Price (VWAP) is the single most important intraday reference for SPX. Price above VWAP = buyers in control; price below VWAP = sellers in control. Institutions use VWAP to benchmark execution. Look for VWAP holds (bounces) as entries and VWAP failures (breaks) as trend changes. The opening 5-minute bar high/low combined with VWAP creates a simple but effective intraday framework.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-session-structure'),
   'session-b3', 'quiz_single', 'Session Structure Quiz',
   'Which SPX intraday time zone typically offers the lowest-quality setups?', 2,
   '{"options":["9:30-10:00 AM","10:00-11:30 AM","11:30 AM-2:00 PM","3:00-4:00 PM"],"correctIndex":2,"explanation":"The 11:30 AM to 2:00 PM window (lunch doldrums) typically has lower volume, choppy price action, and fewer high-quality setups."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 4.1.3: Volatility & VIX
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-market-structure'),
  'volatility-and-vix', 'Volatility & VIX Relationship',
  'Interpret VIX and its term structure to gauge market sentiment and position accordingly',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["spx_structure","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'volatility-and-vix'),
   'vix-b1', 'text_explanation', 'Understanding VIX',
   'The VIX (CBOE Volatility Index) measures the 30-day implied volatility of SPX options. It is often called the "fear gauge." VIX 12-15 = low volatility (complacency). VIX 20-25 = elevated (caution). VIX 30+ = fear (potential panic selling). VIX is mean-reverting — extreme highs eventually come down, extreme lows eventually spike. SPX and VIX have a strong inverse correlation (~-0.8): when SPX drops, VIX spikes.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'volatility-and-vix'),
   'vix-b2', 'key_concept', 'VIX Term Structure',
   'The **VIX term structure** plots implied volatility across different expirations. **Contango** (normal): longer-dated VIX futures > shorter-dated. This is the normal state — uncertainty increases with time. **Backwardation** (inverted): shorter-dated VIX > longer-dated. This signals acute fear — the market is pricing more risk NOW than in the future. Backwardation is relatively rare and often accompanies significant market selloffs.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'volatility-and-vix'),
   'vix-b3', 'quiz_single', 'VIX Quiz',
   'VIX term structure in backwardation suggests:', 2,
   '{"options":["Extreme market complacency","Normal market conditions","Acute fear with near-term risk pricing elevated","VIX is about to go to zero"],"correctIndex":2,"explanation":"Backwardation (short-term VIX higher than long-term) signals the market is pricing more risk in the near term than usual, typically during market stress events."}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 4.2: SPX Trading Strategies ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'spx-specialization'),
  'spx-trading-strategies',
  'spx-trading-strategies',
  'SPX Trading Strategies',
  'Apply proven SPX trading strategies including 0DTE credit spreads, directional plays, and event trades.',
  '["Execute 0DTE iron condors and credit spreads on SPX","Trade SPX around economic events and FOMC","Manage intraday SPX positions with defined risk"]'::jsonb,
  50, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 4.2.1: 0DTE Strategies
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-trading-strategies'),
  'zero-dte-strategies', '0DTE SPX Strategies',
  'Apply same-day expiration strategies with proper risk management',
  18, 'advanced'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["spx_strategies","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'zero-dte-strategies'),
   'zero-dte-b1', 'text_explanation', '0DTE Credit Spreads',
   '0DTE (zero days to expiration) SPX options expire at the end of the same trading day. The most popular 0DTE strategy is selling credit spreads: sell a put credit spread below the market for bullish bias, or a call credit spread above for bearish bias. The key advantage: theta decay is at maximum, so time works aggressively in your favor. The key risk: gamma is at maximum, meaning a move against you accelerates losses rapidly. **Position sizing** is the #1 risk control — never risk more than 1-2% of portfolio on a single 0DTE trade.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'zero-dte-strategies'),
   'zero-dte-b2', 'key_concept', '0DTE Iron Condor',
   'A 0DTE iron condor sells both a put spread and a call spread, collecting premium from both sides. It profits if SPX stays within a defined range. Typical setup: sell wings 20-30 points from current price with $5-10 wide spreads. Take profit at 50% of max credit. **Hard stop** at 2x the credit received. The sweet spot is low-VIX, range-bound days. Avoid 0DTE iron condors on FOMC days, CPI releases, or when VIX is above 25.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'zero-dte-strategies'),
   'zero-dte-b3', 'quiz_single', '0DTE Quiz',
   'The biggest risk of 0DTE SPX options is:', 2,
   '{"options":["Low liquidity","Maximum gamma exposure causing rapid losses","Theta decay working against you","Wide bid-ask spreads"],"correctIndex":1,"explanation":"0DTE options have maximum gamma, meaning delta changes very rapidly with price movement. A small move against you can cause outsized losses if not managed with proper position sizing and stops."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 4.2.2: Event Trading
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-trading-strategies'),
  'spx-event-trading', 'SPX Event Trading',
  'Navigate FOMC, CPI, and employment reports with appropriate SPX options strategies',
  15, 'advanced'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["spx_strategies","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-event-trading'),
   'event-b1', 'text_explanation', 'The Event Trading Framework',
   'Major economic events (FOMC, CPI, NFP) create predictable volatility patterns: (1) **Pre-event**: IV rises (vol premium builds). (2) **Event release**: Violent move in one direction, often followed by a reversal. (3) **Post-event**: IV crushes as uncertainty resolves. Strategies: buy straddles/strangles pre-event if you think the move will exceed the implied move. Sell premium post-event if the market stabilizes. Never hold naked short options through a major event.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-event-trading'),
   'event-b2', 'key_concept', 'Implied Move Calculation',
   'Before an event, check the **implied move** by looking at the nearest-expiration ATM straddle price. If the 4500 straddle costs $30, the market implies a ±30 point (~0.67%) move. If you think the actual move will be larger, buying the straddle has positive expected value. If you think it will be smaller, selling has the edge. Historical data shows that FOMC moves tend to be larger than implied, while CPI moves have become less predictable.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-event-trading'),
   'event-b3', 'quiz_single', 'Event Trading Quiz',
   'What typically happens to implied volatility immediately after a major event?', 2,
   '{"options":["It increases further","It stays the same","It decreases (vol crush)","It becomes unpredictable"],"correctIndex":2,"explanation":"After a major event, implied volatility typically decreases sharply (vol crush) as the uncertainty that was priced in resolves, regardless of the direction of the move."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 4.2.3: SPX Swing Trading
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-trading-strategies'),
  'spx-swing-trading', 'SPX Swing Trading',
  'Hold SPX options for multi-day moves using trend analysis and key levels',
  15, 'advanced'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["spx_strategies","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-swing-trading'),
   'swing-b1', 'text_explanation', 'SPX Swing Setups',
   'SPX swing trades hold for 2-10 days, using 30-60 DTE options to minimize theta decay. The best setups combine: (1) Daily trend alignment (above/below 20 EMA), (2) Support/resistance at key levels (round numbers, prior highs/lows, monthly pivots), (3) VIX confirmation (trending VIX supports trend continuation). Use vertical spreads for defined risk. Entry on pullbacks to the 20 EMA in a trend is a high-probability swing setup.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-swing-trading'),
   'swing-b2', 'key_concept', 'Position Management',
   'Swing position management rules: (1) **Risk 1-2% per trade** maximum. (2) Stop loss: below the swing low (longs) or above the swing high (shorts). (3) **Scale out** in thirds: take 1/3 at 1R, move stop to breakeven, take 1/3 at 2R, let the rest ride with a trailing stop. (4) Reduce size before major events. (5) Review the position daily — if the thesis changes, exit regardless of P&L.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-swing-trading'),
   'swing-b3', 'reflection', 'Your SPX Trading Plan',
   'Draft a brief SPX swing trading plan: What signals would trigger an entry? What DTE and delta would you choose for your options? How would you manage the position? What would make you exit early?', 2,
   '{"minWords":50}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 4.3: SPX Risk Management ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'spx-specialization'),
  'spx-risk-management',
  'spx-risk-management',
  'SPX Risk Management',
  'Manage risk specific to SPX options trading including position sizing, correlation, and tail risk.',
  '["Size SPX positions based on account risk limits","Understand tail risk and portfolio hedging","Use the VIX to adjust position sizing dynamically"]'::jsonb,
  40, 3, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 4.3.1: Position Sizing for SPX
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-risk-management'),
  'spx-position-sizing', 'Position Sizing for SPX',
  'Calculate appropriate position sizes for SPX trades based on account value and risk parameters',
  14, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["risk_management","spx_strategies"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-position-sizing'),
   'sizing-b1', 'text_explanation', 'The 1-2% Rule for SPX',
   'Position sizing is the #1 determinant of long-term trading survival. The rule: risk no more than **1-2% of your account** on any single SPX trade. For a $50,000 account, max risk = $500-$1,000. For a defined-risk spread: Max risk = spread width × 100 - premium collected. Example: $10-wide SPX put spread collected $3.00 → max risk = ($10 - $3) × 100 = $700. This fits within 1.4% risk on a $50K account. For undefined-risk positions, use a hard stop that limits loss to 1-2%.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-position-sizing'),
   'sizing-b2', 'key_concept', 'VIX-Adjusted Sizing',
   'Dynamic position sizing adjusts for volatility regime. When VIX is elevated (>20), reduce position size by 25-50%. When VIX is low (<15), standard sizing applies. This ensures you are taking smaller positions when the market is more dangerous. A simple formula: **Adjusted size = Base size × (15 / current VIX)**. If VIX is 30, you trade at half your normal size. This single rule can prevent blow-up trades during volatile markets.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'spx-position-sizing'),
   'sizing-b3', 'quiz_single', 'Position Sizing Quiz',
   'Your account is $100,000. VIX is at 25. Using a 1% risk rule with VIX-adjusted sizing (base VIX = 15), what is your maximum risk per trade?', 2,
   '{"options":["$1,000","$600","$1,500","$250"],"correctIndex":1,"explanation":"Base risk = 1% × $100K = $1,000. VIX adjustment = 15/25 = 0.6. Adjusted max risk = $1,000 × 0.6 = $600."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 4.3.2: Tail Risk & Hedging
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-risk-management'),
  'tail-risk-hedging', 'Tail Risk & Hedging',
  'Protect against extreme market events using portfolio hedges and tail risk strategies',
  14, 'advanced'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["risk_management","spx_structure"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'tail-risk-hedging'),
   'tail-b1', 'text_explanation', 'Understanding Tail Risk',
   'Tail risk refers to the probability of extreme market moves that exceed normal expectations. The S&P 500 has experienced 5%+ single-day drops multiple times in history. Options pricing assumes a normal distribution, but real markets have **fat tails** — extreme moves happen more often than models predict. If you sell options (credit spreads, iron condors), tail risk is your biggest enemy. A single tail event can wipe out months of collected premium.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'tail-risk-hedging'),
   'tail-b2', 'key_concept', 'Portfolio Hedging Strategies',
   'Simple portfolio hedges: (1) **Far OTM puts**: Buy 5-10% OTM SPX puts as insurance (costs 0.5-1% of portfolio per quarter). (2) **Put spread collars**: Sell calls to finance put purchases. (3) **VIX calls**: Buy VIX calls as a volatility hedge (VIX spikes when SPX drops). (4) **Cash allocation**: The simplest hedge is reducing position size and increasing cash. The goal is not to eliminate risk but to survive the worst-case scenario and live to trade another day.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'tail-risk-hedging'),
   'tail-b3', 'quiz_single', 'Tail Risk Quiz',
   'The most cost-effective way to hedge a portfolio of SPX credit spreads is:', 2,
   '{"options":["Buying far OTM calls","Reducing position size and maintaining cash reserves","Doubling down on losing positions","Ignoring tail risk because it rarely happens"],"correctIndex":1,"explanation":"The simplest and most cost-effective hedge is proper position sizing and cash reserves. Fancy hedges cost money that erodes returns; discipline costs nothing."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 4.3.3: Daily Risk Checklist
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'spx-risk-management'),
  'daily-risk-checklist', 'Daily Risk Checklist',
  'Build and follow a systematic pre-market risk assessment routine',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["risk_management","spx_strategies"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'daily-risk-checklist'),
   'checklist-b1', 'text_explanation', 'The Pre-Market Ritual',
   'Before placing any trade, run through this checklist: (1) **Check VIX level and trend** — Is it rising (caution) or falling (opportunity)? (2) **Review overnight moves** — Futures, Asia/Europe markets, any gap? (3) **Check economic calendar** — FOMC? CPI? Earnings? (4) **Assess current exposure** — Total portfolio delta, max loss scenarios. (5) **Set daily max loss** — Decide the point where you stop trading for the day (typically 1-3% of account). (6) **Confirm position sizes** are within VIX-adjusted limits.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'daily-risk-checklist'),
   'checklist-b2', 'key_concept', 'The Daily Stop',
   'A **daily stop** is the maximum amount you are willing to lose in a single day. When hit, you close all positions and walk away. No exceptions. This rule prevents emotional revenge trading and catastrophic drawdowns. A common level: 2-3% of account value. If your account is $50,000, your daily stop is $1,000-$1,500. Hitting the daily stop is not failure — it is risk management working as designed.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'daily-risk-checklist'),
   'checklist-b3', 'reflection', 'Your Risk Routine',
   'Design your own pre-market risk checklist. What items will you check before trading? What is your daily max loss? Under what conditions will you reduce size or skip trading entirely?', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TRACK 5: ADVANCED STRATEGIES
-- ============================================================================

-- ---------- Module 5.1: Multi-Leg Strategies ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'advanced-strategies'),
  'multi-leg-strategies',
  'multi-leg-strategies',
  'Multi-Leg Strategies',
  'Master iron condors, butterflies, calendar spreads, and other multi-leg structures.',
  '["Construct and manage iron condors and iron butterflies","Use calendar and diagonal spreads for time-based strategies","Adjust multi-leg positions when tested"]'::jsonb,
  50, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 5.1.1: Iron Condors
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'multi-leg-strategies'),
  'iron-condors', 'Iron Condors',
  'Build and manage iron condors for range-bound market conditions',
  18, 'advanced'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["multi_leg","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'iron-condors'),
   'ic-b1', 'text_explanation', 'Iron Condor Structure',
   'An iron condor combines a bull put spread and a bear call spread on the same underlying and expiration. You collect premium from both sides, profiting if price stays within the range. Example: Sell 4450/4440 put spread + Sell 4550/4560 call spread on SPX. Max profit = total credit. Max loss = wing width - credit. Probability of profit depends on the width of the short strikes relative to expected move.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'iron-condors'),
   'ic-b2', 'key_concept', 'Iron Condor Management',
   'Management rules: (1) Enter at 30-45 DTE for optimal theta. (2) Take profit at 50% of max credit. (3) If one side is tested (price approaches short strike), consider rolling the untested side closer to collect more premium. (4) Max loss stop: close if the position reaches 2x the credit received. (5) Avoid holding into the last week — gamma risk increases. (6) Skip when VIX is trending higher or major events are imminent.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'iron-condors'),
   'ic-b3', 'quiz_single', 'Iron Condor Quiz',
   'When should you take profit on an iron condor?', 2,
   '{"options":["At expiration for maximum profit","When 50% of max credit is captured","Only when both sides expire worthless","When the market reverses direction"],"correctIndex":1,"explanation":"Taking profit at 50% of max credit reduces risk and frees up capital. Holding to expiration exposes you to gamma risk and leaves gains on the table if the market moves against you."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 5.1.2: Butterfly Spreads
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'multi-leg-strategies'),
  'butterfly-spreads', 'Butterfly Spreads',
  'Use butterflies for precise directional or neutral positions with limited risk',
  15, 'advanced'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["multi_leg","strategy_selection"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'butterfly-spreads'),
   'butterfly-b1', 'text_explanation', 'Butterfly Structure',
   'A butterfly spread uses three strikes: buy 1 lower, sell 2 middle, buy 1 upper (equal distances). The center strike is the max profit point. Cost = net debit paid. Max profit = wing width - debit. Max loss = debit paid. Butterflies are useful when you have a specific price target at expiration. Example: SPX at 4500, you expect it to stay near 4500. Buy 4490/4500/4510 call butterfly for $3. Max profit = $10 - $3 = $7 if SPX closes exactly at 4500.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'butterfly-spreads'),
   'butterfly-b2', 'key_concept', 'When to Use Butterflies',
   'Butterflies shine when: (1) You have a specific price target (broken-wing butterfly centered on target), (2) IV is high (selling the 2 middle options benefits from vol crush), (3) You want asymmetric risk/reward (small debit for potentially large payout). The trade-off: narrow profit zone. Wider butterflies have wider profit zones but lower max profit. For SPX expiration plays, butterflies can offer 3:1 to 10:1 reward-to-risk ratios.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'butterfly-spreads'),
   'butterfly-b3', 'quiz_single', 'Butterfly Quiz',
   'In a long call butterfly, maximum profit occurs when the underlying closes:', 2,
   '{"options":["Above the highest strike","Below the lowest strike","At the middle (short) strike","Anywhere between the outer strikes"],"correctIndex":2,"explanation":"Maximum profit on a butterfly occurs when the underlying closes exactly at the center (short) strike at expiration, where the short options expire ATM and the long options provide maximum spread value."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 5.1.3: Calendar & Diagonal Spreads
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'multi-leg-strategies'),
  'calendar-diagonal-spreads', 'Calendar & Diagonal Spreads',
  'Use time-based spreads to exploit theta differences between expirations',
  15, 'advanced'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["multi_leg","strategy_selection"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'calendar-diagonal-spreads'),
   'calendar-b1', 'text_explanation', 'Calendar Spread Mechanics',
   'A calendar spread buys a longer-dated option and sells a shorter-dated option at the same strike. The short option decays faster than the long, generating profit. Max profit occurs when the underlying is at the strike at short expiration. Calendars are positive vega — they benefit from IV increases. Use calendars when you expect the underlying to stay near the strike and IV to stay flat or increase.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'calendar-diagonal-spreads'),
   'calendar-b2', 'key_concept', 'Diagonal Spreads',
   'A **diagonal spread** combines different strikes AND different expirations. It is a calendar spread with a directional tilt. Example: Sell the front-month 4500 call, buy the back-month 4520 call. This creates a position that profits from time decay while maintaining upside exposure. Diagonals are flexible: they can be adjusted by rolling the short leg as it decays. Think of them as a "poor man''s covered call" using options instead of shares.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'calendar-diagonal-spreads'),
   'calendar-b3', 'quiz_single', 'Calendar Quiz',
   'Calendar spreads benefit from:', 2,
   '{"options":["Decreasing implied volatility","Large price moves away from the strike","Stable underlying price near the strike with maintained or increasing IV","Rapid gamma changes"],"correctIndex":2,"explanation":"Calendar spreads profit when the underlying stays near the strike (short option decays fastest ATM) and IV stays flat or increases (the spread is long vega)."}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 5.2: Portfolio-Level Thinking ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'advanced-strategies'),
  'portfolio-level-thinking',
  'portfolio-level-thinking',
  'Portfolio-Level Thinking',
  'Think beyond individual trades to manage aggregate portfolio exposure and correlation.',
  '["Evaluate portfolio-level Greeks and net exposure","Manage correlated positions and sector concentration","Plan trade allocation across strategies and time frames"]'::jsonb,
  40, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 5.2.1: Portfolio Greeks
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'portfolio-level-thinking'),
  'portfolio-greeks', 'Portfolio Greeks',
  'Aggregate and interpret Greeks across all positions for holistic risk management',
  15, 'advanced'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["portfolio_management","greeks_mastery"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'portfolio-greeks'),
   'port-greeks-b1', 'text_explanation', 'Aggregating Greeks',
   'Each individual position has its own Greeks. The portfolio aggregate tells you your total exposure: **Net Delta** = your directional bet summed across all positions. **Net Theta** = how much you earn or lose per day from time decay across the portfolio. **Net Vega** = your total exposure to implied volatility changes. A portfolio that is +200 delta, +$50 theta, -$30 vega is moderately bullish, earning from time decay, but vulnerable to a volatility spike.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'portfolio-greeks'),
   'port-greeks-b2', 'key_concept', 'Beta-Weighted Delta',
   'Since different underlyings move at different rates, **beta-weighted delta** normalizes everything to SPX. If you own AAPL calls with +100 delta and AAPL has a beta of 1.2 to SPX, your beta-weighted delta is +120 SPX-equivalent deltas. This lets you compare apples to oranges (pun intended) and understand your true portfolio directional exposure. Most brokerages offer beta-weighted portfolio views.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'portfolio-greeks'),
   'port-greeks-b3', 'quiz_single', 'Portfolio Greeks Quiz',
   'Why use beta-weighted delta instead of raw delta?', 2,
   '{"options":["It looks more professional","It normalizes directional exposure across different underlyings","It eliminates all risk","It is required by regulators"],"correctIndex":1,"explanation":"Beta-weighted delta converts all positions to a common benchmark (typically SPX), allowing you to understand your true aggregate directional exposure regardless of how many different stocks and ETFs you trade."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 5.2.2: Correlation & Diversification
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'portfolio-level-thinking'),
  'correlation-diversification', 'Correlation & Diversification',
  'Manage correlated risk and avoid hidden portfolio concentration',
  12, 'advanced'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["portfolio_management","risk_management"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'correlation-diversification'),
   'corr-b1', 'text_explanation', 'Hidden Correlation Risk',
   'Owning bull spreads on AAPL, MSFT, GOOGL, and AMZN feels diversified — but in a market selloff, all tech stocks drop together. Correlation increases during stress events (correlation goes to 1 in a crash). True diversification means spreading across sectors, strategies, and time frames. Also consider: selling premium on SPX while buying premium on VIX is not diversification — it is doubling the same bet.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'correlation-diversification'),
   'corr-b2', 'key_concept', 'Strategy Diversification',
   'Beyond asset diversification, diversify **strategies**: (1) Some directional trades (delta), (2) Some income trades (theta), (3) Some volatility trades (vega). And diversify **time frames**: some 0DTE, some weekly, some 30-60 DTE. This ensures no single market environment wipes out your entire portfolio. A balanced portfolio might be 40% directional spreads, 40% income (iron condors, credit spreads), and 20% volatility plays.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'correlation-diversification'),
   'corr-b3', 'reflection', 'Audit Your Portfolio',
   'Review your current or hypothetical portfolio. Are your positions truly diversified or secretly correlated? What percentage is directional vs income vs volatility? How would a 5% SPX drop affect your total P&L? Write your analysis.', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TRACK 6: TRADING PSYCHOLOGY (ADVANCED)
-- ============================================================================

-- ---------- Module 6.1: Mental Game ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'trading-psychology'),
  'mental-game',
  'mental-game',
  'The Mental Game',
  'Develop the psychological edge that separates consistent traders from the rest.',
  '["Identify and overcome cognitive biases in trading","Build pre-trade and post-trade mental routines","Manage tilt, revenge trading, and overtrading"]'::jsonb,
  45, 1, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 6.1.1: Cognitive Biases in Trading
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'mental-game'),
  'cognitive-biases-trading', 'Cognitive Biases in Trading',
  'Recognize the most common cognitive biases and their impact on trading decisions',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["trading_psychology","mental_game"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'cognitive-biases-trading'),
   'biases-b1', 'text_explanation', 'The Big Five Trading Biases',
   'Five biases destroy trading accounts: (1) **Confirmation bias**: Seeking information that confirms your existing view. (2) **Loss aversion**: Holding losers too long because losses feel 2x worse than equivalent gains feel good. (3) **Recency bias**: Overweighting the last few trades in your decision-making. (4) **Anchoring**: Fixating on your entry price instead of current market reality. (5) **Overconfidence**: After a winning streak, increasing size recklessly. Awareness is the first step; systematic rules are the cure.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'cognitive-biases-trading'),
   'biases-b2', 'key_concept', 'Process Over Outcome',
   'A good trade can lose money. A bad trade can make money. Judge yourself on **process**, not outcome. Did you follow your plan? Was the setup valid? Was the size correct? Was the stop in place? If yes, the outcome is irrelevant to your process quality. Over hundreds of trades, good process produces good results. But on any single trade, luck dominates. This mindset shift is the foundation of professional trading psychology.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'cognitive-biases-trading'),
   'biases-b3', 'quiz_single', 'Bias Quiz',
   'You are holding a losing position and find yourself only reading news articles that support your bullish thesis. This is an example of:', 2,
   '{"options":["Recency bias","Loss aversion","Confirmation bias","Overconfidence"],"correctIndex":2,"explanation":"Confirmation bias is seeking information that confirms your existing belief while ignoring contradictory evidence. This is especially dangerous when holding a losing position."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 6.1.2: Managing Tilt
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'mental-game'),
  'managing-tilt', 'Managing Tilt & Revenge Trading',
  'Recognize emotional escalation and implement circuit breakers to prevent destructive trading',
  15, 'intermediate'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["trading_psychology","mental_game"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'managing-tilt'),
   'tilt-b1', 'text_explanation', 'The Tilt Cascade',
   'Tilt is an emotional state where frustration, anger, or desperation overrides rational decision-making. The cascade: (1) A losing trade triggers frustration. (2) Frustration leads to a revenge trade with larger size. (3) The revenge trade loses (because it was impulsive). (4) Panic sets in, leading to more desperate trades. (5) The day ends with a catastrophic drawdown. The entire cascade can unfold in 30 minutes. Prevention is the only cure.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'managing-tilt'),
   'tilt-b2', 'key_concept', 'Circuit Breakers',
   'Install personal circuit breakers: (1) **2-loss rule**: After 2 consecutive losses, take a 30-minute break. (2) **Daily stop**: Hit your max daily loss? Close all positions and shut down. (3) **Size lock**: Never increase position size after a loss. (4) **Physical reset**: Get up, walk, drink water. The screen will still be there. (5) **Pre-commitment**: Write these rules down and sign them. Treat them as non-negotiable. The best trade you ever make might be the one you do not take.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'managing-tilt'),
   'tilt-b3', 'reflection', 'Your Tilt Patterns',
   'Think about your last 3 worst trading days. What triggered the emotional cascade? At what point could you have stopped? What circuit breaker would have prevented the damage? Write down your personal tilt prevention plan.', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 6.1.3: Pre-Trade Routine
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'mental-game'),
  'pre-trade-routine', 'Building Your Pre-Trade Routine',
  'Design a systematic pre-market and pre-trade routine for consistent execution',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["mental_game","trading_psychology"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'pre-trade-routine'),
   'routine-b1', 'text_explanation', 'The Power of Routine',
   'Every elite performer has a routine. Surgeons, pilots, and athletes all use checklists and rituals. A pre-trade routine shifts your brain from reactive mode to analytical mode. It reduces impulsive decisions. It creates consistency even when emotions are high. A simple routine: (1) Review overnight action. (2) Check economic calendar. (3) Set key levels on your charts. (4) Review your open positions. (5) Assess your mental state (1-10 rating). If below 7, reduce size or skip the day.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'pre-trade-routine'),
   'routine-b2', 'key_concept', 'Mental State Assessment',
   'Before trading, honestly rate your mental state: **Sleep quality** (well-rested vs exhausted), **Stress level** (calm vs overwhelmed), **Emotional state** (neutral vs angry/euphoric), **Focus** (sharp vs distracted). If 2+ categories are red, reduce position size by 50% or skip trading entirely. Your mental state is a risk factor just like VIX. Ignoring it is like ignoring a flashing warning light on the dashboard.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'pre-trade-routine'),
   'routine-b3', 'reflection', 'Design Your Routine',
   'Create a 5-step pre-market routine that you will follow every trading day. Include: market review, level-setting, mental state check, position review, and sizing decision. Be specific about timing and actions.', 2,
   '{"minWords":40}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- Module 6.2: Performance Optimization ----------

INSERT INTO academy_modules (
  track_id, slug, code, title, description, learning_outcomes,
  estimated_minutes, position, is_published, metadata
)
VALUES (
  (SELECT t.id FROM academy_tracks t JOIN academy_programs p ON p.id = t.program_id
   WHERE p.code = 'titm-core-program' AND t.code = 'trading-psychology'),
  'performance-optimization',
  'performance-optimization',
  'Performance Optimization',
  'Use journaling, review processes, and systematic improvement to optimize your trading performance.',
  '["Build and maintain an effective trading journal","Conduct structured weekly and monthly reviews","Identify and eliminate recurring trading mistakes"]'::jsonb,
  40, 2, true, '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  learning_outcomes = EXCLUDED.learning_outcomes, estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position, is_published = EXCLUDED.is_published, updated_at = now();

-- Lesson 6.2.1: The Trading Journal
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'performance-optimization'),
  'the-trading-journal', 'The Trading Journal',
  'Build a comprehensive trading journal that captures the data needed for improvement',
  15, 'beginner'::academy_difficulty, '{}'::uuid[], 0, true,
  '{"competenciesTargeted":["performance_review","trading_psychology"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'the-trading-journal'),
   'journal-b1', 'text_explanation', 'Why Journal?',
   'Your trading journal is your most valuable tool for improvement. Memory is unreliable — we forget losing trades and exaggerate winners. A journal provides the objective data needed to identify patterns: What setups work? What time of day are you sharpest? Which mistakes keep repeating? Minimum fields per trade: date, time, instrument, direction, entry, exit, size, P&L, setup type, screenshot, and a brief note on mental state and execution quality.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'the-trading-journal'),
   'journal-b2', 'key_concept', 'Quality Score System',
   'Rate every trade on a 1-5 **execution quality** scale independent of P&L: **5** = Perfect execution of plan. **4** = Minor deviation but acceptable. **3** = Average, some mistakes. **2** = Significant deviation from plan. **1** = Impulsive/emotional trade. Over time, plot your quality scores against P&L. You will find that high-quality trades are profitable over time, even if individual trades lose. This reinforces process-over-outcome thinking.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'the-trading-journal'),
   'journal-b3', 'quiz_single', 'Journal Quiz',
   'The primary purpose of a trading journal is to:', 2,
   '{"options":["Calculate taxes","Show off winning trades","Provide objective data for identifying patterns and improving performance","Meet regulatory requirements"],"correctIndex":2,"explanation":"The primary purpose of a trading journal is to provide objective data that reveals patterns, strengths, weaknesses, and areas for improvement that memory alone cannot accurately capture."}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 6.2.2: Weekly & Monthly Reviews
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'performance-optimization'),
  'weekly-monthly-reviews', 'Weekly & Monthly Reviews',
  'Conduct structured periodic reviews to identify patterns and drive continuous improvement',
  12, 'beginner'::academy_difficulty, '{}'::uuid[], 1, true,
  '{"competenciesTargeted":["performance_review"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'weekly-monthly-reviews'),
   'review-b1', 'text_explanation', 'The Weekly Review',
   'Every weekend, spend 30-60 minutes reviewing the week. Framework: (1) **Statistics**: Win rate, average winner vs loser, total P&L, number of trades. (2) **Best trade of the week**: Why was it good? Replicate the process. (3) **Worst trade**: What went wrong? How to prevent repetition? (4) **Rule compliance**: Did you follow your trading plan? (5) **Next week**: Any changes to approach, size, or focus areas? Write it all down. Patterns emerge over 4-6 weeks.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'weekly-monthly-reviews'),
   'review-b2', 'key_concept', 'The Monthly Deep Dive',
   'Monthly reviews go deeper: (1) **Equity curve analysis**: Is your account growing, flat, or declining? (2) **Strategy breakdown**: Which setups are profitable? Which should be eliminated? (3) **Time analysis**: What days/times are you most profitable? (4) **Mistake categorization**: Group errors (sizing, timing, FOMO, revenge trading) and rank by cost. (5) **One improvement goal**: Pick the single highest-impact improvement for next month. Do not try to fix everything at once.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'weekly-monthly-reviews'),
   'review-b3', 'reflection', 'Plan Your Review Process',
   'When will you do your weekly review? Monthly review? What metrics will you track? What questions will you answer? Commit to a specific day and time for each review. Write your plan.', 2,
   '{"minWords":30}'::jsonb)
ON CONFLICT DO NOTHING;

-- Lesson 6.2.3: Eliminating Recurring Mistakes
INSERT INTO academy_lessons (module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata)
VALUES (
  (SELECT id FROM academy_modules WHERE slug = 'performance-optimization'),
  'eliminating-mistakes', 'Eliminating Recurring Mistakes',
  'Systematically identify and eliminate the most costly recurring trading errors',
  12, 'intermediate'::academy_difficulty, '{}'::uuid[], 2, true,
  '{"competenciesTargeted":["performance_review","trading_psychology"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, learning_objective = EXCLUDED.learning_objective, updated_at = now();

INSERT INTO academy_lesson_blocks (lesson_id, slug, block_type, title, body, position, metadata)
VALUES
  ((SELECT id FROM academy_lessons WHERE slug = 'eliminating-mistakes'),
   'mistakes-b1', 'text_explanation', 'The Mistake Audit',
   'After 30+ trades in your journal, run a mistake audit: (1) List every trade rated 1-2 on quality. (2) Categorize each mistake: FOMO entry, early exit, late stop, oversized, revenge trade, no setup, ignored plan. (3) Calculate the dollar cost of each category. (4) Rank by total cost. You will likely find that 1-2 mistake types account for 80% of your losses. Eliminating just those 1-2 patterns can transform your results.', 0, '{}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'eliminating-mistakes'),
   'mistakes-b2', 'key_concept', 'The One-Mistake Protocol',
   'Pick your single most expensive mistake pattern. For the next 20 trades, focus exclusively on eliminating that one error. Put a sticky note on your monitor. When you feel the urge to make that mistake, pause, read the note, and step away for 2 minutes. Track your compliance. Once you have gone 20 consecutive trades without that mistake, move to the next most costly error. This one-at-a-time approach is more effective than trying to fix everything simultaneously.', 1, '{"highlight":true}'::jsonb),
  ((SELECT id FROM academy_lessons WHERE slug = 'eliminating-mistakes'),
   'mistakes-b3', 'reflection', 'Your Top Mistake',
   'Without looking at journal data (if you do not have one yet, use your best memory): What is your single most recurring trading mistake? How much has it cost you? What specific rule or circuit breaker would prevent it? Commit to addressing this one pattern.', 2,
   '{"minWords":30}'::jsonb)
ON CONFLICT DO NOTHING;

COMMIT;
