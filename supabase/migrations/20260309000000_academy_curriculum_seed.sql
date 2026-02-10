-- ============================================================================
-- TITM Academy Curriculum Seed Data
-- 5 Learning Paths, 14 Courses, 71 Lessons with full content & quiz data
-- ============================================================================

DO $$
DECLARE
  -- Learning Path IDs
  v_path1_id uuid;
  v_path2_id uuid;
  v_path3_id uuid;
  v_path4_id uuid;
  v_path5_id uuid;
  -- Course IDs (14 courses)
  v_c1_id uuid;
  v_c2_id uuid;
  v_c3_id uuid;
  v_c4_id uuid;
  v_c5_id uuid;
  v_c6_id uuid;
  v_c7_id uuid;
  v_c8_id uuid;
  v_c9_id uuid;
  v_c10_id uuid;
  v_c11_id uuid;
  v_c12_id uuid;
  v_c13_id uuid;
  v_c14_id uuid;
BEGIN

-- ============================================================
-- LEARNING PATH 1: Options Scalping Fundamentals
-- ============================================================

INSERT INTO learning_paths (name, slug, description, tier_required, difficulty_level, estimated_hours, icon_name, is_published, display_order)
VALUES (
  'Options Scalping Fundamentals',
  'options-scalping-fundamentals',
  'Master the art of 0DTE and sub-DTE options scalping on SPX and NDX. Learn precise entries, risk management, and the psychology of rapid-fire trading.',
  'core',
  'beginner',
  40,
  'zap',
  true,
  1
)
RETURNING id INTO v_path1_id;

-- ============================================================
-- COURSES
-- ============================================================

-- Course 1: Options Basics 101
INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Options Basics 101',
  'options-basics-101',
  'Build your foundation in options trading. Understand calls, puts, premium, and the basic mechanics before risking real capital.',
  'beginner'::difficulty_level,
  8,
  70,
  'core',
  true,
  1
)
RETURNING id INTO v_c1_id;

-- Course 2: Understanding the Greeks
INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Understanding the Greeks',
  'understanding-the-greeks',
  E'Decode the Greeks \u2014 Delta, Gamma, Theta, Vega, and Rho. Learn how each affects your P&L and why they matter for every trade.',
  'beginner'::difficulty_level,
  8,
  70,
  'core',
  true,
  2
)
RETURNING id INTO v_c2_id;

-- Course 3: SPX/NDX 0DTE Mechanics
INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'SPX/NDX 0DTE Mechanics',
  'spx-ndx-0dte-mechanics',
  'Deep dive into same-day expiration (0DTE) options on SPX and NDX. Understand settlement, margin, and the unique behavior of index options.',
  'beginner'::difficulty_level,
  6,
  70,
  'core',
  true,
  3
)
RETURNING id INTO v_c3_id;

-- Course 4: Scalping Entry & Exit Strategies
INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Scalping Entry & Exit Strategies',
  'scalping-entry-exit-strategies',
  'Learn battle-tested entry and exit techniques for 0DTE scalping. Master order types, timing, and the discipline to cut losses fast.',
  'intermediate'::difficulty_level,
  10,
  70,
  'core',
  true,
  4
)
RETURNING id INTO v_c4_id;

-- Course 5: Risk Management for Scalpers
INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Risk Management for Scalpers',
  'risk-management-for-scalpers',
  'Survive and thrive as a scalper. Learn position sizing, max daily loss limits, and the psychology of protecting your capital.',
  'beginner'::difficulty_level,
  8,
  70,
  'core',
  true,
  5
)
RETURNING id INTO v_c5_id;

-- ============================================================
-- LEARNING PATH <-> COURSE JUNCTION
-- ============================================================

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path1_id, v_c1_id, 1);

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path1_id, v_c2_id, 2);

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path1_id, v_c3_id, 3);

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path1_id, v_c4_id, 4);

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path1_id, v_c5_id, 5);

-- ============================================================
-- COURSE 1 LESSONS: Options Basics 101
-- ============================================================

-- C1 Lesson 1: What Are Options? Calls vs Puts Explained
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c1_id,
  'What Are Options? Calls vs Puts Explained',
  'what-are-options-calls-vs-puts',
  E'## What Are Options?\n\nAn option is a financial contract that gives the buyer the **right, but not the obligation**, to buy or sell an underlying asset at a specified price (the strike price) on or before a specified date (the expiration date). Unlike buying stock directly, options allow traders to control a large notional value of shares for a fraction of the cost. Each standard equity options contract represents 100 shares of the underlying asset.\n\nOptions come in two fundamental flavors: **calls** and **puts**. A call option gives the holder the right to **buy** the underlying asset at the strike price. A put option gives the holder the right to **sell** the underlying asset at the strike price. When you buy a call, you are bullish — you profit when the underlying goes up. When you buy a put, you are bearish — you profit when the underlying goes down.\n\n## Buyers vs Sellers\n\nEvery options trade has two sides. The **buyer** (also called the holder) pays the premium and receives the right. The **seller** (also called the writer) collects the premium and takes on the obligation. If you sell a call, you may be obligated to sell shares at the strike price. If you sell a put, you may be obligated to buy shares at the strike price. Buyers have limited risk (the premium paid) and theoretically unlimited upside on calls. Sellers have limited profit (the premium collected) but can face significant losses.\n\n## A Simple Example\n\nImagine SPX is trading at 5,000. You buy a 5,000 call expiring today for $5.00. Since each point on SPX is worth $100 per contract, you pay $500 in premium. If SPX rises to 5,020 by expiration, your call is worth $20.00, or $2,000. Your profit is $2,000 - $500 = $1,500. If SPX stays at or below 5,000, your call expires worthless and you lose the $500 premium. That maximum loss is defined from the start — this is one of the key advantages of buying options.\n\nConversely, if you had bought a 5,000 put for $5.00, you would profit if SPX falls below 5,000. At 4,980, the put is worth $20.00, giving you the same $1,500 profit. Understanding this symmetry between calls and puts is essential before you place your first trade.',
  'text'::lesson_type,
  20,
  1,
  ARRAY['An option gives the right but not the obligation to buy or sell at a specific price by a specific date', 'Call options profit when the underlying rises; put options profit when it falls', 'Option buyers have limited risk equal to the premium paid', 'Every options contract has a buyer (holder) and a seller (writer) with opposite risk profiles'],
  ARRAY['Explain the difference between calls and puts in simple terms', 'Why would someone sell options instead of buying them?', 'What does it mean when an option expires worthless?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What right does a CALL option give the buyer?", "options": [{"id": "a", "text": "The right to sell the underlying at the strike price"}, {"id": "b", "text": "The right to buy the underlying at the strike price"}, {"id": "c", "text": "The obligation to buy the underlying at the strike price"}, {"id": "d", "text": "The obligation to sell the underlying at the strike price"}], "correct_answer": "b", "explanation": "A call option gives the buyer the right, but not the obligation, to BUY the underlying asset at the strike price."},
    {"id": "q2", "type": "multiple_choice", "text": "How many shares does one standard equity options contract represent?", "options": [{"id": "a", "text": "10 shares"}, {"id": "b", "text": "50 shares"}, {"id": "c", "text": "100 shares"}, {"id": "d", "text": "1,000 shares"}], "correct_answer": "c", "explanation": "One standard equity options contract represents 100 shares of the underlying asset."},
    {"id": "q3", "type": "multiple_choice", "text": "What is the maximum loss for an option buyer?", "options": [{"id": "a", "text": "Unlimited"}, {"id": "b", "text": "The strike price"}, {"id": "c", "text": "The premium paid"}, {"id": "d", "text": "50% of the premium"}], "correct_answer": "c", "explanation": "The maximum loss for an option buyer is the premium paid for the contract. The option can expire worthless, but you cannot lose more than what you paid."},
    {"id": "q4", "type": "multiple_choice", "text": "If you are bearish on a stock, which option would you buy?", "options": [{"id": "a", "text": "A call option"}, {"id": "b", "text": "A put option"}, {"id": "c", "text": "A covered call"}, {"id": "d", "text": "A stock share"}], "correct_answer": "b", "explanation": "A put option profits when the underlying price decreases, making it the appropriate choice for a bearish outlook."},
    {"id": "q5", "type": "multiple_choice", "text": "Who takes on the OBLIGATION in an options contract?", "options": [{"id": "a", "text": "The buyer (holder)"}, {"id": "b", "text": "The broker"}, {"id": "c", "text": "The seller (writer)"}, {"id": "d", "text": "Both buyer and seller equally"}], "correct_answer": "c", "explanation": "The seller (writer) of an option takes on the obligation. They collect premium in exchange for the obligation to fulfill the contract if the buyer exercises."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C1 Lesson 2: Option Premium: Intrinsic vs Extrinsic Value
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c1_id,
  'Option Premium: Intrinsic vs Extrinsic Value',
  'option-premium-intrinsic-vs-extrinsic',
  E'## Understanding Option Premium\n\nThe price you pay for an option is called the **premium**. This premium is composed of two distinct components: **intrinsic value** and **extrinsic value** (also called time value). Understanding this breakdown is critical because it tells you exactly what you are paying for and how your option''s value will change over time.\n\nThe formula is straightforward: **Premium = Intrinsic Value + Extrinsic Value**.\n\n## Intrinsic Value\n\nIntrinsic value represents the amount by which an option is **in-the-money (ITM)**. For a call option, intrinsic value = Underlying Price - Strike Price (if positive, otherwise zero). For a put option, intrinsic value = Strike Price - Underlying Price (if positive, otherwise zero). Intrinsic value can never be negative — it is either positive or zero.\n\nFor example, if SPX is trading at 5,050 and you hold a 5,000 call, the intrinsic value is $50. This is the amount you would receive if you could exercise the option right now. If SPX is at 4,980, that same 5,000 call has zero intrinsic value because it is out-of-the-money.\n\n## Extrinsic Value (Time Value)\n\nExtrinsic value is everything above intrinsic value. It represents the **possibility** that the option could become more valuable before expiration. Extrinsic value is influenced by three major factors: time remaining until expiration, implied volatility of the underlying, and interest rates.\n\nThe more time until expiration, the more extrinsic value an option typically has, because there is more opportunity for the underlying to move favorably. This is why extrinsic value is often called "time value." As expiration approaches, extrinsic value decays — a process known as **time decay** or **theta decay**. For 0DTE scalpers, this decay is extremely rapid and is one of the primary forces you must understand.\n\n## Practical Implications for Scalpers\n\nAs a 0DTE scalper, you are trading options where extrinsic value is melting away by the minute. An at-the-money SPX option at 9:30 AM might have $10 of pure extrinsic value. By 2:00 PM, that same option might only have $2-3 of extrinsic value left, even if SPX has not moved. This means you need the underlying to move quickly and decisively in your favor to overcome time decay. Understanding the premium breakdown helps you choose the right strikes and manage your trades with precision.',
  'text'::lesson_type,
  20,
  2,
  ARRAY['Option premium equals intrinsic value plus extrinsic value', 'Intrinsic value is the in-the-money amount and can never be negative', 'Extrinsic value reflects time remaining, implied volatility, and interest rates', 'For 0DTE options, extrinsic value decays extremely rapidly throughout the trading day'],
  ARRAY['How does time decay affect 0DTE options differently than weekly options?', 'Can an out-of-the-money option have intrinsic value?', 'Why does implied volatility increase extrinsic value?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is the formula for option premium?", "options": [{"id": "a", "text": "Premium = Strike Price + Underlying Price"}, {"id": "b", "text": "Premium = Intrinsic Value + Extrinsic Value"}, {"id": "c", "text": "Premium = Delta + Theta"}, {"id": "d", "text": "Premium = Bid + Ask"}], "correct_answer": "b", "explanation": "Option premium is composed of two parts: intrinsic value (the in-the-money amount) plus extrinsic value (time value and volatility premium)."},
    {"id": "q2", "type": "multiple_choice", "text": "SPX is at 5,100. What is the intrinsic value of a 5,050 call?", "options": [{"id": "a", "text": "$0"}, {"id": "b", "text": "$50"}, {"id": "c", "text": "$100"}, {"id": "d", "text": "$5,050"}], "correct_answer": "b", "explanation": "For a call, intrinsic value = Underlying Price - Strike Price = 5,100 - 5,050 = $50. The call is $50 in-the-money."},
    {"id": "q3", "type": "multiple_choice", "text": "An at-the-money option has:", "options": [{"id": "a", "text": "Only intrinsic value"}, {"id": "b", "text": "Only extrinsic value"}, {"id": "c", "text": "Neither intrinsic nor extrinsic value"}, {"id": "d", "text": "Negative intrinsic value"}], "correct_answer": "b", "explanation": "An at-the-money option has zero intrinsic value (strike = underlying price), so its entire premium consists of extrinsic (time) value."},
    {"id": "q4", "type": "multiple_choice", "text": "What happens to extrinsic value as expiration approaches?", "options": [{"id": "a", "text": "It increases"}, {"id": "b", "text": "It stays the same"}, {"id": "c", "text": "It decreases (decays)"}, {"id": "d", "text": "It converts to intrinsic value"}], "correct_answer": "c", "explanation": "Extrinsic value decays as expiration approaches. This is known as time decay or theta decay. At expiration, extrinsic value is zero."},
    {"id": "q5", "type": "multiple_choice", "text": "Can intrinsic value ever be negative?", "options": [{"id": "a", "text": "Yes, for deep out-of-the-money options"}, {"id": "b", "text": "Yes, when volatility is low"}, {"id": "c", "text": "No, intrinsic value is always zero or positive"}, {"id": "d", "text": "Only for put options"}], "correct_answer": "c", "explanation": "Intrinsic value can never be negative. If the option is out-of-the-money, intrinsic value is simply zero."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C1 Lesson 3: Reading an Options Chain Like a Pro
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c1_id,
  'Reading an Options Chain Like a Pro',
  'reading-an-options-chain',
  E'## The Options Chain\n\nAn options chain (also called an option chain or option matrix) is a table that displays all available option contracts for a given underlying asset. It is organized by expiration date and strike price, with calls typically on the left side and puts on the right. Learning to read an options chain fluently is essential — it is the primary tool you will use to select your trades.\n\n## Key Columns Explained\n\nEach row in an options chain represents a specific strike price. The key columns you will encounter include: **Bid** (the highest price a buyer is willing to pay), **Ask** (the lowest price a seller is willing to accept), **Last** (the price of the most recent trade), **Volume** (number of contracts traded today), **Open Interest** (total number of outstanding contracts), and **Implied Volatility** (the market''s expectation of future volatility). The **bid-ask spread** (the difference between bid and ask) is crucial for scalpers — a wide spread means higher transaction costs.\n\n## Identifying Liquidity\n\nFor scalpers, **liquidity is king**. You want to trade strikes with tight bid-ask spreads, high volume, and substantial open interest. On SPX 0DTE options, the at-the-money and near-the-money strikes typically have the tightest spreads — often $0.10 to $0.30 wide. As you move further out-of-the-money, spreads widen and liquidity drops. Trading illiquid strikes means you give up edge on every entry and exit. Always check the bid-ask spread before entering a trade.\n\n## Practical Chain Reading\n\nWhen you open an options chain for SPX, start by selecting today''s expiration for 0DTE trades. Locate the current SPX price and find the at-the-money strike. Look at the bid-ask spreads for strikes within 20-30 points of the current price — these are your primary playground. Note the volume column: high-volume strikes are where institutional and professional traders are active, which means better fills. Open interest tells you how many contracts are outstanding from previous sessions, indicating established positions and potential support/resistance at those strikes.\n\nPay attention to the implied volatility column as well. Higher IV means options are more expensive (higher extrinsic value), which can be advantageous for sellers but costly for buyers. During high-volatility events like FOMC announcements or CPI releases, IV expands dramatically, affecting premiums across the entire chain.',
  'text'::lesson_type,
  25,
  3,
  ARRAY['An options chain displays all available contracts organized by strike price and expiration', 'Bid-ask spread is critical for scalpers — tighter spreads mean lower transaction costs', 'Volume and open interest indicate liquidity and institutional activity', 'For 0DTE scalping focus on at-the-money and near-the-money strikes with the tightest spreads'],
  ARRAY['What is the difference between volume and open interest?', 'How do I find the most liquid strikes for scalping?', 'Why does the bid-ask spread matter so much for scalpers?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does the \"Bid\" price represent in an options chain?", "options": [{"id": "a", "text": "The lowest price a seller will accept"}, {"id": "b", "text": "The highest price a buyer is willing to pay"}, {"id": "c", "text": "The last traded price"}, {"id": "d", "text": "The theoretical fair value"}], "correct_answer": "b", "explanation": "The bid is the highest price a buyer is currently willing to pay for the option. When you sell an option, you receive the bid price (or close to it)."},
    {"id": "q2", "type": "multiple_choice", "text": "What does Open Interest indicate?", "options": [{"id": "a", "text": "The number of contracts traded today"}, {"id": "b", "text": "The total number of outstanding (open) contracts"}, {"id": "c", "text": "The number of market makers at a strike"}, {"id": "d", "text": "The implied volatility at a strike"}], "correct_answer": "b", "explanation": "Open interest is the total number of outstanding options contracts that have not been closed, exercised, or expired. It indicates the total open positions at that strike."},
    {"id": "q3", "type": "multiple_choice", "text": "Why is a tight bid-ask spread important for scalpers?", "options": [{"id": "a", "text": "It means the option is overpriced"}, {"id": "b", "text": "It reduces transaction costs on entries and exits"}, {"id": "c", "text": "It guarantees a profitable trade"}, {"id": "d", "text": "It means the option has high gamma"}], "correct_answer": "b", "explanation": "A tight bid-ask spread means lower transaction costs. Scalpers enter and exit frequently, so even small improvements in spread save significant money over time."},
    {"id": "q4", "type": "multiple_choice", "text": "Which strikes typically have the BEST liquidity on SPX 0DTE options?", "options": [{"id": "a", "text": "Deep in-the-money strikes"}, {"id": "b", "text": "At-the-money and near-the-money strikes"}, {"id": "c", "text": "Deep out-of-the-money strikes"}, {"id": "d", "text": "All strikes have equal liquidity"}], "correct_answer": "b", "explanation": "At-the-money and near-the-money strikes have the highest volume and tightest spreads because that is where most trading activity is concentrated."},
    {"id": "q5", "type": "multiple_choice", "text": "What does high implied volatility in the options chain mean for option premiums?", "options": [{"id": "a", "text": "Premiums are cheaper"}, {"id": "b", "text": "Premiums are more expensive"}, {"id": "c", "text": "Premiums are unaffected"}, {"id": "d", "text": "Only put premiums increase"}], "correct_answer": "b", "explanation": "Higher implied volatility increases the extrinsic value component of option premiums, making both calls and puts more expensive."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C1 Lesson 4: Strike Price Selection & Moneyness
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c1_id,
  'Strike Price Selection & Moneyness',
  'strike-price-selection-moneyness',
  E'## Understanding Moneyness\n\nMoneyness describes the relationship between an option''s strike price and the current price of the underlying asset. There are three states: **In-the-Money (ITM)**, **At-the-Money (ATM)**, and **Out-of-the-Money (OTM)**. For calls, an option is ITM when the underlying price is above the strike, ATM when approximately equal, and OTM when below. For puts, it is reversed: ITM when the underlying is below the strike, and OTM when above.\n\n## Why Moneyness Matters\n\nMoneyness directly affects the option''s premium composition, Greeks behavior, and risk/reward profile. ITM options have significant intrinsic value and move more closely with the underlying (higher delta). ATM options have the most extrinsic value and moderate delta (approximately 0.50 for calls). OTM options are cheaper but require a larger move in the underlying to become profitable, and they have the highest percentage of extrinsic value.\n\nFor scalpers, the choice of moneyness is a core strategic decision. ATM options offer a balance of cost, delta, and liquidity. Slightly OTM options are cheaper and offer more leverage, but they need a bigger move to profit. Slightly ITM options cost more but move more predictably with the underlying.\n\n## Strike Selection for 0DTE Scalping\n\nWhen scalping 0DTE SPX options, most traders focus on strikes within 10-20 points of the current price. The ATM strike (say SPX at 5,000, using the 5,000 strike) provides the best liquidity and a delta near 0.50, meaning for every $1 move in SPX, the option moves roughly $0.50. A 10-point OTM call (5,010 strike when SPX is at 5,000) is cheaper but has a lower delta — perhaps 0.35-0.40.\n\nConsider cost versus probability. An ATM 0DTE call might cost $8.00 ($800 per contract), while a 20-point OTM call might cost only $2.00 ($200 per contract). The OTM option is cheaper, but it needs SPX to rally 20+ points just to reach breakeven. The ATM option breaks even with just an 8-point move. There is no universally "best" strike — it depends on your market thesis, risk tolerance, and the specific setup.\n\n## Practical Guidelines\n\nAs a beginner scalper, start with ATM or 1-2 strikes OTM. These give you the best combination of liquidity, delta, and affordability. Avoid going more than 20-30 points OTM on 0DTE trades — those options have very low delta and are essentially lottery tickets. As you gain experience, you will develop a feel for which strikes match your setups and market conditions.',
  'text'::lesson_type,
  20,
  4,
  ARRAY['Moneyness describes whether an option is in-the-money, at-the-money, or out-of-the-money', 'ATM options have delta near 0.50 and the highest extrinsic value', 'OTM options are cheaper but need a larger underlying move to profit', 'For 0DTE scalping start with ATM or slightly OTM strikes for the best liquidity and delta balance'],
  ARRAY['Should I buy ITM or OTM options for scalping?', 'What delta should I target for 0DTE trades?', 'How does moneyness affect my breakeven point?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "SPX is at 5,000. A 4,980 call is:", "options": [{"id": "a", "text": "Out-of-the-money"}, {"id": "b", "text": "At-the-money"}, {"id": "c", "text": "In-the-money"}, {"id": "d", "text": "Cannot be determined"}], "correct_answer": "c", "explanation": "A call is in-the-money when the underlying price (5,000) is above the strike price (4,980). This call has $20 of intrinsic value."},
    {"id": "q2", "type": "multiple_choice", "text": "What is the approximate delta of an at-the-money call option?", "options": [{"id": "a", "text": "0.10"}, {"id": "b", "text": "0.25"}, {"id": "c", "text": "0.50"}, {"id": "d", "text": "1.00"}], "correct_answer": "c", "explanation": "An at-the-money call option has a delta of approximately 0.50. This means it moves about $0.50 for every $1.00 move in the underlying."},
    {"id": "q3", "type": "multiple_choice", "text": "Which option type has the HIGHEST percentage of extrinsic value?", "options": [{"id": "a", "text": "Deep in-the-money options"}, {"id": "b", "text": "At-the-money options"}, {"id": "c", "text": "Deep out-of-the-money options"}, {"id": "d", "text": "All options have the same ratio"}], "correct_answer": "b", "explanation": "At-the-money options have the highest absolute extrinsic value. Deep OTM options are 100% extrinsic but have small absolute premium. ATM options maximize the time value component."},
    {"id": "q4", "type": "multiple_choice", "text": "For a put option, which condition makes it in-the-money?", "options": [{"id": "a", "text": "Underlying price is above the strike price"}, {"id": "b", "text": "Underlying price is below the strike price"}, {"id": "c", "text": "Underlying price equals the strike price"}, {"id": "d", "text": "Implied volatility is high"}], "correct_answer": "b", "explanation": "A put option is in-the-money when the underlying price is below the strike price. The holder can sell at the strike (higher) and buy at the market price (lower)."},
    {"id": "q5", "type": "multiple_choice", "text": "Why might a scalper prefer ATM strikes over deep OTM strikes for 0DTE?", "options": [{"id": "a", "text": "ATM options are always cheaper"}, {"id": "b", "text": "ATM options have higher delta and better liquidity"}, {"id": "c", "text": "OTM options cannot be traded on 0DTE"}, {"id": "d", "text": "ATM options have no extrinsic value"}], "correct_answer": "b", "explanation": "ATM options have a delta near 0.50 (higher responsiveness to price movement) and typically have the tightest bid-ask spreads and highest volume, making them ideal for scalping."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C1 Lesson 5: Expiration Dates & Time Decay Basics
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c1_id,
  'Expiration Dates & Time Decay Basics',
  'expiration-dates-time-decay-basics',
  E'## Options Expiration Explained\n\nEvery options contract has an expiration date — the date on which the contract ceases to exist. After expiration, the option either settles (if in-the-money) or expires worthless (if out-of-the-money). For equity options, expiration is typically the third Friday of each month, but weekly and daily expirations are now available for popular underlyings like SPX, NDX, and major ETFs. **0DTE** (zero days to expiration) refers to trading options on their expiration day itself.\n\nSPX options now expire every Monday through Friday, giving traders a fresh set of 0DTE opportunities each trading day. This high-frequency expiration cycle is what makes index options scalping possible as a full-time strategy.\n\n## Time Decay (Theta Decay)\n\nTime decay is the reduction in an option''s extrinsic value as expiration approaches. All else being equal, an option is worth less tomorrow than it is today because there is less time for a favorable price move. This erosion is measured by the Greek called **theta**, which represents the dollar amount an option''s price decreases per day, assuming no other changes.\n\nCritically, time decay is **not linear** — it accelerates as expiration approaches. An option with 30 days to expiration might lose $0.05 per day, but with 1 day to expiration, it might lose $1.00 or more per day. On 0DTE, this acceleration is extreme: an at-the-money SPX option can lose most of its extrinsic value in just a few hours. The rate of decay follows roughly the inverse of the square root of time remaining.\n\n## Time Decay Curve\n\nThe time decay curve is steepest in the final hours before expiration. For 0DTE traders, this means the window for profitable trades narrows as the day progresses. At 9:30 AM ET (market open), ATM options have maximum extrinsic value for the day. By noon, roughly half has decayed. By 3:00 PM, very little extrinsic value remains. This is why many scalpers focus their activity on the first two hours of the trading session when premium is richest and moves are most impactful.\n\n## Impact on Scalping Strategy\n\nAs a buyer of 0DTE options, time decay works against you every minute. You need the underlying to move quickly and sufficiently to overcome the decay. This is why scalpers use tight stop losses and take profits quickly — holding too long lets theta eat into your position. Conversely, sellers of 0DTE options benefit from time decay as it works in their favor, but they face unlimited risk if the underlying makes a large move against them.',
  'text'::lesson_type,
  20,
  5,
  ARRAY['Options expire on a fixed date and either settle in-the-money or expire worthless', 'Time decay (theta) accelerates as expiration approaches following a non-linear curve', 'On 0DTE, ATM options can lose most of their extrinsic value within hours', 'Scalpers must act quickly because time decay on 0DTE works against option buyers every minute'],
  ARRAY['Why is time decay non-linear near expiration?', 'What time of day is best for 0DTE scalping?', 'How does theta differ between weekly and 0DTE options?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does 0DTE stand for?", "options": [{"id": "a", "text": "Zero Delta Theta Estimate"}, {"id": "b", "text": "Zero Days To Expiration"}, {"id": "c", "text": "Zero Down Trading Environment"}, {"id": "d", "text": "Zero Directional Trade Entry"}], "correct_answer": "b", "explanation": "0DTE stands for Zero Days To Expiration, meaning the option expires on the same day it is being traded."},
    {"id": "q2", "type": "multiple_choice", "text": "How does time decay behave as expiration approaches?", "options": [{"id": "a", "text": "It slows down"}, {"id": "b", "text": "It remains constant"}, {"id": "c", "text": "It accelerates"}, {"id": "d", "text": "It reverses direction"}], "correct_answer": "c", "explanation": "Time decay accelerates as expiration approaches. The rate of extrinsic value erosion increases dramatically in the final days and hours before expiration."},
    {"id": "q3", "type": "multiple_choice", "text": "When does a 0DTE ATM option have the MOST extrinsic value during the trading day?", "options": [{"id": "a", "text": "At market close (4:00 PM ET)"}, {"id": "b", "text": "At market open (9:30 AM ET)"}, {"id": "c", "text": "At noon ET"}, {"id": "d", "text": "Extrinsic value is constant throughout the day"}], "correct_answer": "b", "explanation": "At market open, the 0DTE option has the most time remaining until expiration, so its extrinsic value is at its maximum for the day."},
    {"id": "q4", "type": "multiple_choice", "text": "SPX options expire:", "options": [{"id": "a", "text": "Only on the third Friday of each month"}, {"id": "b", "text": "Only on Fridays"}, {"id": "c", "text": "Monday through Friday (daily expirations)"}, {"id": "d", "text": "Only on Wednesdays and Fridays"}], "correct_answer": "c", "explanation": "SPX options now have daily expirations, Monday through Friday, providing 0DTE opportunities every trading day."},
    {"id": "q5", "type": "multiple_choice", "text": "As a BUYER of 0DTE options, time decay:", "options": [{"id": "a", "text": "Works in your favor"}, {"id": "b", "text": "Has no effect"}, {"id": "c", "text": "Works against you"}, {"id": "d", "text": "Only matters after noon"}], "correct_answer": "c", "explanation": "Time decay works against option buyers. As an option buyer, the extrinsic value of your position erodes over time, meaning you need the underlying to move in your favor to overcome this decay."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C1 Lesson 6: Your First Paper Trade: Placing Orders
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c1_id,
  'Your First Paper Trade: Placing Orders',
  'your-first-paper-trade-placing-orders',
  E'## Why Paper Trade First\n\nBefore risking real capital, every aspiring scalper should spend time paper trading (simulated trading). Paper trading lets you practice reading options chains, placing orders, managing positions, and experiencing the speed of 0DTE price action — all without financial risk. Most major brokerages offer paper trading platforms, including Thinkorswim (TD Ameritrade), Interactive Brokers, and Webull. Treat your paper trading account seriously; it is your training ground.\n\n## Order Types for Options\n\nThere are several order types you need to master. A **market order** executes immediately at the best available price — fast but potentially costly in wide-spread markets. A **limit order** specifies the maximum price you will pay (for buys) or the minimum you will accept (for sells). For scalpers, limit orders are generally preferred because they give you control over execution price. A **stop order** (stop-loss) triggers a market order when the option reaches a specified price, helping you exit losing trades automatically.\n\nFor more precision, you can use **stop-limit orders**, which trigger a limit order (instead of a market order) when the stop price is hit. This prevents slippage but risks not being filled if the price moves too fast. In the fast-moving world of 0DTE options, you must weigh speed of execution against price control.\n\n## Placing Your First Paper Trade\n\nHere is a step-by-step framework for your first paper trade: (1) Open the options chain for SPX and select today''s expiration. (2) Find the ATM call strike. (3) Check the bid-ask spread — aim for $0.30 or less. (4) Place a limit buy order at the mid-price (halfway between bid and ask). (5) Once filled, immediately set a profit target (e.g., +$2.00) and a stop loss (e.g., -$1.50) using bracket orders or OCO (one-cancels-other) orders. (6) Monitor the trade and journal the outcome.\n\n## Building Good Habits Early\n\nUse paper trading to build the habits that will protect you when real money is on the line. Always define your risk before entering. Always use stop losses. Always record your trades in a journal — noting the setup, entry, exit, and what you learned. The goal of paper trading is not to make pretend profits; it is to develop muscle memory for disciplined execution. Most professional traders recommend at least 2-4 weeks of consistent paper trading before transitioning to live capital.',
  'text'::lesson_type,
  25,
  6,
  ARRAY['Paper trading lets you practice strategies without risking real money', 'Limit orders give scalpers control over execution price compared to market orders', 'Always set a profit target and stop loss before or immediately after entering a trade', 'Journal every paper trade to build discipline and learn from each setup'],
  ARRAY['What broker is best for paper trading options?', 'Should I use market orders or limit orders for scalping?', 'How long should I paper trade before going live?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is the primary advantage of a limit order over a market order?", "options": [{"id": "a", "text": "Limit orders are always filled instantly"}, {"id": "b", "text": "Limit orders let you control the price you pay or receive"}, {"id": "c", "text": "Limit orders have no commission fees"}, {"id": "d", "text": "Limit orders guarantee a profit"}], "correct_answer": "b", "explanation": "Limit orders let you specify the maximum price you will pay (buy) or the minimum you will accept (sell), giving you control over execution price at the cost of potentially not getting filled."},
    {"id": "q2", "type": "multiple_choice", "text": "What is an OCO (One-Cancels-Other) order?", "options": [{"id": "a", "text": "An order that cancels all open positions"}, {"id": "b", "text": "A pair of orders where filling one automatically cancels the other"}, {"id": "c", "text": "An order that can only be placed once per day"}, {"id": "d", "text": "An order that executes at market close"}], "correct_answer": "b", "explanation": "An OCO order is a pair of linked orders (typically a profit target and a stop loss) where the execution of one automatically cancels the other."},
    {"id": "q3", "type": "multiple_choice", "text": "Where should you typically place a limit buy order in the bid-ask spread?", "options": [{"id": "a", "text": "At the ask price"}, {"id": "b", "text": "At the bid price"}, {"id": "c", "text": "At the mid-price (between bid and ask)"}, {"id": "d", "text": "Above the ask price"}], "correct_answer": "c", "explanation": "Placing a limit order at the mid-price is a common practice that balances the chance of getting filled with getting a fair price. You can adjust from there based on urgency."},
    {"id": "q4", "type": "multiple_choice", "text": "What is the primary PURPOSE of paper trading?", "options": [{"id": "a", "text": "To generate virtual profits"}, {"id": "b", "text": "To practice strategy execution and build discipline without risking real money"}, {"id": "c", "text": "To get free trades from your broker"}, {"id": "d", "text": "To test broker software for bugs"}], "correct_answer": "b", "explanation": "Paper trading is for practicing strategy execution, learning the platform, and building disciplined habits — all without the risk of losing real capital."},
    {"id": "q5", "type": "multiple_choice", "text": "What should you do IMMEDIATELY after entering a scalp trade?", "options": [{"id": "a", "text": "Close your trading platform and check back later"}, {"id": "b", "text": "Set a profit target and stop loss"}, {"id": "c", "text": "Double your position size"}, {"id": "d", "text": "Switch to a different underlying"}], "correct_answer": "b", "explanation": "Immediately after entering a trade, you should set your profit target and stop loss. This defines your risk and reward from the start and removes the temptation to make emotional decisions."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- COURSE 2 LESSONS: Understanding the Greeks
-- ============================================================

-- C2 Lesson 1: Delta: Directional Exposure Decoded
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c2_id,
  'Delta: Directional Exposure Decoded',
  'delta-directional-exposure-decoded',
  E'## What Is Delta?\n\nDelta is the most intuitive of the option Greeks. It measures how much an option''s price changes for a $1.00 move in the underlying asset. A call option with a delta of 0.50 will increase by $0.50 when the underlying rises by $1.00 (and decrease by $0.50 when it falls). Delta for calls ranges from 0.00 to 1.00. Delta for puts ranges from -1.00 to 0.00. The sign tells you the direction: positive delta means you profit when the underlying goes up; negative delta means you profit when it goes down.\n\n## Delta and Moneyness\n\nDelta is directly tied to moneyness. **At-the-money (ATM)** call options have a delta of approximately **0.50**, meaning they move roughly half as much as the underlying. **Deep in-the-money (ITM)** calls approach a delta of 1.00, behaving almost like the underlying stock itself. **Far out-of-the-money (OTM)** calls have delta near 0.00, meaning they barely respond to small price changes. For puts, the same logic applies in reverse: ATM puts have delta near -0.50, deep ITM puts near -1.00, and far OTM puts near 0.00.\n\n## Delta as Probability Proxy\n\nTraders often use delta as a rough approximation of the probability that an option will expire in-the-money. A call with delta of 0.30 has roughly a 30% chance of expiring ITM. While this is not mathematically precise (it is based on risk-neutral probability, not real-world probability), it provides a useful mental framework. For 0DTE options, delta changes rapidly throughout the day as the option approaches expiration and gamma effects intensify.\n\n## Delta in Practice for Scalpers\n\nAs a 0DTE scalper, delta tells you how much leverage you have. Buying an ATM call with delta 0.50 on SPX means each 1-point move in SPX changes your option by about $0.50, or $50 per contract (since each point = $100). If SPX moves 10 points in your favor, your option gains roughly $5.00 ($500 per contract). Understanding your position''s total delta helps you manage risk. If you hold 5 ATM calls, your total delta is 2.50, equivalent to being long 250 "shares" of SPX movement. Position delta is the foundation of understanding your directional exposure.',
  'text'::lesson_type,
  25,
  1,
  ARRAY['Delta measures how much an option price changes per $1 move in the underlying', 'ATM calls have delta near 0.50; deep ITM approaches 1.00; far OTM approaches 0.00', 'Delta serves as a rough probability proxy for expiring in-the-money', 'Total position delta tells you your aggregate directional exposure'],
  ARRAY['Explain delta in simple terms', 'How does delta change throughout the day on 0DTE?', 'What is the delta of a deep in-the-money option?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is the approximate delta of an at-the-money call option?", "options": [{"id": "a", "text": "0.10"}, {"id": "b", "text": "0.50"}, {"id": "c", "text": "0.90"}, {"id": "d", "text": "1.00"}], "correct_answer": "b", "explanation": "An at-the-money call has a delta of approximately 0.50, meaning it moves about half as much as the underlying asset."},
    {"id": "q2", "type": "multiple_choice", "text": "A put option with a delta of -0.70 will:", "options": [{"id": "a", "text": "Gain $0.70 when the underlying rises $1"}, {"id": "b", "text": "Lose $0.70 when the underlying rises $1"}, {"id": "c", "text": "Gain $0.70 when the underlying falls $1"}, {"id": "d", "text": "Both B and C are correct"}], "correct_answer": "d", "explanation": "A put with -0.70 delta loses $0.70 when the underlying rises $1 and gains $0.70 when the underlying falls $1. The negative sign indicates inverse relationship with the underlying."},
    {"id": "q3", "type": "multiple_choice", "text": "As a call option moves deeper in-the-money, its delta:", "options": [{"id": "a", "text": "Approaches 0.00"}, {"id": "b", "text": "Stays at 0.50"}, {"id": "c", "text": "Approaches 1.00"}, {"id": "d", "text": "Becomes negative"}], "correct_answer": "c", "explanation": "As a call moves deeper ITM, delta approaches 1.00. The option begins to move nearly dollar-for-dollar with the underlying."},
    {"id": "q4", "type": "multiple_choice", "text": "A call option with delta 0.30 has approximately what probability of expiring in-the-money?", "options": [{"id": "a", "text": "10%"}, {"id": "b", "text": "30%"}, {"id": "c", "text": "50%"}, {"id": "d", "text": "70%"}], "correct_answer": "b", "explanation": "Delta serves as a rough approximation of the probability of expiring in-the-money. A delta of 0.30 suggests approximately a 30% chance."},
    {"id": "q5", "type": "multiple_choice", "text": "If you hold 10 SPX ATM call contracts (delta ~0.50 each), your total position delta is approximately:", "options": [{"id": "a", "text": "0.50"}, {"id": "b", "text": "5.00"}, {"id": "c", "text": "10.00"}, {"id": "d", "text": "50.00"}], "correct_answer": "b", "explanation": "Total position delta = number of contracts x delta per contract = 10 x 0.50 = 5.00. This means for every $1 move in SPX, your position gains or loses $500."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C2 Lesson 2: Gamma: The Acceleration Factor
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c2_id,
  'Gamma: The Acceleration Factor',
  'gamma-the-acceleration-factor',
  E'## What Is Gamma?\n\nGamma measures the **rate of change of delta** for a $1.00 move in the underlying. If delta is speed, gamma is acceleration. A call option with delta 0.50 and gamma 0.05 will see its delta increase to 0.55 after a $1.00 rise in the underlying. Gamma is always positive for long options (both calls and puts) and negative for short options. This means as a long option holder, delta moves increasingly in your favor as the underlying trends, creating a convex payoff profile.\n\n## Gamma and Expiration: The 0DTE Effect\n\nGamma is highest for **at-the-money options near expiration**. This is arguably the most important concept for 0DTE scalpers. On the morning of expiration, ATM gamma can be enormous — meaning delta swings wildly with each point of underlying movement. An ATM option at 9:30 AM on expiration day might have delta of 0.50 and gamma of 0.10. A 5-point move in SPX would shift delta from 0.50 to 1.00, effectively turning your option into a synthetic stock position. This gamma amplification is what makes 0DTE trades so explosive.\n\n## Gamma Risk\n\nWhile high gamma benefits long option holders (creating accelerating profits), it is devastating for short option positions. Option sellers who are short ATM options near expiration face "**gamma risk**" — their delta exposure can flip rapidly, creating large losses in minutes. This is why market makers aggressively hedge their gamma exposure, and it is also why 0DTE options can exhibit such violent price swings. The phrase "gamma squeeze" refers to market makers'' hedging activity amplifying underlying price moves.\n\n## Gamma in Your Scalping Strategy\n\nAs a 0DTE scalper buying ATM options, gamma is your friend — but it cuts both ways. When the underlying moves in your favor, gamma accelerates your profits because delta is increasing. But if the underlying reverses, delta also collapses rapidly, accelerating your losses. This is why 0DTE scalpers must be decisive: the high-gamma environment rewards quick action and punishes indecision. A profitable move of 5 SPX points can turn into a loss with just a 7-point reversal because delta changes so rapidly near expiration.',
  'text'::lesson_type,
  25,
  2,
  ARRAY['Gamma measures the rate of change of delta per $1 move in the underlying', 'Gamma is highest for at-the-money options near expiration making 0DTE trades explosive', 'Long options have positive gamma creating accelerating profits in trending moves', 'High gamma on 0DTE rewards decisiveness and punishes indecision'],
  ARRAY['What happens to gamma at expiration?', 'Why is gamma risk dangerous for option sellers?', 'How does gamma make 0DTE options different from weekly options?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "Gamma measures the rate of change of:", "options": [{"id": "a", "text": "Option premium over time"}, {"id": "b", "text": "Delta per $1 move in the underlying"}, {"id": "c", "text": "Implied volatility"}, {"id": "d", "text": "The bid-ask spread"}], "correct_answer": "b", "explanation": "Gamma measures how much delta changes for each $1 move in the underlying. If delta is speed, gamma is acceleration."},
    {"id": "q2", "type": "multiple_choice", "text": "When is gamma HIGHEST?", "options": [{"id": "a", "text": "For deep OTM options with months to expiration"}, {"id": "b", "text": "For deep ITM options with months to expiration"}, {"id": "c", "text": "For ATM options near expiration"}, {"id": "d", "text": "Gamma is constant across all strikes and expirations"}], "correct_answer": "c", "explanation": "Gamma is highest for at-the-money options near expiration. This is the key dynamic that makes 0DTE options so volatile and responsive."},
    {"id": "q3", "type": "multiple_choice", "text": "A call has delta 0.50 and gamma 0.08. After SPX rises $2, the new approximate delta is:", "options": [{"id": "a", "text": "0.42"}, {"id": "b", "text": "0.50"}, {"id": "c", "text": "0.58"}, {"id": "d", "text": "0.66"}], "correct_answer": "d", "explanation": "New delta = old delta + (gamma x price change) = 0.50 + (0.08 x 2) = 0.66. Gamma causes delta to increase as the underlying moves in favor of the call."},
    {"id": "q4", "type": "multiple_choice", "text": "Is gamma positive or negative for a LONG put option?", "options": [{"id": "a", "text": "Positive"}, {"id": "b", "text": "Negative"}, {"id": "c", "text": "Zero"}, {"id": "d", "text": "It depends on the strike"}], "correct_answer": "a", "explanation": "Gamma is always positive for long option positions, whether calls or puts. Short options have negative gamma."},
    {"id": "q5", "type": "multiple_choice", "text": "Why is high gamma a double-edged sword for 0DTE scalpers?", "options": [{"id": "a", "text": "It only affects put options"}, {"id": "b", "text": "Profits accelerate in your favor but losses also accelerate on reversals"}, {"id": "c", "text": "It increases commission costs"}, {"id": "d", "text": "It widens the bid-ask spread"}], "correct_answer": "b", "explanation": "High gamma means delta changes rapidly. In your favor, this accelerates profits. Against you, delta collapses quickly, accelerating losses. This is why decisive action is critical on 0DTE."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C2 Lesson 3: Theta: Time Decay and Your Edge
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c2_id,
  'Theta: Time Decay and Your Edge',
  'theta-time-decay-and-your-edge',
  E'## What Is Theta?\n\nTheta measures the rate at which an option loses value due to the passage of time, expressed as dollars per day. For long option positions, theta is **always negative** — your options lose value every day (and every hour, minute, and second). For short option positions, theta is positive — time decay works in the seller''s favor. Theta is the price you pay for the privilege of holding an option position, and it is often called the "rent" on your options position.\n\n## Theta and 0DTE Options\n\nOn 0DTE, theta is at its most extreme. An ATM SPX option that opens the day at $8.00 might have theta equivalent to -$8.00 for the day, meaning time decay alone will consume the entire premium by market close. This is not spread evenly: the first hour might only erode $1-2, while the final two hours can eat $4-5 of remaining value. The theta "burn" accelerates intraday following a roughly exponential curve.\n\nFor 0DTE buyers, this means you are on a clock from the moment you enter. Every minute that the underlying does not move in your favor, your option is losing value. A common mistake among new scalpers is holding positions too long, watching theta slowly drain their profits.\n\n## Theta and Strike Selection\n\nTheta is highest for **at-the-money options** and decreases as you move further in-the-money or out-of-the-money. This makes sense because ATM options have the most extrinsic value to decay. A deep ITM option with very little extrinsic value has minimal theta — most of its value is intrinsic, which does not decay. An OTM option has a smaller absolute premium, so while 100% of it is extrinsic, the dollar amount of theta is lower than ATM.\n\n## Using Theta Strategically\n\nWhile theta works against 0DTE buyers, savvy scalpers use this knowledge to their advantage. First, recognize that large, fast moves in the underlying can overwhelm theta. A 15-point SPX move in your favor generates far more profit than theta takes away. Second, take profits quickly when you have them — do not let theta erode a winning position. Third, be aware of the time of day: trades entered after 2:00 PM ET on 0DTE face extreme theta decay, meaning you need even faster and larger moves to profit. Some scalpers avoid buying options in the final 90 minutes entirely.',
  'text'::lesson_type,
  25,
  3,
  ARRAY['Theta is always negative for long options meaning your position loses value over time', 'ATM options have the highest theta because they carry the most extrinsic value', 'On 0DTE theta accelerates intraday with the fastest decay in the final hours', 'Take profits quickly on 0DTE trades to prevent theta from eroding winning positions'],
  ARRAY['How does theta differ between buying and selling options?', 'Why do ATM options have the highest theta?', 'Is there a time of day where theta decay is most dangerous for scalpers?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "For a LONG option position, theta is:", "options": [{"id": "a", "text": "Always positive"}, {"id": "b", "text": "Always negative"}, {"id": "c", "text": "Zero"}, {"id": "d", "text": "Depends on the strike"}], "correct_answer": "b", "explanation": "Theta is always negative for long option positions. This means holding a long option costs you money every day through time decay."},
    {"id": "q2", "type": "multiple_choice", "text": "Which options have the HIGHEST absolute theta?", "options": [{"id": "a", "text": "Deep in-the-money options"}, {"id": "b", "text": "At-the-money options"}, {"id": "c", "text": "Deep out-of-the-money options"}, {"id": "d", "text": "All options have equal theta"}], "correct_answer": "b", "explanation": "At-the-money options have the highest theta because they carry the most extrinsic (time) value, which is what decays over time."},
    {"id": "q3", "type": "multiple_choice", "text": "On a 0DTE option, theta decay during the trading day is:", "options": [{"id": "a", "text": "Linear — constant throughout the day"}, {"id": "b", "text": "Front-loaded — fastest at market open"}, {"id": "c", "text": "Accelerating — fastest in the final hours before expiration"}, {"id": "d", "text": "Negligible because the option expires today"}], "correct_answer": "c", "explanation": "Theta decay accelerates as expiration approaches. On 0DTE, the final hours see the most rapid erosion of extrinsic value."},
    {"id": "q4", "type": "multiple_choice", "text": "A short option position benefits from theta because:", "options": [{"id": "a", "text": "The seller receives additional premium daily"}, {"id": "b", "text": "Time decay reduces the option value the seller must buy back"}, {"id": "c", "text": "Short sellers are exempt from time decay"}, {"id": "d", "text": "Theta does not affect short positions"}], "correct_answer": "b", "explanation": "Option sellers benefit from theta because the options they sold lose value over time. If they sold an option for $5 and theta reduces its value to $3, they can buy it back for a $2 profit."},
    {"id": "q5", "type": "multiple_choice", "text": "What is the main risk of holding a long 0DTE option after 2:00 PM ET?", "options": [{"id": "a", "text": "Markets are closed after 2:00 PM"}, {"id": "b", "text": "Extreme theta decay rapidly erodes remaining extrinsic value"}, {"id": "c", "text": "Brokers increase commissions in the afternoon"}, {"id": "d", "text": "Liquidity completely disappears"}], "correct_answer": "b", "explanation": "After 2:00 PM on expiration day, theta decay is at its most extreme. Remaining extrinsic value erodes very quickly, requiring larger and faster underlying moves to profit."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C2 Lesson 4: Vega: Volatility Sensitivity
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c2_id,
  'Vega: Volatility Sensitivity',
  'vega-volatility-sensitivity',
  E'## What Is Vega?\n\nVega measures the sensitivity of an option''s price to a 1% (one percentage point) change in **implied volatility (IV)**. If an option has a vega of 0.15, a 1-point increase in IV will increase the option''s price by $0.15, and a 1-point decrease will reduce it by $0.15. Vega is always positive for long options — both long calls and long puts benefit from rising volatility. Short options have negative vega exposure.\n\n## Implied Volatility Explained\n\nImplied volatility is the market''s expectation of how much the underlying will move over the life of the option. It is derived from the option''s market price using pricing models like Black-Scholes. Higher IV means the market expects bigger moves, which makes options more expensive. Lower IV means smaller expected moves and cheaper options. IV is quoted as an annualized percentage — if SPX IV is 20%, the market expects SPX to move approximately 20% over the next year, or about 1.26% per day (20% / sqrt(252 trading days)).\n\n## Vega and Expiration\n\nVega is **highest for longer-dated options** and decreases as expiration approaches. For 0DTE options, vega is relatively low compared to weekly or monthly options. This means 0DTE option prices are less sensitive to changes in implied volatility and more driven by intrinsic value changes (delta/gamma effects) and time decay (theta). However, intraday IV spikes — such as those triggered by unexpected economic data, Fed comments, or geopolitical events — can still meaningfully impact 0DTE pricing.\n\n## Vega for 0DTE Scalpers\n\nWhile vega is less dominant on 0DTE than on longer-dated options, you still need to be aware of it. Entering a 0DTE trade right before a major economic release (like CPI or FOMC) means IV is elevated — you are paying a "volatility premium." If the data release is uneventful and IV collapses (known as a "vol crush" or "IV crush"), your option can lose value even if the underlying moves slightly in your favor. Scalpers should note the economic calendar each morning and understand that options are priced for expected events. The edge comes from trading the unexpected move, not the expected one.',
  'text'::lesson_type,
  20,
  4,
  ARRAY['Vega measures how much an option price changes per 1% change in implied volatility', 'Long options have positive vega and benefit from rising implied volatility', 'Vega is lower for 0DTE options than for longer-dated contracts', 'IV crush after economic events can cause option value to drop even if the underlying moves in your favor'],
  ARRAY['What is implied volatility and how is it calculated?', 'How does IV crush affect 0DTE options?', 'Should I avoid trading around major economic releases?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "Vega measures sensitivity to changes in:", "options": [{"id": "a", "text": "The underlying price"}, {"id": "b", "text": "Time to expiration"}, {"id": "c", "text": "Implied volatility"}, {"id": "d", "text": "Interest rates"}], "correct_answer": "c", "explanation": "Vega measures how much an option price changes for a 1 percentage point change in implied volatility."},
    {"id": "q2", "type": "multiple_choice", "text": "Is vega positive or negative for a long call option?", "options": [{"id": "a", "text": "Positive"}, {"id": "b", "text": "Negative"}, {"id": "c", "text": "Zero"}, {"id": "d", "text": "It depends on moneyness"}], "correct_answer": "a", "explanation": "Vega is always positive for long options (both calls and puts). Long option holders benefit when implied volatility increases because it raises the option premium."},
    {"id": "q3", "type": "multiple_choice", "text": "Compared to monthly options, 0DTE options have:", "options": [{"id": "a", "text": "Higher vega"}, {"id": "b", "text": "Lower vega"}, {"id": "c", "text": "The same vega"}, {"id": "d", "text": "No vega at all"}], "correct_answer": "b", "explanation": "Vega decreases as expiration approaches. 0DTE options have relatively low vega compared to monthly or weekly options, meaning they are less sensitive to IV changes."},
    {"id": "q4", "type": "multiple_choice", "text": "What is an \"IV crush\"?", "options": [{"id": "a", "text": "When intrinsic value drops to zero"}, {"id": "b", "text": "A rapid drop in implied volatility, often after an anticipated event"}, {"id": "c", "text": "When the bid-ask spread widens dramatically"}, {"id": "d", "text": "When volume exceeds open interest"}], "correct_answer": "b", "explanation": "IV crush is a rapid collapse in implied volatility that typically occurs after an anticipated event (like earnings or economic data). This reduces option premiums even if the underlying price does not move against you."},
    {"id": "q5", "type": "multiple_choice", "text": "If an option has vega of 0.20, and implied volatility increases by 3 points, the option price will increase by approximately:", "options": [{"id": "a", "text": "$0.20"}, {"id": "b", "text": "$0.40"}, {"id": "c", "text": "$0.60"}, {"id": "d", "text": "$3.00"}], "correct_answer": "c", "explanation": "Price change = vega x IV change = 0.20 x 3 = $0.60. Each point of IV change moves the option price by the vega amount."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C2 Lesson 5: Rho and Putting Greeks Together
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c2_id,
  'Rho and Putting Greeks Together',
  'rho-and-putting-greeks-together',
  E'## What Is Rho?\n\nRho measures the sensitivity of an option''s price to a 1% change in the risk-free interest rate. A call option with rho of 0.05 will increase by $0.05 for each 1% increase in interest rates. Calls have positive rho (they benefit from rising rates) and puts have negative rho (they benefit from falling rates). In practice, rho is the least impactful Greek for short-term traders. Interest rates change slowly and incrementally, so for 0DTE scalpers, rho has negligible impact on day-to-day trading decisions.\n\n## The Greeks Working Together\n\nNo Greek operates in isolation. At any given moment, your option''s price is being influenced by all five Greeks simultaneously. A profitable understanding requires seeing how they interact:\n\n- **Delta** tells you your directional exposure.\n- **Gamma** tells you how fast that exposure changes.\n- **Theta** tells you the time cost of holding the position.\n- **Vega** tells you how volatility shifts affect your price.\n- **Rho** tells you the (minimal for 0DTE) interest rate effect.\n\nFor a 0DTE ATM call, the dominant forces are delta/gamma (directional movement) and theta (time decay). Vega plays a supporting role, and rho is virtually irrelevant.\n\n## A Unified Example\n\nImagine you buy a 0DTE SPX 5,000 call at 10:00 AM when SPX is at 5,000. Your Greeks are: delta 0.50, gamma 0.08, theta -$6.00 (for the remaining day), vega 0.10. SPX rallies 10 points to 5,010 over 30 minutes.\n\nYour delta profit: approximately 10 x 0.50 + gamma effect = roughly $5.50 in premium gain ($550 per contract). Your theta loss over 30 minutes: approximately $0.50-$1.00 (theta is not equally distributed). Net gain: approximately $4.50-$5.00 ($450-$500 per contract). The delta/gamma contribution overwhelmed theta — this is exactly the dynamic scalpers seek.\n\n## Building Your Greek Dashboard\n\nProfessional traders monitor their Greeks in real-time. Most trading platforms display Greeks alongside the options chain. Before entering any trade, check: (1) What is my delta exposure? (2) How fast will delta change (gamma)? (3) How much am I paying in time decay per hour (theta)? (4) Am I overpaying for volatility (vega/IV)? This Greek awareness transforms you from a gambler into a trader with a quantitative edge.',
  'text'::lesson_type,
  20,
  5,
  ARRAY['Rho measures interest rate sensitivity but is negligible for 0DTE traders', 'All five Greeks act simultaneously on your option position', 'For 0DTE trades delta/gamma and theta are the dominant forces', 'Always check your Greek exposure before entering a trade to understand your risk profile'],
  ARRAY['How do all the Greeks interact in a real trade?', 'Why is rho not important for scalpers?', 'What should my Greek dashboard look like for 0DTE?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does Rho measure?", "options": [{"id": "a", "text": "Sensitivity to changes in the underlying price"}, {"id": "b", "text": "Sensitivity to changes in implied volatility"}, {"id": "c", "text": "Sensitivity to changes in interest rates"}, {"id": "d", "text": "Sensitivity to changes in time"}], "correct_answer": "c", "explanation": "Rho measures the sensitivity of an option price to a 1% change in the risk-free interest rate."},
    {"id": "q2", "type": "multiple_choice", "text": "For 0DTE scalpers, which two Greeks are MOST important?", "options": [{"id": "a", "text": "Vega and Rho"}, {"id": "b", "text": "Delta/Gamma and Theta"}, {"id": "c", "text": "Rho and Theta"}, {"id": "d", "text": "Only Delta matters"}], "correct_answer": "b", "explanation": "Delta/Gamma (directional movement) and Theta (time decay) are the dominant forces for 0DTE options. Vega plays a supporting role, and Rho is negligible."},
    {"id": "q3", "type": "multiple_choice", "text": "Calls have _____ rho, and puts have _____ rho.", "options": [{"id": "a", "text": "Positive, Positive"}, {"id": "b", "text": "Negative, Positive"}, {"id": "c", "text": "Positive, Negative"}, {"id": "d", "text": "Negative, Negative"}], "correct_answer": "c", "explanation": "Calls have positive rho (benefit from rising interest rates) and puts have negative rho (benefit from falling interest rates)."},
    {"id": "q4", "type": "multiple_choice", "text": "If delta and gamma are producing +$5.00 profit and theta has cost -$1.00, the net change is:", "options": [{"id": "a", "text": "+$6.00"}, {"id": "b", "text": "+$5.00"}, {"id": "c", "text": "+$4.00"}, {"id": "d", "text": "-$1.00"}], "correct_answer": "c", "explanation": "Net change = delta/gamma profit + theta cost = $5.00 + (-$1.00) = +$4.00. The directional movement overcame time decay."},
    {"id": "q5", "type": "multiple_choice", "text": "Why is rho considered negligible for 0DTE trading?", "options": [{"id": "a", "text": "Interest rates do not exist for same-day options"}, {"id": "b", "text": "Interest rates change very slowly relative to the short time frame of 0DTE"}, {"id": "c", "text": "Rho only affects put options"}, {"id": "d", "text": "Brokers do not calculate rho for 0DTE options"}], "correct_answer": "b", "explanation": "Interest rates change very slowly and incrementally. Over the few hours of a 0DTE trade, interest rate changes have virtually no measurable impact on option pricing."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C2 Lesson 6: Greek Scenarios: Real Trade Analysis
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c2_id,
  'Greek Scenarios: Real Trade Analysis',
  'greek-scenarios-real-trade-analysis',
  E'## Scenario 1: The Morning Breakout\n\nIt is 9:45 AM ET. SPX opens at 5,000 and breaks out to the upside. You buy a 5,000 call (ATM) for $10.00. Your Greeks: delta 0.50, gamma 0.09, theta -$8.00/day, vega 0.12. SPX rallies 15 points to 5,015 over 20 minutes.\n\nYour delta started at 0.50 but gamma pushed it higher with each point gained. Estimated profit: approximately $9.00-$10.00 per contract ($900-$1,000). Theta cost over 20 minutes was approximately $0.30-$0.50. Vega impact was minimal (no IV shift). **Net result: strong profit driven by delta/gamma, with minimal theta drag.** This is the ideal scalp — a fast, decisive move that overwhelms time decay.\n\n## Scenario 2: The Afternoon Chop\n\nIt is 2:00 PM ET. SPX is at 5,010. You buy a 5,010 call for $3.00. Greeks: delta 0.50, gamma 0.15 (high because near expiration), theta -$3.00/remaining. SPX oscillates between 5,008 and 5,012 for 30 minutes.\n\nDespite the high gamma, the underlying is not trending. You gain on rallies to 5,012 but give it back on dips to 5,008. Meanwhile, theta is burning aggressively — you have lost approximately $1.50 of your $3.00 premium just to time decay. **Net result: near break-even or loss, because theta eroded the premium while the underlying chopped sideways.** This scenario illustrates why scalpers avoid low-conviction trades in the afternoon.\n\n## Scenario 3: The CPI Report\n\nIt is 8:25 AM ET (pre-market). CPI data drops at 8:30 AM. IV on 0DTE options is elevated at 30% versus the normal 18%. You buy a call right after the release as SPX spikes 20 points. However, IV simultaneously drops from 30% to 19% (IV crush). Your vega impact: 0.12 x 11-point IV drop = -$1.32 loss from vega. Your delta/gamma profit from the 20-point move: approximately $12.00. **Net result: still profitable (+$10.68), but the IV crush clipped roughly 11% of your potential profit.** Always account for vega when trading around data releases.\n\n## Key Takeaways from Scenarios\n\nThese scenarios demonstrate that successful 0DTE scalping requires: (1) fast, directional moves that let delta/gamma dominate, (2) avoiding choppy conditions where theta grinds you down, and (3) awareness of IV dynamics around economic events. Each trade is a balance sheet of Greek forces — your job is to enter when the forces are stacked in your favor.',
  'text'::lesson_type,
  30,
  6,
  ARRAY['Fast directional moves let delta and gamma overwhelm theta decay for profitable scalps', 'Choppy sideways markets let theta grind away 0DTE premium without directional gains', 'IV crush around economic releases can reduce profits even when direction is correct', 'Every trade is a balance of Greek forces and your job is to enter when they favor you'],
  ARRAY['Walk me through a real 0DTE trade with all the Greeks', 'How do I know if theta will eat my profits before the underlying moves?', 'Should I trade 0DTE options during CPI or FOMC releases?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "In a fast morning breakout on 0DTE, which Greeks are the PRIMARY profit drivers?", "options": [{"id": "a", "text": "Theta and Rho"}, {"id": "b", "text": "Delta and Gamma"}, {"id": "c", "text": "Vega and Theta"}, {"id": "d", "text": "Rho and Gamma"}], "correct_answer": "b", "explanation": "In a fast directional move, delta (directional exposure) and gamma (accelerating delta) are the primary profit drivers that overwhelm theta decay."},
    {"id": "q2", "type": "multiple_choice", "text": "What makes afternoon choppy markets especially dangerous for 0DTE option buyers?", "options": [{"id": "a", "text": "Volume is too high"}, {"id": "b", "text": "Theta decay is at its most extreme while the underlying lacks direction"}, {"id": "c", "text": "Gamma is too low"}, {"id": "d", "text": "Brokers restrict trading after noon"}], "correct_answer": "b", "explanation": "In the afternoon, theta decay is accelerating rapidly. If the underlying is chopping sideways, there is no delta/gamma profit to offset the aggressive time decay, leading to losses."},
    {"id": "q3", "type": "multiple_choice", "text": "An IV crush typically occurs:", "options": [{"id": "a", "text": "Every Monday morning"}, {"id": "b", "text": "After an anticipated economic event or data release"}, {"id": "c", "text": "Only on monthly expiration days"}, {"id": "d", "text": "When volume drops below 1,000 contracts"}], "correct_answer": "b", "explanation": "IV crush typically occurs after anticipated events like CPI, FOMC, or earnings releases. Implied volatility was elevated in anticipation and drops rapidly once the uncertainty is resolved."},
    {"id": "q4", "type": "multiple_choice", "text": "If you have a call with vega 0.15 and IV drops 8 points, the vega-related loss is:", "options": [{"id": "a", "text": "$0.15"}, {"id": "b", "text": "$0.80"}, {"id": "c", "text": "$1.20"}, {"id": "d", "text": "$8.00"}], "correct_answer": "c", "explanation": "Vega loss = vega x IV change = 0.15 x 8 = $1.20. This is the portion of price change attributable to the volatility decrease."},
    {"id": "q5", "type": "multiple_choice", "text": "The ideal 0DTE scalp scenario is:", "options": [{"id": "a", "text": "Slow, grinding movement over several hours"}, {"id": "b", "text": "A fast, decisive directional move that overwhelms theta"}, {"id": "c", "text": "A day with no economic data and low volume"}, {"id": "d", "text": "Holding until 5 minutes before expiration"}], "correct_answer": "b", "explanation": "The ideal scalp features a fast, directional move where delta/gamma profits quickly exceed theta costs. Speed is essential because time decay on 0DTE is relentless."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- COURSE 3 LESSONS: SPX/NDX 0DTE Mechanics
-- ============================================================

-- C3 Lesson 1: Index Options vs Equity Options
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c3_id,
  'Index Options vs Equity Options',
  'index-options-vs-equity-options',
  E'## Two Worlds of Options\n\nOptions can be written on individual stocks (equity options) or on broad market indices (index options). While the fundamental mechanics of calls, puts, and the Greeks apply to both, there are critical structural differences that every scalper must understand. Index options on SPX and NDX have unique characteristics that make them the preferred vehicle for professional scalpers.\n\n## Key Differences\n\nThe most important differences between index and equity options are:\n\n1. **Settlement:** Equity options are **physically settled** — exercising a call means you receive 100 shares of stock. Index options like SPX and NDX are **cash-settled** — there is no delivery of shares. Instead, the in-the-money amount is paid in cash. This is a massive advantage for scalpers because you never have to worry about inadvertently being assigned stock.\n\n2. **Exercise Style:** Most equity options are **American-style**, meaning they can be exercised at any time before expiration. SPX options are **European-style**, meaning they can only be exercised at expiration. For 0DTE traders, this eliminates the risk of early assignment — you control the option until expiration.\n\n3. **Contract Multiplier:** SPX options have a notional multiplier of $100 per point, just like equity options. However, with SPX trading around 5,000, each ATM option controls massive notional value — approximately $500,000. NDX options, with the index near 17,000-18,000, control even more.\n\n## Tax Advantages (Section 1256)\n\nIndex options on SPX and NDX qualify for favorable tax treatment under **IRS Section 1256**. Regardless of how long you hold the position, profits are taxed at a blended rate: **60% long-term capital gains and 40% short-term capital gains**. For active scalpers in high tax brackets, this can save thousands of dollars per year compared to equity options, which are taxed entirely as short-term gains (ordinary income) if held less than a year.\n\n## Why Scalpers Prefer Index Options\n\nThe combination of cash settlement (no assignment risk), European exercise (no early exercise), daily expirations (0DTE every day), deep liquidity, tight spreads, and Section 1256 tax treatment makes SPX and NDX the gold standard for options scalpers. Equity options have their place, but for rapid-fire 0DTE trading, index options are purpose-built for the job.',
  'text'::lesson_type,
  20,
  1,
  ARRAY['Index options are cash-settled while equity options are physically settled with share delivery', 'SPX options are European-style and cannot be exercised early eliminating assignment risk', 'Section 1256 tax treatment gives index options a 60/40 long-term/short-term blended rate', 'Cash settlement and European exercise make index options ideal for 0DTE scalping'],
  ARRAY['What is the difference between cash settlement and physical settlement?', 'How does the Section 1256 tax benefit work for scalpers?', 'Can I get assigned on SPX options before expiration?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "SPX options are settled by:", "options": [{"id": "a", "text": "Physical delivery of S&P 500 shares"}, {"id": "b", "text": "Cash payment of the in-the-money amount"}, {"id": "c", "text": "Delivery of SPY ETF shares"}, {"id": "d", "text": "Transfer of futures contracts"}], "correct_answer": "b", "explanation": "SPX options are cash-settled. When an ITM SPX option is exercised or expires, the holder receives a cash payment equal to the in-the-money amount rather than any shares."},
    {"id": "q2", "type": "multiple_choice", "text": "SPX options are which exercise style?", "options": [{"id": "a", "text": "American-style (can exercise anytime)"}, {"id": "b", "text": "European-style (can only exercise at expiration)"}, {"id": "c", "text": "Bermuda-style (exercise on specific dates)"}, {"id": "d", "text": "Asian-style (based on average price)"}], "correct_answer": "b", "explanation": "SPX options are European-style, meaning they can only be exercised at expiration. This eliminates early assignment risk for traders."},
    {"id": "q3", "type": "multiple_choice", "text": "Under Section 1256, index option profits are taxed at:", "options": [{"id": "a", "text": "100% short-term capital gains rate"}, {"id": "b", "text": "100% long-term capital gains rate"}, {"id": "c", "text": "60% long-term / 40% short-term blended rate"}, {"id": "d", "text": "No taxes apply to index options"}], "correct_answer": "c", "explanation": "Section 1256 contracts, including SPX and NDX options, receive favorable 60/40 tax treatment: 60% of gains are taxed at the long-term rate and 40% at the short-term rate, regardless of holding period."},
    {"id": "q4", "type": "multiple_choice", "text": "Which of these is an advantage of European-style options for 0DTE traders?", "options": [{"id": "a", "text": "They can be exercised at any time for maximum flexibility"}, {"id": "b", "text": "No risk of early assignment"}, {"id": "c", "text": "They always cost less than American-style options"}, {"id": "d", "text": "They have higher delta"}], "correct_answer": "b", "explanation": "European-style options cannot be exercised before expiration, eliminating the risk of early assignment. This is valuable for 0DTE traders who want to control their exit timing."},
    {"id": "q5", "type": "multiple_choice", "text": "Why do professional scalpers prefer SPX over individual stock options?", "options": [{"id": "a", "text": "Stock options are not available for day trading"}, {"id": "b", "text": "Cash settlement, no early assignment, daily expirations, deep liquidity, and tax advantages"}, {"id": "c", "text": "SPX options are free to trade"}, {"id": "d", "text": "Stock options have no Greeks"}], "correct_answer": "b", "explanation": "SPX offers a combination of cash settlement, European exercise, daily expirations, deep liquidity, tight spreads, and favorable Section 1256 tax treatment that makes it ideal for professional scalping."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C3 Lesson 2: 0DTE Mechanics: Settlement & Exercise
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c3_id,
  '0DTE Mechanics: Settlement & Exercise',
  '0dte-mechanics-settlement-exercise',
  E'## How 0DTE Options Expire\n\nWhen you trade 0DTE SPX options, you are trading contracts that expire at the end of that same trading day. At expiration, the settlement process determines the final value of every outstanding contract. For standard SPX options (PM-settled), the settlement price is based on the **closing price of the S&P 500 index at 4:00 PM ET**. SPX also has AM-settled options (the traditional monthly and some weekly expirations) that settle based on the opening prices on expiration morning, but daily 0DTE expirations are PM-settled.\n\n## Cash Settlement in Practice\n\nWhen a 0DTE SPX call with a 5,000 strike expires with SPX at 5,015, the option settles for $15.00 per point, or **$1,500 per contract** ($15 x $100 multiplier). This cash is automatically credited to your account — no shares change hands, no exercise notices, no stock positions to manage. If the option expires out-of-the-money (SPX at or below 5,000 for the 5,000 call), it expires worthless with $0 value. The simplicity of cash settlement is one of the reasons SPX is the dominant 0DTE instrument.\n\n## Do Not Let Options Expire ITM Unintentionally\n\nWhile cash settlement makes things simpler than equity options, you should still actively manage your expiring positions. Most brokers will automatically exercise (settle) ITM options, but the settlement value is determined at close — not when you last checked. If SPX is at 5,010 at 3:30 PM and you hold a 5,000 call, that option might be worth $10, but a late-day selloff could push SPX to 4,998 by close, making your option worthless. Always have an exit plan rather than relying on expiration settlement.\n\n## The Final Hour: Pin Risk and Gamma Exposure\n\nThe final hour of 0DTE trading is characterized by extreme gamma. Options that are near-the-money can swing from worthless to deeply in-the-money (or vice versa) with just a few points of movement. This creates what traders call **pin risk** — the risk that the underlying closes very near your strike price, making the outcome uncertain until the final moments. Professional traders often close 0DTE positions 30-60 minutes before close to avoid this uncertainty, especially when profits are already in hand.\n\n## Practical Settlement Timeline\n\nThe key timestamps for 0DTE SPX options: Trading continues until **4:00 PM ET**. Settlement price is determined at close. Cash settlement credits or debits appear in your account by the next business morning. There are no after-hours complications because SPX options do not trade after the cash session closes.',
  'text'::lesson_type,
  25,
  2,
  ARRAY['Daily 0DTE SPX options are PM-settled based on the 4:00 PM ET closing index price', 'Cash settlement means ITM options pay the in-the-money amount in cash with no shares involved', 'Never rely on expiration settlement as a strategy since late-day moves can change outcomes', 'Close 0DTE positions 30-60 minutes before market close to avoid pin risk and gamma uncertainty'],
  ARRAY['What happens if my 0DTE option expires in-the-money?', 'What is pin risk and why should I care?', 'Is it better to close my position or let it expire?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "Daily 0DTE SPX options are settled based on:", "options": [{"id": "a", "text": "The opening price of the S&P 500"}, {"id": "b", "text": "The closing price of the S&P 500 at 4:00 PM ET"}, {"id": "c", "text": "The volume-weighted average price (VWAP)"}, {"id": "d", "text": "The high of the day"}], "correct_answer": "b", "explanation": "Daily (PM-settled) SPX options use the closing price of the S&P 500 at 4:00 PM ET as the settlement price."},
    {"id": "q2", "type": "multiple_choice", "text": "A 0DTE SPX 5,020 put expires with SPX at 5,005. The cash settlement value per contract is:", "options": [{"id": "a", "text": "$0 (worthless)"}, {"id": "b", "text": "$500"}, {"id": "c", "text": "$1,500"}, {"id": "d", "text": "$5,005"}], "correct_answer": "c", "explanation": "The put is in-the-money by 15 points (5,020 - 5,005 = 15). Settlement value = 15 x $100 = $1,500 per contract."},
    {"id": "q3", "type": "multiple_choice", "text": "What is \"pin risk\" on 0DTE options?", "options": [{"id": "a", "text": "The risk of your broker closing your account"}, {"id": "b", "text": "The risk that the underlying closes near your strike, making the outcome uncertain"}, {"id": "c", "text": "The risk of early assignment"}, {"id": "d", "text": "The risk of a margin call"}], "correct_answer": "b", "explanation": "Pin risk is the risk that the underlying closes very near your strike price at expiration, making it uncertain whether your option will expire ITM or OTM until the final moments."},
    {"id": "q4", "type": "multiple_choice", "text": "Why do professional traders often close 0DTE positions before the final 30-60 minutes?", "options": [{"id": "a", "text": "Brokers charge higher commissions in the final hour"}, {"id": "b", "text": "To avoid pin risk and extreme gamma uncertainty near expiration"}, {"id": "c", "text": "Options cannot be traded in the final hour"}, {"id": "d", "text": "To get better tax treatment"}], "correct_answer": "b", "explanation": "The final hour features extreme gamma and pin risk. Small moves can dramatically change whether an option expires ITM or OTM, so professionals lock in profits or cut losses early."},
    {"id": "q5", "type": "multiple_choice", "text": "SPX cash settlement credits appear in your account:", "options": [{"id": "a", "text": "Immediately at 4:00 PM ET"}, {"id": "b", "text": "By the next business morning"}, {"id": "c", "text": "Within 3 business days (T+3)"}, {"id": "d", "text": "After 30 days"}], "correct_answer": "b", "explanation": "Cash settlement credits from expired SPX options typically appear in your account by the next business morning."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C3 Lesson 3: SPX vs SPY: Cash-Settled Advantages
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c3_id,
  'SPX vs SPY: Cash-Settled Advantages',
  'spx-vs-spy-cash-settled-advantages',
  E'## SPX vs SPY: The Core Debate\n\nBoth SPX (the S&P 500 Index) and SPY (the SPDR S&P 500 ETF) track the same underlying benchmark, but their options behave very differently. SPX options trade on the CBOE and are index options. SPY options trade on multiple exchanges and are equity (ETF) options. For 0DTE scalpers, the choice between them has significant implications for cost, settlement, taxes, and execution.\n\n## Size and Pricing\n\nSPX is priced at the full index value (approximately 5,000), while SPY trades at roughly 1/10th of SPX (approximately 500). This means one SPX option contract controls roughly 10x the notional value of one SPY option. An ATM SPX 0DTE option might cost $8.00 ($800), while the equivalent SPY option costs about $0.80 ($80). To get equivalent exposure with SPY, you would need 10 contracts — and 10x the commissions. For larger accounts, SPX is more capital-efficient.\n\n## Settlement and Assignment\n\nThis is the critical difference. **SPX options are cash-settled and European-style.** You will never be assigned shares. The option settles for cash at expiration. **SPY options are physically settled and American-style.** If you sell a SPY put and it goes ITM, you can be assigned 100 shares of SPY at any time — even before expiration. For 0DTE traders, being assigned SPY shares overnight is a significant risk that requires margin and creates unwanted stock exposure. SPX eliminates this entirely.\n\n## Tax Treatment\n\nSPX options qualify for **Section 1256** treatment (60% long-term / 40% short-term capital gains). SPY options do not — they are taxed as regular short-term gains if held less than a year (which all 0DTE trades are). For an active scalper generating $100,000 in annual profits, this tax difference can amount to $5,000-$10,000 or more in savings with SPX.\n\n## When SPY Makes Sense\n\nSPY options are preferred by traders with smaller accounts who cannot afford $800+ per SPX contract. SPY''s smaller size allows more precise position sizing. SPY also has extended trading hours and trades on multiple exchanges, sometimes offering tighter spreads at specific strikes. However, for most traders with accounts above $25,000, SPX is the superior vehicle for 0DTE scalping due to cash settlement and tax advantages.',
  'text'::lesson_type,
  20,
  3,
  ARRAY['SPX is approximately 10x the size of SPY requiring fewer contracts for equivalent exposure', 'SPX is cash-settled with no assignment risk while SPY can result in share assignment', 'SPX qualifies for Section 1256 tax treatment saving active traders thousands annually', 'SPY is better for smaller accounts that need more granular position sizing'],
  ARRAY['Should I trade SPX or SPY for 0DTE scalping?', 'How much money do I need to start trading SPX options?', 'What are the tax savings of SPX over SPY for active traders?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "How does the notional size of one SPX option compare to one SPY option?", "options": [{"id": "a", "text": "They are the same size"}, {"id": "b", "text": "SPX is approximately 10x larger"}, {"id": "c", "text": "SPY is approximately 10x larger"}, {"id": "d", "text": "SPX is approximately 100x larger"}], "correct_answer": "b", "explanation": "SPX trades at approximately 10x the price of SPY (e.g., SPX ~5,000 vs SPY ~500), so one SPX option controls roughly 10x the notional value."},
    {"id": "q2", "type": "multiple_choice", "text": "What is a key RISK of selling SPY put options that does NOT apply to SPX?", "options": [{"id": "a", "text": "Higher commissions"}, {"id": "b", "text": "Being assigned 100 shares of SPY stock"}, {"id": "c", "text": "Wider bid-ask spreads"}, {"id": "d", "text": "No 0DTE expirations available"}], "correct_answer": "b", "explanation": "SPY options are physically settled and American-style, meaning you can be assigned shares at any time. SPX options are cash-settled and European-style, eliminating assignment risk entirely."},
    {"id": "q3", "type": "multiple_choice", "text": "Which statement about tax treatment is correct?", "options": [{"id": "a", "text": "SPY options qualify for Section 1256 tax treatment"}, {"id": "b", "text": "SPX options qualify for Section 1256 tax treatment"}, {"id": "c", "text": "Both SPX and SPY qualify for Section 1256"}, {"id": "d", "text": "Neither qualifies for Section 1256"}], "correct_answer": "b", "explanation": "SPX options qualify for Section 1256 (60/40 tax treatment). SPY options, as equity options, do not qualify and are taxed as regular short-term gains when held less than a year."},
    {"id": "q4", "type": "multiple_choice", "text": "When might SPY options be preferred over SPX?", "options": [{"id": "a", "text": "When you want cash settlement"}, {"id": "b", "text": "When you have a smaller account and need more granular position sizing"}, {"id": "c", "text": "When you want Section 1256 tax treatment"}, {"id": "d", "text": "When you want European-style exercise"}], "correct_answer": "b", "explanation": "SPY options cost approximately 1/10th of SPX options, making them more accessible for smaller accounts that need more precise position sizing."},
    {"id": "q5", "type": "multiple_choice", "text": "To replicate the exposure of 1 SPX option contract, you would need approximately:", "options": [{"id": "a", "text": "1 SPY option contract"}, {"id": "b", "text": "5 SPY option contracts"}, {"id": "c", "text": "10 SPY option contracts"}, {"id": "d", "text": "100 SPY option contracts"}], "correct_answer": "c", "explanation": "Since SPX is approximately 10x the size of SPY, you need about 10 SPY contracts to match the exposure of 1 SPX contract — which also means 10x the commissions."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C3 Lesson 4: NDX and QQQ: Choosing Your Vehicle
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c3_id,
  'NDX and QQQ: Choosing Your Vehicle',
  'ndx-and-qqq-choosing-your-vehicle',
  E'## The Nasdaq-100 Options Landscape\n\nJust as SPX and SPY offer two ways to trade the S&P 500, the Nasdaq-100 index has its own pair: **NDX** (the full-size Nasdaq-100 index option) and **QQQ** (the Invesco QQQ ETF option). NDX options share the same advantages as SPX — cash settlement, European exercise, and Section 1256 tax treatment. QQQ options, like SPY, are equity options with physical settlement and American exercise.\n\n## NDX vs QQQ Sizing\n\nNDX trades at the full index value (approximately 17,000-18,000), making each option contract extremely large in notional terms. An ATM NDX call might cost $50-$80 ($5,000-$8,000 per contract). This is prohibitively expensive for many retail traders. QQQ trades at roughly 1/40th of NDX (approximately 450-480), with ATM calls costing $1-$3 ($100-$300 per contract). For this reason, QQQ is far more popular among retail 0DTE traders, despite its equity option characteristics.\n\n## Why Trade NDX/QQQ?\n\nThe Nasdaq-100 is heavily weighted toward technology stocks (Apple, Microsoft, NVIDIA, Amazon, Meta, Google, etc.), making it more volatile than the S&P 500. On a typical day, the Nasdaq-100 may move 1.5-2x as much as the S&P 500 in percentage terms. For scalpers, this higher volatility means larger price swings — more opportunity but also more risk. Some traders prefer the Nasdaq-100 specifically because bigger moves make it easier to overcome theta decay on 0DTE.\n\n## Choosing Between SPX and NDX\n\nMost 0DTE scalpers start with SPX because of its unmatched liquidity, tight spreads, and abundant educational resources. NDX/QQQ is a strong secondary vehicle, especially on tech-driven days (earnings from major tech companies, semiconductor news, etc.). Some traders specialize in one index, while others monitor both and trade whichever has the better setup. The key considerations are: (1) liquidity — SPX generally has tighter 0DTE spreads, (2) volatility — NDX moves more, offering bigger swings, (3) cost — NDX contracts are expensive; QQQ is more accessible, and (4) correlation — both indices are correlated but not identical; divergence creates opportunities.\n\n## Practical Recommendation\n\nAs a beginner, start with SPX (or SPY if your account is small). Once you are consistently profitable, add NDX or QQQ as a secondary instrument. Trading multiple indices simultaneously is an advanced technique that requires monitoring two order books and managing correlated positions.',
  'text'::lesson_type,
  20,
  4,
  ARRAY['NDX options have the same cash settlement and tax advantages as SPX', 'NDX is more volatile than SPX making it attractive for scalpers but also riskier', 'QQQ is the more accessible alternative to NDX for smaller accounts', 'Start with SPX and add NDX/QQQ as a secondary instrument once consistently profitable'],
  ARRAY['Is NDX better than SPX for scalping?', 'Why is NDX more volatile than SPX?', 'Can I trade both SPX and NDX simultaneously?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "NDX options are:", "options": [{"id": "a", "text": "Physically settled, American-style"}, {"id": "b", "text": "Cash-settled, European-style"}, {"id": "c", "text": "Physically settled, European-style"}, {"id": "d", "text": "Cash-settled, American-style"}], "correct_answer": "b", "explanation": "NDX options, like SPX, are cash-settled and European-style. They also qualify for Section 1256 tax treatment."},
    {"id": "q2", "type": "multiple_choice", "text": "Why is the Nasdaq-100 generally more volatile than the S&P 500?", "options": [{"id": "a", "text": "It has fewer trading hours"}, {"id": "b", "text": "It is heavily weighted toward technology stocks"}, {"id": "c", "text": "It has lower liquidity"}, {"id": "d", "text": "It uses a different settlement method"}], "correct_answer": "b", "explanation": "The Nasdaq-100 is heavily concentrated in technology stocks (Apple, Microsoft, NVIDIA, etc.), which tend to be more volatile than the broader market represented by the S&P 500."},
    {"id": "q3", "type": "multiple_choice", "text": "QQQ trades at approximately what fraction of NDX?", "options": [{"id": "a", "text": "1/10th"}, {"id": "b", "text": "1/20th"}, {"id": "c", "text": "1/40th"}, {"id": "d", "text": "1/100th"}], "correct_answer": "c", "explanation": "QQQ trades at roughly 1/40th of the NDX index value (e.g., NDX ~18,000 vs QQQ ~450), making QQQ contracts far more affordable for retail traders."},
    {"id": "q4", "type": "multiple_choice", "text": "Which index generally has the TIGHTEST 0DTE bid-ask spreads?", "options": [{"id": "a", "text": "SPX"}, {"id": "b", "text": "NDX"}, {"id": "c", "text": "They are always identical"}, {"id": "d", "text": "NDX on tech-heavy days only"}], "correct_answer": "a", "explanation": "SPX generally has the tightest 0DTE bid-ask spreads due to its unmatched liquidity and trading volume. It is the most actively traded index option in the world."},
    {"id": "q5", "type": "multiple_choice", "text": "For a beginner 0DTE scalper, the recommended starting instrument is:", "options": [{"id": "a", "text": "NDX because of higher volatility"}, {"id": "b", "text": "QQQ because it is cheapest"}, {"id": "c", "text": "SPX (or SPY for smaller accounts) because of best liquidity and resources"}, {"id": "d", "text": "Individual stock options for simplicity"}], "correct_answer": "c", "explanation": "Beginners should start with SPX (or SPY for smaller accounts) because of unmatched liquidity, tight spreads, and the most educational resources available."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C3 Lesson 5: Margin Requirements for Index Scalping
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c3_id,
  'Margin Requirements for Index Scalping',
  'margin-requirements-for-index-scalping',
  E'## Understanding Margin for Options\n\nMargin requirements determine how much capital your broker requires you to have in your account to hold certain positions. For **long options** (buying calls or puts), the margin requirement is straightforward: you must pay the full premium upfront. If you buy an SPX call for $8.00, you need $800 in your account. There is no additional margin because your maximum loss is limited to the premium paid.\n\nFor **short options** (selling calls or puts), margin requirements are significantly higher because your potential loss can be much larger than the premium collected. Selling a naked SPX call or put requires substantial margin — often $50,000-$100,000+ per contract depending on the strike and current market conditions.\n\n## Pattern Day Trader (PDT) Rule\n\nIf you have a margin account with less than $25,000, the **Pattern Day Trader (PDT) rule** limits you to 3 day trades within a rolling 5-business-day period. Since every 0DTE scalp is by definition a day trade (opened and closed same day), this rule effectively requires a minimum account balance of $25,000 for active scalping. Some workarounds exist: cash accounts are not subject to PDT (but have settlement delays), and some brokers offer special programs for active traders.\n\n## Buying Power and Position Sizing\n\nYour **buying power** is the total amount available for new trades. For long options in a margin account, buying power equals your cash balance (options cannot be purchased on margin in most cases — this is a Reg T requirement). If you have $50,000 in cash, you can buy up to $50,000 worth of options. However, prudent risk management means you should never deploy all your buying power on a single trade.\n\nA common guideline is to risk no more than **1-2% of your account** per trade. With a $50,000 account, this means limiting each 0DTE scalp to $500-$1,000 in premium. This allows you to survive a string of losses without devastating your account.\n\n## Spread Margin: Reducing Requirements\n\nInstead of buying naked options or selling naked options, many scalpers use **vertical spreads** (buying one strike and selling another). Spreads have defined risk, which dramatically reduces margin requirements. For example, a 10-point wide SPX call spread might cost $3.00 ($300 max risk) versus $8.00 ($800) for a naked call. The tradeoff is capped profit potential, but the improved capital efficiency can be worthwhile.\n\n## Broker Requirements Vary\n\nDifferent brokers have different margin policies, minimum account balances, and options approval levels. Before trading 0DTE index options, ensure your broker: (1) offers SPX/NDX options, (2) has approved you for the appropriate options level, (3) provides competitive commissions on index options, and (4) has a platform fast enough for scalping. Popular choices include Interactive Brokers, Thinkorswim (Schwab), and Tastytrade.',
  'text'::lesson_type,
  25,
  5,
  ARRAY['Long options require full premium payment upfront with no additional margin', 'The Pattern Day Trader rule requires $25,000 minimum for active 0DTE scalping in margin accounts', 'Risk no more than 1-2% of your account per trade for sustainable scalping', 'Vertical spreads reduce margin requirements by defining maximum risk upfront'],
  ARRAY['How much money do I need to start scalping 0DTE options?', 'What is the Pattern Day Trader rule and how does it affect me?', 'Are vertical spreads better than naked options for beginners?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is the margin requirement for BUYING a long call option?", "options": [{"id": "a", "text": "50% of the option premium"}, {"id": "b", "text": "The full premium must be paid upfront"}, {"id": "c", "text": "No margin required — options can be bought on credit"}, {"id": "d", "text": "The strike price times 100"}], "correct_answer": "b", "explanation": "For long options (buying calls or puts), you must pay the full premium upfront. Options generally cannot be purchased on margin under Reg T rules."},
    {"id": "q2", "type": "multiple_choice", "text": "The Pattern Day Trader rule requires a minimum account balance of:", "options": [{"id": "a", "text": "$5,000"}, {"id": "b", "text": "$10,000"}, {"id": "c", "text": "$25,000"}, {"id": "d", "text": "$100,000"}], "correct_answer": "c", "explanation": "The PDT rule requires a minimum of $25,000 in a margin account to make more than 3 day trades in a rolling 5-business-day period."},
    {"id": "q3", "type": "multiple_choice", "text": "A common risk management guideline is to risk no more than _____ of your account per trade.", "options": [{"id": "a", "text": "1-2%"}, {"id": "b", "text": "10-15%"}, {"id": "c", "text": "25-30%"}, {"id": "d", "text": "50%"}], "correct_answer": "a", "explanation": "Risking 1-2% per trade is a widely followed guideline that allows traders to survive strings of losses without devastating their account."},
    {"id": "q4", "type": "multiple_choice", "text": "What is the advantage of a vertical spread over a naked long option?", "options": [{"id": "a", "text": "Unlimited profit potential"}, {"id": "b", "text": "Lower cost and reduced margin requirements with defined risk"}, {"id": "c", "text": "No commissions"}, {"id": "d", "text": "Vertical spreads are not affected by theta"}], "correct_answer": "b", "explanation": "Vertical spreads cost less than naked options and have defined maximum risk, reducing both the premium outlay and margin requirements. The tradeoff is capped profit potential."},
    {"id": "q5", "type": "multiple_choice", "text": "Which account type is NOT subject to the Pattern Day Trader rule?", "options": [{"id": "a", "text": "Margin accounts under $25,000"}, {"id": "b", "text": "Cash accounts"}, {"id": "c", "text": "IRA accounts with margin features"}, {"id": "d", "text": "All accounts are subject to PDT"}], "correct_answer": "b", "explanation": "Cash accounts are not subject to the PDT rule. However, they have settlement delays — you must wait for funds to settle after closing a trade before using them again (typically T+1 for options)."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- COURSE 4 LESSONS: Scalping Entry & Exit Strategies
-- ============================================================

-- C4 Lesson 1: Market Structure for Scalpers: Key Levels
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c4_id,
  'Market Structure for Scalpers: Key Levels',
  'market-structure-for-scalpers-key-levels',
  E'## What Is Market Structure?\n\nMarket structure refers to the pattern of price action that reveals where buyers and sellers are positioned. For scalpers, understanding market structure means identifying **key price levels** where the market is likely to react — bouncing, breaking through, or consolidating. These levels act as a roadmap for your entries and exits. Without a framework for market structure, you are trading blind.\n\nThe most important structural levels for 0DTE scalpers are: **prior day''s high and low**, **overnight high and low** (globex session), **the opening price**, **VWAP (Volume Weighted Average Price)**, **round numbers** (like SPX 5,000 or 5,050), and **key options strikes** with large open interest (gamma exposure levels).\n\n## Support and Resistance\n\nSupport is a price level where buying pressure tends to emerge, preventing further declines. Resistance is where selling pressure appears, capping advances. These levels are not exact prices but **zones** — a range of a few points where activity clusters. On SPX, support and resistance zones are often 5-10 points wide.\n\nFor 0DTE scalpers, the most actionable support/resistance levels are the prior day''s high and low. If SPX closed at 5,020 yesterday with a high of 5,040 and a low of 4,990, those three levels (close, high, low) are likely to act as magnets or barriers during today''s session.\n\n## Opening Range and Initial Balance\n\nThe **initial balance** is the high-low range of the first 30-60 minutes of trading. Many professional scalpers wait for the initial balance to form before placing their first trade. If the market breaks above the initial balance high, that is a bullish signal. A break below is bearish. Trading within the initial balance suggests a range-bound day. This framework helps you avoid getting chopped up by the opening volatility when direction is unclear.\n\n## Putting Levels Together\n\nBefore the market opens each day, mark your key levels on a chart or in your trading journal: yesterday''s high, low, and close; overnight high and low; major round numbers; and VWAP (which updates in real-time once the session begins). These levels are where you will look for trade setups. A disciplined scalper enters at levels where the risk/reward is asymmetric — for example, buying calls at strong support with a tight stop just below it.',
  'text'::lesson_type,
  30,
  1,
  ARRAY['Market structure identifies key levels where price is likely to react creating trade opportunities', 'Prior day high/low and overnight high/low are critical reference points for 0DTE scalpers', 'The initial balance (first 30-60 min range) helps determine if the day will trend or range', 'Mark key levels before market open to create a roadmap for entries and exits'],
  ARRAY['What are the most important levels to mark before market open?', 'How do I use the initial balance to decide my first trade?', 'What makes a good support or resistance level for scalping?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is the \"initial balance\" in market structure?", "options": [{"id": "a", "text": "Your account balance at market open"}, {"id": "b", "text": "The high-low range of the first 30-60 minutes of trading"}, {"id": "c", "text": "The difference between the open and close price"}, {"id": "d", "text": "The overnight futures range"}], "correct_answer": "b", "explanation": "The initial balance is the high-low range established during the first 30-60 minutes of the trading session. It helps determine whether the day is likely to trend or remain range-bound."},
    {"id": "q2", "type": "multiple_choice", "text": "Which of these is NOT typically a key level for 0DTE scalpers?", "options": [{"id": "a", "text": "Prior day high and low"}, {"id": "b", "text": "VWAP"}, {"id": "c", "text": "200-day moving average"}, {"id": "d", "text": "Round numbers like SPX 5,000"}], "correct_answer": "c", "explanation": "While the 200-day moving average matters for swing traders, 0DTE scalpers focus on intraday levels like prior day high/low, VWAP, opening range, and round numbers that affect same-day price action."},
    {"id": "q3", "type": "multiple_choice", "text": "A break above the initial balance high suggests:", "options": [{"id": "a", "text": "A bearish day"}, {"id": "b", "text": "A bullish signal"}, {"id": "c", "text": "The market will close flat"}, {"id": "d", "text": "Volume is too low to trade"}], "correct_answer": "b", "explanation": "A break above the initial balance high is a bullish signal suggesting the market may trend higher. This can be a trigger for entering long (call) positions."},
    {"id": "q4", "type": "multiple_choice", "text": "Support and resistance levels on SPX should be viewed as:", "options": [{"id": "a", "text": "Exact price points to the penny"}, {"id": "b", "text": "Zones that are typically 5-10 points wide"}, {"id": "c", "text": "Only valid on Mondays and Fridays"}, {"id": "d", "text": "Only relevant for put options"}], "correct_answer": "b", "explanation": "Support and resistance are zones, not exact prices. On SPX, these zones are typically 5-10 points wide, reflecting areas where buying or selling pressure clusters."},
    {"id": "q5", "type": "multiple_choice", "text": "When should you mark your key levels for the trading day?", "options": [{"id": "a", "text": "After lunch when volume picks up"}, {"id": "b", "text": "Before the market opens, as part of pre-market preparation"}, {"id": "c", "text": "Only after the first trade"}, {"id": "d", "text": "Key levels are not important for scalpers"}], "correct_answer": "b", "explanation": "Key levels should be identified before market open as part of your pre-market preparation. This creates a roadmap for the day and helps you react quickly when price reaches important zones."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C4 Lesson 2: Entry Signals: VWAP, Volume, and Momentum
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c4_id,
  'Entry Signals: VWAP, Volume, and Momentum',
  'entry-signals-vwap-volume-momentum',
  E'## VWAP: The Scalper''s Anchor\n\n**VWAP (Volume Weighted Average Price)** is the average price weighted by volume, calculated from the start of the trading session. It represents the "fair value" for the day — the average price at which shares have actually changed hands. Institutional traders use VWAP as a benchmark, which makes it a self-fulfilling reference point. When SPX is above VWAP, the short-term bias is bullish. When below, the bias is bearish.\n\nFor 0DTE scalpers, VWAP serves as a directional filter. A simple framework: buy calls when SPX is above VWAP and showing momentum higher; buy puts when SPX is below VWAP and showing momentum lower. Fading the trend (buying calls below VWAP or puts above) is a more advanced technique that requires strong confirmation from other signals.\n\n## Volume Confirmation\n\nVolume is the number of shares or contracts traded and is a critical confirmation tool. **Volume validates price moves.** A breakout above resistance on heavy volume is more likely to sustain than a breakout on low volume. Conversely, a move on declining volume suggests weakness and potential reversal.\n\nFor 0DTE scalpers, watch volume on 1-minute and 5-minute candles. A surge in volume (2-3x the recent average) at a key level signals institutional participation and increases the probability that the move will follow through. Low volume at a breakout is a warning sign — the move may be a fake-out.\n\n## Momentum Indicators\n\nMomentum measures the speed and strength of price movement. Common momentum tools for scalpers include:\n\n- **Relative Strength (comparing current candle size to recent candles):** Large candles with full bodies indicate strong momentum.\n- **RSI (Relative Strength Index) on short timeframes:** An RSI above 70 on the 1-minute chart indicates strong bullish momentum (not necessarily overbought on this timeframe). Below 30 indicates strong bearish momentum.\n- **MACD crossovers on the 1-minute chart:** While lagging, they can confirm trend direction.\n\nThe most effective approach combines all three: price above VWAP (directional bias), volume surge (institutional confirmation), and momentum expansion (strong candles or RSI confirmation). When all three align, the probability of a successful scalp increases significantly.\n\n## Entry Timing\n\nTiming your entry is as important as identifying the signal. Do not chase. Wait for a **pullback to VWAP or a key level** after a momentum move, then enter as price resumes the trend direction. This "buy the pullback" technique gives you a better entry price and a clearer stop-loss level (just below VWAP or the level). Chasing extended moves is one of the most common mistakes new scalpers make — the best entries come from patience, not urgency.',
  'text'::lesson_type,
  30,
  2,
  ARRAY['VWAP is the scalper anchor: bullish above VWAP and bearish below', 'Volume validates price moves: breakouts need 2-3x average volume to confirm', 'Combine VWAP direction plus volume surge plus momentum expansion for highest probability entries', 'Wait for pullbacks to enter rather than chasing extended moves'],
  ARRAY['How do I use VWAP for 0DTE trade entries?', 'What volume level confirms a real breakout?', 'Should I chase a move or wait for a pullback?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does VWAP stand for?", "options": [{"id": "a", "text": "Value Weighted Asset Price"}, {"id": "b", "text": "Volume Weighted Average Price"}, {"id": "c", "text": "Volatile Weekly Average Point"}, {"id": "d", "text": "Volume Weighted Asking Price"}], "correct_answer": "b", "explanation": "VWAP stands for Volume Weighted Average Price. It is the average price weighted by volume from the start of the trading session."},
    {"id": "q2", "type": "multiple_choice", "text": "When SPX is trading ABOVE VWAP, the short-term bias is:", "options": [{"id": "a", "text": "Bearish"}, {"id": "b", "text": "Neutral"}, {"id": "c", "text": "Bullish"}, {"id": "d", "text": "VWAP does not indicate bias"}], "correct_answer": "c", "explanation": "When price is above VWAP, it indicates buyers have been more aggressive on the day, creating a short-term bullish bias."},
    {"id": "q3", "type": "multiple_choice", "text": "A breakout above resistance on LOW volume suggests:", "options": [{"id": "a", "text": "A very strong move that will continue"}, {"id": "b", "text": "A potential fake-out that may reverse"}, {"id": "c", "text": "The best time to buy calls"}, {"id": "d", "text": "Institutional buying"}], "correct_answer": "b", "explanation": "A breakout on low volume lacks institutional conviction and may be a fake-out. Volume validates price moves — strong breakouts are accompanied by high volume."},
    {"id": "q4", "type": "multiple_choice", "text": "The highest-probability entry signal combines:", "options": [{"id": "a", "text": "Only VWAP direction"}, {"id": "b", "text": "VWAP direction, volume surge, and momentum expansion"}, {"id": "c", "text": "Only RSI readings"}, {"id": "d", "text": "Only price above the prior day high"}], "correct_answer": "b", "explanation": "The highest probability entries combine all three: price relative to VWAP (directional bias), volume surge (institutional confirmation), and momentum expansion (strong price movement)."},
    {"id": "q5", "type": "multiple_choice", "text": "What is the recommended entry technique rather than chasing an extended move?", "options": [{"id": "a", "text": "Buy at the daily high"}, {"id": "b", "text": "Wait for a pullback to VWAP or a key level"}, {"id": "c", "text": "Enter at any random time"}, {"id": "d", "text": "Only enter in the final hour"}], "correct_answer": "b", "explanation": "Waiting for a pullback to VWAP or a key level gives you a better entry price and a clear stop-loss level, improving your risk/reward ratio compared to chasing extended moves."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C4 Lesson 3: The 1-Minute Candle Framework
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c4_id,
  'The 1-Minute Candle Framework',
  'the-1-minute-candle-framework',
  E'## Why 1-Minute Candles?\n\nFor 0DTE scalpers, the 1-minute chart is the primary timeframe. Each candle represents 60 seconds of price action, providing the granularity needed for rapid entries and exits. While higher timeframes (5-minute, 15-minute) provide context, the 1-minute chart is where you execute. Learning to read 1-minute candle patterns is a core skill that separates profitable scalpers from unprofitable ones.\n\n## Candle Anatomy\n\nEvery candlestick has four data points: **Open** (where price started), **High** (the highest point reached), **Low** (the lowest point reached), and **Close** (where price ended). The solid body of the candle represents the range between open and close. The thin lines extending above and below are **wicks** (or shadows), showing the high and low extremes. A green (bullish) candle closes higher than it opened. A red (bearish) candle closes lower.\n\nFor scalpers, the size and shape of candles tell a story. A large green candle with a small wick indicates strong buying pressure from open to close. A candle with a long lower wick and small body (a "hammer") indicates sellers pushed price down but buyers recovered — bullish at support. A candle with a long upper wick (a "shooting star") at resistance indicates buyers tried but sellers won.\n\n## The 1-Minute Scalping Framework\n\nThis framework uses three elements: (1) **Trend Candles** — large-bodied candles moving in the same direction indicate momentum. Three or more consecutive trend candles in the same direction signal a strong move. (2) **Pause Candles** — small-bodied candles (doji, spinning top) indicate indecision. After a trend, pause candles may precede a continuation or reversal. (3) **Rejection Candles** — candles with long wicks at key levels indicate the market rejected that price. A long lower wick at support is bullish; a long upper wick at resistance is bearish.\n\n## Practical Entry Trigger\n\nA concrete entry trigger: After identifying a key level and directional bias (VWAP, momentum), wait for a rejection candle at the level, then enter when the next candle confirms the direction. For example: SPX pulls back to VWAP, prints a 1-minute candle with a long lower wick (buyers defending VWAP), and the next candle opens and moves higher — that is your entry for a long call position. Your stop is just below the wick low.\n\nThis framework provides structure. Instead of guessing, you are waiting for specific candle patterns at specific levels. Pattern + Level + Direction = High-probability entry.',
  'text'::lesson_type,
  25,
  3,
  ARRAY['The 1-minute chart is the primary execution timeframe for 0DTE scalpers', 'Candle body size indicates momentum strength while wicks indicate rejection', 'Look for trend candles for momentum and rejection candles at key levels for entries', 'Wait for rejection candle at a key level followed by confirmation candle before entering'],
  ARRAY['How do I read 1-minute candle patterns for scalping?', 'What does a long wick on a candle tell me?', 'How many candles should confirm a trend before I enter?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "A candlestick with a long lower wick at a support level suggests:", "options": [{"id": "a", "text": "Strong selling pressure and likely breakdown"}, {"id": "b", "text": "Buyers rejected lower prices — potentially bullish"}, {"id": "c", "text": "The market is about to close"}, {"id": "d", "text": "Volume is extremely low"}], "correct_answer": "b", "explanation": "A long lower wick (hammer) at support indicates sellers pushed price down but buyers recovered, rejecting the lower price. This is a bullish signal at support."},
    {"id": "q2", "type": "multiple_choice", "text": "Three or more consecutive large-bodied candles in the same direction indicate:", "options": [{"id": "a", "text": "The market is about to reverse"}, {"id": "b", "text": "Strong momentum in that direction"}, {"id": "c", "text": "Low volume and no conviction"}, {"id": "d", "text": "A trading halt is imminent"}], "correct_answer": "b", "explanation": "Multiple consecutive trend candles (large bodies moving the same direction) indicate strong momentum and institutional participation."},
    {"id": "q3", "type": "multiple_choice", "text": "A doji candle (small body, equal wicks) indicates:", "options": [{"id": "a", "text": "Strong bullish momentum"}, {"id": "b", "text": "Strong bearish momentum"}, {"id": "c", "text": "Indecision between buyers and sellers"}, {"id": "d", "text": "The trend will always continue"}], "correct_answer": "c", "explanation": "A doji candle has a very small body, showing that the open and close were nearly the same. This indicates indecision between buyers and sellers."},
    {"id": "q4", "type": "multiple_choice", "text": "The recommended entry trigger in the 1-minute framework is:", "options": [{"id": "a", "text": "Enter immediately when price touches any moving average"}, {"id": "b", "text": "Rejection candle at key level followed by a confirmation candle in your direction"}, {"id": "c", "text": "Buy every red candle"}, {"id": "d", "text": "Wait for exactly 5 doji candles in a row"}], "correct_answer": "b", "explanation": "Wait for a rejection candle at a key level (showing the market defended that level), then enter when the next candle confirms the directional bias. This provides a structured, high-probability entry."},
    {"id": "q5", "type": "multiple_choice", "text": "Where should you place your stop loss in the 1-minute candle framework?", "options": [{"id": "a", "text": "At a random dollar amount"}, {"id": "b", "text": "Just beyond the wick of the rejection candle"}, {"id": "c", "text": "50 points below entry"}, {"id": "d", "text": "Stops should never be used"}], "correct_answer": "b", "explanation": "The stop should be placed just beyond the wick of the rejection candle. If price breaks past that level, the setup is invalidated and you want to exit quickly."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C4 Lesson 4: Exit Rules: Profit Targets & Stop Losses
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c4_id,
  'Exit Rules: Profit Targets & Stop Losses',
  'exit-rules-profit-targets-stop-losses',
  E'## The Most Important Part of Trading\n\nMany traders obsess over entries but neglect exits. Yet your exit strategy determines your actual P&L. A perfect entry with a poor exit often results in a loss. The two pillars of exit strategy are **profit targets** (where you take gains) and **stop losses** (where you cut losses). Both must be defined before or immediately upon entering every trade.\n\n## Setting Profit Targets\n\nProfit targets should be based on the reward you expect relative to the risk you are taking. Common approaches for 0DTE scalpers:\n\n1. **Fixed Dollar Target:** Set a target of 1x to 2x your risk. If you risk $300 (your stop loss), target $300-$600 in profit. This creates a minimum 1:1 or 2:1 reward-to-risk ratio.\n2. **Key Level Target:** Take profit at the next significant support or resistance level. If you buy calls at VWAP support and the prior day high is 15 points above, that is your target.\n3. **Percentage of Premium Target:** Many scalpers target a 50-100% return on premium. If you buy a call for $4.00, you exit at $6.00-$8.00.\n\nThe key is consistency. Choose one method and apply it systematically. Do not let greed convince you to hold beyond your target — on 0DTE, theta is always working against you.\n\n## Setting Stop Losses\n\nStop losses protect your capital from catastrophic losses. For 0DTE scalpers, stops should be tight but not so tight that normal volatility stops you out prematurely. Common approaches:\n\n1. **Fixed Dollar Stop:** Risk a fixed amount per trade, typically 1-2% of account. With a $50,000 account, that is $500-$1,000 max loss per trade.\n2. **Technical Stop:** Place your stop just below/above the key level that prompted your entry. If you bought calls because SPX bounced off 5,000, your stop is at 4,997 (3 points below the level).\n3. **Percentage of Premium Stop:** Many scalpers use a 30-50% stop on premium. Buy a call at $5.00, stop out if it drops to $2.50-$3.50.\n\n## The 2:1 Rule\n\nA widely used framework is the **2:1 reward-to-risk ratio**. For every $1 you risk, you aim to make $2. This means even if you only win 40% of your trades, you remain profitable: (40% x $2.00) - (60% x $1.00) = $0.80 - $0.60 = +$0.20 per dollar risked. This mathematical edge is the foundation of sustainable scalping.\n\n## Trailing Stops\n\nOnce a trade moves in your favor, you can use a **trailing stop** to lock in profits while allowing the trade to continue running. For example, once your position is up $3.00, move your stop to breakeven (your entry price). If the trade continues to $5.00 profit, trail your stop to $3.00 profit. This technique captures outsized winners while protecting against reversals.',
  'text'::lesson_type,
  25,
  4,
  ARRAY['Define profit targets and stop losses before or immediately upon entering every trade', 'Target a minimum 2:1 reward-to-risk ratio so you can be profitable winning only 40% of trades', 'Stop losses should be based on key levels or a fixed percentage of premium not arbitrary amounts', 'Use trailing stops to lock in profits while allowing winning trades to continue running'],
  ARRAY['What reward-to-risk ratio should I target for scalping?', 'Where should I place my stop loss on a 0DTE trade?', 'How do trailing stops work in practice?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "With a 2:1 reward-to-risk ratio, what win rate is needed to be profitable?", "options": [{"id": "a", "text": "Over 75%"}, {"id": "b", "text": "Over 50%"}, {"id": "c", "text": "Over 33.4%"}, {"id": "d", "text": "100%"}], "correct_answer": "c", "explanation": "With 2:1 reward-to-risk, you need to win just over 33.4% of trades to break even. At 40% win rate: (0.40 x $2) - (0.60 x $1) = +$0.20 per dollar risked. This is why reward-to-risk is more important than win rate."},
    {"id": "q2", "type": "multiple_choice", "text": "When should profit targets and stop losses be defined?", "options": [{"id": "a", "text": "After the trade has been open for 30 minutes"}, {"id": "b", "text": "Before or immediately upon entering the trade"}, {"id": "c", "text": "Only when the trade is losing"}, {"id": "d", "text": "At the end of the trading day"}], "correct_answer": "b", "explanation": "Profit targets and stop losses should be defined before or immediately upon entering every trade. This removes emotion from the exit decision and protects your capital."},
    {"id": "q3", "type": "multiple_choice", "text": "A technical stop loss is placed:", "options": [{"id": "a", "text": "At a random dollar amount"}, {"id": "b", "text": "Just beyond the key level that prompted the entry"}, {"id": "c", "text": "50% below the entry price always"}, {"id": "d", "text": "Only for losing trades"}], "correct_answer": "b", "explanation": "A technical stop is placed just beyond the level that justified the trade. If that level breaks, the setup is invalidated and you exit."},
    {"id": "q4", "type": "multiple_choice", "text": "What is a trailing stop?", "options": [{"id": "a", "text": "A stop that gets further from the current price as the trade moves in your favor"}, {"id": "b", "text": "A stop that moves in the direction of your trade to lock in profits"}, {"id": "c", "text": "A stop that only activates after hours"}, {"id": "d", "text": "A stop placed before market open"}], "correct_answer": "b", "explanation": "A trailing stop moves in the direction of your profitable trade, locking in gains while still allowing the position to run. It helps capture larger winners while protecting against reversals."},
    {"id": "q5", "type": "multiple_choice", "text": "With a 50% premium stop, if you buy an option at $6.00, you exit at:", "options": [{"id": "a", "text": "$5.50"}, {"id": "b", "text": "$4.00"}, {"id": "c", "text": "$3.00"}, {"id": "d", "text": "$0.00 (hold to expiration)"}], "correct_answer": "c", "explanation": "A 50% premium stop means you exit when the option loses 50% of its value. 50% of $6.00 = $3.00 loss, so you exit at $6.00 - $3.00 = $3.00."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C4 Lesson 5: Scaling In and Out of Positions
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c4_id,
  'Scaling In and Out of Positions',
  'scaling-in-and-out-of-positions',
  E'## What Is Scaling?\n\nScaling is the practice of entering or exiting a position in multiple tranches rather than all at once. Instead of buying 10 contracts at one price, you might buy 4 contracts initially, add 3 more on a pullback, and add the final 3 on a breakout confirmation. Similarly, instead of selling all 10 contracts at your target, you might sell 5 at the first target and let 5 run for a bigger move. Scaling is one of the most powerful techniques in a scalper''s toolkit.\n\n## Scaling In: Building Your Position\n\nScaling in reduces the risk of poor entry timing. By splitting your entry into 2-3 tranches, you average your cost basis and give yourself room if the initial entry is slightly early. A common scaling-in approach for 0DTE:\n\n1. **Tranche 1 (50% size):** Enter when your primary setup triggers — for example, a rejection candle at VWAP.\n2. **Tranche 2 (30% size):** Add if price pulls back slightly but holds above your stop level — you are getting a better average price.\n3. **Tranche 3 (20% size):** Add on confirmation — the move resumes in your direction with momentum.\n\nImportant rule: Never scale into a losing position that has broken your stop level. Scaling in is for building a position at progressively better prices within your original thesis, not for averaging down on a failed trade.\n\n## Scaling Out: Locking In Profits\n\nScaling out is arguably even more important. The tension between taking profits too early and holding too long is real — scaling out solves this by doing both.\n\n1. **Tranche 1 (50%):** Take half your position off at your primary profit target (e.g., 1:1 risk/reward). This locks in guaranteed profit.\n2. **Move stop to breakeven:** Once half is off at a profit, move your stop on the remaining position to your entry price. You now have a "free trade" — you cannot lose money.\n3. **Tranche 2 (remaining 50%):** Let the remaining position run toward a secondary target (2:1 or 3:1) with a trailing stop. If the market continues, you capture an outsized winner. If it reverses, you exit at breakeven on the second half.\n\n## The Psychology of Scaling\n\nScaling out is psychologically powerful. By locking in profits on the first tranche, you reduce anxiety about the remaining position. You can hold the second tranche with more patience because the trade is already a winner. This emotional relief often leads to better decision-making on the remaining position.\n\nMany professional traders say that scaling out improved their performance more than any other technique. It prevents the regret of selling too early (you still have half running) and the regret of holding too long (you already locked in half).',
  'text'::lesson_type,
  30,
  5,
  ARRAY['Scaling means entering or exiting in multiple tranches rather than all at once', 'Scale in by adding to winners at better prices but never average down past your stop level', 'Scale out by taking half at the first target then trailing the rest for a potential bigger win', 'After taking partial profits move your stop to breakeven for a risk-free remaining position'],
  ARRAY['How many tranches should I use for scaling?', 'When should I add to a winning position?', 'What is the advantage of scaling out versus exiting all at once?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does \"scaling in\" mean?", "options": [{"id": "a", "text": "Entering the full position all at once"}, {"id": "b", "text": "Building the position in multiple tranches at different prices"}, {"id": "c", "text": "Increasing your stop loss size"}, {"id": "d", "text": "Trading multiple underlying assets simultaneously"}], "correct_answer": "b", "explanation": "Scaling in means building your position in multiple tranches (portions) rather than entering the full size at one price. This reduces timing risk and can improve average entry price."},
    {"id": "q2", "type": "multiple_choice", "text": "After taking 50% off at your profit target, what should you do with your stop loss?", "options": [{"id": "a", "text": "Remove it entirely"}, {"id": "b", "text": "Move it further from current price"}, {"id": "c", "text": "Move it to breakeven (your entry price)"}, {"id": "d", "text": "Keep it in the original position"}], "correct_answer": "c", "explanation": "After taking partial profits, move your stop to breakeven on the remaining position. This creates a risk-free trade — you have locked in profit and cannot lose on the rest."},
    {"id": "q3", "type": "multiple_choice", "text": "When scaling in, you should NEVER:", "options": [{"id": "a", "text": "Add to a position that is at a better price but above your stop"}, {"id": "b", "text": "Add to a losing position that has broken your stop level"}, {"id": "c", "text": "Use limit orders for additional tranches"}, {"id": "d", "text": "Split your position into three tranches"}], "correct_answer": "b", "explanation": "Never scale into a position that has broken your stop level. If your stop is hit, the trade thesis is invalid. Scaling in is for building positions at better prices within your original thesis."},
    {"id": "q4", "type": "multiple_choice", "text": "The primary PSYCHOLOGICAL benefit of scaling out is:", "options": [{"id": "a", "text": "It eliminates all emotions from trading"}, {"id": "b", "text": "It locks in profits on the first tranche, reducing anxiety about the remaining position"}, {"id": "c", "text": "It guarantees the second tranche will be profitable"}, {"id": "d", "text": "It eliminates commissions"}], "correct_answer": "b", "explanation": "Scaling out locks in profits on the first tranche, which reduces anxiety and allows you to hold the remaining position with more patience and better decision-making."},
    {"id": "q5", "type": "multiple_choice", "text": "A common scaling-out strategy is:", "options": [{"id": "a", "text": "Sell 100% at the first sign of profit"}, {"id": "b", "text": "Sell 50% at 1:1 R/R, trail the remaining 50% toward 2:1 or 3:1"}, {"id": "c", "text": "Never take profits until expiration"}, {"id": "d", "text": "Sell 10% every minute regardless of price"}], "correct_answer": "b", "explanation": "A common approach: sell half at 1:1 reward/risk, move stop to breakeven on the remaining half, then trail toward a 2:1 or 3:1 target. This balances locking in profits with capturing bigger winners."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- COURSE 5 LESSONS: Risk Management for Scalpers
-- ============================================================

-- C5 Lesson 1: The 1% Rule: Never Blow Up Your Account
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c5_id,
  'The 1% Rule: Never Blow Up Your Account',
  'the-1-percent-rule-never-blow-up',
  E'## The Cardinal Rule of Trading\n\nThe single most important rule in trading is survival. You cannot make money if you have no capital to trade with. The **1% Rule** states that you should never risk more than 1% of your total trading account on any single trade. With a $50,000 account, your maximum risk per trade is $500. This sounds conservative — and it is — by design. The 1% Rule ensures that even a devastating losing streak of 10 consecutive losses only draws down your account by approximately 10%.\n\n## The Mathematics of Ruin\n\nTo understand why the 1% Rule matters, consider the math of recovery. If you lose 10% of your account, you need an 11.1% gain to get back to breakeven. If you lose 25%, you need a 33.3% gain. If you lose 50%, you need a 100% gain — you must double your remaining capital just to recover. The deeper the hole, the harder (and often impossible) it is to climb out. The 1% Rule keeps your drawdowns manageable and recoverable.\n\nA common failure pattern: a new trader risks 5-10% per trade, hits a losing streak of 5 trades, loses 25-50% of their account, then overtrades trying to recover, which leads to complete account blowup. The 1% Rule breaks this cycle by making any single loss psychologically and financially insignificant.\n\n## Applying the 1% Rule to 0DTE Scalping\n\nHere is how to apply the 1% Rule in practice with a $50,000 account:\n\n1. **Maximum risk per trade:** $500 (1% of $50,000)\n2. **Choose your stop loss:** If your stop is 50% of premium, you can buy up to $1,000 in premium ($1,000 x 50% = $500 risk)\n3. **Position size:** If an ATM SPX call costs $8.00 ($800 per contract), you can buy 1 contract with $200 of headroom before hitting your max risk\n4. **Adjust as account changes:** If your account grows to $60,000, your 1% becomes $600. If it shrinks to $45,000, your 1% drops to $450. Always recalculate.\n\n## The 2% Variation\n\nSome traders use a 2% rule, especially those with smaller accounts where 1% would make position sizes impractically small. With a $25,000 account, 2% = $500 risk per trade. The key is consistency — choose 1% or 2% and stick with it. Never increase your risk percentage during a losing streak. If anything, reduce it. The traders who survive long enough to become profitable are the ones who protected their capital during the learning phase.',
  'text'::lesson_type,
  20,
  1,
  ARRAY['Never risk more than 1% of your total account on any single trade', 'A 50% drawdown requires a 100% gain to recover making large losses nearly unrecoverable', 'Always calculate position size based on your risk percentage before entering a trade', 'The 1% Rule ensures that even 10 consecutive losses only cost about 10% of your account'],
  ARRAY['How do I calculate position size using the 1% rule?', 'What happens to my account after 10 consecutive losses at 1% risk?', 'Is 2% per trade too risky for a beginner?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "The 1% Rule states that you should risk no more than _____ of your total account per trade.", "options": [{"id": "a", "text": "1%"}, {"id": "b", "text": "5%"}, {"id": "c", "text": "10%"}, {"id": "d", "text": "25%"}], "correct_answer": "a", "explanation": "The 1% Rule limits risk to 1% of your total trading account per trade, ensuring that any single loss is financially and psychologically manageable."},
    {"id": "q2", "type": "multiple_choice", "text": "If your $50,000 account loses 50%, how much gain do you need to recover?", "options": [{"id": "a", "text": "50%"}, {"id": "b", "text": "75%"}, {"id": "c", "text": "100%"}, {"id": "d", "text": "150%"}], "correct_answer": "c", "explanation": "After a 50% loss, you have $25,000. You need to gain $25,000 to get back to $50,000, which is a 100% gain on $25,000. The math of recovery makes large drawdowns extremely difficult to overcome."},
    {"id": "q3", "type": "multiple_choice", "text": "With a $40,000 account using the 1% rule, your max risk per trade is:", "options": [{"id": "a", "text": "$100"}, {"id": "b", "text": "$400"}, {"id": "c", "text": "$4,000"}, {"id": "d", "text": "$40,000"}], "correct_answer": "b", "explanation": "1% of $40,000 = $400. This is the maximum amount you should risk (not the maximum position size) on any single trade."},
    {"id": "q4", "type": "multiple_choice", "text": "During a losing streak, you should:", "options": [{"id": "a", "text": "Double your risk to recover faster"}, {"id": "b", "text": "Maintain or reduce your risk percentage"}, {"id": "c", "text": "Switch to a different asset class"}, {"id": "d", "text": "Take a larger position on the next trade"}], "correct_answer": "b", "explanation": "During a losing streak, maintain or reduce your risk percentage. Never increase risk to try to recover losses — this is how accounts get blown up."},
    {"id": "q5", "type": "multiple_choice", "text": "The 1% Rule breaks the cycle of account blowup by:", "options": [{"id": "a", "text": "Guaranteeing profitable trades"}, {"id": "b", "text": "Making any single loss financially and psychologically insignificant"}, {"id": "c", "text": "Eliminating losing trades"}, {"id": "d", "text": "Increasing win rate automatically"}], "correct_answer": "b", "explanation": "The 1% Rule makes each loss small enough that it does not create panic or desperate behavior. This prevents the overtrade-to-recover spiral that destroys accounts."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C5 Lesson 2: Position Sizing for Options Scalpers
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c5_id,
  'Position Sizing for Options Scalpers',
  'position-sizing-for-options-scalpers',
  E'## Position Sizing: The Bridge Between Risk and Reward\n\nPosition sizing is the process of determining **how many contracts** to trade on each scalp. It is the practical implementation of your risk management rules. Correct position sizing ensures that your risk per trade stays within your 1-2% limit regardless of the option''s price, your stop distance, or market conditions. Position sizing is not about maximizing profit on any single trade — it is about maximizing long-term account growth.\n\n## The Position Sizing Formula\n\nThe formula is: **Number of Contracts = Max Risk / (Entry Price - Stop Price) / 100**\n\nExample: $50,000 account, 1% max risk = $500. You buy an SPX call at $6.00. Your stop loss is at $3.00 (50% of premium). Risk per contract = ($6.00 - $3.00) x 100 = $300. Number of contracts = $500 / $300 = 1.67, rounded down to **1 contract**.\n\nAnother example: Same account, but you find a cheaper option at $2.50 with a stop at $1.50. Risk per contract = ($2.50 - $1.50) x 100 = $100. Number of contracts = $500 / $100 = **5 contracts**.\n\nNotice how cheaper options with tighter stops allow larger position sizes while maintaining the same dollar risk. This is by design — the 1% Rule always governs.\n\n## Adjusting for Volatility\n\nOn high-volatility days (VIX elevated, major economic releases), options premiums are higher and price swings are larger. Some disciplined traders reduce their position size on volatile days — trading fewer contracts or using a 0.5% risk rule instead of 1%. This accounts for the wider stops needed to avoid being prematurely stopped out by noise.\n\nConversely, on low-volatility days, options are cheaper, stops can be tighter, and you may be able to trade slightly larger size while maintaining the same dollar risk. Always let the math determine your size, never your conviction or emotion.\n\n## The Danger of Oversizing\n\nThe most common mistake among new scalpers is trading too large. An outsized position creates outsized emotions. When you have too much money on the line, you freeze on exits, move your stops further away, or panic-sell at the worst moment. Proper position sizing keeps each trade routine and emotionless. If your heart is pounding during a trade, your position is too large.\n\n## Kelly Criterion (Advanced)\n\nAdvanced traders may reference the **Kelly Criterion** for optimal position sizing: **f* = (bp - q) / b**, where f* is the fraction of capital to risk, b is the odds received (reward/risk ratio), p is the probability of winning, and q is the probability of losing (1-p). For example, with a 2:1 reward-to-risk and 45% win rate: f* = (2 x 0.45 - 0.55) / 2 = 0.175 or 17.5%. In practice, most traders use a fraction of Kelly (quarter-Kelly or half-Kelly) for additional safety.',
  'text'::lesson_type,
  25,
  2,
  ARRAY['Position size = Max Risk divided by Risk Per Contract ensuring each trade stays within your limit', 'Cheaper options with tighter stops allow more contracts while maintaining the same total risk', 'Reduce position size on high-volatility days and let the math always govern your sizing', 'If your heart is pounding during a trade your position is too large'],
  ARRAY['How do I calculate the right number of contracts for a trade?', 'Should I trade more contracts with cheaper options?', 'What is the Kelly Criterion and should I use it?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "You have a $30,000 account with 1% max risk. An option costs $4.00 and your stop is at $2.00. How many contracts can you trade?", "options": [{"id": "a", "text": "1 contract"}, {"id": "b", "text": "2 contracts"}, {"id": "c", "text": "3 contracts"}, {"id": "d", "text": "5 contracts"}], "correct_answer": "a", "explanation": "Max risk = 1% of $30,000 = $300. Risk per contract = ($4.00 - $2.00) x 100 = $200. Contracts = $300 / $200 = 1.5, rounded down to 1 contract."},
    {"id": "q2", "type": "multiple_choice", "text": "On high-volatility days, prudent traders typically:", "options": [{"id": "a", "text": "Double their position size to capture bigger moves"}, {"id": "b", "text": "Reduce position size or use a lower risk percentage"}, {"id": "c", "text": "Avoid trading entirely"}, {"id": "d", "text": "Switch to equity options only"}], "correct_answer": "b", "explanation": "On volatile days, wider stops are needed and premiums are higher. Reducing position size or using a lower risk percentage maintains discipline during uncertain conditions."},
    {"id": "q3", "type": "multiple_choice", "text": "A sign that your position is too large is:", "options": [{"id": "a", "text": "You feel calm and routine during the trade"}, {"id": "b", "text": "Your heart is pounding and you feel anxious"}, {"id": "c", "text": "You are checking other trades simultaneously"}, {"id": "d", "text": "Your profit target is hit quickly"}], "correct_answer": "b", "explanation": "If you feel extreme anxiety or your heart is pounding during a trade, your position is too large. Proper sizing should make each trade feel routine, allowing clear-headed decision making."},
    {"id": "q4", "type": "multiple_choice", "text": "Position sizing should be determined by:", "options": [{"id": "a", "text": "Your conviction about the trade"}, {"id": "b", "text": "How much you won or lost on the previous trade"}, {"id": "c", "text": "The mathematical formula based on account size and stop distance"}, {"id": "d", "text": "The time of day"}], "correct_answer": "c", "explanation": "Position sizing should always be determined by the math: your account size, risk percentage, and the distance to your stop loss. Never let emotion or conviction drive sizing."},
    {"id": "q5", "type": "multiple_choice", "text": "If the same dollar risk allows you to buy 5 contracts of a $2.00 option vs 1 contract of a $8.00 option, you should:", "options": [{"id": "a", "text": "Always choose the 5-contract position for more leverage"}, {"id": "b", "text": "Always choose the 1-contract position for simplicity"}, {"id": "c", "text": "Choose based on the delta, liquidity, and setup quality of each option"}, {"id": "d", "text": "Avoid trading that day"}], "correct_answer": "c", "explanation": "Same dollar risk can be deployed across different strikes and sizes. The choice should depend on the specific trade setup, option Greeks, and liquidity — not just the number of contracts."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C5 Lesson 3: Setting Daily Loss Limits That Work
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c5_id,
  'Setting Daily Loss Limits That Work',
  'setting-daily-loss-limits-that-work',
  E'## Why Daily Loss Limits Are Essential\n\nA daily loss limit is the **maximum amount you are willing to lose in a single trading day**. Once you hit this limit, you stop trading — no exceptions. Daily loss limits prevent the most destructive behavior in trading: revenge trading. After a string of losses, the emotional urge to "make it back" is overwhelming. Traders in this state make their worst decisions: larger positions, abandoned stop losses, and impulsive entries. A hard daily loss limit is the circuit breaker that prevents a bad day from becoming a catastrophic day.\n\n## Setting Your Daily Loss Limit\n\nA common daily loss limit is **3% of your account** or **3 consecutive losing trades**, whichever comes first. With a $50,000 account, your daily loss limit is $1,500. If you risk 1% ($500) per trade, this gives you 3 full-risk trades before stopping. Some traders use 2% as their daily limit for tighter control.\n\nThe key principle: your daily loss limit should be large enough to allow a reasonable number of trade attempts but small enough that hitting it does not significantly impact your ability to trade the next day.\n\n## The Three-Strike Rule\n\nMany professional scalpers use a "three-strike" framework: three consecutive losses in a row and you are done for the day. This rule exists because three consecutive losses often indicates one of three things: (1) your reads are wrong and the market is not behaving as you expect, (2) you are emotionally compromised and making poor decisions, or (3) market conditions are not conducive to your strategy today. In all three cases, the best action is to stop.\n\n## When to Resume Trading\n\nAfter hitting your daily limit, close your platform and step away. Do not watch the charts — this only leads to frustration ("I would have nailed that one!"). Instead, use the time for trade review. Analyze your losing trades: Were the setups valid? Were the entries and exits executed correctly? Were you following your rules? If the answer is yes and you simply had unlucky outcomes, that is normal variance. If the answer is no, you have identified areas for improvement.\n\nResume trading the next day with a fresh mindset and a full daily allocation. Never carry emotional baggage from one session to the next.\n\n## Scaling Up After Green Days\n\nSome traders also set **daily profit targets** — a maximum gain at which they stop trading for the day. The logic is the same: protect gains from overtrading. After hitting $1,500 in profits, for instance, you might stop trading or switch to paper trading for the rest of the session. While this caps upside, it also prevents giving back large gains on afternoon trades.',
  'text'::lesson_type,
  20,
  3,
  ARRAY['Set a hard daily loss limit of 3% of account or 3 consecutive losses whichever comes first', 'Daily loss limits prevent revenge trading which is the most destructive behavior in scalping', 'After hitting your limit close the platform and review your trades instead of watching charts', 'Never carry emotional baggage from one trading session to the next'],
  ARRAY['How do I set the right daily loss limit for my account size?', 'What should I do after hitting my daily loss limit?', 'Should I also have a daily profit target?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "A common daily loss limit for scalpers is:", "options": [{"id": "a", "text": "25% of account"}, {"id": "b", "text": "10% of account"}, {"id": "c", "text": "3% of account"}, {"id": "d", "text": "0.1% of account"}], "correct_answer": "c", "explanation": "A common daily loss limit is 3% of account or 3 consecutive losses, whichever comes first. This allows a reasonable number of attempts while preventing catastrophic daily drawdowns."},
    {"id": "q2", "type": "multiple_choice", "text": "The primary purpose of a daily loss limit is to prevent:", "options": [{"id": "a", "text": "Profitable trades"}, {"id": "b", "text": "Revenge trading and emotional decision-making after losses"}, {"id": "c", "text": "Trading in the morning"}, {"id": "d", "text": "Using stop losses"}], "correct_answer": "b", "explanation": "Daily loss limits primarily prevent revenge trading — the destructive cycle of increasing risk and abandoning discipline after losses in an attempt to recover."},
    {"id": "q3", "type": "multiple_choice", "text": "The \"three-strike rule\" means:", "options": [{"id": "a", "text": "You can only make 3 trades per day"}, {"id": "b", "text": "After 3 consecutive losses, you stop trading for the day"}, {"id": "c", "text": "You must win 3 trades before stopping"}, {"id": "d", "text": "You can only lose 3 points per trade"}], "correct_answer": "b", "explanation": "The three-strike rule: after 3 consecutive losses, stop trading. Three straight losses often indicates your reads are off, you are emotional, or market conditions do not suit your strategy."},
    {"id": "q4", "type": "multiple_choice", "text": "After hitting your daily loss limit, you should:", "options": [{"id": "a", "text": "Immediately switch to a different strategy and keep trading"}, {"id": "b", "text": "Close your platform, step away, and review your trades"}, {"id": "c", "text": "Double your position size on the next trade to recover"}, {"id": "d", "text": "Watch the charts for the rest of the day to see what you missed"}], "correct_answer": "b", "explanation": "After hitting your daily limit, close the platform and step away. Use the time for constructive trade review rather than watching charts, which leads to frustration."},
    {"id": "q5", "type": "multiple_choice", "text": "Three consecutive losing trades often indicates:", "options": [{"id": "a", "text": "You are about to go on a winning streak"}, {"id": "b", "text": "Your market reads may be wrong, you may be emotional, or conditions do not suit your strategy"}, {"id": "c", "text": "You should increase position size"}, {"id": "d", "text": "The broker is giving you bad fills"}], "correct_answer": "b", "explanation": "Three consecutive losses suggests something is off: your analysis may be wrong, you may be emotionally compromised, or the market may not be suited to your strategy that day."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C5 Lesson 4: Managing Correlated Positions
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c5_id,
  'Managing Correlated Positions',
  'managing-correlated-positions',
  E'## What Is Correlation Risk?\n\nCorrelation measures how closely two assets move together. SPX and NDX are highly correlated — on most days, they move in the same direction. If you hold long calls on both SPX and NDX simultaneously, you do not have two independent bets; you have one large directional bet with double the exposure. This is **correlation risk** — the danger that positions you thought were diversified actually amplify each other.\n\n## Hidden Correlations in 0DTE Trading\n\nCorrelation risk is sneaky. Consider these scenarios where you might unknowingly accumulate correlated exposure:\n\n- **Multiple strikes on the same underlying:** If you hold 5,000 calls and 5,010 calls on SPX, both positions move in the same direction. You have doubled your SPX exposure.\n- **SPX and NDX together:** SPX and NDX have a correlation of approximately 0.85-0.95 on most days. Long calls on both is essentially one large bullish bet on the market.\n- **SPX and individual tech stocks:** If you buy SPX calls and simultaneously buy AAPL calls, you have correlated exposure because Apple is a major component of the S&P 500.\n\nThe danger: each individual position might be within your 1% risk rule, but the combined correlated risk far exceeds it.\n\n## Managing Correlated Exposure\n\nTo manage correlation risk, follow these guidelines:\n\n1. **Track your total directional exposure:** Sum the dollar risk of all positions that move in the same direction. If you have $500 risk on an SPX call and $500 risk on an NDX call, your effective directional risk is closer to $900-$950 (not $500), given their high correlation.\n2. **Use a portfolio risk limit:** Set a maximum total portfolio risk of 3-5% of your account across all open positions. This prevents you from having 5 correlated trades each at 1% risk, totaling 5% concentrated directional exposure.\n3. **Offsetting positions:** If you want exposure to both directions (hedging), pair a long SPX call with a long SPX put at different strikes. This creates a defined risk structure.\n4. **One trade at a time (for beginners):** The simplest correlation management: trade only one position at a time. Close your first trade before entering the second. This eliminates correlation risk entirely.\n\n## Diversification in Scalping\n\nTrue diversification for a scalper is not holding multiple correlated positions simultaneously — it is diversifying **across time**. Take one high-quality trade, manage it to completion, then take the next. Your diversification comes from the many independent trade opportunities throughout the day, not from stacking multiple bets at the same moment.',
  'text'::lesson_type,
  20,
  4,
  ARRAY['SPX and NDX are highly correlated so simultaneous positions amplify directional risk', 'Sum dollar risk across all correlated positions to understand true portfolio exposure', 'Set a portfolio risk limit of 3-5% across all open positions not just per-trade limits', 'Beginners should trade one position at a time to eliminate correlation risk entirely'],
  ARRAY['How do I know if my positions are correlated?', 'Can I trade SPX and NDX at the same time safely?', 'What is the right maximum portfolio risk for a scalper?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "SPX and NDX have a typical correlation of approximately:", "options": [{"id": "a", "text": "0.10-0.20 (low correlation)"}, {"id": "b", "text": "0.40-0.50 (moderate correlation)"}, {"id": "c", "text": "0.85-0.95 (high correlation)"}, {"id": "d", "text": "-1.00 (perfectly inverse)"}], "correct_answer": "c", "explanation": "SPX and NDX typically have a correlation of 0.85-0.95, meaning they move in the same direction the vast majority of the time. Simultaneous positions in both amplify directional risk."},
    {"id": "q2", "type": "multiple_choice", "text": "If you hold long calls on both SPX and NDX, you effectively have:", "options": [{"id": "a", "text": "A perfectly hedged position"}, {"id": "b", "text": "Two independent bets with separate risk"}, {"id": "c", "text": "One large directional bet with amplified exposure"}, {"id": "d", "text": "A market-neutral position"}], "correct_answer": "c", "explanation": "Because SPX and NDX are highly correlated, holding long calls on both is essentially one large bullish directional bet, not two independent bets."},
    {"id": "q3", "type": "multiple_choice", "text": "The recommended maximum total portfolio risk across all open positions is:", "options": [{"id": "a", "text": "1%"}, {"id": "b", "text": "3-5%"}, {"id": "c", "text": "15-20%"}, {"id": "d", "text": "50%"}], "correct_answer": "b", "explanation": "A portfolio risk limit of 3-5% across all open correlated positions prevents excessive directional concentration even when individual trades are within the 1% per-trade rule."},
    {"id": "q4", "type": "multiple_choice", "text": "The simplest way for beginners to manage correlation risk is:", "options": [{"id": "a", "text": "Hold positions in 5 different underlyings"}, {"id": "b", "text": "Trade only one position at a time"}, {"id": "c", "text": "Use complex hedging strategies"}, {"id": "d", "text": "Ignore correlation and trade normally"}], "correct_answer": "b", "explanation": "The simplest and most effective correlation management for beginners is to trade one position at a time. Close your first trade before entering the next, eliminating correlation risk entirely."},
    {"id": "q5", "type": "multiple_choice", "text": "True diversification for a scalper comes from:", "options": [{"id": "a", "text": "Holding 10 correlated positions simultaneously"}, {"id": "b", "text": "Trading multiple independent opportunities across time throughout the day"}, {"id": "c", "text": "Only trading on Fridays"}, {"id": "d", "text": "Using different brokers for each trade"}], "correct_answer": "b", "explanation": "Diversification for scalpers comes from taking many independent trade opportunities throughout the day, not from stacking multiple correlated bets at the same moment."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- C5 Lesson 5: The Scalper's Mindset: Discipline Over Emotion
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c5_id,
  E'The Scalper''s Mindset: Discipline Over Emotion',
  'the-scalpers-mindset-discipline-over-emotion',
  E'## Trading Is a Mental Game\n\nYou can learn every technical concept in this course — Greeks, market structure, entry signals, position sizing — and still lose money if you cannot control your psychology. The vast majority of trading losses come not from lack of knowledge but from emotional decision-making: fear, greed, revenge, overconfidence, and FOMO (fear of missing out). Developing the right mindset is not a "nice to have" — it is a requirement for long-term profitability.\n\n## The Five Emotional Enemies\n\n1. **Fear:** Fear of losing causes you to exit winners too early or avoid valid setups entirely. The antidote: accept that losses are a normal cost of doing business. With proper risk management (1% rule), no single loss matters.\n\n2. **Greed:** Greed causes you to hold winners too long, ignore your profit targets, or oversize positions. The antidote: stick to your pre-defined exit rules. The market will always provide more opportunities tomorrow.\n\n3. **Revenge:** After a loss, the urge to immediately "make it back" leads to impulsive, oversized trades. The antidote: daily loss limits and the three-strike rule.\n\n4. **Overconfidence:** A winning streak can make you feel invincible, leading to larger positions and sloppy entries. The antidote: never change your position sizing formula based on recent results.\n\n5. **FOMO:** Seeing a massive move that you missed creates the urge to chase. The antidote: there are hundreds of trading days per year. Missing one move is irrelevant in the long run.\n\n## Building Discipline\n\nDiscipline is not an innate trait — it is a skill built through practice and systems. The most effective disciplines for scalpers:\n\n- **Pre-market routine:** Review your key levels, check the economic calendar, and set your risk parameters before the market opens. Enter the day with a plan, not a hope.\n- **Trade checklist:** Before every entry, run through a checklist: Is the setup valid? Is the risk within my limits? Is my stop defined? If any answer is no, do not trade.\n- **Post-trade journal:** Record every trade with entry, exit, setup rationale, emotions felt, and lessons learned. Review weekly. Patterns in your journal reveal your psychological weaknesses.\n- **Physical state:** Sleep, exercise, and nutrition directly impact decision-making. Tired traders make bad decisions. Treat trading like an athletic performance.\n\n## The Process Over Outcome Mindset\n\nThe most powerful mental shift is to focus on **process, not outcome**. A losing trade executed perfectly according to your rules is a good trade. A winning trade that violated your rules is a bad trade — you just got lucky. Over time, good process produces good outcomes. Bad process, even with occasional wins, leads to ruin. Judge yourself by how well you followed your rules, not by your P&L on any individual trade.',
  'text'::lesson_type,
  25,
  5,
  ARRAY['The five emotional enemies of trading are fear, greed, revenge, overconfidence, and FOMO', 'Discipline is built through systems like pre-market routines, trade checklists, and journaling', 'Focus on process over outcome: a losing trade executed correctly is still a good trade', 'Physical health including sleep and exercise directly impacts trading performance and decision-making'],
  ARRAY['How do I stop revenge trading after a loss?', 'What should my pre-market routine look like?', 'How do I keep a trading journal effectively?'],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "The majority of trading losses come from:", "options": [{"id": "a", "text": "Lack of technical knowledge"}, {"id": "b", "text": "Emotional decision-making and lack of discipline"}, {"id": "c", "text": "Broker errors"}, {"id": "d", "text": "Market manipulation"}], "correct_answer": "b", "explanation": "Most trading losses stem from emotional decisions — fear, greed, revenge, overconfidence, and FOMO — rather than from lack of knowledge. Psychology is the biggest edge or biggest liability."},
    {"id": "q2", "type": "multiple_choice", "text": "After a string of winning trades, the psychological risk is:", "options": [{"id": "a", "text": "Becoming too cautious"}, {"id": "b", "text": "Overconfidence leading to larger positions and sloppy entries"}, {"id": "c", "text": "Quitting trading"}, {"id": "d", "text": "Having no psychological impact"}], "correct_answer": "b", "explanation": "Winning streaks can create overconfidence, leading traders to increase position sizes beyond their rules and take lower-quality setups. The antidote is to never change your sizing formula based on recent results."},
    {"id": "q3", "type": "multiple_choice", "text": "A losing trade that was executed perfectly according to your rules is:", "options": [{"id": "a", "text": "A bad trade because you lost money"}, {"id": "b", "text": "A good trade because you followed your process"}, {"id": "c", "text": "A sign to change your strategy"}, {"id": "d", "text": "An indication of a flawed system"}], "correct_answer": "b", "explanation": "Process over outcome: a losing trade executed according to your rules is a good trade. Over time, consistent good process produces positive outcomes. Individual trade results include random variance."},
    {"id": "q4", "type": "multiple_choice", "text": "Which of these is NOT part of a recommended pre-market routine?", "options": [{"id": "a", "text": "Review key support and resistance levels"}, {"id": "b", "text": "Check the economic calendar"}, {"id": "c", "text": "Set your risk parameters for the day"}, {"id": "d", "text": "Set a target to make a specific dollar amount no matter what"}], "correct_answer": "d", "explanation": "A pre-market routine should include reviewing levels, checking the calendar, and setting risk parameters. Setting a specific dollar target can lead to overtrading or forcing trades when no good setups exist."},
    {"id": "q5", "type": "multiple_choice", "text": "The antidote to FOMO (fear of missing out) is:", "options": [{"id": "a", "text": "Always chasing the move to avoid regret"}, {"id": "b", "text": "Recognizing that there are hundreds of trading days and missing one move is irrelevant"}, {"id": "c", "text": "Increasing position size to compensate for missed trades"}, {"id": "d", "text": "Trading every setup you see"}], "correct_answer": "b", "explanation": "FOMO is countered by perspective: there are hundreds of trading days per year with countless opportunities. Missing one move is statistically irrelevant to your long-term results."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Set learning_path_id on Path 1 courses
UPDATE courses SET learning_path_id = v_path1_id WHERE id IN (v_c1_id, v_c2_id, v_c3_id, v_c4_id, v_c5_id);

-- ============================================================
-- LEARNING PATH 2: Day Trading Options
-- ============================================================

INSERT INTO learning_paths (
  name, slug, description, tier_required, difficulty_level,
  estimated_hours, icon_name, is_published, display_order
)
VALUES (
  'Day Trading Options',
  'day-trading-options',
  'Take your trading to the next level with intraday options strategies. Master market analysis, options flow reading, and a complete day trading playbook.',
  'core',
  'intermediate'::difficulty_level,
  30,
  'trending-up',
  true,
  2
)
RETURNING id INTO v_path2_id;

-- ============================================================
-- COURSE 6: Intraday Market Analysis
-- ============================================================

INSERT INTO courses (
  title, slug, description, difficulty_level, estimated_hours,
  passing_score, tier_required, is_published, display_order
)
VALUES (
  'Intraday Market Analysis',
  'intraday-market-analysis',
  'Learn to read the market in real-time. Master VWAP, volume profiles, market internals, and the key indicators that drive intraday price action.',
  'intermediate'::difficulty_level,
  10,
  70,
  'core',
  true,
  6
)
RETURNING id INTO v_c6_id;

UPDATE courses SET learning_path_id = v_path2_id WHERE id = v_c6_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path2_id, v_c6_id, 1);

-- Lesson 1: VWAP as Your Intraday Anchor
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c6_id,
  'VWAP as Your Intraday Anchor',
  'vwap-intraday-anchor',
  'Volume Weighted Average Price (VWAP) is the single most important indicator for intraday traders. Unlike a simple moving average, VWAP weights each price level by the volume traded there, giving you a true average price that reflects where the majority of transactions occurred. The formula is straightforward: VWAP = Cumulative(Price x Volume) / Cumulative(Volume). Because it resets at the start of each trading session, VWAP provides a clean, unbiased benchmark that institutional traders use to evaluate execution quality.

VWAP acts as a dynamic support and resistance level throughout the trading day. When price is trading above VWAP, the bias is bullish — buyers are in control and willing to pay above the average. When price is below VWAP, sellers dominate. This simple framework gives day traders an objective way to determine directional bias without relying on lagging indicators. Many institutional algorithms are programmed to buy below VWAP and sell above it, which creates a natural mean-reversion effect around the line.

For options day traders, VWAP provides critical timing signals. A stock reclaiming VWAP after trading below it all morning is a high-probability long entry for call options. Conversely, a stock losing VWAP after holding above it signals a potential put opportunity. The key is to combine VWAP crosses with volume confirmation — a VWAP reclaim on heavy volume is far more significant than one on light volume. Pay attention to the slope of VWAP as well: a rising VWAP confirms an uptrend, while a flattening VWAP suggests the trend is losing momentum.

Standard deviation bands around VWAP (often plotted at +/- 1, 2, and 3 standard deviations) create a statistical framework for mean reversion trades. Price reaching the +2 standard deviation band means it has moved roughly two standard deviations above the volume-weighted mean — a statistically extreme move that often reverts. These bands are especially useful for selling premium or entering contrarian positions. However, in strong trending days, price can ride the upper or lower bands for extended periods, so always confirm with market context before fading a move.',
  'text'::lesson_type,
  30,
  1,
  true,
  ARRAY['VWAP equals Cumulative(Price x Volume) / Cumulative(Volume) and resets each session', 'Price above VWAP indicates bullish bias; below VWAP indicates bearish bias', 'VWAP reclaims and losses on high volume are the highest-probability trade signals', 'Standard deviation bands around VWAP provide statistical mean-reversion levels'],
  ARRAY['How do I set up VWAP bands on my charting platform?', 'When does VWAP fail as a reliable indicator?', 'How do institutions use VWAP for order execution?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What does VWAP stand for?", "options": [{"id": "a", "text": "Volume Weighted Average Price"}, {"id": "b", "text": "Volatility Weighted Average Position"}, {"id": "c", "text": "Volume Weighted Aggregate Pricing"}, {"id": "d", "text": "Variable Weighted Average Price"}], "correct_answer": "a", "explanation": "VWAP stands for Volume Weighted Average Price. It weights each price by the volume traded at that level."}, {"id": "q2", "type": "multiple_choice", "text": "How is VWAP calculated?", "options": [{"id": "a", "text": "Sum of closing prices divided by number of periods"}, {"id": "b", "text": "Cumulative (Price x Volume) divided by Cumulative Volume"}, {"id": "c", "text": "Highest price plus lowest price divided by two"}, {"id": "d", "text": "Exponential moving average of price and volume"}], "correct_answer": "b", "explanation": "VWAP is calculated as the cumulative sum of (Price x Volume) divided by the cumulative sum of Volume across the trading session."}, {"id": "q3", "type": "multiple_choice", "text": "When price is trading above VWAP, what does this indicate?", "options": [{"id": "a", "text": "Bearish bias — sellers are in control"}, {"id": "b", "text": "The market is in a range"}, {"id": "c", "text": "Bullish bias — buyers are in control"}, {"id": "d", "text": "The indicator is broken"}], "correct_answer": "c", "explanation": "Price above VWAP indicates bullish bias because buyers are willing to transact above the volume-weighted average, showing demand strength."}, {"id": "q4", "type": "multiple_choice", "text": "What does it mean when price reaches the +2 standard deviation VWAP band?", "options": [{"id": "a", "text": "A strong buy signal to add more calls"}, {"id": "b", "text": "Price has moved two standard deviations above the volume-weighted mean — a statistically extended move"}, {"id": "c", "text": "VWAP has reset and needs recalibration"}, {"id": "d", "text": "Volume has doubled from the session average"}], "correct_answer": "b", "explanation": "The +2 SD band indicates price is two standard deviations above the mean, which is statistically extended and often leads to mean reversion."}, {"id": "q5", "type": "multiple_choice", "text": "How often does VWAP reset?", "options": [{"id": "a", "text": "Every hour"}, {"id": "b", "text": "Every week"}, {"id": "c", "text": "At the start of each trading session"}, {"id": "d", "text": "It never resets"}], "correct_answer": "c", "explanation": "VWAP resets at the beginning of each trading session, providing a fresh and unbiased benchmark each day."}], "passing_score": 70}'::jsonb
);

-- Lesson 2: Volume Profile: Finding Value Areas
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c6_id,
  'Volume Profile: Finding Value Areas',
  'volume-profile-value-areas',
  'Volume Profile is a charting tool that plots the total volume traded at each price level over a specified period, displayed as a horizontal histogram on the price axis. Unlike traditional volume bars that show volume per time period, Volume Profile shows volume per price level, revealing where the most trading activity has occurred. This distinction is critical because it tells you which prices the market considers ''''fair value'''' and which prices were rejected quickly.

The three most important levels in a Volume Profile are the Point of Control (POC), the Value Area High (VAH), and the Value Area Low (VAL). The POC is the single price level with the highest traded volume — it represents the price where the most agreement between buyers and sellers occurred. The Value Area encompasses the price range where approximately 70% of total volume was traded (based on one standard deviation of a normal distribution). VAH is the upper boundary and VAL is the lower boundary of this range.

For day trading options, Volume Profile provides actionable levels for entries and exits. When price trades into a high-volume node (HVN) — an area of heavy prior trading — it tends to slow down and consolidate because there are many participants with positions at those levels. Conversely, low-volume nodes (LVN) act as price magnets that markets tend to move through quickly because few participants have positions to defend. Trading the edges of the value area is a core strategy: buying puts at VAH when price fails to break higher, or buying calls at VAL when price bounces.

The prior day''''s value area provides one of the most reliable frameworks for intraday trading. If price opens above the prior day''''s VAH, the market has accepted higher prices and the bias is bullish. If price opens below the prior day''''s VAL, it has accepted lower prices. An open inside the prior value area suggests a rotational, range-bound day. Combining these value area relationships with VWAP gives you a powerful dual-confirmation system for options entries.',
  'text'::lesson_type,
  30,
  2,
  true,
  ARRAY['Volume Profile plots volume at each price level, revealing fair value zones', 'POC is the highest-volume price; Value Area covers roughly 70% of traded volume', 'High-Volume Nodes slow price; Low-Volume Nodes allow rapid price movement', 'Prior day value area relationships help determine bullish, bearish, or rotational bias'],
  ARRAY['How do I use Volume Profile for setting options strike prices?', 'What is the difference between Volume Profile and market profile?', 'How do I identify a single-print in the profile?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What does Volume Profile display?", "options": [{"id": "a", "text": "Volume per time period as vertical bars"}, {"id": "b", "text": "Total volume traded at each price level as a horizontal histogram"}, {"id": "c", "text": "The ratio of buying to selling volume"}, {"id": "d", "text": "Open interest at each strike price"}], "correct_answer": "b", "explanation": "Volume Profile shows total volume at each price level as a horizontal histogram, revealing which prices attracted the most trading."}, {"id": "q2", "type": "multiple_choice", "text": "What is the Point of Control (POC)?", "options": [{"id": "a", "text": "The price where VWAP is plotted"}, {"id": "b", "text": "The opening price of the day"}, {"id": "c", "text": "The single price level with the highest traded volume"}, {"id": "d", "text": "The midpoint between high and low of the day"}], "correct_answer": "c", "explanation": "The POC is the price level where the most volume was traded, representing the area of greatest agreement between buyers and sellers."}, {"id": "q3", "type": "multiple_choice", "text": "Approximately what percentage of volume does the Value Area encompass?", "options": [{"id": "a", "text": "50%"}, {"id": "b", "text": "60%"}, {"id": "c", "text": "70%"}, {"id": "d", "text": "90%"}], "correct_answer": "c", "explanation": "The Value Area encompasses approximately 70% of total traded volume, based on one standard deviation of a normal distribution around the POC."}, {"id": "q4", "type": "multiple_choice", "text": "What happens when price moves into a Low-Volume Node (LVN)?", "options": [{"id": "a", "text": "Price tends to consolidate and stall"}, {"id": "b", "text": "Price tends to move through quickly"}, {"id": "c", "text": "Volume spikes dramatically"}, {"id": "d", "text": "The trend always reverses"}], "correct_answer": "b", "explanation": "Low-Volume Nodes act as areas with few positioned participants, so price tends to traverse them rapidly on its way to the next high-volume area."}, {"id": "q5", "type": "multiple_choice", "text": "If price opens above the prior day''''s Value Area High, what does this suggest?", "options": [{"id": "a", "text": "A rotational, range-bound day is expected"}, {"id": "b", "text": "The market has accepted lower prices"}, {"id": "c", "text": "The market has accepted higher prices and bias is bullish"}, {"id": "d", "text": "Volume Profile has failed and should be ignored"}], "correct_answer": "c", "explanation": "An open above the prior day''''s VAH indicates the market has accepted higher prices, establishing a bullish directional bias for the session."}], "passing_score": 70}'::jsonb
);

-- Lesson 3: Market Internals: TICK, ADD, VOLD
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c6_id,
  'Market Internals: TICK, ADD, VOLD',
  'market-internals-tick-add-vold',
  'Market internals are breadth indicators that measure the collective behavior of all stocks in an index, giving you an X-ray view of what is happening beneath the surface of price action. While a chart of SPY or QQQ shows you the index price, market internals reveal whether that price move is supported by broad participation or driven by just a handful of stocks. The three most important intraday breadth indicators are the NYSE TICK (symbol $TICK), Advance-Decline Line ($ADD), and Up Volume vs Down Volume ($VOLD).

The NYSE TICK measures the number of NYSE stocks on an uptick minus the number on a downtick at any given moment. Normal readings range between -500 and +500. Extreme readings above +800 or below -800 indicate strong directional pressure. Readings above +1000 or below -1000 are considered ''''extreme'''' and often mark short-term exhaustion points. For options day traders, a sustained series of high TICK readings (above +500) confirms bullish momentum and supports call positions. A sudden plunge in TICK from positive to deeply negative territory can signal an emerging selloff — a cue to grab puts.

The Advance-Decline Line ($ADD) tracks the cumulative running total of advancing stocks minus declining stocks. Unlike TICK which is a snapshot, ADD builds throughout the day and shows the trend of market breadth. A rising ADD line confirms broad market participation in a rally. A key divergence signal occurs when SPY makes a new intraday high but ADD is declining — this means fewer stocks are participating in the move, warning that the rally is narrowing and may reverse.

The Up/Down Volume indicator ($VOLD) measures total volume in advancing stocks minus volume in declining stocks. This is arguably the most powerful internal because it combines direction with conviction. A ratio of up volume to down volume exceeding 3:1 or 4:1 indicates a very strong breadth thrust that often leads to sustained moves. For intraday options traders, combining all three internals creates a powerful confirmation framework: when TICK, ADD, and VOLD all align in one direction, the probability of a successful directional options trade increases substantially.',
  'text'::lesson_type,
  25,
  3,
  true,
  ARRAY['NYSE TICK measures upticking minus downticking stocks; extremes above +1000 or below -1000 signal exhaustion', 'Advance-Decline Line (ADD) shows cumulative breadth trend; divergences from price warn of reversals', 'VOLD measures up volume minus down volume, combining direction with conviction', 'All three internals aligning in one direction provides the highest-confidence trade signals'],
  ARRAY['How do I add market internals to my trading platform?', 'What TICK readings should I watch for options scalps?', 'How do I spot a breadth divergence in real time?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What does the NYSE TICK indicator measure?", "options": [{"id": "a", "text": "Total volume of all NYSE stocks"}, {"id": "b", "text": "Number of NYSE stocks on an uptick minus those on a downtick"}, {"id": "c", "text": "The price of the most-traded NYSE stock"}, {"id": "d", "text": "The cumulative advance-decline line for the day"}], "correct_answer": "b", "explanation": "NYSE TICK measures the net number of stocks ticking up versus ticking down at any given moment, providing a real-time breadth snapshot."}, {"id": "q2", "type": "multiple_choice", "text": "What is considered an extreme NYSE TICK reading?", "options": [{"id": "a", "text": "Above +200 or below -200"}, {"id": "b", "text": "Above +500 or below -500"}, {"id": "c", "text": "Above +1000 or below -1000"}, {"id": "d", "text": "Above +5000 or below -5000"}], "correct_answer": "c", "explanation": "TICK readings above +1000 or below -1000 are considered extreme and often mark short-term exhaustion points in intraday price action."}, {"id": "q3", "type": "multiple_choice", "text": "What does it signal when SPY makes a new high but the ADD line is declining?", "options": [{"id": "a", "text": "Confirmation that the rally is strong"}, {"id": "b", "text": "A breadth divergence warning that fewer stocks are participating"}, {"id": "c", "text": "Volume is increasing on the move"}, {"id": "d", "text": "Market internals are irrelevant to the price move"}], "correct_answer": "b", "explanation": "When price makes new highs but the Advance-Decline Line declines, it reveals a narrowing rally with fewer stocks participating — a bearish divergence warning."}, {"id": "q4", "type": "multiple_choice", "text": "What does the $VOLD indicator measure?", "options": [{"id": "a", "text": "Implied volatility of SPX options"}, {"id": "b", "text": "Total volume in advancing stocks minus volume in declining stocks"}, {"id": "c", "text": "The daily volume compared to the 20-day average"}, {"id": "d", "text": "VIX futures term structure"}], "correct_answer": "b", "explanation": "VOLD measures up volume minus down volume across stocks, combining directional information with volume conviction."}, {"id": "q5", "type": "multiple_choice", "text": "When is the best time to initiate a directional options trade based on internals?", "options": [{"id": "a", "text": "When only TICK is at an extreme"}, {"id": "b", "text": "When ADD and VOLD diverge from each other"}, {"id": "c", "text": "When TICK, ADD, and VOLD all align in one direction"}, {"id": "d", "text": "When all internals are near zero"}], "correct_answer": "c", "explanation": "The highest-probability directional trades occur when all three internals — TICK, ADD, and VOLD — align in the same direction, confirming broad market participation."}], "passing_score": 70}'::jsonb
);

-- Lesson 4: Pre-Market Analysis: Building Your Game Plan
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c6_id,
  'Pre-Market Analysis: Building Your Game Plan',
  'pre-market-analysis-game-plan',
  'Successful day trading begins long before the opening bell. A structured pre-market routine transforms you from a reactive trader into a prepared one. The pre-market session (4:00 AM to 9:30 AM ET) provides critical information about overnight developments, gap direction, and the likely character of the upcoming session. Building a systematic game plan each morning eliminates emotional decision-making and ensures you are trading with an edge rather than guessing.

Start your pre-market analysis by checking overnight price action in index futures (ES, NQ, RTY). A gap up of more than 0.5% in ES futures often leads to continuation if supported by a catalyst such as strong earnings, economic data, or a geopolitical development. However, gaps without a clear catalyst (''''air gaps'''') are more likely to fill. Next, review the economic calendar for scheduled events: FOMC announcements, CPI/PPI releases, jobs reports, and Fed speaker schedules dramatically affect intraday volatility and should shape your position sizing and strategy selection.

Identify your key levels before the open: the prior day''''s high, low, and close; VWAP from the prior session; overnight high and low from futures; and any significant support/resistance from the daily chart. Plot the expected move for SPY using at-the-money straddle pricing — this tells you the range the market is pricing in for the day. If SPY''''s ATM straddle implies a $3 move and SPY is at $450, the expected range is roughly $447-$453. Trades beyond this range offer favorable risk/reward for mean reversion; trades within it favor trend-following.

Finally, build your watchlist of 3-5 stocks with the highest potential for intraday options trades. Focus on stocks with high relative volume in the pre-market (at least 2x the 20-day average), clear pre-market levels, and liquid options chains (tight bid-ask spreads, high open interest). Write down your plan for each ticker: the setup you are looking for, entry criteria, target, stop, and position size. This written plan is your accountability partner — it prevents you from chasing trades that do not meet your criteria.',
  'text'::lesson_type,
  25,
  4,
  true,
  ARRAY['Check overnight futures, gaps, and catalysts before the open to establish directional bias', 'Review the economic calendar — scheduled events like FOMC and CPI directly impact intraday volatility', 'Map key levels: prior day high/low/close, overnight range, and expected move from ATM straddle pricing', 'Build a focused 3-5 stock watchlist with written entry and exit plans for each'],
  ARRAY['What does my pre-market checklist look like step by step?', 'How do I calculate the expected move from straddle pricing?', 'Which economic events cause the most intraday volatility?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What time does the US equity pre-market session begin?", "options": [{"id": "a", "text": "6:00 AM ET"}, {"id": "b", "text": "4:00 AM ET"}, {"id": "c", "text": "8:00 AM ET"}, {"id": "d", "text": "7:00 AM ET"}], "correct_answer": "b", "explanation": "The US pre-market session opens at 4:00 AM ET, giving traders several hours to analyze overnight developments before the 9:30 AM open."}, {"id": "q2", "type": "multiple_choice", "text": "What is an ''''air gap'''' in pre-market analysis?", "options": [{"id": "a", "text": "A gap caused by a major earnings report"}, {"id": "b", "text": "A gap up or down without a clear fundamental catalyst"}, {"id": "c", "text": "A gap that occurs during regular trading hours"}, {"id": "d", "text": "A gap measured in options implied volatility"}], "correct_answer": "b", "explanation": "An air gap is a gap without a clear catalyst. These gaps are more likely to fill because there is no fundamental reason sustaining the price displacement."}, {"id": "q3", "type": "multiple_choice", "text": "How can you estimate the market''''s expected daily range?", "options": [{"id": "a", "text": "Multiply the VIX by the stock price"}, {"id": "b", "text": "Use the prior day''''s range as a fixed estimate"}, {"id": "c", "text": "Price the at-the-money straddle to derive the expected move"}, {"id": "d", "text": "Divide the 52-week range by 252 trading days"}], "correct_answer": "c", "explanation": "The ATM straddle price reflects the options market''''s implied expected move for the day. This gives you a probabilistic range for the session."}, {"id": "q4", "type": "multiple_choice", "text": "What pre-market volume level suggests a stock is worth watching for day trades?", "options": [{"id": "a", "text": "Any volume above zero"}, {"id": "b", "text": "At least 2x the 20-day average volume"}, {"id": "c", "text": "Volume lower than the prior day"}, {"id": "d", "text": "Exactly equal to the 50-day average"}], "correct_answer": "b", "explanation": "Stocks with pre-market volume at least 2x their 20-day average indicate elevated interest and are more likely to offer strong intraday moves with liquid options."}, {"id": "q5", "type": "multiple_choice", "text": "Why should you write down your trade plan before the market opens?", "options": [{"id": "a", "text": "It is required by SEC regulations"}, {"id": "b", "text": "It helps you memorize stock ticker symbols"}, {"id": "c", "text": "It prevents emotional decision-making and ensures you trade with predefined criteria"}, {"id": "d", "text": "It guarantees profitable trades"}], "correct_answer": "c", "explanation": "A written trade plan acts as an accountability partner, preventing you from chasing trades or making emotional decisions that deviate from your edge."}], "passing_score": 70}'::jsonb
);

-- Lesson 5: Intraday Trends vs Range-Bound Markets
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c6_id,
  'Intraday Trends vs Range-Bound Markets',
  'intraday-trends-vs-range-bound',
  'One of the most critical skills for a day trader is identifying whether the current session is trending or range-bound, because the optimal strategy differs dramatically. Approximately 70-80% of trading days are rotational or range-bound, while only 20-30% produce strong directional trends. Applying a trending strategy in a range (or vice versa) is the fastest way to lose money. Learning to diagnose the day type early — ideally within the first 30-60 minutes — allows you to select the right tools and trade setups.

Trending days are characterized by several key features: price moves away from VWAP and stays on one side for the majority of the session, VWAP itself slopes in the trend direction, market internals (TICK, ADD, VOLD) persistently favor one side, and pullbacks are shallow (typically to the 9 or 20 EMA on a 5-minute chart) before the trend resumes. On trending days, the best strategy is to trade with the trend using momentum entries: buy calls on pullbacks in an uptrend, or buy puts on bounces in a downtrend. Avoid trying to pick tops or bottoms on trending days — the odds heavily favor continuation.

Range-bound days look very different: price oscillates above and below VWAP, the TICK oscillates between roughly -500 and +500 without sustained extremes, and the ADD line moves sideways. Volume Profile on a range day typically forms a wide, single-distribution bell curve centered around the POC. The optimal strategy on range days is mean reversion: sell calls or buy puts at the top of the range near VWAP upper bands or VAH, and buy calls or sell puts at the bottom near VWAP lower bands or VAL.

The transition between range and trend is where the biggest opportunities exist. A range-bound market that suddenly breaks out of its value area on high volume and strong internals is signaling a potential trend day. This ''''range expansion'''' typically occurs after a period of low volatility compression (narrow Bollinger Bands, tight value area). For options traders, these transitions are the best time to buy directional options because implied volatility is often low from the quiet range period, making options cheap right before a big move. Recognizing this shift in real time is a skill that separates profitable day traders from the rest.',
  'text'::lesson_type,
  30,
  5,
  true,
  ARRAY['About 70-80% of days are range-bound; only 20-30% are trending — choose your strategy accordingly', 'Trending days show persistent VWAP slope, one-sided internals, and shallow pullbacks', 'Range days feature VWAP oscillation, flat ADD, and a bell-curve Volume Profile', 'Range-to-trend transitions offer the best options buying opportunities due to low IV before expansion'],
  ARRAY['How quickly can I tell if it is a trending or range day?', 'What options strategies work best on range days?', 'How do I trade the transition from range to trend?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "Approximately what percentage of trading days are range-bound?", "options": [{"id": "a", "text": "10-20%"}, {"id": "b", "text": "30-40%"}, {"id": "c", "text": "50-60%"}, {"id": "d", "text": "70-80%"}], "correct_answer": "d", "explanation": "Studies show approximately 70-80% of trading days are rotational or range-bound, making range strategies applicable the majority of the time."}, {"id": "q2", "type": "multiple_choice", "text": "On a trending day, what is the best approach for options trades?", "options": [{"id": "a", "text": "Buy options against the trend at extremes"}, {"id": "b", "text": "Trade with the trend — buy calls on pullbacks in uptrends, puts on bounces in downtrends"}, {"id": "c", "text": "Avoid trading entirely"}, {"id": "d", "text": "Sell straddles to collect premium"}], "correct_answer": "b", "explanation": "Trending days favor continuation. The best approach is trading with the trend, entering on pullbacks rather than trying to pick reversals."}, {"id": "q3", "type": "multiple_choice", "text": "What characterizes a range-bound day in the NYSE TICK?", "options": [{"id": "a", "text": "Persistent readings above +1000"}, {"id": "b", "text": "Persistent readings below -1000"}, {"id": "c", "text": "Oscillation between roughly -500 and +500 without sustained extremes"}, {"id": "d", "text": "Zero readings throughout the day"}], "correct_answer": "c", "explanation": "Range-bound days show TICK oscillating in a moderate band without the sustained directional extremes that characterize trending days."}, {"id": "q4", "type": "multiple_choice", "text": "What is the best strategy on a range-bound day?", "options": [{"id": "a", "text": "Momentum chasing with leveraged options"}, {"id": "b", "text": "Mean reversion — selling at the top of the range and buying at the bottom"}, {"id": "c", "text": "Buying breakouts immediately when price touches range edges"}, {"id": "d", "text": "Holding positions overnight for a gap"}], "correct_answer": "b", "explanation": "Range days are best traded with mean-reversion strategies, fading moves at range extremes (VAH/VAL or VWAP bands) rather than chasing momentum."}, {"id": "q5", "type": "multiple_choice", "text": "Why are range-to-trend transitions particularly good for buying options?", "options": [{"id": "a", "text": "Options prices are always lowest at 10 AM"}, {"id": "b", "text": "Implied volatility is often low from the quiet range period, making options cheap before expansion"}, {"id": "c", "text": "Market makers lower prices during transitions"}, {"id": "d", "text": "Open interest always increases during transitions"}], "correct_answer": "b", "explanation": "During range periods, implied volatility compresses. When the range breaks and a trend emerges, the resulting move in the underlying benefits from both directional gains and potential IV expansion."}], "passing_score": 70}'::jsonb
);

-- ============================================================
-- COURSE 7: Options Flow & Volume Analysis
-- ============================================================

INSERT INTO courses (
  title, slug, description, difficulty_level, estimated_hours,
  passing_score, tier_required, is_published, display_order
)
VALUES (
  'Options Flow & Volume Analysis',
  'options-flow-volume-analysis',
  'Decode institutional activity through options flow. Learn to spot unusual activity, read order flow, and follow the smart money.',
  'intermediate'::difficulty_level,
  10,
  70,
  'core',
  true,
  7
)
RETURNING id INTO v_c7_id;

UPDATE courses SET learning_path_id = v_path2_id WHERE id = v_c7_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path2_id, v_c7_id, 2);

-- Lesson 1: Reading Options Volume & Open Interest
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c7_id,
  'Reading Options Volume & Open Interest',
  'reading-options-volume-open-interest',
  'Options volume and open interest are two fundamental metrics that every options trader must understand thoroughly. Volume represents the total number of contracts traded during the current session, while open interest (OI) represents the total number of outstanding contracts that have not been closed or exercised. Volume tells you about today''''s activity; open interest tells you about the accumulated positioning over time. Together, they reveal the liquidity, sentiment, and commitment of market participants at each strike price.

The relationship between volume and open interest provides critical context. When volume exceeds open interest at a particular strike, it signals that new positions are being established — this is fresh money entering the market and indicates strong conviction. Conversely, when volume is high but open interest decreases the next day, it means existing positions were closed rather than new ones opened. Watching the day-over-day change in open interest is essential: a rising OI with rising price confirms bullish conviction, while rising OI with falling price confirms bearish conviction.

For day trading, focus on strikes with the highest open interest because they act as magnets for price. Market makers who have sold options at high-OI strikes will hedge their positions by buying or selling the underlying stock, creating a gravitational pull toward those strikes — this is the foundation of ''''max pain'''' theory. The strike with the highest total open interest (calls plus puts) often represents the price at which the most options expire worthless, benefiting sellers. On expiration days, this magnetic effect is amplified dramatically.

Pay attention to the volume distribution across the options chain. Heavy call volume at out-of-the-money strikes suggests traders are positioning for upside. Heavy put volume at OTM strikes indicates hedging or bearish bets. The put/call volume ratio at individual stock level gives you a quick read on sentiment. A stock with 3x more call volume than put volume is experiencing strong bullish flow. Combine this data with price action and technicals for the highest-conviction trade setups.',
  'text'::lesson_type,
  25,
  1,
  true,
  ARRAY['Volume = contracts traded today; Open Interest = total outstanding contracts not yet closed', 'Volume exceeding OI at a strike signals new positions and strong conviction', 'High-OI strikes act as price magnets due to market maker hedging (max pain effect)', 'Put/call volume ratio reveals directional sentiment at individual stock level'],
  ARRAY['How do I find options with unusually high volume?', 'What is the max pain theory and does it really work?', 'How does open interest change affect my trade thesis?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What is the difference between options volume and open interest?", "options": [{"id": "a", "text": "There is no difference — they measure the same thing"}, {"id": "b", "text": "Volume is contracts traded today; open interest is total outstanding contracts"}, {"id": "c", "text": "Volume measures puts only; open interest measures calls only"}, {"id": "d", "text": "Volume is calculated weekly; open interest is calculated monthly"}], "correct_answer": "b", "explanation": "Volume counts contracts traded in the current session, while open interest tracks the total number of contracts that remain open and have not been closed or exercised."}, {"id": "q2", "type": "multiple_choice", "text": "What does it signal when volume at a strike exceeds open interest?", "options": [{"id": "a", "text": "The options chain is illiquid"}, {"id": "b", "text": "Positions are being closed at that strike"}, {"id": "c", "text": "New positions are being established, indicating fresh conviction"}, {"id": "d", "text": "The strike price is about to change"}], "correct_answer": "c", "explanation": "Volume exceeding open interest means more contracts traded today than existed before, confirming that new positions are being opened — a sign of strong directional conviction."}, {"id": "q3", "type": "multiple_choice", "text": "Why do high open interest strikes act as price magnets?", "options": [{"id": "a", "text": "Retail traders always buy at those strikes"}, {"id": "b", "text": "Market makers hedge their options exposure by trading the underlying, pulling price toward high-OI strikes"}, {"id": "c", "text": "The SEC mandates price convergence at high-OI strikes"}, {"id": "d", "text": "High OI always means the option is mispriced"}], "correct_answer": "b", "explanation": "Market makers who sold options at high-OI strikes must delta-hedge by buying or selling shares, which creates buying/selling pressure that pulls the stock price toward those strikes."}, {"id": "q4", "type": "multiple_choice", "text": "If a stock has 3x more call volume than put volume, what does this suggest?", "options": [{"id": "a", "text": "Bearish sentiment"}, {"id": "b", "text": "Neutral sentiment"}, {"id": "c", "text": "Strong bullish flow and sentiment"}, {"id": "d", "text": "The options chain is broken"}], "correct_answer": "c", "explanation": "A put/call volume ratio heavily skewed toward calls indicates traders are positioning for upside, reflecting strong bullish sentiment."}, {"id": "q5", "type": "multiple_choice", "text": "What does rising open interest combined with rising price indicate?", "options": [{"id": "a", "text": "Bearish divergence"}, {"id": "b", "text": "Bullish conviction — new money is entering on the long side"}, {"id": "c", "text": "Short covering only"}, {"id": "d", "text": "Decreasing liquidity"}], "correct_answer": "b", "explanation": "Rising OI with rising price means new long positions are being opened as price moves higher, confirming bullish conviction with fresh capital commitment."}], "passing_score": 70}'::jsonb
);

-- Lesson 2: Unusual Options Activity: Spotting Smart Money
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c7_id,
  'Unusual Options Activity: Spotting Smart Money',
  'unusual-options-activity-smart-money',
  'Unusual Options Activity (UOA) occurs when the volume traded on a specific options contract significantly exceeds its average daily volume or its current open interest. The typical threshold is volume exceeding open interest by at least 2x, or daily volume exceeding the 30-day average by 5x or more. UOA is one of the most powerful signals available to retail traders because it often represents institutional or ''''smart money'''' positioning ahead of a catalyst — earnings, an FDA decision, a merger, or insider knowledge of a material event.

Not all unusual activity is created equal. To filter signal from noise, evaluate the characteristics of the trade. Large block orders (100+ contracts executed at once) at the ask price indicate aggressive buying — someone is willing to pay the offer to get filled quickly, suggesting urgency and conviction. Conversely, trades at the bid price suggest selling. Sweeps — large orders broken into smaller pieces and routed to multiple exchanges simultaneously for fast execution — are even more significant because they indicate a trader who wants to accumulate a large position quickly without waiting for a single exchange to fill them.

The strike price and expiration of UOA provide crucial context. Smart money buying near-term, out-of-the-money calls with heavy size suggests they expect a significant move soon. Deep in-the-money calls may indicate a leveraged stock replacement strategy. Far-dated (LEAPS) purchases suggest longer-term conviction. Pay attention to the premium spent — a single order worth $1 million+ in premium represents serious capital commitment. Always check whether the unusual activity is opening or closing a position by comparing volume to the open interest change the following day.

To use UOA in your day trading, build a watchlist of stocks showing unusual activity in the pre-market or early session. Do not blindly follow the flow — use it as a starting point, then confirm with technical analysis and your own thesis. A stock showing bullish UOA that is also breaking out of a technical pattern with strong market internals is a much higher probability trade than UOA alone. Remember that some unusual activity is hedging (a large call buy might be hedging a short stock position), so always consider the context before trading.',
  'text'::lesson_type,
  30,
  2,
  true,
  ARRAY['UOA occurs when volume exceeds OI by 2x+ or average daily volume by 5x+', 'Block orders at the ask price and sweep orders signal aggressive, conviction-driven buying', 'Strike, expiration, and premium size reveal the trader''''s thesis and time horizon', 'Always confirm UOA with technical analysis — do not blindly follow flow'],
  ARRAY['Where can I find unusual options activity scanners?', 'How do I tell if unusual activity is a hedge vs a directional bet?', 'What are the best UOA setups for day trading?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What defines Unusual Options Activity?", "options": [{"id": "a", "text": "Any options trade over $10,000"}, {"id": "b", "text": "Volume significantly exceeding open interest or average daily volume"}, {"id": "c", "text": "Options trading at exactly the mid price"}, {"id": "d", "text": "Activity only in SPY and QQQ options"}], "correct_answer": "b", "explanation": "UOA is defined by volume that significantly exceeds open interest (typically 2x+) or the average daily volume (typically 5x+), signaling out-of-ordinary positioning."}, {"id": "q2", "type": "multiple_choice", "text": "What is a sweep order in options?", "options": [{"id": "a", "text": "An order that cancels all existing orders"}, {"id": "b", "text": "A large order broken into pieces and routed to multiple exchanges simultaneously for fast execution"}, {"id": "c", "text": "An order placed only at market close"}, {"id": "d", "text": "An order that automatically exercises the option"}], "correct_answer": "b", "explanation": "Sweep orders split a large order across multiple exchanges to get filled as quickly as possible, indicating urgency and conviction in the trade."}, {"id": "q3", "type": "multiple_choice", "text": "A large block order executed at the ask price suggests:", "options": [{"id": "a", "text": "The trader is selling the option"}, {"id": "b", "text": "The option is illiquid"}, {"id": "c", "text": "Aggressive buying — the trader is willing to pay up to get filled quickly"}, {"id": "d", "text": "The market maker is closing a position"}], "correct_answer": "c", "explanation": "Buying at the ask (the higher price) shows urgency and willingness to pay the full offer price, indicating aggressive bullish conviction."}, {"id": "q4", "type": "multiple_choice", "text": "How can you determine if unusual activity is opening new positions?", "options": [{"id": "a", "text": "Check if the stock price went up"}, {"id": "b", "text": "Compare today''''s volume to the change in open interest the following day"}, {"id": "c", "text": "Look at the stock''''s earnings date"}, {"id": "d", "text": "Check the VIX level"}], "correct_answer": "b", "explanation": "If open interest increases the next day by an amount close to the unusual volume, it confirms new positions were opened rather than existing ones being closed."}, {"id": "q5", "type": "multiple_choice", "text": "Why should you NOT blindly follow unusual options activity?", "options": [{"id": "a", "text": "UOA data is always delayed by 24 hours"}, {"id": "b", "text": "Some UOA may be hedging activity, and flow alone without technical confirmation has lower reliability"}, {"id": "c", "text": "Unusual activity is illegal to trade on"}, {"id": "d", "text": "UOA only works for stocks above $100"}], "correct_answer": "b", "explanation": "Some unusual activity represents hedging rather than directional bets. Combining UOA with technical analysis and market context provides much higher-probability setups."}], "passing_score": 70}'::jsonb
);

-- Lesson 3: Dark Pool Prints & Block Trades
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c7_id,
  'Dark Pool Prints & Block Trades',
  'dark-pool-prints-block-trades',
  'Dark pools are private exchanges where institutional investors execute large block trades away from public markets. These Alternative Trading Systems (ATS) account for roughly 35-40% of all US equity volume. While the trades are not visible before execution, they are reported to the consolidated tape after the fact, usually within 10 seconds. By monitoring these prints in real time, day traders can detect institutional buying and selling that would otherwise be invisible on a standard Level 2 screen.

Dark pool prints are significant because they represent large, institutional-sized orders. A single dark pool print of 500,000 shares of a stock that normally trades 2 million shares per day is a massive signal. The key metric to watch is the price at which the print occurs relative to the National Best Bid and Offer (NBBO). Prints executed at or above the ask price are considered bullish because the institutional buyer was willing to pay the full offer. Prints at or below the bid are bearish — the seller accepted the lower price to get the trade done. Prints at the midpoint are neutral and may represent negotiated crosses.

Block trades on public exchanges also provide institutional breadcrumbs. A block trade is typically defined as 10,000 shares or more (or $200,000+ in value) executed as a single transaction. When you see a series of block prints at progressively higher prices, it signals institutional accumulation. Conversely, blocks hitting at progressively lower prices indicate distribution. Tools that aggregate dark pool and block data show you the net dollar flow: the total value of bullish prints minus bearish prints over a given period.

For options day traders, dark pool and block data serves as a leading indicator. A stock absorbing large dark pool buying while options flow shows heavy call accumulation is a high-conviction bullish setup. Watch for ''''dark pool levels'''' — price zones where the largest prints occurred — as these often act as support or resistance. If a stock sold off but a huge dark pool buy print appeared at $150, that level may hold as support because the institution is defending their entry. Combining dark pool data with options flow and technical analysis creates one of the most powerful edge-stacking frameworks available to retail traders.',
  'text'::lesson_type,
  25,
  3,
  true,
  ARRAY['Dark pools handle 35-40% of US equity volume; prints are reported post-execution within seconds', 'Prints at/above the ask are bullish; prints at/below the bid are bearish', 'Block trades of 10,000+ shares reveal institutional accumulation or distribution patterns', 'Dark pool levels (price zones of large prints) often act as support or resistance'],
  ARRAY['What tools can I use to see dark pool prints in real time?', 'How do I differentiate meaningful dark pool prints from noise?', 'Do dark pool levels work as support and resistance on all stocks?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What percentage of US equity volume do dark pools approximately handle?", "options": [{"id": "a", "text": "5-10%"}, {"id": "b", "text": "15-20%"}, {"id": "c", "text": "35-40%"}, {"id": "d", "text": "75-80%"}], "correct_answer": "c", "explanation": "Dark pools (Alternative Trading Systems) account for roughly 35-40% of all US equity volume, making them a significant portion of market activity."}, {"id": "q2", "type": "multiple_choice", "text": "A dark pool print executed at or above the ask price suggests:", "options": [{"id": "a", "text": "The seller got a favorable price"}, {"id": "b", "text": "The institutional buyer was willing to pay the full offer — a bullish signal"}, {"id": "c", "text": "The trade was a negotiated cross"}, {"id": "d", "text": "The print is an error"}], "correct_answer": "b", "explanation": "When a large dark pool print occurs at or above the ask, the buyer paid full price or more, indicating urgency and bullish intent."}, {"id": "q3", "type": "multiple_choice", "text": "What typically defines a block trade?", "options": [{"id": "a", "text": "Any trade over 100 shares"}, {"id": "b", "text": "10,000+ shares or $200,000+ in value as a single transaction"}, {"id": "c", "text": "Only trades that occur after hours"}, {"id": "d", "text": "Trades executed exclusively by market makers"}], "correct_answer": "b", "explanation": "Block trades are generally defined as 10,000 shares or more (or $200,000+ in value) executed as a single transaction, indicating institutional activity."}, {"id": "q4", "type": "multiple_choice", "text": "What does a series of block prints at progressively higher prices indicate?", "options": [{"id": "a", "text": "Institutional distribution (selling)"}, {"id": "b", "text": "Retail panic buying"}, {"id": "c", "text": "Institutional accumulation (buying)"}, {"id": "d", "text": "Market maker inventory rebalancing"}], "correct_answer": "c", "explanation": "Blocks hitting at progressively higher prices show an institution willing to buy at increasingly higher levels, confirming systematic accumulation."}, {"id": "q5", "type": "multiple_choice", "text": "How should dark pool data be used in options day trading?", "options": [{"id": "a", "text": "As the sole indicator for trade entries"}, {"id": "b", "text": "Only for overnight swing trades"}, {"id": "c", "text": "Combined with options flow and technical analysis for high-conviction setups"}, {"id": "d", "text": "Dark pool data is irrelevant to options trading"}], "correct_answer": "c", "explanation": "Dark pool data is most powerful when combined with options flow and technical analysis, creating a multi-factor confirmation framework for high-probability trades."}], "passing_score": 70}'::jsonb
);

-- Lesson 4: Put/Call Ratios: Sentiment Gauges
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c7_id,
  'Put/Call Ratios: Sentiment Gauges',
  'put-call-ratios-sentiment-gauges',
  'The put/call ratio is one of the oldest and most reliable sentiment indicators in options trading. It is calculated by dividing the total number of put options traded (or open interest) by the total number of call options traded. A ratio above 1.0 means more puts than calls are being traded, indicating bearish sentiment or hedging demand. A ratio below 1.0 means more calls are traded, indicating bullish sentiment. The CBOE publishes daily put/call ratios for equities, indices, and the total market.

The equity put/call ratio (individual stocks only) normally ranges from 0.50 to 0.80. The index put/call ratio (SPX, VIX options) tends to run higher because institutions routinely buy index puts as portfolio hedges. As a contrarian indicator, extreme readings signal potential reversals: an equity put/call ratio above 1.0-1.2 suggests excessive fear and often precedes market bounces, while readings below 0.40-0.50 indicate excessive complacency and often precede pullbacks. This contrarian interpretation works because extreme fear means most selling has already occurred, and extreme greed means most buying has already occurred.

For intraday use, the real-time put/call ratio can be tracked via your broker or data provider. Intraday spikes in put volume relative to calls often coincide with local lows, especially when combined with extreme negative TICK readings and price at support. Conversely, extreme intraday call-heavy readings at resistance can mark short-term tops. However, context is essential: a high put/call ratio during a strong downtrend may not be contrarian — it may confirm the trend. Use the put/call ratio as a supplementary tool, not a standalone signal.

Beyond the aggregate ratio, individual stock put/call ratios provide targeted sentiment reads. If AAPL normally has an equity put/call ratio of 0.60 and today it spikes to 1.5, something unusual is happening — either heavy hedging or directional bearish bets. Cross-reference this with the stock''''s technical setup: if the stock is at major support with extreme put buying, it could be a contrarian buy signal. If it is breaking down through support with heavy put buying, it confirms the bearish move. Always ask: is the put buying new hedging, or new directional bets?',
  'text'::lesson_type,
  25,
  4,
  true,
  ARRAY['Put/call ratio above 1.0 = more puts traded (bearish sentiment); below 1.0 = more calls (bullish sentiment)', 'Equity P/C ratio normally ranges 0.50-0.80; extreme readings above 1.0 or below 0.40 are contrarian signals', 'High put/call at support often marks bottoms; low put/call at resistance often marks tops', 'Individual stock P/C ratio spikes vs their normal range flag unusual sentiment shifts'],
  ARRAY['Where can I find real-time put/call ratio data?', 'Is the put/call ratio more useful as a contrarian or confirming indicator?', 'How do I calculate the put/call ratio for a single stock?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "How is the put/call ratio calculated?", "options": [{"id": "a", "text": "Call volume divided by put volume"}, {"id": "b", "text": "Put volume divided by call volume"}, {"id": "c", "text": "(Put volume + call volume) divided by open interest"}, {"id": "d", "text": "Put open interest minus call open interest"}], "correct_answer": "b", "explanation": "The put/call ratio is calculated by dividing total put volume by total call volume. A ratio above 1.0 means more puts were traded than calls."}, {"id": "q2", "type": "multiple_choice", "text": "What does a put/call ratio above 1.0 indicate?", "options": [{"id": "a", "text": "More calls are being traded than puts"}, {"id": "b", "text": "Equal call and put trading"}, {"id": "c", "text": "More puts are being traded than calls, indicating bearish sentiment or hedging"}, {"id": "d", "text": "Options markets are closed"}], "correct_answer": "c", "explanation": "A ratio above 1.0 means put volume exceeds call volume, reflecting bearish sentiment, increased hedging demand, or both."}, {"id": "q3", "type": "multiple_choice", "text": "What is the typical range of the equity put/call ratio?", "options": [{"id": "a", "text": "0.01 to 0.10"}, {"id": "b", "text": "0.50 to 0.80"}, {"id": "c", "text": "2.0 to 3.0"}, {"id": "d", "text": "5.0 to 10.0"}], "correct_answer": "b", "explanation": "The equity put/call ratio normally fluctuates between 0.50 and 0.80, with readings outside this range considered unusual."}, {"id": "q4", "type": "multiple_choice", "text": "As a contrarian indicator, what does an equity put/call ratio above 1.2 suggest?", "options": [{"id": "a", "text": "Excessive bullishness — expect a pullback"}, {"id": "b", "text": "Normal market conditions"}, {"id": "c", "text": "Excessive fear — most selling may be done, potential bounce ahead"}, {"id": "d", "text": "The data is unreliable at these levels"}], "correct_answer": "c", "explanation": "Extremely high put/call readings indicate excessive fear and heavy hedging. Contrarian logic suggests most selling has occurred, and the market may be near a bottom."}, {"id": "q5", "type": "multiple_choice", "text": "Why does the index put/call ratio tend to be higher than the equity put/call ratio?", "options": [{"id": "a", "text": "Index options are cheaper"}, {"id": "b", "text": "Institutions routinely buy index puts as portfolio hedges, inflating the ratio"}, {"id": "c", "text": "Retail traders only trade index puts"}, {"id": "d", "text": "Index options have more strikes available"}], "correct_answer": "b", "explanation": "Institutional investors systematically buy index puts (SPX, SPY) as portfolio insurance, which structurally elevates the index put/call ratio above the equity ratio."}], "passing_score": 70}'::jsonb
);

-- Lesson 5: Building a Flow-Based Trading Strategy
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c7_id,
  'Building a Flow-Based Trading Strategy',
  'building-flow-based-trading-strategy',
  'A flow-based trading strategy synthesizes everything you have learned about options volume, unusual activity, dark pool prints, and put/call ratios into a repeatable, systematic edge. The core premise is simple: institutional and smart money flow tends to be predictive because these participants have superior resources, information, and analytical capabilities. By tracking their footprints in the options and dark pool data, retail traders can position alongside the best-resourced participants in the market.

The foundation of your flow strategy is a tiered alert system. Tier 1 alerts are the highest conviction: large sweep orders (500+ contracts) in near-term options at the ask, with volume exceeding 5x average daily volume AND 2x open interest, accompanied by dark pool prints at or above the ask. Tier 2 alerts include block orders (100-499 contracts) at the ask, or sweep orders in longer-dated expirations. Tier 3 alerts are smaller unusual volume or put/call ratio anomalies. Focus your capital on Tier 1 signals and use Tiers 2-3 for watchlist building.

Once you identify a flow signal, apply a technical filter before entering. The ideal setup combines bullish flow with a stock at or near a support level, showing a constructive chart pattern (flag, base breakout, VWAP reclaim). The entry should use the flow''''s strike and expiration as a guide: if smart money is buying the $150 calls expiring in two weeks, you might buy the same strike or one strike closer to the money. Position size based on the premium cost — risk no more than 1-2% of your trading capital per flow trade. Use a stop loss if the underlying breaks below the technical level that supported your entry.

Track every flow-based trade in a journal with columns for: date, ticker, flow signal type (sweep/block/dark pool), flow details (strike, expiration, size, price), your entry and exit, profit/loss, and notes on what worked or did not. After 50+ trades, analyze your journal to identify which flow types, sectors, and market conditions produce the best results. This data-driven approach transforms flow trading from an art into a science. Most successful flow traders find that their edge concentrates in specific patterns — perhaps Tier 1 call sweeps in tech stocks during uptrends — and they allocate more capital to those setups while reducing exposure to lower-edge signals.',
  'text'::lesson_type,
  30,
  5,
  true,
  ARRAY['Build a tiered alert system: Tier 1 (large sweeps + dark pool) gets the most capital allocation', 'Always combine flow signals with technical analysis — flow alone is not sufficient for entry', 'Size positions at 1-2% of capital per trade and use the flow''''s strike/expiration as a guide', 'Journal every trade and analyze after 50+ trades to identify your highest-edge flow patterns'],
  ARRAY['Can you walk me through a complete flow trade from signal to exit?', 'What tools do I need to build a flow-based trading desk?', 'How do I tell when smart money flow is wrong?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What is the core premise of a flow-based trading strategy?", "options": [{"id": "a", "text": "Retail traders always lose money"}, {"id": "b", "text": "Institutional/smart money flow tends to be predictive due to superior resources and information"}, {"id": "c", "text": "All options trades are equally informative"}, {"id": "d", "text": "Dark pool data is always delayed"}], "correct_answer": "b", "explanation": "Flow-based strategies work because institutional participants have superior research, analytics, and sometimes informational advantages that make their positioning predictive."}, {"id": "q2", "type": "multiple_choice", "text": "What characterizes a Tier 1 flow alert?", "options": [{"id": "a", "text": "Any options trade over 10 contracts"}, {"id": "b", "text": "Large sweeps (500+ contracts) at the ask, volume exceeding 5x average AND 2x OI, with confirming dark pool prints"}, {"id": "c", "text": "Put/call ratio slightly above average"}, {"id": "d", "text": "A stock mentioned on social media"}], "correct_answer": "b", "explanation": "Tier 1 alerts combine the most aggressive order types (sweeps at the ask), extreme volume multiples, and dark pool confirmation — the highest-conviction signals."}, {"id": "q3", "type": "multiple_choice", "text": "What should you do AFTER identifying a strong flow signal?", "options": [{"id": "a", "text": "Immediately buy the same option without any further analysis"}, {"id": "b", "text": "Apply a technical filter — confirm the stock''''s chart supports the directional thesis"}, {"id": "c", "text": "Wait 3 days to see if the flow continues"}, {"id": "d", "text": "Short the stock instead of buying options"}], "correct_answer": "b", "explanation": "Flow signals should always be confirmed with technical analysis. The best setups combine strong flow with favorable chart patterns at key support/resistance levels."}, {"id": "q4", "type": "multiple_choice", "text": "How much capital should you risk on a single flow-based trade?", "options": [{"id": "a", "text": "25-50% of your account"}, {"id": "b", "text": "10-15% of your account"}, {"id": "c", "text": "1-2% of your trading capital"}, {"id": "d", "text": "100% — go all in on Tier 1 signals"}], "correct_answer": "c", "explanation": "Risk management is critical. Limiting risk to 1-2% of capital per trade ensures that a string of losses does not significantly damage your account."}, {"id": "q5", "type": "multiple_choice", "text": "Why is journaling every flow trade important?", "options": [{"id": "a", "text": "It is required by the SEC"}, {"id": "b", "text": "It allows you to analyze which flow types, sectors, and conditions produce your best results over 50+ trades"}, {"id": "c", "text": "Journals automatically execute trades for you"}, {"id": "d", "text": "Journaling replaces the need for stop losses"}], "correct_answer": "b", "explanation": "Journaling and reviewing 50+ trades helps you identify your specific edge within the flow universe, allowing you to concentrate capital on the highest-probability setups."}], "passing_score": 70}'::jsonb
);

-- ============================================================
-- COURSE 8: Day Trading Playbook
-- ============================================================

INSERT INTO courses (
  title, slug, description, difficulty_level, estimated_hours,
  passing_score, tier_required, is_published, display_order
)
VALUES (
  'Day Trading Playbook',
  'day-trading-playbook',
  'A complete systematic approach to day trading options. From opening bell setups to closing routines, build repeatable processes that generate consistent results.',
  'intermediate'::difficulty_level,
  10,
  70,
  'core',
  true,
  8
)
RETURNING id INTO v_c8_id;

UPDATE courses SET learning_path_id = v_path2_id WHERE id = v_c8_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path2_id, v_c8_id, 3);

-- Lesson 1: The Opening Range Breakout Strategy
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c8_id,
  'The Opening Range Breakout Strategy',
  'opening-range-breakout-strategy',
  'The Opening Range Breakout (ORB) is one of the most well-established and reliable day trading strategies. The concept is straightforward: define the high and low of the first N minutes of trading (typically 5, 15, or 30 minutes), then trade the breakout in the direction of the move. The opening range works because it captures the initial battle between buyers and sellers as overnight orders, gap reactions, and early institutional activity establish the session''''s first equilibrium. A decisive break of this range signals that one side has won the early battle.

The 15-minute opening range is the most popular time frame for options day traders. After the first 15 minutes, mark the high and low on your chart. A break above the opening range high with volume confirmation is a signal to buy calls; a break below the low triggers a put entry. The best ORB trades occur on days with a clear catalyst (earnings gap, economic data, sector rotation) because catalysts provide the fuel for sustained directional moves. On low-catalyst days, ORB signals are more likely to fail as the market may revert to a range.

Risk management for ORB trades is precise. Place your stop just inside the opening range — if price breaks above the high and you buy calls, your stop triggers if price falls back below the opening range high. The first target is typically 1x the opening range height added to the breakout point. For example, if the opening range is $148-$150 (a $2 range), the upside target after a breakout above $150 is $152. More aggressive targets use 1.5x or 2x the range, but the 1x target has the highest hit rate.

For options selection on ORB trades, use at-the-money or slightly in-the-money options with the nearest weekly expiration to maximize delta exposure while keeping premium reasonable. The delta of a near-ATM option (0.45-0.55) gives you close to dollar-for-dollar exposure to the underlying''''s move. Avoid far out-of-the-money options on ORB trades — while they are cheaper, their low delta means the underlying must move significantly for you to profit, and theta decay will work against you if the trade stalls.',
  'text'::lesson_type,
  30,
  1,
  true,
  ARRAY['ORB uses the high/low of the first 5-30 minutes as breakout levels for directional trades', 'The 15-minute opening range is the most popular time frame for options day traders', 'Stop loss goes just inside the opening range; first profit target is 1x the range height', 'Use ATM or slightly ITM options with nearest weekly expiration for maximum delta exposure'],
  ARRAY['What is the best opening range time frame for my style?', 'How do I filter ORB signals to avoid false breakouts?', 'Can you show me an ORB trade example with options?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What defines the opening range in an ORB strategy?", "options": [{"id": "a", "text": "The prior day''''s high and low"}, {"id": "b", "text": "The high and low of the first N minutes of trading (typically 5, 15, or 30 minutes)"}, {"id": "c", "text": "The pre-market high and low only"}, {"id": "d", "text": "The weekly high and low"}], "correct_answer": "b", "explanation": "The opening range is defined by the high and low established during the first N minutes of regular trading (commonly 5, 15, or 30 minutes)."}, {"id": "q2", "type": "multiple_choice", "text": "Where should you place your stop loss on an ORB long trade?", "options": [{"id": "a", "text": "At the prior day''''s close"}, {"id": "b", "text": "Just inside the opening range (below the opening range high)"}, {"id": "c", "text": "10% below entry price"}, {"id": "d", "text": "At VWAP"}], "correct_answer": "b", "explanation": "The stop goes just inside the opening range. For a long breakout above the range high, a stop below that high invalidates the breakout thesis."}, {"id": "q3", "type": "multiple_choice", "text": "If the opening range is $50-$52 and price breaks above $52, what is the 1x target?", "options": [{"id": "a", "text": "$53"}, {"id": "b", "text": "$54"}, {"id": "c", "text": "$56"}, {"id": "d", "text": "$52.50"}], "correct_answer": "b", "explanation": "The range is $2 ($52-$50). Adding 1x the range to the breakout point: $52 + $2 = $54."}, {"id": "q4", "type": "multiple_choice", "text": "What type of options are best for ORB trades?", "options": [{"id": "a", "text": "Deep out-of-the-money options for maximum leverage"}, {"id": "b", "text": "LEAPS with 1+ year expiration"}, {"id": "c", "text": "ATM or slightly ITM options with nearest weekly expiration for maximum delta"}, {"id": "d", "text": "Far OTM puts regardless of direction"}], "correct_answer": "c", "explanation": "ATM or slightly ITM options with near-term expiration provide the highest delta (0.45-0.55), giving close to dollar-for-dollar exposure to the breakout move."}, {"id": "q5", "type": "multiple_choice", "text": "ORB strategies work best on days with:", "options": [{"id": "a", "text": "Low volume and no news"}, {"id": "b", "text": "A clear catalyst (earnings, economic data, sector rotation) that fuels sustained moves"}, {"id": "c", "text": "Markets closed for a holiday"}, {"id": "d", "text": "Extremely tight opening ranges"}], "correct_answer": "b", "explanation": "Catalysts provide the fuel for sustained directional moves. ORB on low-catalyst days has a higher failure rate as the market tends to revert to a range."}], "passing_score": 70}'::jsonb
);

-- Lesson 2: Mean Reversion Plays with Options
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c8_id,
  'Mean Reversion Plays with Options',
  'mean-reversion-plays-options',
  'Mean reversion is the statistical tendency of prices to return toward their average after moving to an extreme. In intraday trading, this means prices that have stretched too far from VWAP, from a key moving average, or from the Value Area tend to snap back. Mean reversion strategies are the bread and butter of range-bound days and are particularly powerful with options because you can define your risk precisely and benefit from time decay if you structure the trade correctly.

The primary tools for identifying mean reversion setups are VWAP standard deviation bands, Bollinger Bands (20-period, 2 standard deviations on a 5-minute chart), and RSI (Relative Strength Index). A classic mean reversion setup occurs when price touches or exceeds the +2 standard deviation VWAP band while RSI on the 5-minute chart exceeds 80 — the stock is both statistically extended and showing overbought momentum. The mirror setup for puts is price at -2 SD with RSI below 20. These setups target a return to VWAP or the POC as the profit objective.

Options offer a unique advantage for mean reversion trades: you can sell premium instead of just buying directionally. If a stock has spiked to an extreme, selling a call credit spread at the elevated level capitalizes on both the expected price pullback AND the elevated implied volatility at the extremes. For example, if stock XYZ spikes to $155 (at the +2 SD VWAP band) and VWAP is at $150, you could sell the $155/$157.50 call spread for the current week. If price reverts toward VWAP, both the directional move and IV contraction work in your favor. Alternatively, buying a put when price is at the upper extreme is the simpler directional approach.

The critical risk in mean reversion trading is the ''''trend day trap'''' — when you fade a move expecting reversion, but it is actually a trending day and price continues moving against you. Protect yourself with strict stops: if price closes a 5-minute candle beyond the +3 SD VWAP band (or the equivalent technical extreme), exit immediately. Also check market internals before entering a mean reversion trade: if TICK is persistently above +800 and ADD is making new highs, the market is trending and mean reversion trades should be avoided. Only take mean reversion setups when internals confirm a rotational environment.',
  'text'::lesson_type,
  30,
  2,
  true,
  ARRAY['Mean reversion targets prices returning to VWAP/POC after reaching statistical extremes', 'Classic setup: price at +/-2 SD VWAP band with RSI above 80 or below 20', 'Selling credit spreads at extremes benefits from both price reversion and IV contraction', 'Always check market internals — avoid mean reversion on trending days with persistent TICK extremes'],
  ARRAY['How do I set up VWAP bands and RSI for mean reversion?', 'When should I buy puts vs sell call spreads for mean reversion?', 'What is the win rate on mean reversion trades?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What is mean reversion?", "options": [{"id": "a", "text": "The tendency for price to continue in the same direction indefinitely"}, {"id": "b", "text": "The statistical tendency of prices to return toward their average after moving to an extreme"}, {"id": "c", "text": "A strategy that only works on weekly charts"}, {"id": "d", "text": "The process of averaging into a losing position"}], "correct_answer": "b", "explanation": "Mean reversion is the statistical principle that prices tend to return toward their mean (average) after becoming extended in either direction."}, {"id": "q2", "type": "multiple_choice", "text": "What is a classic mean reversion sell setup?", "options": [{"id": "a", "text": "Price at VWAP with average RSI"}, {"id": "b", "text": "Price at the -2 SD VWAP band with RSI below 20"}, {"id": "c", "text": "Price at the +2 SD VWAP band with RSI above 80"}, {"id": "d", "text": "Price gapping up 10% on earnings"}], "correct_answer": "c", "explanation": "A classic bearish mean reversion setup occurs when price reaches the +2 SD VWAP band (statistically extended) and RSI exceeds 80 (overbought momentum)."}, {"id": "q3", "type": "multiple_choice", "text": "Why are credit spreads effective for mean reversion trades?", "options": [{"id": "a", "text": "They have unlimited profit potential"}, {"id": "b", "text": "They require no margin"}, {"id": "c", "text": "They benefit from both the expected price pullback AND implied volatility contraction"}, {"id": "d", "text": "They never lose money"}], "correct_answer": "c", "explanation": "Selling credit spreads at price extremes captures premium from both the directional reversion and the IV contraction that occurs as the extreme fades."}, {"id": "q4", "type": "multiple_choice", "text": "What is the biggest risk in mean reversion trading?", "options": [{"id": "a", "text": "Commissions being too high"}, {"id": "b", "text": "The trend day trap — fading a move that turns out to be a persistent trend"}, {"id": "c", "text": "Options expiring worthless on weekends"}, {"id": "d", "text": "VWAP resetting at the open"}], "correct_answer": "b", "explanation": "The trend day trap occurs when you take a mean reversion trade but price keeps moving in the same direction because it is a trending day, leading to significant losses."}, {"id": "q5", "type": "multiple_choice", "text": "When should you avoid mean reversion trades?", "options": [{"id": "a", "text": "When the market opens"}, {"id": "b", "text": "On any day with volume"}, {"id": "c", "text": "When TICK is persistently above +800 and ADD is making new highs, signaling a trending day"}, {"id": "d", "text": "When implied volatility is low"}], "correct_answer": "c", "explanation": "Persistent extreme TICK readings and a trending ADD line signal a directional day where mean reversion strategies will repeatedly fail."}], "passing_score": 70}'::jsonb
);

-- Lesson 3: Momentum Continuation Setups
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c8_id,
  'Momentum Continuation Setups',
  'momentum-continuation-setups',
  'Momentum continuation setups capture the tendency of strong moves to persist after brief consolidation periods. Unlike mean reversion (which fades extremes), momentum continuation trades with the prevailing force. The underlying principle is that large institutional orders cannot be executed all at once — they are worked throughout the day, creating sustained buying or selling pressure. A stock breaking out on heavy volume typically has more institutional orders queued behind the initial move.

The most reliable momentum continuation pattern is the ''''flag'''' or ''''pennant'''' on the intraday chart. After a strong impulsive move (the ''''pole''''), price consolidates in a tight, shallow pullback for 3-10 candles on the 5-minute chart before continuing in the original direction. Key characteristics of a valid flag: the pullback retraces no more than 38.2-50% of the impulse move (using Fibonacci retracements), volume contracts during the consolidation, and the 9 EMA on the 5-minute chart holds as dynamic support (or resistance in a downtrend). The breakout from the flag on increasing volume triggers the continuation entry.

For options, momentum continuation setups are best traded with directional long options — long calls for bullish continuation, long puts for bearish continuation. Use slightly in-the-money options (delta 0.55-0.65) to ensure you capture most of the move without paying excessive premium. The expiration should be at least 3-5 days out to minimize the risk of theta decay if the consolidation takes longer than expected. Set your stop below the flag low (for longs) and target a measured move equal to the length of the impulse pole projected from the flag breakout point.

Volume is the critical confirmation for momentum continuation. The initial impulse move must occur on volume that is at least 2x the average for that time of day (not just 2x the daily average — intraday volume is U-shaped, heaviest at open and close). The consolidation should show declining volume as profit-takers exit and the supply/demand equilibrium briefly pauses. The continuation breakout should come with a volume surge back to or above the impulse level. If the breakout occurs on weak volume, the setup is compromised and should be skipped. Momentum continuation with volume confirmation has one of the highest expectancy rates of any intraday pattern.',
  'text'::lesson_type,
  25,
  3,
  true,
  ARRAY['Momentum continuation trades with the trend, capturing moves that persist after brief consolidation', 'Valid flags retrace only 38.2-50% of the impulse, with contracting volume and 9 EMA support', 'Use slightly ITM options (delta 0.55-0.65) with 3-5 day expiration for continuation plays', 'Volume must surge on the breakout — weak volume breakouts should be avoided'],
  ARRAY['How do I scan for intraday flag patterns in real time?', 'What distinguishes a valid flag from a failing pattern?', 'How do I calculate the measured move target?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What is a momentum continuation setup?", "options": [{"id": "a", "text": "A trade that fades an extended move back to the mean"}, {"id": "b", "text": "A trade that captures the tendency of strong moves to persist after brief consolidation"}, {"id": "c", "text": "A strategy that only works at market close"}, {"id": "d", "text": "A method for trading earnings reports"}], "correct_answer": "b", "explanation": "Momentum continuation trades with the prevailing trend, entering during brief consolidations (flags/pennants) before the move resumes."}, {"id": "q2", "type": "multiple_choice", "text": "In a valid bull flag, the pullback should retrace no more than:", "options": [{"id": "a", "text": "10-20% of the impulse"}, {"id": "b", "text": "38.2-50% of the impulse"}, {"id": "c", "text": "75-100% of the impulse"}, {"id": "d", "text": "The pullback depth does not matter"}], "correct_answer": "b", "explanation": "A valid flag retraces only 38.2-50% of the initial impulse move. Deeper retracements suggest the move is weakening rather than pausing."}, {"id": "q3", "type": "multiple_choice", "text": "What should volume look like during the flag consolidation?", "options": [{"id": "a", "text": "Increasing throughout the consolidation"}, {"id": "b", "text": "Equal to the impulse move volume"}, {"id": "c", "text": "Declining/contracting as the consolidation develops"}, {"id": "d", "text": "Volume is irrelevant during consolidation"}], "correct_answer": "c", "explanation": "Volume should contract during the flag as profit-takers exit and supply/demand briefly equilibrates. This decline sets up the next volume surge on the breakout."}, {"id": "q4", "type": "multiple_choice", "text": "What delta range is recommended for continuation options trades?", "options": [{"id": "a", "text": "0.05-0.15 (far OTM)"}, {"id": "b", "text": "0.20-0.30 (moderately OTM)"}, {"id": "c", "text": "0.55-0.65 (slightly ITM)"}, {"id": "d", "text": "1.0 (deep ITM)"}], "correct_answer": "c", "explanation": "Slightly ITM options with delta 0.55-0.65 capture most of the underlying''''s move without excessive premium, offering the best risk-reward for continuation trades."}, {"id": "q5", "type": "multiple_choice", "text": "What is the measured move target for a flag pattern?", "options": [{"id": "a", "text": "The length of the flag projected from the breakout point"}, {"id": "b", "text": "The length of the impulse pole projected from the flag breakout point"}, {"id": "c", "text": "Twice the flag length"}, {"id": "d", "text": "The prior day''''s range"}], "correct_answer": "b", "explanation": "The measured move target equals the length of the initial impulse (pole) projected from the flag breakout point, giving a quantitative profit target."}], "passing_score": 70}'::jsonb
);

-- Lesson 4: End-of-Day Plays: Power Hour Strategies
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c8_id,
  'End-of-Day Plays: Power Hour Strategies',
  'end-of-day-power-hour-strategies',
  'Power Hour — the final hour of trading from 3:00 PM to 4:00 PM ET — is one of the most active and volatile periods of the trading day. Volume typically surges as institutional investors complete their daily allocations, mutual funds rebalance, and market-on-close (MOC) orders flood in. The combination of high volume, decisive moves, and proximity to the close creates unique opportunities for options day traders who understand the dynamics.

The most reliable Power Hour pattern is the ''''end-of-day trend continuation.'''' If the market has been trending all day (confirmed by VWAP slope, one-sided internals, and the opening range breakout direction), the final hour often sees an acceleration of that trend as institutions chase performance and MOC imbalances compound the move. Entering a call position on a trending-up day around 3:00-3:15 PM when price pulls back to the 9 or 20 EMA on the 5-minute chart can capture the final thrust. Use 0DTE (zero days to expiration) options for maximum gamma exposure — on the day of expiration, near-ATM options have extremely high gamma, meaning their delta changes rapidly with each point of underlying movement.

The ''''MOC imbalance trade'''' is another Power Hour strategy. Around 3:45-3:50 PM, the NYSE publishes preliminary market-on-close imbalance data showing whether there is a significant buy or sell imbalance for the close. A large buy imbalance (more shares to buy at the close than to sell) tends to push prices higher into 4:00 PM. Traders can position with options ahead of the expected direction, although the window is tight and execution speed matters. This is a scalp — expect to hold for only 5-15 minutes.

Risk management during Power Hour requires extra discipline because of the compressed time frame and heightened volatility. Position sizes should be smaller than your morning trades — a sharp reversal in the final 15 minutes leaves no time to recover. If using 0DTE options, accept that they can move 50-100% in either direction within minutes due to their high gamma. Define your maximum loss before entering: for 0DTE plays, risk only the premium paid and never average down. Close all day-trading positions before 3:55 PM to avoid being caught in the closing auction volatility or accidental overnight exposure.',
  'text'::lesson_type,
  25,
  4,
  true,
  ARRAY['Power Hour (3:00-4:00 PM ET) sees surging volume from institutional allocations and MOC orders', 'End-of-day trend continuation is the highest-probability Power Hour pattern', '0DTE options offer maximum gamma exposure but require strict risk management', 'Close all day-trade positions by 3:55 PM to avoid closing auction volatility'],
  ARRAY['How do I find MOC imbalance data in real time?', 'Is it better to use 0DTE or weekly options for Power Hour?', 'What are the risks of holding options through the close?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "What time is ''''Power Hour'''' in US equity markets?", "options": [{"id": "a", "text": "9:30-10:30 AM ET"}, {"id": "b", "text": "12:00-1:00 PM ET"}, {"id": "c", "text": "3:00-4:00 PM ET"}, {"id": "d", "text": "4:00-5:00 PM ET"}], "correct_answer": "c", "explanation": "Power Hour refers to the final hour of regular trading, 3:00 PM to 4:00 PM ET, when volume typically surges and decisive moves occur."}, {"id": "q2", "type": "multiple_choice", "text": "Why does volume increase during Power Hour?", "options": [{"id": "a", "text": "Retail traders return from lunch"}, {"id": "b", "text": "Institutional investors complete daily allocations and MOC orders flood in"}, {"id": "c", "text": "The SEC requires increased trading near the close"}, {"id": "d", "text": "Options expire at 3:30 PM"}], "correct_answer": "b", "explanation": "Institutions completing their daily orders, mutual fund rebalancing, and market-on-close (MOC) order flow all contribute to the volume surge."}, {"id": "q3", "type": "multiple_choice", "text": "What makes 0DTE options particularly powerful during Power Hour?", "options": [{"id": "a", "text": "They have very low gamma"}, {"id": "b", "text": "They are free of time decay"}, {"id": "c", "text": "Their extremely high gamma means delta changes rapidly with each point of movement"}, {"id": "d", "text": "They can only be traded by institutions"}], "correct_answer": "c", "explanation": "0DTE options near ATM have extremely high gamma, causing their delta to change rapidly. This means the option''''s price sensitivity to the underlying accelerates with each tick."}, {"id": "q4", "type": "multiple_choice", "text": "When does the NYSE publish preliminary MOC imbalance data?", "options": [{"id": "a", "text": "At market open"}, {"id": "b", "text": "Around 3:45-3:50 PM ET"}, {"id": "c", "text": "After the market closes"}, {"id": "d", "text": "Every 30 minutes throughout the day"}], "correct_answer": "b", "explanation": "The NYSE publishes preliminary market-on-close imbalance data around 3:45-3:50 PM, giving traders a window to position before the closing auction."}, {"id": "q5", "type": "multiple_choice", "text": "By what time should you close all day-trading positions?", "options": [{"id": "a", "text": "2:00 PM to avoid any Power Hour risk"}, {"id": "b", "text": "3:55 PM to avoid closing auction volatility"}, {"id": "c", "text": "4:15 PM in after-hours trading"}, {"id": "d", "text": "You should hold all positions overnight"}], "correct_answer": "b", "explanation": "Closing by 3:55 PM avoids being caught in the closing auction volatility and prevents accidental overnight exposure from unsold positions."}], "passing_score": 70}'::jsonb
);

-- Lesson 5: Building Your Daily Trading Routine
INSERT INTO lessons (
  course_id, title, slug, content_markdown, lesson_type, estimated_minutes,
  display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data
)
VALUES (
  v_c8_id,
  'Building Your Daily Trading Routine',
  'building-daily-trading-routine',
  'Consistency in day trading does not come from finding the perfect strategy — it comes from executing a systematic daily routine with discipline. Professional day traders treat their activity like a business, with defined processes for every phase of the trading day. A structured routine eliminates emotional decision-making, ensures you do not miss high-quality setups, and creates a framework for continuous improvement through data-driven review.

Your pre-market routine (7:00-9:30 AM ET) should follow a fixed checklist: review overnight futures action and any gap; check the economic calendar for scheduled events; scan for unusual options activity and dark pool prints from the prior session; identify the prior day''''s key levels (high, low, close, POC, VAH, VAL); calculate the expected move from ATM straddle pricing; and build your 3-5 stock watchlist with written trade plans. This process should take 60-90 minutes and be completed before the opening bell. Many professional traders also review the Asian and European session price action for global context.

During active trading (9:30 AM-4:00 PM ET), structure your day into three phases. Phase 1 (9:30-10:30) is the ''''morning session'''' — the most volatile and opportunity-rich period. Execute your opening range breakout plays and momentum setups here. Phase 2 (10:30 AM-2:30 PM) is the ''''midday lull'''' — volume typically drops, and range-bound mean reversion strategies dominate. Many professional traders reduce size or stop trading entirely during this window. Phase 3 (2:30-4:00 PM) is ''''Power Hour'''' — volume returns, trends often resume or accelerate, and end-of-day plays become viable. Map your strategy selection to each phase rather than using the same approach all day.

Your post-market routine (4:00-5:00 PM ET) is arguably the most important part of the day. Review every trade: entry and exit timing, strategy used, whether you followed your plan, what you would do differently, and the P&L. Record this in your trading journal. Calculate your daily statistics: win rate, average winner, average loser, profit factor (gross wins / gross losses — aim for above 1.5), and largest drawdown. At the end of each week, review your journal to identify patterns: which strategies, times of day, and market conditions produce your best results. This weekly review is where you refine your edge and evolve from a reactive trader into a consistently profitable one.',
  'text'::lesson_type,
  30,
  5,
  true,
  ARRAY['Pre-market (7:00-9:30 AM): follow a fixed checklist covering futures, calendar, levels, and watchlist', 'Structure active trading into three phases: morning momentum, midday range, Power Hour', 'Post-market review is the most important habit — journal every trade with detailed statistics', 'Weekly review of journal data identifies your highest-edge strategies and conditions'],
  ARRAY['Can you give me a minute-by-minute pre-market checklist?', 'How should I adjust my approach during the midday lull?', 'What statistics should I track in my trading journal?'],
  '{"questions": [{"id": "q1", "type": "multiple_choice", "text": "When should your pre-market routine begin?", "options": [{"id": "a", "text": "At 9:29 AM, one minute before the open"}, {"id": "b", "text": "Around 7:00 AM ET, giving 60-90 minutes for preparation"}, {"id": "c", "text": "The night before"}, {"id": "d", "text": "Pre-market routines are not necessary"}], "correct_answer": "b", "explanation": "Starting around 7:00 AM ET gives you 60-90 minutes to complete a thorough pre-market checklist before the 9:30 AM open."}, {"id": "q2", "type": "multiple_choice", "text": "What characterizes the midday lull (10:30 AM-2:30 PM)?", "options": [{"id": "a", "text": "The highest volume and best momentum of the day"}, {"id": "b", "text": "Volume typically drops and range-bound mean reversion strategies dominate"}, {"id": "c", "text": "The market is closed during this period"}, {"id": "d", "text": "Only institutional traders participate"}], "correct_answer": "b", "explanation": "The midday period sees reduced volume and participation, favoring range-bound strategies. Many professional traders reduce position size or pause trading during this window."}, {"id": "q3", "type": "multiple_choice", "text": "What is ''''profit factor'''' and what is a good target?", "options": [{"id": "a", "text": "Net profit divided by account size — target 10%"}, {"id": "b", "text": "Gross wins divided by gross losses — aim for above 1.5"}, {"id": "c", "text": "Number of winning trades divided by total trades — target 90%"}, {"id": "d", "text": "Total commissions divided by net profit — target below 0.1"}], "correct_answer": "b", "explanation": "Profit factor is gross winning dollars divided by gross losing dollars. A ratio above 1.5 means your winners are significantly larger than your losers in aggregate."}, {"id": "q4", "type": "multiple_choice", "text": "Which part of the daily trading routine is described as ''''arguably the most important''''?", "options": [{"id": "a", "text": "The pre-market scan"}, {"id": "b", "text": "The opening bell execution"}, {"id": "c", "text": "The post-market review and journaling"}, {"id": "d", "text": "Power Hour trading"}], "correct_answer": "c", "explanation": "The post-market review is the most important because it is where you identify what works, what does not, and how to improve — driving long-term consistency."}, {"id": "q5", "type": "multiple_choice", "text": "How often should you conduct a comprehensive journal review?", "options": [{"id": "a", "text": "Once a year"}, {"id": "b", "text": "Monthly only"}, {"id": "c", "text": "Weekly — to identify patterns in strategies, times, and conditions that produce best results"}, {"id": "d", "text": "Journaling is not important for experienced traders"}], "correct_answer": "c", "explanation": "A weekly review of your journal helps you identify patterns in your performance across strategies, times of day, and market conditions, enabling continuous edge refinement."}], "passing_score": 70}'::jsonb
);

-- ============================================================
-- LEARNING PATH 3: Swing Trading Strategies
-- ============================================================

INSERT INTO learning_paths (name, slug, description, tier_required, difficulty_level, estimated_hours, icon_name, is_published, display_order)
VALUES (
  'Swing Trading Strategies',
  'swing-trading-strategies',
  'Master multi-day options positions with technical analysis and trend-following strategies. Learn to hold positions through overnight risk and maximize swing trade profits.',
  'pro',
  'intermediate'::difficulty_level,
  30,
  'bar-chart-2',
  true,
  3
)
RETURNING id INTO v_path3_id;

-- ============================================================
-- COURSE 9: Technical Analysis for Options
-- ============================================================

INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Technical Analysis for Options',
  'technical-analysis-for-options',
  'Apply classical and modern technical analysis specifically to options trading. Learn support/resistance, chart patterns, and indicators that improve strike and expiry selection.',
  'intermediate'::difficulty_level,
  10,
  70,
  'pro',
  true,
  9
)
RETURNING id INTO v_c9_id;

UPDATE courses SET learning_path_id = v_path3_id WHERE id = v_c9_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path3_id, v_c9_id, 1);

-- Course 9, Lesson 1
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c9_id,
  'Support and Resistance: The Foundation',
  'support-and-resistance-the-foundation',
  E'## Support and Resistance: The Foundation\n\nSupport and resistance are the bedrock of technical analysis and arguably the most important concept for options traders. A **support level** is a price zone where buying interest historically overwhelms selling pressure, preventing the price from falling further. A **resistance level** is the opposite—a price zone where sellers dominate and prevent the price from rising. These levels form because market participants have memory: traders who bought at a certain price and saw losses will often sell when the price returns to that level, creating a ceiling.\n\nFor options traders, support and resistance levels are directly actionable. If SPY is trading at $450 and has strong support at $445, a swing trader might buy a $448 put with confidence that the downside is limited, or sell a $444/$442 bull put spread knowing that support should hold. Conversely, if resistance sits at $460, buying a $462 call for a swing trade carries extra risk because the stock may stall at that level. Understanding these zones helps you choose strikes that align with probable price behavior rather than just guessing.\n\nThere are several methods to identify support and resistance. **Horizontal levels** come from prior swing highs and swing lows—look left on the chart to find prices where the stock reversed multiple times. **Round numbers** like $100, $200, or $500 act as psychological support and resistance because humans anchor to them. **Volume profile** analysis shows price levels where the most shares changed hands, indicating strong agreement on value. The more times a level has been tested without breaking, the stronger it becomes, but when it finally breaks, the move can be explosive.\n\nA critical concept is the **polarity principle**: once support is broken, it often becomes resistance, and vice versa. If AAPL had support at $180 that broke down to $170, that $180 level now acts as resistance. Options traders can exploit this by buying puts on a retest of the broken support or selling call spreads with the short strike near that new resistance. This principle repeats across all timeframes and is one of the most reliable patterns in technical analysis.\n\nWhen applying support and resistance to options, always think in terms of **zones rather than exact prices**. Markets rarely reverse at a precise penny. A support zone might span $448 to $450 on SPY. This means you should give your strike selection some buffer—don''t pick a strike right at the level; instead choose a strike a few dollars beyond it to account for the zone width and any brief spike through the level before the bounce.',
  'text'::lesson_type,
  25,
  1,
  ARRAY[
    'Support is a price zone where buying pressure prevents further decline; resistance is where selling pressure prevents further advance',
    'The polarity principle means broken support becomes resistance and broken resistance becomes support',
    'Use support and resistance zones to select option strikes that align with probable price behavior',
    'Think in zones rather than exact prices and give your strikes a buffer beyond key levels'
  ],
  ARRAY[
    'How do I identify the strongest support levels on a chart?',
    'Should I buy calls near support or near resistance?',
    'What happens to my options position when support breaks?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is the polarity principle in technical analysis?", "options": [{"id": "a", "text": "Support levels always hold on the first test"}, {"id": "b", "text": "Broken support becomes resistance and broken resistance becomes support"}, {"id": "c", "text": "Price always reverses at round numbers"}, {"id": "d", "text": "Resistance is stronger than support in all markets"}], "correct_answer": "b", "explanation": "The polarity principle states that when a support level is broken, it flips to act as resistance, and when resistance is broken, it becomes support. This occurs because the psychology of market participants changes at these price levels."},
    {"id": "q2", "type": "multiple_choice", "text": "If SPY has strong support at $445 and is currently trading at $450, which options strategy benefits from support holding?", "options": [{"id": "a", "text": "Buy a $460 call"}, {"id": "b", "text": "Buy a $440 put"}, {"id": "c", "text": "Sell a $444/$442 bull put spread"}, {"id": "d", "text": "Sell a $450 straddle"}], "correct_answer": "c", "explanation": "A bull put spread sold below the support level benefits if support holds because the short put at $444 stays out of the money. The support at $445 acts as a buffer protecting the position from loss."},
    {"id": "q3", "type": "multiple_choice", "text": "Why should options traders think of support and resistance as zones rather than exact prices?", "options": [{"id": "a", "text": "Exact prices are only for day traders"}, {"id": "b", "text": "Markets rarely reverse at a precise penny and may briefly spike through a level before reversing"}, {"id": "c", "text": "Zones are easier to draw on charts"}, {"id": "d", "text": "Options can only be bought at round numbers"}], "correct_answer": "b", "explanation": "Markets are imprecise and prices can briefly overshoot a level before the expected reversal occurs. Thinking in zones helps you choose strikes with appropriate buffers rather than placing them exactly at a single price."},
    {"id": "q4", "type": "multiple_choice", "text": "Which of the following methods is used to identify support and resistance levels?", "options": [{"id": "a", "text": "Prior swing highs and swing lows"}, {"id": "b", "text": "Volume profile analysis"}, {"id": "c", "text": "Round psychological numbers"}, {"id": "d", "text": "All of the above"}], "correct_answer": "d", "explanation": "Support and resistance can be identified through multiple methods including horizontal levels from prior swing points, volume profile analysis showing high-activity price zones, and round psychological numbers where traders tend to cluster orders."},
    {"id": "q5", "type": "multiple_choice", "text": "A stock has been rejected at $200 resistance three times. What does the fourth test suggest?", "options": [{"id": "a", "text": "The resistance is guaranteed to hold again"}, {"id": "b", "text": "Each test weakens the level, so a breakout becomes more likely"}, {"id": "c", "text": "The stock will always reverse at round numbers"}, {"id": "d", "text": "You should never trade near resistance"}], "correct_answer": "b", "explanation": "Multiple tests of a resistance level tend to weaken it because the pool of sellers at that price gets absorbed with each test. When resistance finally breaks after multiple tests, the resulting move is often sharp."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 9, Lesson 2
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c9_id,
  'Moving Averages for Options Traders',
  'moving-averages-for-options-traders',
  E'## Moving Averages for Options Traders\n\nMoving averages are among the most widely followed indicators in all of trading, and for good reason—they smooth out price noise and reveal the underlying trend direction. A **simple moving average (SMA)** calculates the arithmetic mean of the last N closing prices. A **50-day SMA** adds up the last 50 closes and divides by 50. An **exponential moving average (EMA)** gives more weight to recent prices, making it more responsive to current price action. The most commonly watched moving averages are the 20 EMA (short-term trend), 50 SMA (intermediate trend), and 200 SMA (long-term trend).\n\nFor swing trading options, moving averages serve three key functions. First, they define **trend direction**: if price is above the 50-day SMA and the 50-day is above the 200-day, the stock is in an uptrend—favor buying calls or bull spreads. If price is below both, the trend is down—favor puts or bear spreads. Second, moving averages act as **dynamic support and resistance**. During an uptrend, stocks often pull back to the 20 EMA or 50 SMA before bouncing higher. If MSFT is in an uptrend and pulls back to its rising 50-day SMA at $380, that''s a high-probability entry point for a swing call position. Third, **crossovers** signal potential trend changes: when the 50-day SMA crosses above the 200-day SMA, it''s called a "Golden Cross" and is bullish; when it crosses below, it''s called a "Death Cross" and is bearish.\n\nThe practical application for options is straightforward. When a stock pulls back to a key moving average in an uptrend, you can buy calls with 2-4 weeks to expiration, giving the trade time to work. For example, if NVDA is in a strong uptrend and pulls back 5% to its 20 EMA at $800, you might buy the $810 call expiring in 3 weeks. Your risk is defined: if NVDA closes below the 20 EMA, you exit the trade. Your stop is logical rather than arbitrary because it''s based on market structure. This approach gives you a defined entry, a defined exit, and a reason for the trade.\n\nOne important nuance: **moving averages lag**. They are built from past prices, so they confirm trends rather than predict them. This means moving average crossovers often trigger after a significant move has already occurred. Don''t chase a Golden Cross that happens after a 15% rally—wait for a pullback. Also, in choppy, range-bound markets, moving averages generate frequent whipsaws and false signals. The best moving average setups occur when a stock is in a clear, established trend and pulls back to a rising or falling average.\n\nFor options-specific considerations, pay attention to the **slope** of the moving average, not just price''s position relative to it. A steeply rising 20 EMA suggests strong momentum and supports buying calls with shorter duration. A flat 50 SMA suggests indecision and favors strategies with less directional dependency, like iron condors. Also, be aware that many institutional algorithms use the 200-day SMA as a trigger, so moves around this level tend to be high-volume and significant—plan your position sizing accordingly.',
  'text'::lesson_type,
  25,
  2,
  ARRAY[
    'The 20 EMA, 50 SMA, and 200 SMA are the most widely watched moving averages defining short, intermediate, and long-term trends',
    'Moving averages act as dynamic support and resistance where stocks often bounce during pullbacks in a trend',
    'The Golden Cross (50-day crossing above 200-day) is bullish; the Death Cross (50-day crossing below 200-day) is bearish',
    'Moving averages lag price and work best in trending markets—avoid them during choppy, range-bound conditions'
  ],
  ARRAY[
    'Which moving average should I use for 2-week swing trades?',
    'How do I trade a pullback to the 50-day moving average with options?',
    'What is the difference between a Golden Cross and a Death Cross?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is a Golden Cross?", "options": [{"id": "a", "text": "When the 200-day SMA crosses above the 50-day SMA"}, {"id": "b", "text": "When the 50-day SMA crosses above the 200-day SMA"}, {"id": "c", "text": "When price crosses above the 20 EMA"}, {"id": "d", "text": "When the 20 EMA crosses above the 50 SMA"}], "correct_answer": "b", "explanation": "A Golden Cross occurs when the 50-day SMA crosses above the 200-day SMA, signaling a potential long-term bullish trend change. It is one of the most widely followed technical signals in the market."},
    {"id": "q2", "type": "multiple_choice", "text": "A stock is in an uptrend and pulls back to its rising 50-day SMA. What is the most appropriate swing trade?", "options": [{"id": "a", "text": "Buy puts expecting the trend to reverse"}, {"id": "b", "text": "Sell a straddle to capture time decay"}, {"id": "c", "text": "Buy calls with 2-4 weeks to expiration with a stop below the 50 SMA"}, {"id": "d", "text": "Wait for the stock to make a new low before entering"}], "correct_answer": "c", "explanation": "In an uptrend, a pullback to a rising 50-day SMA is a high-probability buying opportunity. Buying calls with 2-4 weeks to expiration gives the trade time to work, and the 50-day SMA provides a logical stop level."},
    {"id": "q3", "type": "multiple_choice", "text": "What is the main limitation of moving averages?", "options": [{"id": "a", "text": "They only work on daily charts"}, {"id": "b", "text": "They lag price because they are calculated from past data"}, {"id": "c", "text": "They cannot be used with options"}, {"id": "d", "text": "They only work for stocks above $100"}], "correct_answer": "b", "explanation": "Moving averages are lagging indicators because they are calculated from historical price data. They confirm trends rather than predict them, which means crossover signals often trigger after a significant move has already happened."},
    {"id": "q4", "type": "multiple_choice", "text": "How does an exponential moving average (EMA) differ from a simple moving average (SMA)?", "options": [{"id": "a", "text": "The EMA gives more weight to recent prices, making it more responsive"}, {"id": "b", "text": "The EMA uses volume data while the SMA does not"}, {"id": "c", "text": "The SMA is faster than the EMA"}, {"id": "d", "text": "The EMA only works on intraday charts"}], "correct_answer": "a", "explanation": "An EMA applies more weight to recent closing prices compared to a simple moving average, which weights all prices equally. This makes the EMA more responsive to current price changes and quicker to signal trend shifts."},
    {"id": "q5", "type": "multiple_choice", "text": "When the 20 EMA is flat and price is oscillating around it, what does this suggest?", "options": [{"id": "a", "text": "A strong uptrend is forming"}, {"id": "b", "text": "The market is in a choppy, range-bound environment where directional trades are risky"}, {"id": "c", "text": "You should buy calls immediately"}, {"id": "d", "text": "A Death Cross is imminent"}], "correct_answer": "b", "explanation": "A flat moving average with price oscillating around it signals indecision and a range-bound market. Directional strategies like long calls or puts will generate whipsaws. Non-directional strategies like iron condors or strangles may be more appropriate."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 9, Lesson 3
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c9_id,
  'RSI, MACD, and Momentum Indicators',
  'rsi-macd-and-momentum-indicators',
  E'## RSI, MACD, and Momentum Indicators\n\nMomentum indicators measure the speed and strength of price movement, helping traders determine whether a trend is accelerating, decelerating, or likely to reverse. The two most important momentum indicators for options swing traders are the **Relative Strength Index (RSI)** and the **Moving Average Convergence Divergence (MACD)**. Unlike moving averages which follow trends, momentum indicators can provide early warnings that a trend is losing steam before the price itself reverses.\n\nThe **RSI** is a bounded oscillator that ranges from 0 to 100. It measures the magnitude of recent price gains versus losses over a lookback period, typically 14 days. An RSI above 70 indicates the stock is **overbought**—it has risen rapidly and may be due for a pullback. An RSI below 30 indicates the stock is **oversold**—it has fallen sharply and may be due for a bounce. However, in strong trends, a stock can remain overbought or oversold for extended periods. For swing trading options, the best RSI signals come from **divergences**: if a stock makes a new high but RSI makes a lower high, this bearish divergence warns that buying momentum is fading. Conversely, if a stock makes a new low but RSI makes a higher low, this bullish divergence suggests selling pressure is exhausting.\n\nThe **MACD** consists of three components: the MACD line (the 12-period EMA minus the 26-period EMA), the signal line (a 9-period EMA of the MACD line), and the histogram (the difference between the MACD line and signal line). When the MACD line crosses above the signal line, it''s a bullish signal; when it crosses below, it''s bearish. The histogram visually shows momentum: growing bars mean the trend is strengthening, shrinking bars mean it''s weakening. For options traders, MACD is especially useful for timing entries—buy calls when the MACD crosses bullish and the histogram starts expanding from below zero.\n\nApplying these indicators to options requires understanding their limitations. If AAPL has an RSI of 25 after a sharp selloff, buying a call for a bounce might seem obvious, but you need context. Is there an earnings report coming? Has the sector been weak? An oversold RSI in a downtrend often leads to more downside—the stock bounces briefly, then resumes falling. The safest RSI-based options plays occur when an oversold reading aligns with support or when an overbought reading aligns with resistance. For instance, if META drops to its 200-day SMA with an RSI of 28, both the support level and the oversold condition support buying a call or a bull call spread.\n\nCombine RSI and MACD for higher-conviction trades. A powerful setup is when RSI shows bullish divergence (higher lows on RSI while price makes lower lows) AND the MACD histogram starts turning positive. This dual confirmation reduces false signals. For example, if AMZN falls from $190 to $175 with RSI divergence forming and the MACD histogram shrinking (becoming less negative), you might buy a $180 call expiring in 3 weeks. The confluence of momentum indicators shifting bullish gives the trade a stronger foundation than relying on a single signal.',
  'text'::lesson_type,
  30,
  3,
  ARRAY[
    'RSI above 70 means overbought and RSI below 30 means oversold, but stocks can stay overbought or oversold in strong trends',
    'RSI divergences (price making new highs/lows while RSI does not) are among the most reliable reversal warnings',
    'MACD crossovers of the signal line indicate momentum shifts; the histogram shows whether momentum is strengthening or weakening',
    'Combine RSI and MACD with support/resistance for the highest-conviction swing trade setups'
  ],
  ARRAY[
    'How do I spot RSI divergence on a chart?',
    'Is an RSI of 75 automatically a sell signal?',
    'How do I use MACD to time my options entry?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does an RSI reading above 70 indicate?", "options": [{"id": "a", "text": "The stock is oversold and due for a bounce"}, {"id": "b", "text": "The stock is overbought and may be due for a pullback"}, {"id": "c", "text": "The stock has no momentum"}, {"id": "d", "text": "The stock is in a downtrend"}], "correct_answer": "b", "explanation": "An RSI above 70 indicates the stock is overbought, meaning it has risen rapidly relative to recent losses and may be due for a pullback or consolidation. However, in strong uptrends, stocks can remain overbought for extended periods."},
    {"id": "q2", "type": "multiple_choice", "text": "What is a bearish RSI divergence?", "options": [{"id": "a", "text": "RSI drops below 30"}, {"id": "b", "text": "Price makes a new high but RSI makes a lower high"}, {"id": "c", "text": "RSI rises above 70"}, {"id": "d", "text": "Price and RSI both make new highs"}], "correct_answer": "b", "explanation": "A bearish divergence occurs when price makes a new high but RSI makes a lower high. This shows that while price is still rising, the buying momentum behind the move is weakening, which often precedes a reversal."},
    {"id": "q3", "type": "multiple_choice", "text": "What are the three components of the MACD indicator?", "options": [{"id": "a", "text": "RSI line, signal line, and histogram"}, {"id": "b", "text": "MACD line, signal line, and histogram"}, {"id": "c", "text": "Fast EMA, slow SMA, and volume"}, {"id": "d", "text": "Upper band, middle band, and lower band"}], "correct_answer": "b", "explanation": "The MACD indicator consists of the MACD line (12-period EMA minus 26-period EMA), the signal line (9-period EMA of the MACD line), and the histogram (the difference between the MACD line and signal line)."},
    {"id": "q4", "type": "multiple_choice", "text": "A stock hits its 200-day SMA with an RSI of 28. What does this confluence suggest?", "options": [{"id": "a", "text": "The stock is in freefall and should be shorted aggressively"}, {"id": "b", "text": "Both the support level and oversold RSI support a potential bounce, making it a favorable spot for a bullish trade"}, {"id": "c", "text": "The RSI is irrelevant when price is at a moving average"}, {"id": "d", "text": "You should wait for RSI to reach 10 before buying"}], "correct_answer": "b", "explanation": "When an oversold RSI reading coincides with a strong support level like the 200-day SMA, both technical signals align to suggest a bounce is likely. This confluence gives a bullish options trade higher conviction than either signal alone."},
    {"id": "q5", "type": "multiple_choice", "text": "What does a shrinking MACD histogram indicate?", "options": [{"id": "a", "text": "Momentum is strengthening in the current direction"}, {"id": "b", "text": "Volume is increasing"}, {"id": "c", "text": "Momentum is weakening and the trend may be about to shift"}, {"id": "d", "text": "The stock is about to report earnings"}], "correct_answer": "c", "explanation": "A shrinking MACD histogram means the gap between the MACD line and signal line is narrowing, indicating that momentum in the current trend direction is weakening. This often precedes a MACD crossover and potential trend reversal."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 9, Lesson 4
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c9_id,
  'Chart Patterns That Actually Work',
  'chart-patterns-that-actually-work',
  E'## Chart Patterns That Actually Work\n\nChart patterns are visual formations on price charts that reflect the psychology of buyers and sellers in a recognizable, repeatable structure. While there are dozens of named patterns, swing traders should focus on the ones that have the highest reliability and clearest trade signals. The most actionable patterns for options trading fall into two categories: **continuation patterns** (the trend is pausing before resuming) and **reversal patterns** (the trend is about to change direction).\n\nThe **bull flag** is the most reliable continuation pattern for swing traders. After a sharp move higher (the flagpole), the stock consolidates in a slight downward or sideways channel (the flag) on declining volume. The breakout above the flag''s upper trendline, ideally on increasing volume, signals that the uptrend is resuming. For options, buy a call or bull call spread when price breaks above the flag with a target equal to the length of the flagpole projected from the breakout point. If TSLA rallies from $240 to $270 (a $30 flagpole), then forms a flag back down to $260, the breakout target is $290 ($260 + $30). You might buy the $265 call expiring in 3 weeks on the breakout.\n\nThe **head and shoulders** is the most recognized reversal pattern. It consists of three peaks: a left shoulder, a higher head, and a right shoulder that is roughly equal in height to the left shoulder. The **neckline** connects the lows between the shoulders. A break below the neckline confirms the reversal and projects a measured move downward equal to the distance from the head to the neckline. For options traders, this is a put-buying or bear put spread opportunity. If GOOGL forms a head and shoulders with the head at $180 and the neckline at $165, the measured move target is $150 ($165 minus the $15 distance from head to neckline). Buy puts or a put spread on the neckline break.\n\nThe **double bottom** (or "W" pattern) is a powerful bullish reversal that forms after a downtrend. Price hits a low, bounces, returns to roughly the same low (creating two equal bottoms), then breaks above the middle peak (the confirmation line). This pattern signals that sellers tried twice to push price lower and failed—demand has absorbed the supply. For a swing trade, buy calls when price breaks above the confirmation line. If AMD forms a double bottom with lows at $120 and a confirmation line at $130, buy the $132 call on the breakout with a target of $140 (the measured move equals the pattern height of $10 added to the breakout at $130).\n\n**Ascending triangles** are continuation patterns formed by a flat resistance line and a rising support trendline. Each pullback makes a higher low, indicating buyers are becoming more aggressive. The expected breakout is upward through the resistance line. This is an ideal pattern for swing call trades because the rising lows give you a clear stop level (below the latest higher low), and the flat resistance provides a specific breakout trigger. If QQQ forms an ascending triangle with resistance at $400 and higher lows at $390, $393, $395, you would buy calls when QQQ breaks above $400.\n\nA few critical rules for trading patterns with options: Always **wait for the breakout confirmation** rather than anticipating it—many patterns fail, and options lose value quickly if the breakout doesn''t materialize. Use the **measured move** to select your strike price and determine if the reward justifies the cost of the option. Finally, give yourself **adequate time**—buy options with at least 2-3 weeks more time than you expect the trade to take, because patterns don''t always resolve on your schedule.',
  'text'::lesson_type,
  30,
  4,
  ARRAY[
    'Bull flags are the most reliable continuation patterns: look for a sharp move followed by a consolidating pullback before breakout',
    'Head and shoulders is a reversal pattern with a measured move target equal to the distance from head to neckline',
    'Double bottoms signal failed selling attempts and project upward from the confirmation line by the pattern height',
    'Always wait for breakout confirmation before entering and give yourself more time on options than you think you need'
  ],
  ARRAY[
    'How do I calculate the measured move target for a bull flag?',
    'What is the most common reason chart pattern trades fail?',
    'How much time should I give my options when trading a pattern breakout?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "A stock rallies $20, then consolidates in a slight downward channel on declining volume. What pattern is this?", "options": [{"id": "a", "text": "Head and shoulders"}, {"id": "b", "text": "Double bottom"}, {"id": "c", "text": "Bull flag"}, {"id": "d", "text": "Descending triangle"}], "correct_answer": "c", "explanation": "A bull flag consists of a sharp upward move (the flagpole) followed by a slight downward or sideways consolidation (the flag) on declining volume. The breakout above the flag resumes the uptrend."},
    {"id": "q2", "type": "multiple_choice", "text": "In a head and shoulders pattern, what confirms the reversal?", "options": [{"id": "a", "text": "The formation of the right shoulder"}, {"id": "b", "text": "A break below the neckline"}, {"id": "c", "text": "Volume increasing on the head"}, {"id": "d", "text": "RSI reaching 70"}], "correct_answer": "b", "explanation": "The head and shoulders reversal is only confirmed when price breaks below the neckline, which connects the lows between the left shoulder, head, and right shoulder. Until the neckline breaks, the pattern is not confirmed and could fail."},
    {"id": "q3", "type": "multiple_choice", "text": "A stock forms a double bottom with lows at $50 and a confirmation line at $56. What is the measured move target?", "options": [{"id": "a", "text": "$60"}, {"id": "b", "text": "$62"}, {"id": "c", "text": "$56"}, {"id": "d", "text": "$64"}], "correct_answer": "b", "explanation": "The measured move for a double bottom equals the pattern height ($56 - $50 = $6) added to the breakout point ($56 + $6 = $62). This gives a projected upside target of $62."},
    {"id": "q4", "type": "multiple_choice", "text": "What characterizes an ascending triangle?", "options": [{"id": "a", "text": "Flat support with a descending resistance line"}, {"id": "b", "text": "Flat resistance with a rising support trendline of higher lows"}, {"id": "c", "text": "Two equal peaks and a trough between them"}, {"id": "d", "text": "A sharp decline followed by sideways consolidation"}], "correct_answer": "b", "explanation": "An ascending triangle has a flat horizontal resistance level and a rising support trendline created by higher lows. This shows buyers becoming more aggressive, and the expected breakout is upward through the resistance."},
    {"id": "q5", "type": "multiple_choice", "text": "When trading a chart pattern breakout with options, how much extra time should you buy?", "options": [{"id": "a", "text": "Options expiring the same week as the expected breakout"}, {"id": "b", "text": "At least 2-3 weeks more time than you expect the trade to take"}, {"id": "c", "text": "At least 6 months to be safe"}, {"id": "d", "text": "Time does not matter for pattern breakout trades"}], "correct_answer": "b", "explanation": "Chart patterns do not always resolve on your expected timeline. Buying at least 2-3 extra weeks of time protects against theta decay eating your position while you wait for the breakout to develop and follow through."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 9, Lesson 5
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c9_id,
  'Combining Technicals with Options Greeks',
  'combining-technicals-with-options-greeks',
  E'## Combining Technicals with Options Greeks\n\nTechnical analysis tells you **where** price is likely to go and **when** it might get there. Options Greeks tell you **how** your position will behave along the way. The most effective swing traders combine both disciplines to select not just the direction, but the optimal strike, expiration, and strategy for each setup. This integration is what separates options traders who consistently profit from those who are right on direction but still lose money.\n\n**Delta and directional conviction.** Delta measures how much the option''s price changes for a $1 move in the underlying. If your technical analysis shows a high-conviction setup—such as a breakout from a bull flag with volume confirmation—you want higher delta exposure. Buy an in-the-money call (delta 0.65-0.80) to capture more of the move. For lower-conviction setups where you''re speculating on a possible bounce off support, an at-the-money option (delta ~0.50) or even a slightly out-of-the-money option gives you exposure with less capital at risk. The strength of the technical signal should directly influence your delta selection.\n\n**Theta and expected duration.** Technical patterns give you an estimated timeframe. A bull flag typically resolves within 1-2 weeks. A head and shoulders might take 3-4 weeks from right shoulder to neckline break. Use this expected duration to choose your expiration. You want your expiration to extend at least 2 weeks beyond when you expect the pattern to resolve. If you expect a breakout in 5 trading days, buy at least 3 weeks to expiration. This matters because theta decay accelerates as expiration approaches—an option with 5 days to expiry loses value roughly 4 times faster per day than one with 30 days to expiry. If your technical pattern takes an extra week to play out, the short-dated option could lose 30-40% of its value just from time decay.\n\n**Implied volatility and strategy selection.** Before placing any swing trade, check the option''s implied volatility (IV) relative to its historical range (IV Rank or IV Percentile). If IV Rank is above 50%, options are expensive relative to their history, and you should favor strategies that benefit from volatility contraction: sell credit spreads, sell put spreads on bullish setups, or use debit spreads to offset the high IV cost. If IV Rank is below 30%, options are cheap, and buying single-leg calls or puts gives you the most bang for your buck because you''re buying volatility at a discount. For example, if your chart shows a bullish setup on AMZN but IV Rank is at 70%, buy a bull call spread rather than a naked call—the spread''s short leg offsets the expensive premium.\n\n**Gamma and proximity to key levels.** Gamma measures how fast delta changes. Options with high gamma (at-the-money, near expiration) experience rapid delta shifts—they gain value quickly when price moves in your favor but lose it just as fast on reversals. When the underlying is near a major support or resistance level, gamma becomes critically important. If SPY is sitting right at $450 resistance and you own $450 calls, gamma is at its peak. A breakout above $450 will cause your calls'' delta to surge, amplifying gains. But a rejection at $450 will cause delta to collapse. This is why timing your entry relative to key technical levels is essential—the Greeks amplify or punish you based on how price reacts at those levels.\n\nThe integrated workflow looks like this: (1) Identify the technical setup and determine direction, target, and timeframe. (2) Check IV Rank to decide between buying premium or selling it. (3) Choose your strike based on your directional conviction (delta). (4) Choose your expiration based on the expected pattern duration plus buffer (theta). (5) Size the position knowing that gamma will amplify moves near your strike. This five-step framework turns a chart observation into a precisely structured options trade.',
  'text'::lesson_type,
  30,
  5,
  ARRAY[
    'Match your delta to your conviction level: higher delta (ITM) for high-conviction setups, lower delta (OTM) for speculative plays',
    'Choose expirations that extend at least 2 weeks beyond the expected pattern resolution to buffer against theta acceleration',
    'Check IV Rank before entering: high IV favors credit spreads or debit spreads; low IV favors long single-leg options',
    'Gamma amplifies gains and losses near key technical levels—be aware of acceleration risk near support and resistance'
  ],
  ARRAY[
    'Should I buy ITM or OTM calls for a bull flag breakout?',
    'How does IV Rank change which strategy I should use?',
    'Why do I need extra time on my options when trading patterns?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "You identify a high-conviction bull flag breakout. Which delta range best captures the move?", "options": [{"id": "a", "text": "Delta 0.10-0.20 (deep OTM)"}, {"id": "b", "text": "Delta 0.30-0.40 (OTM)"}, {"id": "c", "text": "Delta 0.65-0.80 (ITM)"}, {"id": "d", "text": "Delta 0.95-1.00 (deep ITM)"}], "correct_answer": "c", "explanation": "For high-conviction setups, an in-the-money option with a delta of 0.65-0.80 captures most of the underlying move while still providing leverage. Deep ITM options behave too much like stock, while OTM options risk expiring worthless despite a correct direction call."},
    {"id": "q2", "type": "multiple_choice", "text": "IV Rank on a stock is 72%. You have a bullish chart setup. What is the best strategy?", "options": [{"id": "a", "text": "Buy a single long call"}, {"id": "b", "text": "Buy a bull call spread or sell a bull put spread to offset the expensive premium"}, {"id": "c", "text": "Buy a straddle"}, {"id": "d", "text": "IV Rank does not affect strategy selection"}], "correct_answer": "b", "explanation": "When IV Rank is high (above 50%), options are expensive. A bull call spread offsets the high cost because the short leg collects inflated premium, and a bull put spread benefits from IV contraction. Buying a naked call at high IV means overpaying and suffering if volatility drops."},
    {"id": "q3", "type": "multiple_choice", "text": "Your chart pattern should resolve in 7 trading days. What is the minimum expiration you should choose?", "options": [{"id": "a", "text": "7 days (match the expected resolution)"}, {"id": "b", "text": "At least 21 days (add 2+ weeks of buffer)"}, {"id": "c", "text": "1 day to maximize gamma"}, {"id": "d", "text": "6 months for maximum safety"}], "correct_answer": "b", "explanation": "You should buy at least 2 weeks more time than the expected pattern resolution. With 7 trading days expected, a minimum of 21 days (3 weeks) to expiration gives a buffer against theta acceleration and pattern delays. Theta decay accelerates dramatically in the final 2 weeks."},
    {"id": "q4", "type": "multiple_choice", "text": "What does high gamma near a key resistance level mean for your long calls?", "options": [{"id": "a", "text": "Your calls are immune to price changes"}, {"id": "b", "text": "A breakout will rapidly increase delta and amplify gains, but a rejection will rapidly decrease delta and amplify losses"}, {"id": "c", "text": "Theta decay pauses near resistance"}, {"id": "d", "text": "Gamma is not relevant at technical levels"}], "correct_answer": "b", "explanation": "Gamma measures how fast delta changes. Near key levels with at-the-money options, gamma is highest. This means a breakout causes delta to surge (amplifying gains) while a rejection causes delta to collapse (amplifying losses). The outcome at the level is amplified in both directions."},
    {"id": "q5", "type": "multiple_choice", "text": "What is the correct order for the integrated technical-options workflow?", "options": [{"id": "a", "text": "Choose expiration, check IV, identify setup, select strike, size position"}, {"id": "b", "text": "Identify technical setup, check IV Rank, choose strike (delta), choose expiration (theta), size position (gamma awareness)"}, {"id": "c", "text": "Buy the cheapest option, then check the chart"}, {"id": "d", "text": "Check IV Rank first, then look for any chart pattern that fits"}], "correct_answer": "b", "explanation": "The correct workflow starts with the technical setup (direction, target, timeframe), then checks IV Rank to select strategy type, then uses delta for strike selection, theta for expiration selection, and gamma awareness for position sizing. The chart setup drives the trade; the Greeks optimize it."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- COURSE 10: Multi-Day Position Management
-- ============================================================

INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Multi-Day Position Management',
  'multi-day-position-management',
  'Learn the art of holding options overnight and over multiple days. Manage theta decay, adjust positions, and handle earnings and events.',
  'intermediate'::difficulty_level,
  10,
  70,
  'pro',
  true,
  10
)
RETURNING id INTO v_c10_id;

UPDATE courses SET learning_path_id = v_path3_id WHERE id = v_c10_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path3_id, v_c10_id, 2);

-- Course 10, Lesson 1
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c10_id,
  'Overnight Risk: Gaps, News, and Futures',
  'overnight-risk-gaps-news-and-futures',
  E'## Overnight Risk: Gaps, News, and Futures\n\nThe moment you decide to hold an options position overnight, you accept a category of risk that day traders avoid entirely: **gap risk**. A gap occurs when a stock opens at a significantly different price than its previous close. Gaps can be caused by after-hours earnings reports, pre-market economic data releases, geopolitical events, analyst upgrades or downgrades, or simply overnight sentiment shifts in global markets. For options traders, gaps are particularly dangerous because a large adverse gap can wipe out an entire position before you have a chance to exit.\n\nUnderstanding **futures markets** is essential for managing overnight risk. S&P 500 futures (ES) trade nearly 24 hours a day, and their movement overnight directly influences where SPY and most large-cap stocks will open. If ES futures drop 1.5% overnight due to a negative economic report from Asia, SPY will likely open down approximately 1.5% as well. Checking futures before the market opens gives you a preview of the gap. Many swing traders set alerts on ES futures at key levels—if futures break below a critical support level overnight, they know their long calls will be under pressure at the open and can prepare a plan of action.\n\nThe practical impact of gaps on options depends on your position type. **Long calls and puts** face asymmetric gap risk. If you hold a $450 SPY call and SPY gaps down $5 overnight, your call might lose 40-50% of its value at the open because delta, gamma, and potentially IV all move against you simultaneously. However, long options have a built-in advantage: your maximum loss is capped at the premium paid. **Spread positions** offer more protection because the short leg offsets some of the gap damage. If you hold a $450/$455 bull call spread on SPY and it gaps down $3, your spread loses less than a naked call because the short $455 call also loses value, partially offsetting your $450 call''s loss.\n\nTo manage overnight risk effectively, follow these principles. First, **size your positions assuming a gap will happen**. If SPY could reasonably gap 2% ($9) and that would cause your position to lose $500, make sure that $500 loss is acceptable relative to your account size—typically no more than 1-2% of total capital per position. Second, **avoid holding through known binary events** unless your strategy specifically accounts for them. Earnings announcements, FOMC meetings, and CPI reports create enormous gap potential. Third, **use spread strategies** when holding overnight to cap your risk. A defined-risk spread means you know your absolute worst case even if the stock gaps through your strikes. Fourth, **check futures and pre-market activity** before the open and have a plan for both bullish and bearish scenarios.\n\nFinally, recognize that overnight gaps are not always threats—they can be opportunities. If you hold a bull call spread and the stock gaps up 3% overnight on positive news, you might open with a significant unrealized profit. The key is to be positioned correctly before the gap rather than trying to react to it after. This means doing your homework on upcoming catalysts and news cycles before deciding to hold overnight.',
  'text'::lesson_type,
  25,
  1,
  ARRAY[
    'Gap risk is the primary danger of holding options overnight—stocks can open significantly higher or lower than the prior close',
    'S&P 500 futures (ES) trade nearly 24 hours and preview where the market will open—check them before the bell',
    'Spread positions reduce gap damage because the short leg offsets losses on the long leg',
    'Size positions assuming a gap will occur and limit overnight risk to 1-2% of total account capital per position'
  ],
  ARRAY[
    'How much can my options lose from an overnight gap?',
    'Should I check futures before the market opens?',
    'Are spreads safer to hold overnight than single-leg options?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What causes gaps in stock prices?", "options": [{"id": "a", "text": "After-hours earnings, economic data, geopolitical events, and analyst actions"}, {"id": "b", "text": "Only earnings announcements cause gaps"}, {"id": "c", "text": "Gaps are random and cannot be anticipated"}, {"id": "d", "text": "Gaps only occur on Mondays"}], "correct_answer": "a", "explanation": "Gaps are caused by a variety of factors including after-hours earnings reports, pre-market economic data, geopolitical events, analyst upgrades/downgrades, and overnight sentiment shifts. Being aware of upcoming catalysts helps manage gap risk."},
    {"id": "q2", "type": "multiple_choice", "text": "Why are spread positions generally safer to hold overnight than naked long options?", "options": [{"id": "a", "text": "Spreads are immune to gap risk"}, {"id": "b", "text": "The short leg offsets some of the gap damage, reducing the net loss"}, {"id": "c", "text": "Spreads do not lose value overnight"}, {"id": "d", "text": "The broker protects spread positions from gaps"}], "correct_answer": "b", "explanation": "In a spread, if the stock gaps adversely, both the long and short legs are affected. The short leg gains value (for you) when the stock gaps against your direction, partially offsetting the loss on the long leg. This makes the net impact smaller than a naked position."},
    {"id": "q3", "type": "multiple_choice", "text": "What is the recommended maximum loss per position relative to account size for overnight holds?", "options": [{"id": "a", "text": "5-10% of total capital"}, {"id": "b", "text": "1-2% of total capital"}, {"id": "c", "text": "25% of total capital"}, {"id": "d", "text": "There is no recommended limit"}], "correct_answer": "b", "explanation": "A widely accepted risk management guideline is to limit potential loss per position to 1-2% of total account capital. This ensures that even a worst-case overnight gap does not cause catastrophic damage to the account."},
    {"id": "q4", "type": "multiple_choice", "text": "S&P 500 futures (ES) drop 1.5% overnight. What is the likely impact on SPY at the open?", "options": [{"id": "a", "text": "SPY will be unaffected"}, {"id": "b", "text": "SPY will likely open down approximately 1.5%"}, {"id": "c", "text": "SPY will gap up to compensate"}, {"id": "d", "text": "SPY and ES futures are unrelated"}], "correct_answer": "b", "explanation": "SPY tracks the S&P 500 index, and ES futures represent the same index. Overnight moves in ES futures directly translate to gap opens in SPY. A 1.5% drop in ES futures typically means SPY will open down roughly 1.5%."},
    {"id": "q5", "type": "multiple_choice", "text": "Which of the following is NOT a recommended practice for managing overnight risk?", "options": [{"id": "a", "text": "Checking futures before the market opens"}, {"id": "b", "text": "Sizing positions based on worst-case gap scenarios"}, {"id": "c", "text": "Holding large naked options positions through earnings announcements"}, {"id": "d", "text": "Using defined-risk spreads instead of naked options"}], "correct_answer": "c", "explanation": "Holding large naked options through earnings announcements exposes you to enormous gap risk with potentially unlimited losses. Recommended practices include checking futures, sizing for gaps, and using defined-risk spreads."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 10, Lesson 2
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c10_id,
  'Theta Management for Multi-Day Holds',
  'theta-management-for-multi-day-holds',
  E'## Theta Management for Multi-Day Holds\n\nTheta is the Greek that measures how much value an option loses each day simply from the passage of time, assuming all else remains equal. For swing traders holding options over multiple days or weeks, theta is the silent tax on every position. A call option with a theta of -$0.15 loses fifteen cents per share ($15 per contract) every single day you hold it. Over a 10-day swing trade, that''s $150 in time decay you must overcome just to break even—before commissions and slippage.\n\nTheta decay is **not linear**—it accelerates as expiration approaches. An option with 45 days to expiration might lose $5 per day in theta, but the same option with 10 days left might lose $20 per day. This acceleration follows an approximate square-root-of-time curve: the last 30 days account for roughly 50% of total time value decay. For swing traders, this has a critical implication: **the closer your expiration, the faster your position bleeds value**. If you''re holding a 2-week swing trade, an option with 14 days to expiration is decaying rapidly, while the same strike with 45 days to expiration decays much more slowly. The extra premium you pay for more time is effectively an insurance policy against theta erosion.\n\nThe practical framework for managing theta in swing trades involves three rules. **Rule 1: Buy more time than you need.** If your technical analysis suggests the trade will take 5-7 days, buy an option with at least 30 days to expiration. The daily theta on a 30-day option is roughly half that of a 14-day option at the same strike. **Rule 2: Monitor your daily theta cost relative to expected gains.** If your option loses $20/day in theta and your expected move would generate $200 in profit, you have a 10-day window before theta eats your potential profit. Calculate this ratio before entering. **Rule 3: Exit before the acceleration zone.** If you bought a 30-day option for a swing trade and 15 days have passed with the stock still consolidating, consider closing or rolling the position rather than holding into the final two weeks where theta decay doubles.\n\nDifferent strategies have different theta profiles that swing traders should understand. **Long single-leg options** have the worst theta exposure—you pay theta every day with no offset. **Debit spreads** (like bull call spreads) have reduced theta because the short leg earns theta that partially offsets the long leg''s decay. For example, if your long $450 call has theta of -$0.20 and your short $460 call has theta of +$0.12, the net spread theta is only -$0.08—a 60% reduction in daily decay. **Calendar spreads** can actually have positive theta, making them ideal for swing trades in consolidating markets—but that''s a more advanced topic.\n\nFinally, consider the relationship between theta and implied volatility. When IV is high, options have more extrinsic value, which means there is more value to decay. A swing trade entered when IV is elevated will experience faster absolute theta decay than the same trade entered in a low-IV environment. This reinforces why checking IV Rank before entering is essential: in high-IV environments, use debit spreads to reduce your theta exposure; in low-IV environments, naked long options are more manageable because there is less extrinsic value to erode.',
  'text'::lesson_type,
  30,
  2,
  ARRAY[
    'Theta decay accelerates as expiration approaches—the last 30 days account for roughly 50% of total time value decay',
    'Always buy more time than you think you need: if the trade takes 5-7 days, buy at least 30 days to expiration',
    'Debit spreads reduce theta exposure significantly because the short leg earns theta that offsets the long leg decay',
    'Calculate your daily theta cost relative to expected profit to determine how many days you have before theta erodes the opportunity'
  ],
  ARRAY[
    'How much theta decay should I expect on a 30-day option?',
    'Why are debit spreads better than single legs for multi-day holds?',
    'When should I exit a swing trade to avoid theta acceleration?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "How does theta decay behave as expiration approaches?", "options": [{"id": "a", "text": "It remains constant throughout the option life"}, {"id": "b", "text": "It decelerates, losing less value per day near expiration"}, {"id": "c", "text": "It accelerates, with the last 30 days accounting for roughly 50% of total decay"}, {"id": "d", "text": "It stops completely in the final week"}], "correct_answer": "c", "explanation": "Theta decay follows an approximate square-root-of-time curve and accelerates as expiration nears. The last 30 days account for roughly half of the total time value decay, making this the most dangerous period for long options holders."},
    {"id": "q2", "type": "multiple_choice", "text": "Your swing trade should take 5-7 days. What is the minimum expiration you should buy?", "options": [{"id": "a", "text": "7 days to match the expected duration"}, {"id": "b", "text": "10 days for a small buffer"}, {"id": "c", "text": "At least 30 days to minimize daily theta decay"}, {"id": "d", "text": "1 day to maximize gamma"}], "correct_answer": "c", "explanation": "Buying at least 30 days to expiration means daily theta is roughly half that of a 14-day option. This gives you a much larger time buffer and ensures theta decay does not erode your position while waiting for the trade to play out."},
    {"id": "q3", "type": "multiple_choice", "text": "A bull call spread has a long $450 call with theta of -$0.20 and a short $460 call with theta of +$0.12. What is the net theta?", "options": [{"id": "a", "text": "-$0.32"}, {"id": "b", "text": "-$0.08"}, {"id": "c", "text": "+$0.12"}, {"id": "d", "text": "-$0.20"}], "correct_answer": "b", "explanation": "Net theta is calculated by adding the theta values: -$0.20 + $0.12 = -$0.08. The short leg earns theta that partially offsets the long leg decay, reducing the net daily cost from $0.20 to $0.08 per share—a 60% reduction."},
    {"id": "q4", "type": "multiple_choice", "text": "Why does high implied volatility increase theta decay?", "options": [{"id": "a", "text": "High IV has no effect on theta"}, {"id": "b", "text": "High IV means more extrinsic value, and more extrinsic value means more value to decay each day"}, {"id": "c", "text": "High IV reduces theta decay"}, {"id": "d", "text": "Theta only depends on time, not volatility"}], "correct_answer": "b", "explanation": "When implied volatility is high, options carry more extrinsic (time) value. Since theta measures the decay of extrinsic value, higher IV means there is more value to erode per day, resulting in faster absolute theta decay."},
    {"id": "q5", "type": "multiple_choice", "text": "You bought a 30-day option for a swing trade. After 15 days, the stock has not moved. What should you do?", "options": [{"id": "a", "text": "Hold through expiration hoping for a last-minute move"}, {"id": "b", "text": "Consider closing or rolling the position to avoid the accelerating theta decay in the final two weeks"}, {"id": "c", "text": "Double your position size to recover the theta lost"}, {"id": "d", "text": "Switch to selling the same option"}], "correct_answer": "b", "explanation": "With 15 days remaining, you are entering the theta acceleration zone where decay roughly doubles. If the trade thesis has not played out, closing to limit further theta losses or rolling to a later expiration to reset the decay curve are prudent risk management actions."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 10, Lesson 3
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c10_id,
  'Rolling Options: When and How',
  'rolling-options-when-and-how',
  E'## Rolling Options: When and How\n\nRolling an option means **closing your current position and simultaneously opening a new one** at a different strike price, a different expiration date, or both. It is not a single magical transaction—it is two trades executed together: a closing trade on the existing option and an opening trade on the new one. Rolling is one of the most important skills for swing traders because it allows you to extend a trade that is working, repair a trade that is struggling, or adjust your risk profile without completely exiting and re-entering the market.\n\nThere are three primary types of rolls. A **roll out** (also called rolling forward) keeps the same strike but moves to a later expiration. If you hold a $450 SPY call expiring this Friday and the trade is working but needs more time, you close the Friday $450 call and open the $450 call expiring in two weeks. This costs additional premium (the new option costs more than the old one is worth) but gives you more time for the thesis to play out. A **roll up** closes your current call and opens a higher-strike call at the same expiration. You do this when the stock has moved in your favor and you want to lock in some profit while maintaining upside exposure. A **roll up and out** combines both—moving to a higher strike AND a later expiration—and is the most common roll for profitable swing trades.\n\nKnowing **when to roll** is as important as knowing how. Roll when your original thesis is still intact but your timeline was off. If you bought calls because SPY was setting up a breakout above $450 and it''s now consolidating at $449 with 5 days left to expiration, the thesis is alive but time is running out—roll out to buy more time. Roll when your trade is profitable and you want to **reduce risk while staying in the trade**. If your $440 calls are now deep in the money with SPY at $455, roll up to the $450 calls: you book profit on the $440 calls and the $450 calls cost less, so you free up capital and reduce your dollar risk. Do NOT roll when the original thesis is broken. If you bought calls expecting a bounce off support and support has broken, rolling is just throwing good money after bad.\n\nThe **cost of rolling** matters enormously. When you roll out, you typically pay a net debit because the longer-dated option costs more. When you roll up in a profitable trade, you might actually receive a net credit because you''re selling an expensive ITM option and buying a cheaper ATM or OTM option. Always calculate the net cost before rolling. If rolling out costs $1.50 per contract and your expected additional profit from the extended trade is only $1.00, the roll has negative expected value—you''re better off closing the trade entirely.\n\nA practical rolling workflow for swing trades: (1) With 7-10 days to expiration, evaluate whether your thesis is still valid. (2) If yes and the trade is profitable, consider rolling up and out to lock in gains and extend exposure. (3) If yes but the trade is flat or slightly losing, consider rolling out only to buy time. (4) If no—the technical setup has broken down—close the position and do not roll. (5) Always compare the cost of the roll to the remaining profit potential. Rolling should improve your risk/reward ratio, not worsen it.',
  'text'::lesson_type,
  30,
  3,
  ARRAY[
    'Rolling means closing your current option and opening a new one at a different strike, expiration, or both—it is two trades, not one',
    'Roll out to buy more time, roll up to lock in profit, roll up and out to do both',
    'Only roll when your original thesis is intact—if the setup is broken, close the trade instead of rolling',
    'Always calculate the net cost of the roll and compare it to the remaining profit potential before executing'
  ],
  ARRAY[
    'When should I roll my options position versus just closing it?',
    'What is the difference between rolling out and rolling up?',
    'How do I calculate whether a roll is worth the cost?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What does it mean to roll an option?", "options": [{"id": "a", "text": "Exercise the option early"}, {"id": "b", "text": "Close your current position and simultaneously open a new one at a different strike or expiration"}, {"id": "c", "text": "Convert a call into a put"}, {"id": "d", "text": "Add more contracts to your existing position"}], "correct_answer": "b", "explanation": "Rolling involves two trades: closing your existing option position and opening a new one at a different strike price, different expiration date, or both. It allows you to adjust the trade without fully exiting the market."},
    {"id": "q2", "type": "multiple_choice", "text": "You hold a $450 SPY call expiring in 5 days. The setup is still valid but needs more time. What type of roll is appropriate?", "options": [{"id": "a", "text": "Roll up to a $460 call at the same expiration"}, {"id": "b", "text": "Roll out to a $450 call at a later expiration"}, {"id": "c", "text": "Roll down to a $440 call"}, {"id": "d", "text": "Close the position and buy puts instead"}], "correct_answer": "b", "explanation": "A roll out (rolling forward) keeps the same strike but extends to a later expiration. This is appropriate when your directional thesis is still valid but the position needs more time to play out."},
    {"id": "q3", "type": "multiple_choice", "text": "When should you NOT roll an options position?", "options": [{"id": "a", "text": "When the trade is profitable and you want to stay in"}, {"id": "b", "text": "When your original thesis is still intact but time is running short"}, {"id": "c", "text": "When the technical setup has broken down and the thesis is invalidated"}, {"id": "d", "text": "When you want to reduce risk by moving to a higher strike"}], "correct_answer": "c", "explanation": "Rolling should only be done when your original thesis is still valid. If the technical setup has broken down—for example, support has failed—rolling simply adds more cost to a losing trade. The correct action is to close the position and accept the loss."},
    {"id": "q4", "type": "multiple_choice", "text": "You roll your $440 calls up to $450 calls when SPY is at $455. What is the likely financial result?", "options": [{"id": "a", "text": "You pay a large debit because higher strikes cost more"}, {"id": "b", "text": "You receive a net credit because you sell expensive ITM calls and buy cheaper ATM calls"}, {"id": "c", "text": "There is no cost to rolling up"}, {"id": "d", "text": "Rolling up always results in a loss"}], "correct_answer": "b", "explanation": "When rolling up from deep ITM calls ($440 with SPY at $455 = $15+ intrinsic) to ATM calls ($450 = $5 intrinsic plus premium), you sell the more expensive option and buy the cheaper one, typically resulting in a net credit. This locks in some profit while maintaining exposure."},
    {"id": "q5", "type": "multiple_choice", "text": "Rolling out to a later expiration typically requires:", "options": [{"id": "a", "text": "A net credit because longer-dated options are cheaper"}, {"id": "b", "text": "A net debit because longer-dated options cost more due to additional time value"}, {"id": "c", "text": "No additional cost"}, {"id": "d", "text": "Selling additional contracts to cover the cost"}], "correct_answer": "b", "explanation": "Rolling out means closing a near-term option and opening a longer-dated one at the same strike. The longer-dated option has more time value and therefore costs more, requiring you to pay a net debit to execute the roll."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 10, Lesson 4
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c10_id,
  'Adjusting Positions Mid-Trade',
  'adjusting-positions-mid-trade',
  E'## Adjusting Positions Mid-Trade\n\nNo trade goes perfectly according to plan. The stock might move halfway to your target and stall, retrace briefly before continuing, or approach your stop level without triggering it. **Position adjustment** is the skill of modifying your options trade while it is live to improve your risk/reward, lock in partial profits, or adapt to changing market conditions—without completely closing the position. Adjusting is what separates reactive traders from proactive ones.\n\nThe most common adjustment is **taking partial profits**. If you hold 5 contracts of the $450 SPY call and SPY reaches your first target at $455, you might close 2-3 contracts to lock in gains and let the remaining contracts run toward a higher target. This reduces your risk to the remaining position while guaranteeing some realized profit. A variation is the **free trade**: if you bought 4 contracts at $3.00 each ($1,200 total) and SPY moves enough that each contract is now worth $6.00, selling 2 contracts recovers your entire $1,200 cost basis. The remaining 2 contracts are now a "free trade" with zero risk to your original capital.\n\nAnother powerful adjustment is **adding a short leg to create a spread**. Suppose you bought a $450 call at $5.00 and SPY has rallied to $458, making your call worth $10.00. You''re worried about a pullback but don''t want to close entirely. You can sell a $465 call for $3.00, converting your naked long call into a bull call spread. You''ve collected $3.00 in premium, reducing your net cost from $5.00 to $2.00 and capping your maximum risk at $2.00 per share. The trade-off is that your upside is now capped at $465, but you''ve locked in a minimum profit and dramatically reduced your downside risk. This is one of the most practical adjustments in swing trading.\n\nAdjusting also includes **widening or narrowing stops** based on new information. If you entered a bullish trade and the stock pulls back to a support level you didn''t initially identify, you might tighten your stop to just below that new support. If the stock is consolidating in a tight range before what appears to be a continuation breakout, you might give the position more room rather than getting stopped out by noise. The key principle is that adjustments should be based on new market structure information, not on emotions or P&L anxiety.\n\n**Scaling into a position** is another form of adjustment. Rather than buying your full position at once, you can enter with half the intended size and add the rest when the trade confirms your thesis. For instance, if you plan to buy 6 contracts of a call option on a pullback to the 50-day SMA, buy 3 contracts when price touches the SMA and add 3 more if price bounces and breaks above the prior day''s high. This approach gives you a better average entry price if the stock continues lower but still gives you meaningful exposure if it bounces immediately.\n\nThe golden rule of mid-trade adjustments is: **every adjustment should improve your risk/reward ratio**. If taking partial profits, you should be locking in gains while leaving room for more upside. If adding a short leg, the premium collected should meaningfully reduce your cost basis. If tightening a stop, the new level should be technically justified. Never adjust out of fear or greed—adjust because the market has given you new information that makes the adjustment rational.',
  'text'::lesson_type,
  25,
  4,
  ARRAY[
    'Taking partial profits locks in gains while leaving room for further upside with the remaining position',
    'Selling a call against your long call converts it to a spread, reducing cost basis and capping risk',
    'The free trade technique involves selling enough contracts to recover your cost basis so remaining contracts carry zero risk',
    'Every adjustment should improve your risk/reward ratio based on new market information, not emotions'
  ],
  ARRAY[
    'How do I take partial profits on a multi-contract position?',
    'What is a free trade and how do I set one up?',
    'When should I add a short leg to my long calls?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "You bought 4 call contracts at $3.00 each ($1,200 total). They are now worth $6.00 each. How do you create a free trade?", "options": [{"id": "a", "text": "Sell all 4 contracts for $2,400 profit"}, {"id": "b", "text": "Sell 2 contracts for $1,200, recovering your cost basis, and hold the remaining 2 risk-free"}, {"id": "c", "text": "Buy 4 more contracts at $6.00"}, {"id": "d", "text": "Roll all contracts to a higher strike"}], "correct_answer": "b", "explanation": "Selling 2 contracts at $6.00 each generates $1,200, which exactly recovers your total cost basis. The remaining 2 contracts cost you nothing out of pocket, making them a free trade—any further gains are pure profit with zero capital at risk."},
    {"id": "q2", "type": "multiple_choice", "text": "You hold a long $450 call at $5.00. SPY rallies to $458. You sell a $465 call for $3.00. What is your new net cost?", "options": [{"id": "a", "text": "$5.00"}, {"id": "b", "text": "$2.00"}, {"id": "c", "text": "$8.00"}, {"id": "d", "text": "$3.00"}], "correct_answer": "b", "explanation": "Your original cost was $5.00 for the long call. By selling the $465 call for $3.00, you reduce your net cost to $5.00 - $3.00 = $2.00 per share. You now have a $450/$465 bull call spread with a maximum risk of $2.00 and maximum profit of $13.00 ($15 spread width minus $2 cost)."},
    {"id": "q3", "type": "multiple_choice", "text": "What is the golden rule of mid-trade adjustments?", "options": [{"id": "a", "text": "Adjust whenever you feel nervous"}, {"id": "b", "text": "Never adjust—always hold to expiration"}, {"id": "c", "text": "Every adjustment should improve your risk/reward ratio based on new market information"}, {"id": "d", "text": "Only adjust losing trades, never winning trades"}], "correct_answer": "c", "explanation": "Adjustments should be rational and based on new information the market has provided, not on emotions. Each adjustment should objectively improve your risk/reward ratio—either by reducing risk, increasing potential reward, or both."},
    {"id": "q4", "type": "multiple_choice", "text": "What is the benefit of scaling into a position rather than entering all at once?", "options": [{"id": "a", "text": "You pay lower commissions"}, {"id": "b", "text": "You get a better average entry if the stock continues lower while still having exposure if it bounces immediately"}, {"id": "c", "text": "It eliminates all risk from the trade"}, {"id": "d", "text": "Scaling in is only useful for stock positions, not options"}], "correct_answer": "b", "explanation": "By entering half your position initially and adding the rest on confirmation, you improve your average entry if the stock dips further. If it bounces immediately, you still have meaningful exposure. This approach balances the risk of missing the move against the risk of poor entry timing."},
    {"id": "q5", "type": "multiple_choice", "text": "When should you tighten your stop on a swing trade?", "options": [{"id": "a", "text": "Whenever you are losing money"}, {"id": "b", "text": "When new market structure (like a newly identified support level) provides a technically justified closer stop"}, {"id": "c", "text": "Every day automatically"}, {"id": "d", "text": "Only after the stock hits your profit target"}], "correct_answer": "b", "explanation": "Stops should be adjusted based on new technical information, not arbitrary rules or emotional reactions. If the market reveals a new support level closer to current price, tightening your stop to just below that level is a rational adjustment based on market structure."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 10, Lesson 5
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c10_id,
  'Event Risk: Earnings, FOMC, CPI',
  'event-risk-earnings-fomc-cpi',
  E'## Event Risk: Earnings, FOMC, CPI\n\nScheduled events create some of the largest single-day moves in the market, and understanding how to navigate them is essential for swing traders. The three most impactful recurring events are **earnings announcements** (company-specific), **Federal Reserve (FOMC) meetings** (8 per year), and **Consumer Price Index (CPI) releases** (monthly). Each of these events can cause violent price moves and dramatic changes in implied volatility, creating both enormous opportunity and significant danger for options positions.\n\n**Earnings announcements** are the most common event risk for individual stock swing trades. Companies report quarterly earnings before the market opens or after it closes, and the stock can gap 5-15% or more in either direction. The critical concept for options traders is **implied volatility crush (IV crush)**. In the weeks before earnings, implied volatility rises as the market prices in the expected move. The moment earnings are reported and the uncertainty is resolved, IV collapses—often by 30-50% overnight. This means even if you correctly predict the direction, your option can still lose money if the move is smaller than what was priced in. If NFLX options imply a 10% earnings move and NFLX only moves 5% in your direction, your long calls could lose value despite being right on direction because the IV crush overwhelms the directional gain.\n\n**FOMC meetings** affect the entire market because the Federal Reserve sets interest rate policy and provides forward guidance on the economy. Rate decisions and the Fed Chair''s press conference can cause SPY to move 1-3% in minutes, with the move sometimes reversing intraday. For swing traders, FOMC events are tricky because they create short-term volatility that often reverses. A common pattern is a sharp move on the announcement followed by a counter-move during the press conference. The safest approach for swing traders is to **reduce position size before FOMC** or close directional trades entirely. If you must hold, use defined-risk spreads.\n\n**CPI (Consumer Price Index)** releases have become increasingly impactful because inflation drives Fed policy, which drives the entire market. CPI is released monthly at 8:30 AM ET, and the data can cause SPY to gap 1-2% at the open. A hotter-than-expected CPI reading (higher inflation) is bearish because it suggests the Fed will keep rates higher for longer. A cooler-than-expected reading is bullish because it suggests the Fed may cut rates sooner. For options traders, the key is knowing **when CPI is released relative to your position''s expiration**. If your options expire the same week as CPI, the event will dominate your outcome.\n\nPractical rules for managing event risk in swing trades: **Rule 1: Know the calendar.** Before entering any swing trade, check the earnings date for the underlying stock and the macro calendar for FOMC and CPI dates. **Rule 2: Decide before the event, not during.** Establish your plan for each scenario (beat, miss, or in-line) before the data is released. **Rule 3: If you intentionally hold through an event, use defined-risk strategies.** Spreads, butterflies, and iron condors cap your maximum loss regardless of how large the gap is. **Rule 4: Respect IV crush.** If you want to trade an earnings move, consider selling premium rather than buying it, or use strategies where IV crush works in your favor (short strangles, iron condors). **Rule 5: Size down.** If you must hold through an event, cut your position size by 50-75% to account for the outsized risk.\n\nThe most disciplined swing traders simply avoid events. They close positions 1-2 days before earnings, FOMC, or CPI and re-enter afterward when the dust settles. This approach sacrifices some potential gains but eliminates the binary, coin-flip nature of event trading. Preservation of capital is the foundation of long-term swing trading success.',
  'text'::lesson_type,
  30,
  5,
  ARRAY[
    'IV crush after earnings can cause options to lose value even when you predict the correct direction if the move is smaller than implied',
    'FOMC decisions often create volatile whipsaws—reduce size or close directional trades before the announcement',
    'CPI releases move the entire market: hotter than expected is bearish (rates stay high) and cooler than expected is bullish',
    'The safest approach is to close swing trades before major events and re-enter after the dust settles'
  ],
  ARRAY[
    'What is IV crush and how does it affect my earnings trade?',
    'Should I hold my swing trade through an FOMC meeting?',
    'How do I check the economic calendar before placing a trade?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What is implied volatility (IV) crush?", "options": [{"id": "a", "text": "A sudden increase in implied volatility before earnings"}, {"id": "b", "text": "A sharp collapse in implied volatility after an event resolves, often by 30-50%"}, {"id": "c", "text": "A gradual decline in stock price"}, {"id": "d", "text": "A strategy for buying options before earnings"}], "correct_answer": "b", "explanation": "IV crush occurs when implied volatility drops sharply after an event (like earnings) resolves the uncertainty. IV can drop 30-50% overnight, causing options to lose significant extrinsic value even if the stock moves in the expected direction."},
    {"id": "q2", "type": "multiple_choice", "text": "NFLX options imply a 10% earnings move. NFLX beats earnings and moves up 5%. What likely happens to your long calls?", "options": [{"id": "a", "text": "They gain significant value from the 5% move"}, {"id": "b", "text": "They may lose value because the 5% move is less than the 10% implied, and IV crush overwhelms the directional gain"}, {"id": "c", "text": "They are unaffected by IV crush"}, {"id": "d", "text": "They automatically exercise"}], "correct_answer": "b", "explanation": "When the actual move (5%) is smaller than the implied move (10%), the IV crush on the option premium typically exceeds the gain from the directional move. The option was priced for a larger move, so the resolution of uncertainty destroys more value than the actual move creates."},
    {"id": "q3", "type": "multiple_choice", "text": "A CPI report comes in hotter than expected (higher inflation). What is the likely market reaction?", "options": [{"id": "a", "text": "Bullish because higher prices mean higher earnings"}, {"id": "b", "text": "Bearish because it suggests the Fed will keep interest rates higher for longer"}, {"id": "c", "text": "No reaction because CPI does not affect stocks"}, {"id": "d", "text": "Bullish because inflation helps all companies equally"}], "correct_answer": "b", "explanation": "Higher-than-expected CPI (inflation) is bearish for markets because it signals the Federal Reserve will likely maintain or increase interest rates, which raises borrowing costs, reduces corporate earnings, and makes bonds relatively more attractive than stocks."},
    {"id": "q4", "type": "multiple_choice", "text": "What is the safest way to handle a swing trade when FOMC is scheduled during your holding period?", "options": [{"id": "a", "text": "Double your position to profit from the volatility"}, {"id": "b", "text": "Reduce position size, use defined-risk spreads, or close entirely before the meeting"}, {"id": "c", "text": "Switch from calls to puts right before the announcement"}, {"id": "d", "text": "FOMC meetings do not affect options positions"}], "correct_answer": "b", "explanation": "FOMC meetings can cause violent, whipsaw price action. The safest approaches are reducing position size (50-75%), using defined-risk spreads to cap maximum loss, or closing directional trades before the meeting and re-entering afterward."},
    {"id": "q5", "type": "multiple_choice", "text": "Before entering any swing trade, what calendar items should you check?", "options": [{"id": "a", "text": "Only the stock earnings date"}, {"id": "b", "text": "Earnings date for the stock, plus FOMC and CPI dates on the macro calendar"}, {"id": "c", "text": "Only the options expiration date"}, {"id": "d", "text": "Calendar items are not relevant to swing trading"}], "correct_answer": "b", "explanation": "A complete pre-trade checklist includes the company earnings date, FOMC meeting dates, CPI release dates, and any other major scheduled events. These events can dominate your trade outcome and should be factored into your strike, expiration, and position size decisions."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- COURSE 11: Swing Trading with Spreads
-- ============================================================

INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Swing Trading with Spreads',
  'swing-trading-with-spreads',
  'Level up from single legs to vertical, diagonal, and calendar spreads for swing trades. Reduce cost basis and define risk with multi-leg strategies.',
  'advanced'::difficulty_level,
  10,
  70,
  'pro',
  true,
  11
)
RETURNING id INTO v_c11_id;

UPDATE courses SET learning_path_id = v_path3_id WHERE id = v_c11_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path3_id, v_c11_id, 3);

-- Course 11, Lesson 1
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c11_id,
  'Vertical Spreads: Bull Call & Bear Put',
  'vertical-spreads-bull-call-and-bear-put',
  E'## Vertical Spreads: Bull Call & Bear Put\n\nVertical spreads are the foundation of multi-leg options strategies and the most natural next step for swing traders graduating from single-leg calls and puts. A vertical spread involves buying one option and selling another option of the **same type** (both calls or both puts), at **different strike prices**, with the **same expiration date**. The term "vertical" comes from the options chain layout where different strikes are listed vertically. These spreads define your maximum risk and maximum reward upfront, making them ideal for disciplined swing trading.\n\nA **bull call spread** is constructed by buying a lower-strike call and selling a higher-strike call at the same expiration. For example, if SPY is at $450 and you are bullish, you might buy the $450 call for $6.00 and sell the $455 call for $3.50. Your net cost (maximum risk) is $2.50 per share ($250 per contract). Your maximum profit is the width of the strikes minus your cost: $5.00 - $2.50 = $2.50 per share ($250 per contract). This occurs when SPY is at or above $455 at expiration. The breakeven point is the long strike plus the net debit: $450 + $2.50 = $452.50. Compared to buying the $450 call outright for $6.00, the bull call spread costs 58% less—but your upside is capped at $455.\n\nA **bear put spread** is the mirror image for bearish setups. You buy a higher-strike put and sell a lower-strike put at the same expiration. If SPY is at $450 and you expect a decline, you might buy the $450 put for $5.50 and sell the $445 put for $3.00. Your net cost is $2.50, maximum profit is $2.50, and breakeven is $447.50. The mechanics are identical to a bull call spread but in the opposite direction.\n\nThe advantages of vertical spreads for swing trading are significant. **Cost reduction**: the premium collected from the short leg reduces your net outlay, allowing you to take the same directional view for less capital. **Defined risk**: your maximum loss is the net debit paid, no matter how far the stock moves against you. **Reduced IV sensitivity**: because you are both long and short volatility, the net vega of the spread is lower than a single-leg option. This means IV crush (such as after earnings) hurts less. **Lower theta decay**: the short leg earns theta that partially offsets the long leg''s decay, reducing the daily cost of holding the position.\n\nThe primary trade-off is **capped upside**. If SPY rallies from $450 to $470, your bull call spread maxes out at $2.50 profit, while a naked long call would have captured the entire move. This is why strike selection matters enormously. Choose the short strike at a level the stock is likely to reach but unlikely to significantly exceed within your timeframe. If your technical analysis shows a measured move target of $458, sell the $460 call—the spread captures nearly all of the expected move while still giving you the cost and risk benefits. Use wider spreads (e.g., $10 wide) when you have a larger target and want more profit potential. Use narrower spreads ($2-$5 wide) when you want to reduce cost and are targeting a smaller move.',
  'text'::lesson_type,
  30,
  1,
  ARRAY[
    'A bull call spread is buying a lower-strike call and selling a higher-strike call at the same expiration—max risk is the net debit paid',
    'A bear put spread is buying a higher-strike put and selling a lower-strike put at the same expiration for bearish setups',
    'Vertical spreads reduce cost, define risk, lower IV sensitivity, and reduce theta decay compared to single-leg options',
    'Choose the short strike near your technical target to capture the expected move while benefiting from spread advantages'
  ],
  ARRAY[
    'How wide should I make my bull call spread?',
    'When is a bull call spread better than buying a naked call?',
    'How do I calculate the breakeven on a vertical spread?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "How is a bull call spread constructed?", "options": [{"id": "a", "text": "Buy a higher-strike call and sell a lower-strike call"}, {"id": "b", "text": "Buy a lower-strike call and sell a higher-strike call at the same expiration"}, {"id": "c", "text": "Buy a call and sell a put at the same strike"}, {"id": "d", "text": "Buy calls at two different expirations"}], "correct_answer": "b", "explanation": "A bull call spread is created by buying a lower-strike call and selling a higher-strike call at the same expiration. The long call provides the bullish exposure while the short call reduces cost and caps the maximum profit."},
    {"id": "q2", "type": "multiple_choice", "text": "You buy the $450 call for $6.00 and sell the $455 call for $3.50. What is your maximum profit?", "options": [{"id": "a", "text": "$6.00"}, {"id": "b", "text": "$3.50"}, {"id": "c", "text": "$2.50 (strike width $5.00 minus net cost $2.50)"}, {"id": "d", "text": "$5.00"}], "correct_answer": "c", "explanation": "Maximum profit on a bull call spread equals the width between strikes ($455 - $450 = $5.00) minus the net debit paid ($6.00 - $3.50 = $2.50). So max profit is $5.00 - $2.50 = $2.50 per share, achieved when the stock is at or above the short strike at expiration."},
    {"id": "q3", "type": "multiple_choice", "text": "What is the breakeven on a bull call spread with a $450 long call and $2.50 net debit?", "options": [{"id": "a", "text": "$450.00"}, {"id": "b", "text": "$452.50"}, {"id": "c", "text": "$455.00"}, {"id": "d", "text": "$447.50"}], "correct_answer": "b", "explanation": "The breakeven on a bull call spread equals the long strike plus the net debit paid: $450 + $2.50 = $452.50. The stock must rise above this level for the spread to be profitable at expiration."},
    {"id": "q4", "type": "multiple_choice", "text": "How is a bear put spread constructed?", "options": [{"id": "a", "text": "Buy a lower-strike put and sell a higher-strike put"}, {"id": "b", "text": "Buy a higher-strike put and sell a lower-strike put at the same expiration"}, {"id": "c", "text": "Buy a put and sell a call"}, {"id": "d", "text": "Sell two puts at different strikes"}], "correct_answer": "b", "explanation": "A bear put spread is built by buying a higher-strike put (more expensive, provides bearish exposure) and selling a lower-strike put (cheaper, reduces cost and caps profit). Both options share the same expiration date."},
    {"id": "q5", "type": "multiple_choice", "text": "What is the primary trade-off of using a vertical spread instead of a single-leg option?", "options": [{"id": "a", "text": "Vertical spreads have unlimited risk"}, {"id": "b", "text": "Your upside profit is capped at the short strike in exchange for lower cost and defined risk"}, {"id": "c", "text": "Vertical spreads cannot be used for swing trades"}, {"id": "d", "text": "Vertical spreads have higher theta decay than single legs"}], "correct_answer": "b", "explanation": "The main trade-off is capped upside: the short leg limits your maximum profit to the width of the strikes minus the debit paid. In exchange, you get significantly lower cost, defined maximum risk, reduced IV sensitivity, and lower theta decay."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 11, Lesson 2
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c11_id,
  'Credit Spreads for Swing Traders',
  'credit-spreads-for-swing-traders',
  E'## Credit Spreads for Swing Traders\n\nWhile debit spreads (like the bull call spread) require you to pay to enter, **credit spreads** pay you to enter. A credit spread is a vertical spread where you collect a net premium upfront by selling the more expensive option and buying a cheaper one as protection. The two primary credit spreads are the **bull put spread** (bullish) and the **bear call spread** (bearish). Credit spreads are powerful tools for swing traders because they profit from time decay and allow you to be profitable even when the stock doesn''t move—as long as it doesn''t move against you.\n\nA **bull put spread** is constructed by selling a higher-strike put and buying a lower-strike put at the same expiration. For example, if SPY is at $450 and you are bullish, you sell the $445 put for $3.00 and buy the $440 put for $1.50. You collect a net credit of $1.50 per share ($150 per contract). Your maximum profit is this $1.50 credit—you keep it in full if SPY stays above $445 at expiration. Your maximum risk is the width of the strikes minus the credit: $5.00 - $1.50 = $3.50 per share ($350 per contract). The breakeven is the short strike minus the credit: $445 - $1.50 = $443.50.\n\nA **bear call spread** is the bearish equivalent. You sell a lower-strike call and buy a higher-strike call. If SPY is at $450 and you expect it to stay below $455, you sell the $455 call for $2.50 and buy the $460 call for $1.00, collecting a $1.50 credit. Maximum profit is $1.50 if SPY stays below $455. Maximum risk is $3.50 if SPY rises above $460.\n\nCredit spreads excel in specific swing trading scenarios. **High IV environments**: when implied volatility is elevated, options premiums are fat. Selling credit spreads captures this inflated premium, and if IV contracts, the spread value decreases in your favor even without a directional move. **Range-bound markets**: if your technical analysis suggests SPY will stay between $440 and $460 for the next two weeks, sell a bull put spread below support ($438/$433) and/or a bear call spread above resistance ($462/$467). Both spreads profit from the stock staying in the range. **Post-event plays**: after earnings or FOMC when IV has already crushed, credit spreads at nearby strikes can capture continued premium decay.\n\nThe risk management framework for credit spreads differs from debit spreads. With debit spreads, your risk is paid upfront and the trade either works or you lose your debit. With credit spreads, **the premium is your profit potential but the risk is larger**. A typical credit spread might risk $3.50 to make $1.50—a 2.3:1 risk-to-reward ratio. This means your win rate must be high enough to compensate. A common guideline is to exit a credit spread at a loss equal to 2x the credit received. If you collected $1.50, close the spread if the loss reaches $3.00 rather than waiting for maximum loss. Additionally, consider closing credit spreads early when you''ve captured 50-70% of the maximum profit—taking the $1.00 out of $1.50 and eliminating the remaining risk is often the optimal play.\n\nTiming credit spreads with technical analysis means selling into strength for bull put spreads and selling into weakness for bear call spreads. Place the short strike of your bull put spread below a strong support level—this way, support must break before your spread is threatened. Place the short strike of your bear call spread above strong resistance. The technical level acts as a buffer between the current price and your short strike, improving the probability that the spread expires worthless (maximum profit).',
  'text'::lesson_type,
  30,
  2,
  ARRAY[
    'Bull put spreads (sell higher put, buy lower put) profit if the stock stays above the short strike—you collect premium upfront',
    'Bear call spreads (sell lower call, buy higher call) profit if the stock stays below the short strike',
    'Credit spreads excel in high IV environments, range-bound markets, and post-event situations',
    'Close credit spreads at 50-70% of max profit or when the loss reaches 2x the credit received'
  ],
  ARRAY[
    'When should I use a credit spread versus a debit spread?',
    'How do I pick the right strikes for a bull put spread?',
    'What is the best time to close a credit spread for profit?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "How is a bull put spread constructed?", "options": [{"id": "a", "text": "Buy a higher-strike put and sell a lower-strike put"}, {"id": "b", "text": "Sell a higher-strike put and buy a lower-strike put at the same expiration"}, {"id": "c", "text": "Buy a call and sell a put"}, {"id": "d", "text": "Sell two puts at the same strike"}], "correct_answer": "b", "explanation": "A bull put spread is created by selling a higher-strike put (collecting more premium) and buying a lower-strike put (paying less premium) at the same expiration. The net result is a credit received, which is your maximum profit."},
    {"id": "q2", "type": "multiple_choice", "text": "You sell a $445 put for $3.00 and buy a $440 put for $1.50. What is your maximum risk?", "options": [{"id": "a", "text": "$1.50"}, {"id": "b", "text": "$3.00"}, {"id": "c", "text": "$3.50 (strike width $5.00 minus credit $1.50)"}, {"id": "d", "text": "$5.00"}], "correct_answer": "c", "explanation": "Maximum risk on a credit spread equals the width between strikes ($445 - $440 = $5.00) minus the net credit received ($3.00 - $1.50 = $1.50). So max risk is $5.00 - $1.50 = $3.50 per share, occurring if the stock falls below both strikes at expiration."},
    {"id": "q3", "type": "multiple_choice", "text": "Why do credit spreads perform well in high implied volatility environments?", "options": [{"id": "a", "text": "High IV makes options cheaper to sell"}, {"id": "b", "text": "High IV inflates premiums, allowing you to collect more credit, and IV contraction further helps the spread"}, {"id": "c", "text": "High IV eliminates all risk"}, {"id": "d", "text": "Credit spreads do not benefit from high IV"}], "correct_answer": "b", "explanation": "When IV is elevated, option premiums are inflated. Credit spreads collect this inflated premium upfront. If IV subsequently contracts, the sold options lose value faster, allowing you to close the spread for less than you collected—profiting from both theta decay and IV contraction."},
    {"id": "q4", "type": "multiple_choice", "text": "You collected $1.50 credit on a bull put spread. When should you consider closing it for a profit?", "options": [{"id": "a", "text": "Only at expiration for maximum profit"}, {"id": "b", "text": "When you have captured 50-70% of the maximum profit ($0.75-$1.05)"}, {"id": "c", "text": "Immediately after entering to lock in the credit"}, {"id": "d", "text": "Credit spreads cannot be closed early"}], "correct_answer": "b", "explanation": "Closing at 50-70% of max profit is a widely recommended practice. If you collected $1.50, closing when you can buy the spread back for $0.45-$0.75 locks in most of the profit while eliminating the remaining risk. Holding for the last 30-50% of profit exposes you to diminishing returns and potential reversal."},
    {"id": "q5", "type": "multiple_choice", "text": "Where should you place the short strike of a bull put spread relative to technical levels?", "options": [{"id": "a", "text": "Above the current stock price"}, {"id": "b", "text": "Below a strong support level so support must break before the spread is threatened"}, {"id": "c", "text": "At the exact support level"}, {"id": "d", "text": "Technical levels are irrelevant for credit spreads"}], "correct_answer": "b", "explanation": "Placing the short put strike below a strong support level creates a technical buffer. The stock would need to break through support before threatening your spread, increasing the probability that the spread expires worthless for maximum profit."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 11, Lesson 3
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c11_id,
  'Calendar Spreads: Trading Time Decay',
  'calendar-spreads-trading-time-decay',
  E'## Calendar Spreads: Trading Time Decay\n\nA calendar spread (also known as a time spread or horizontal spread) is a strategy that profits from the different rates of time decay between two options at the **same strike price** but with **different expiration dates**. The standard calendar spread involves **selling the front-month (near-term) option and buying the back-month (longer-term) option** at the same strike. Because the front-month option decays faster than the back-month, the spread widens over time as the short option loses value more rapidly than the long option.\n\nHere is a concrete example. Suppose SPY is trading at $450 and you expect it to stay near this level for the next two weeks. You sell the 14-day $450 call for $4.00 and buy the 45-day $450 call for $7.00. Your net debit is $3.00. Over the next two weeks, the short 14-day call decays rapidly—after 10 days, it might be worth only $1.50 (lost $2.50). Meanwhile, the long 45-day call, now a 35-day option, might be worth $5.80 (lost only $1.20). The spread has widened from $3.00 to $4.30 ($5.80 - $1.50), giving you a $1.30 profit. The key is that both options lost value, but the short option lost more.\n\nCalendar spreads are ideal for **consolidating markets** where your technical analysis suggests the stock will trade sideways near a specific price. They profit most when the stock stays near the strike price because that is where the front-month option experiences maximum theta decay. The position has a characteristic tent-shaped profit diagram at expiration of the front month: maximum profit at the strike price, with losses increasing as the stock moves further away in either direction. For swing traders, this means calendar spreads are a bet on **location** (where the stock will be) rather than **direction** (which way it will move).\n\nThe **Greeks of a calendar spread** are instructive. Theta is typically positive—you earn money from time passing, which is the core thesis. Delta is near zero when the stock is at the strike, making it a neutral position. However, **vega is positive and significant**. This means the spread benefits when implied volatility increases and suffers when IV decreases. This vega exposure is critical: if you enter a calendar spread and IV drops sharply (such as after earnings), both options lose extrinsic value, but the back-month option with more vega exposure loses more, and the spread can narrow even if the stock stays at your strike. For this reason, **avoid entering calendar spreads just before IV-crushing events**. The best time to enter is when IV is relatively low and you expect it to remain stable or increase.\n\nManaging a calendar spread requires monitoring two key factors: **where the stock is relative to the strike** and **how much time remains on the front-month option**. If the stock moves significantly away from your strike, the spread loses value because the front-month option is no longer decaying at maximum speed. You should close or adjust if the stock moves more than one strike width away. As the front-month option approaches expiration, you have two choices: close the entire spread (taking profit or loss) or close only the front-month short option and keep the back-month long option as a directional play. This flexibility is one of the calendar spread''s greatest advantages.',
  'text'::lesson_type,
  30,
  3,
  ARRAY[
    'A calendar spread sells the front-month option and buys the back-month option at the same strike, profiting from differential time decay',
    'Maximum profit occurs when the stock stays near the strike price where front-month theta decay is highest',
    'Calendar spreads have positive vega—they benefit from rising IV and suffer from IV crush, so avoid entering before earnings',
    'Close or adjust the spread if the stock moves more than one strike width away from your chosen strike'
  ],
  ARRAY[
    'How does a calendar spread profit from time decay?',
    'When is the best time to enter a calendar spread?',
    'What happens to my calendar spread if the stock moves away from the strike?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "How is a standard calendar spread constructed?", "options": [{"id": "a", "text": "Buy the front-month option and sell the back-month option at the same strike"}, {"id": "b", "text": "Sell the front-month option and buy the back-month option at the same strike"}, {"id": "c", "text": "Buy and sell options at different strikes with the same expiration"}, {"id": "d", "text": "Buy two options at the same strike and expiration"}], "correct_answer": "b", "explanation": "A calendar spread sells the near-term (front-month) option and buys the longer-term (back-month) option at the same strike price. The front-month option decays faster, widening the spread over time."},
    {"id": "q2", "type": "multiple_choice", "text": "Where does a calendar spread achieve maximum profit?", "options": [{"id": "a", "text": "When the stock rallies significantly above the strike"}, {"id": "b", "text": "When the stock drops significantly below the strike"}, {"id": "c", "text": "When the stock stays near the strike price at front-month expiration"}, {"id": "d", "text": "When the stock moves in any direction"}], "correct_answer": "c", "explanation": "Calendar spreads have a tent-shaped profit diagram with maximum profit at the strike price. At that point, the front-month option experiences maximum theta decay while the back-month option retains significant time value, creating the widest spread."},
    {"id": "q3", "type": "multiple_choice", "text": "Calendar spreads have positive vega. What does this mean practically?", "options": [{"id": "a", "text": "The spread benefits from time decay"}, {"id": "b", "text": "The spread benefits from rising implied volatility and suffers from IV crush"}, {"id": "c", "text": "The spread is immune to volatility changes"}, {"id": "d", "text": "The spread profits from falling implied volatility"}], "correct_answer": "b", "explanation": "Positive vega means the spread gains value when IV increases and loses value when IV decreases. Because the back-month option has more vega exposure, an IV drop hurts the long option more than it helps the short option, narrowing the spread."},
    {"id": "q4", "type": "multiple_choice", "text": "Why should you avoid entering a calendar spread just before earnings?", "options": [{"id": "a", "text": "Earnings always cause the stock to gap past your strike"}, {"id": "b", "text": "The post-earnings IV crush reduces the value of the back-month option disproportionately due to positive vega exposure"}, {"id": "c", "text": "Calendar spreads cannot be held through earnings"}, {"id": "d", "text": "Commissions are higher during earnings"}], "correct_answer": "b", "explanation": "Calendar spreads have positive vega, so the IV crush after earnings causes the longer-dated back-month option (with higher vega) to lose more value than the front-month option. This narrows the spread and can cause a loss even if the stock stays at your strike."},
    {"id": "q5", "type": "multiple_choice", "text": "The stock has moved significantly away from your calendar spread strike. What should you do?", "options": [{"id": "a", "text": "Hold and hope it comes back"}, {"id": "b", "text": "Close or adjust the spread, as it loses value when the stock moves more than one strike width away"}, {"id": "c", "text": "Double the position size"}, {"id": "d", "text": "Convert it to a vertical spread"}], "correct_answer": "b", "explanation": "Calendar spreads profit when the stock stays near the strike. When price moves more than one strike width away, the front-month option is no longer decaying at its maximum rate, and the spread narrows. Closing or adjusting at that point limits further losses."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 11, Lesson 4
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c11_id,
  'Diagonal Spreads: The Best of Both Worlds',
  'diagonal-spreads-the-best-of-both-worlds',
  E'## Diagonal Spreads: The Best of Both Worlds\n\nA diagonal spread combines elements of both vertical and calendar spreads by using options with **different strike prices AND different expiration dates**. The most common version for swing traders is the **long call diagonal**: buy a longer-dated, lower-strike call (your anchor) and sell a shorter-dated, higher-strike call (your income generator). This structure gives you directional exposure from the long call, time-decay income from the short call, and the flexibility to sell multiple short-term options against your longer-dated position over time.\n\nHere is a practical example. Suppose AAPL is at $185 and you are moderately bullish over the next 4-6 weeks. You buy the 45-day $180 call for $8.00 (slightly in the money, delta ~0.65) and sell the 14-day $190 call for $2.00 (out of the money). Your net debit is $6.00. If AAPL stays below $190 over the next 14 days, the short call expires worthless and you keep the $2.00 credit, reducing your effective cost to $4.00. You can then sell another 14-day call against your position—perhaps the $192 call if AAPL has risen—collecting additional premium. This ability to **sell multiple rounds of short-term options** against one long-term position is the core advantage of diagonal spreads.\n\nDiagonals differ from calendar spreads in an important way: because the strikes are different, diagonals have a **directional bias**. A long call diagonal (long lower-strike, short higher-strike) is bullish. The long call''s delta is higher than the short call''s delta, giving you net positive delta—you profit as the stock rises. However, you don''t want the stock to rise too fast or too far. If AAPL jumps to $195 before the short call expires, your short $190 call is now $5 in the money and you face assignment risk. The ideal scenario is a gradual grind higher—AAPL drifts toward $190 over two weeks, the short call expires near the money (maximum decay), and you sell another short-term call at a higher strike.\n\nThe **risk profile** of a diagonal spread has two scenarios to manage. If the stock drops significantly, both options lose value, but your maximum loss is limited to the net debit paid ($6.00 in our example). If the stock rises sharply above the short strike, your profit is capped similarly to a vertical spread at the short call''s expiration. The worst-case scenario is a massive gap up that puts the short call deep in the money—you would need to close or roll the short call, potentially at a loss on that leg, though the long call would also have significant gains.\n\nBest practices for diagonal spreads in swing trading: **Buy the long leg with 30-60 days to expiration** in the money or at the money for solid delta exposure. **Sell the short leg with 7-21 days to expiration** out of the money near a resistance level. **Aim to sell 2-3 rounds of short calls** against the long position to reduce cost basis substantially or even below zero. **Close the entire position when your directional thesis completes** or when the long option reaches 21 days to expiration (to avoid the theta acceleration zone on your own long leg). Diagonal spreads require more active management than simple verticals, but they reward attentive swing traders with superior risk-adjusted returns.',
  'text'::lesson_type,
  25,
  4,
  ARRAY[
    'A diagonal spread uses different strikes AND different expirations—typically buying a longer-dated lower strike and selling a shorter-dated higher strike',
    'The core advantage is selling multiple rounds of short-term options against one longer-dated position to repeatedly reduce cost basis',
    'Diagonals have a directional bias unlike calendar spreads and profit from a gradual move toward the short strike',
    'Buy the long leg with 30-60 DTE in or at the money; sell the short leg with 7-21 DTE out of the money near resistance'
  ],
  ARRAY[
    'How is a diagonal spread different from a calendar spread?',
    'How many times can I sell short-term options against my long leg?',
    'What happens if the stock moves too far past my short strike?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "What defines a diagonal spread?", "options": [{"id": "a", "text": "Same strike, different expirations"}, {"id": "b", "text": "Different strikes, same expiration"}, {"id": "c", "text": "Different strikes AND different expirations"}, {"id": "d", "text": "Same strike, same expiration, different quantities"}], "correct_answer": "c", "explanation": "A diagonal spread is distinguished by using options with both different strike prices and different expiration dates. This combines the directional element of a vertical spread with the time-decay element of a calendar spread."},
    {"id": "q2", "type": "multiple_choice", "text": "You buy a 45-day $180 call for $8.00 and sell a 14-day $190 call for $2.00. The short call expires worthless. What is your new effective cost?", "options": [{"id": "a", "text": "$8.00"}, {"id": "b", "text": "$6.00"}, {"id": "c", "text": "$4.00 (the $8.00 long call reduced by $2.00 expired short call and originally paid $6.00 net, now effectively $4.00 with the $2.00 credit realized)"}, {"id": "d", "text": "$2.00"}], "correct_answer": "c", "explanation": "You originally paid a net debit of $6.00 ($8.00 - $2.00). When the short call expires worthless, you keep the $2.00 credit, reducing your effective cost on the long call to $8.00 - $2.00 = $6.00 net, which is now just the long call at an effective cost of $6.00 minus the realized $2.00 = $4.00 remaining risk if you can sell another round."},
    {"id": "q3", "type": "multiple_choice", "text": "What is the ideal price movement for a long call diagonal spread?", "options": [{"id": "a", "text": "A sharp gap up above the short strike"}, {"id": "b", "text": "A gradual grind higher toward the short strike over the short option life"}, {"id": "c", "text": "A sharp drop below the long strike"}, {"id": "d", "text": "No movement at all"}], "correct_answer": "b", "explanation": "The ideal scenario for a long call diagonal is a gradual move toward the short strike. This allows the short option to experience maximum time decay while the long option gains from delta. A slow approach to the short strike is better than a sharp gap through it."},
    {"id": "q4", "type": "multiple_choice", "text": "What is the core advantage of a diagonal spread over a simple vertical spread?", "options": [{"id": "a", "text": "Lower commissions"}, {"id": "b", "text": "The ability to sell multiple rounds of short-term options against the longer-dated long position"}, {"id": "c", "text": "Diagonal spreads have no risk"}, {"id": "d", "text": "Diagonal spreads require less capital"}], "correct_answer": "b", "explanation": "The key advantage is that after the first short option expires or is closed, you can sell another short-term option against the same long position. This allows you to collect premium multiple times, potentially reducing your cost basis to zero or even generating a net credit."},
    {"id": "q5", "type": "multiple_choice", "text": "When should you close the entire diagonal spread position?", "options": [{"id": "a", "text": "Only at expiration of the long leg"}, {"id": "b", "text": "When your directional thesis completes or when the long option reaches about 21 days to expiration"}, {"id": "c", "text": "After selling exactly one round of short options"}, {"id": "d", "text": "Diagonal spreads should be held indefinitely"}], "correct_answer": "b", "explanation": "Close when the thesis is fulfilled or when the long option reaches approximately 21 days to expiration. Beyond that point, theta accelerates on your long leg, and the time-decay advantage of the diagonal structure diminishes significantly."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- Course 11, Lesson 5
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, key_takeaways, ai_tutor_chips, quiz_data, is_published)
VALUES (
  v_c11_id,
  'Choosing the Right Spread for the Setup',
  'choosing-the-right-spread-for-the-setup',
  E'## Choosing the Right Spread for the Setup\n\nWith vertical spreads, credit spreads, calendar spreads, and diagonal spreads in your toolkit, the final skill is knowing **which spread to deploy for each market setup**. The correct choice depends on four factors: your directional thesis, the expected magnitude of the move, the current implied volatility environment, and the expected timeframe. There is no single "best" spread—only the best spread for the specific conditions in front of you.\n\n**When you have a strong directional opinion and a specific price target**, use a **debit vertical spread** (bull call or bear put). For example, if your technical analysis shows a bull flag breakout on MSFT with a measured move from $400 to $420, buy the $400/$420 bull call spread. The defined risk and reduced cost make verticals ideal when you have high conviction about both direction and target. Choose the width of the spread to match your target: if you expect a $10 move, a $10-wide spread captures the full expected profit.\n\n**When you expect the stock to stay within a range or drift slowly**, use a **credit spread** or **calendar spread**. If SPY has been consolidating between $445 and $455 and shows no signs of breaking out, sell a bull put spread below $445 support and/or a bear call spread above $455 resistance. You profit from the stock doing nothing. Alternatively, enter a calendar spread at $450 (the midpoint) if you expect the stock to stay anchored near that level. Choose credit spreads when IV is high (inflated premiums to sell) and calendars when IV is low to moderate (favorable vega exposure).\n\n**When you have a moderate directional lean over a longer timeframe**, use a **diagonal spread**. If you are bullish on AMZN over the next 6 weeks but expect a gradual grind rather than an explosive breakout, buy a 45-day ITM call and sell a 14-day OTM call. The diagonal lets you collect premium while waiting for the gradual move to unfold. Diagonals are particularly effective when IV is moderate and you want to offset time decay without giving up your directional exposure.\n\nHere is a decision framework you can apply to any setup:\n\n**Step 1: Direction.** Are you bullish, bearish, or neutral? Bullish setups point to bull call spreads, bull put spreads, or call diagonals. Bearish setups point to bear put spreads, bear call spreads, or put diagonals. Neutral setups point to calendars or iron condors.\n\n**Step 2: IV Environment.** Is IV Rank above 50%? Favor selling premium (credit spreads, short options in diagonals). Is IV Rank below 30%? Favor buying premium (debit spreads, calendars). Between 30-50%? Either approach works—let the technical setup decide.\n\n**Step 3: Expected Move Magnitude.** Large expected move (5%+)? Use a debit spread with wide strikes to capture it. Small expected move (1-3%)? Use a credit spread that profits from the stock not moving much. Minimal movement expected? Use a calendar spread.\n\n**Step 4: Timeframe.** Short-term (1-2 weeks)? Weekly credit spreads or narrow debit spreads. Medium-term (2-4 weeks)? Monthly debit or credit spreads. Longer-term (4-8 weeks)? Diagonal spreads that allow multiple rounds of short premium sales.\n\nAs you gain experience, you will develop an intuition for which spread fits each situation. The best swing traders don''t have a favorite strategy—they have a repertoire and deploy the right tool for the job. Start by mastering one spread type thoroughly, then add another to your toolkit. Within a few months, selecting the right spread will become second nature.',
  'text'::lesson_type,
  30,
  5,
  ARRAY[
    'Use debit verticals for strong directional conviction with a specific price target',
    'Use credit spreads in high IV environments or when expecting range-bound price action below support or above resistance',
    'Use calendar spreads for neutral outlook when you expect the stock to stay anchored near a specific price with stable or rising IV',
    'Use diagonal spreads for moderate directional trades over longer timeframes to collect multiple rounds of premium'
  ],
  ARRAY[
    'How do I decide between a debit spread and a credit spread?',
    'Which spread is best for a stock in a trading range?',
    'What role does IV Rank play in spread selection?'
  ],
  '{"questions": [
    {"id": "q1", "type": "multiple_choice", "text": "You see a clear bull flag breakout with a $15 measured move target. What spread is most appropriate?", "options": [{"id": "a", "text": "A calendar spread at the current price"}, {"id": "b", "text": "A $15-wide bull call debit spread to capture the expected move"}, {"id": "c", "text": "A bull put credit spread"}, {"id": "d", "text": "An iron condor"}], "correct_answer": "b", "explanation": "With a strong directional thesis and a specific price target, a debit vertical spread (bull call spread) is ideal. Making the spread $15 wide matches the expected measured move, allowing you to capture the full anticipated profit with defined risk."},
    {"id": "q2", "type": "multiple_choice", "text": "SPY has been consolidating between $445 and $455. IV Rank is 65%. What is the best strategy?", "options": [{"id": "a", "text": "Buy a straddle"}, {"id": "b", "text": "Sell credit spreads outside the range—a bull put spread below $445 and/or a bear call spread above $455"}, {"id": "c", "text": "Buy a long-dated call"}, {"id": "d", "text": "Enter a diagonal spread"}], "correct_answer": "b", "explanation": "A range-bound market with high IV Rank is the ideal setup for credit spreads. Sell a bull put spread below support ($445) and/or a bear call spread above resistance ($455). You profit from the range holding, and the high IV gives you fatter premiums to collect."},
    {"id": "q3", "type": "multiple_choice", "text": "IV Rank is 22%. You have a moderately bullish outlook. What approach is favored?", "options": [{"id": "a", "text": "Sell credit spreads to collect premium"}, {"id": "b", "text": "Buy debit spreads or long options since IV is cheap and premium is inexpensive"}, {"id": "c", "text": "Sell naked calls"}, {"id": "d", "text": "IV Rank does not affect strategy selection"}], "correct_answer": "b", "explanation": "When IV Rank is below 30%, options premiums are relatively cheap. Buying premium through debit spreads or single-leg options gives you exposure at a discount. Selling premium when IV is low yields small credits that may not justify the risk."},
    {"id": "q4", "type": "multiple_choice", "text": "You are moderately bullish on a stock over a 6-week timeframe and expect a slow grind higher. What spread fits best?", "options": [{"id": "a", "text": "A weekly bull call debit spread"}, {"id": "b", "text": "A long call diagonal—buy a 45-day ITM call and sell a 14-day OTM call"}, {"id": "c", "text": "An iron condor"}, {"id": "d", "text": "A bear put spread"}], "correct_answer": "b", "explanation": "A diagonal spread is ideal for moderate directional views over longer timeframes. The longer-dated long call provides sustained directional exposure, while repeatedly selling shorter-dated calls collects premium and reduces cost basis during the expected gradual move."},
    {"id": "q5", "type": "multiple_choice", "text": "What are the four factors in the spread selection framework?", "options": [{"id": "a", "text": "Stock price, volume, open interest, and bid-ask spread"}, {"id": "b", "text": "Directional thesis, expected move magnitude, IV environment, and timeframe"}, {"id": "c", "text": "Delta, gamma, theta, and vega"}, {"id": "d", "text": "Support, resistance, moving average, and RSI"}], "correct_answer": "b", "explanation": "The four-factor framework for spread selection considers: (1) your directional thesis (bullish, bearish, neutral), (2) expected move magnitude (large, small, minimal), (3) IV environment (high favors selling, low favors buying), and (4) timeframe (short, medium, or longer-term)."}
  ], "passing_score": 70}'::jsonb,
  true
);

-- ============================================================
-- LEARNING PATH 4: Advanced Options Income
-- ============================================================

INSERT INTO learning_paths (name, slug, description, tier_required, difficulty_level, estimated_hours, display_order, is_published, icon_name)
VALUES (
  'Advanced Options Income',
  'advanced-options-income',
  'Generate consistent income through premium selling strategies. Master credit spreads, iron condors, and the wheel strategy used by professional traders.',
  'pro',
  'advanced'::difficulty_level,
  20,
  4,
  true,
  'dollar-sign'
)
RETURNING id INTO v_path4_id;

-- ------------------------------------------------------------
-- Course 12: Credit Spreads & Iron Condors
-- ------------------------------------------------------------

INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'Credit Spreads & Iron Condors',
  'credit-spreads-iron-condors',
  'Master defined-risk income strategies. Learn to sell premium with credit spreads and iron condors while managing probability and max loss.',
  'advanced'::difficulty_level,
  10,
  70,
  'pro',
  true,
  12
)
RETURNING id INTO v_c12_id;

UPDATE courses SET learning_path_id = v_path4_id WHERE id = v_c12_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path4_id, v_c12_id, 1);

-- Course 12, Lesson 1: Why Sell Premium? The Statistical Edge
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c12_id,
  'Why Sell Premium? The Statistical Edge',
  'why-sell-premium-statistical-edge',
  E'## Why Sell Premium? The Statistical Edge\n\nOptions premium selling is one of the most consistent income strategies available to traders, and the reason is rooted in mathematics. Studies consistently show that options expire worthless roughly 60-80% of the time depending on how far out-of-the-money they are at initiation. When you sell an option, time decay (theta) works in your favor every single day. This is the statistical edge that professional market makers and hedge funds have exploited for decades.\n\nThe core concept is straightforward: options are priced using implied volatility, which almost always overstates the actual movement a stock will make. This difference between implied volatility and realized volatility is called the **volatility risk premium**. Research from firms like Tastytrade has shown that implied volatility overstates actual moves by roughly 15-20% on average across thousands of occurrences. When you sell options, you are essentially selling insurance at a price that is statistically too high—and pocketing the difference over time.\n\nConsider a practical example. If SPY is trading at $450 and you sell a put option at the $430 strike for $2.00 with 30 days to expiration, you collect $200 per contract. SPY would need to fall more than 4.4% in 30 days for you to be in trouble. Historically, SPY moves less than that in a 30-day window about 85% of the time. Your probability of profit is high, and even if SPY does fall somewhat, time decay erodes the option''s value in your favor.\n\nHowever, premium selling is not free money. The risk-reward is asymmetric in the opposite direction from buying options. You collect small, consistent premiums but face the possibility of larger losses on the trades that go against you. The key to long-term profitability is **position sizing** and **mechanical management**. Professional premium sellers typically risk no more than 1-5% of their portfolio on any single trade, and they have clear adjustment rules before a trade becomes a full loss.\n\nThe best environments for selling premium are when the VIX (CBOE Volatility Index) is elevated above 20, because higher implied volatility means fatter premiums collected. Conversely, when the VIX is below 15, premiums are thin and the risk-reward is less attractive. Understanding these cycles and adjusting your aggressiveness accordingly is what separates profitable premium sellers from those who blow up during market corrections.',
  'text'::lesson_type,
  25,
  1,
  true,
  ARRAY[
    'Options expire worthless 60-80% of the time, giving premium sellers a statistical edge',
    'The volatility risk premium means implied volatility consistently overstates actual stock movement by 15-20%',
    'Position sizing (1-5% per trade) and mechanical management rules are essential to surviving losing trades',
    'Elevated VIX (above 20) provides the best risk-reward for premium selling strategies'
  ],
  ARRAY[
    'How does theta decay accelerate as expiration approaches?',
    'What is the difference between implied and realized volatility?',
    'How should I size my premium selling positions relative to my portfolio?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What percentage of options approximately expire worthless, giving premium sellers their statistical edge?",
        "options": [
          {"id": "a", "text": "20-30%"},
          {"id": "b", "text": "40-50%"},
          {"id": "c", "text": "60-80%"},
          {"id": "d", "text": "95-100%"}
        ],
        "correct_answer": "c",
        "explanation": "Studies show that roughly 60-80% of options expire worthless depending on how far out-of-the-money they are at initiation, which provides a statistical edge to premium sellers."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "What is the ''volatility risk premium''?",
        "options": [
          {"id": "a", "text": "The extra cost brokers charge for volatility trades"},
          {"id": "b", "text": "The difference between implied volatility and realized volatility"},
          {"id": "c", "text": "The premium charged on VIX options specifically"},
          {"id": "d", "text": "The cost of hedging a portfolio during volatile markets"}
        ],
        "correct_answer": "b",
        "explanation": "The volatility risk premium is the persistent tendency for implied volatility to overstate actual (realized) volatility. This means option prices are systematically too expensive, benefiting sellers."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "When is the BEST environment for selling options premium?",
        "options": [
          {"id": "a", "text": "When the VIX is below 12"},
          {"id": "b", "text": "When the VIX is above 20"},
          {"id": "c", "text": "Only during earnings season"},
          {"id": "d", "text": "When the market is at all-time highs"}
        ],
        "correct_answer": "b",
        "explanation": "When the VIX is elevated above 20, implied volatility is high, which means fatter premiums for sellers. The risk-reward for premium selling is most attractive during these periods."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "What is the recommended maximum portfolio risk per trade for premium sellers?",
        "options": [
          {"id": "a", "text": "1-5% of portfolio"},
          {"id": "b", "text": "10-15% of portfolio"},
          {"id": "c", "text": "25% of portfolio"},
          {"id": "d", "text": "50% of portfolio"}
        ],
        "correct_answer": "a",
        "explanation": "Professional premium sellers typically risk no more than 1-5% of their portfolio on any single trade. This ensures that inevitable losing trades do not cause catastrophic portfolio damage."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "Which Greek works in favor of the option seller every day?",
        "options": [
          {"id": "a", "text": "Delta"},
          {"id": "b", "text": "Gamma"},
          {"id": "c", "text": "Theta"},
          {"id": "d", "text": "Vega"}
        ],
        "correct_answer": "c",
        "explanation": "Theta (time decay) works in favor of the option seller every day. As time passes, the option loses extrinsic value, which benefits the person who sold the option and collected the premium."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 12, Lesson 2: Bull Put Spreads: Setup and Management
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c12_id,
  'Bull Put Spreads: Setup and Management',
  'bull-put-spreads-setup-management',
  E'## Bull Put Spreads: Setup and Management\n\nA bull put spread (also called a put credit spread) is a defined-risk, bullish-to-neutral strategy that profits from time decay and/or upward price movement. You construct it by **selling a put at a higher strike** and **buying a put at a lower strike** with the same expiration date. The net credit received is your maximum profit, and your maximum loss is the width of the spread minus the credit received.\n\nHere is a concrete example. Suppose AAPL is trading at $185 and you believe it will stay above $175 over the next 30 days. You sell the $175 put for $2.50 and buy the $170 put for $1.20. Your net credit is $1.30 per share, or $130 per contract. Your maximum profit is $130 (if AAPL stays above $175 at expiration). Your maximum loss is the width of the spread ($5.00) minus the credit ($1.30) = $3.70 per share, or $370 per contract. Your breakeven price is the short strike minus the credit: $175 - $1.30 = $173.70.\n\nStrike selection is critical for bull put spreads. The short strike defines your probability of profit—the further out-of-the-money (OTM) you go, the higher your win rate but the smaller your premium. Most professional traders sell their short put at around the 25-35 delta level, which corresponds to roughly a 65-75% probability of the option expiring worthless. The width of the spread (distance between strikes) determines your risk-reward ratio. Wider spreads collect more credit but risk more capital. Common widths are $2.50, $5, and $10 depending on the underlying price and your risk tolerance.\n\nManaging winners and losers is where the real skill lies. A best practice is to close winning trades at 50-75% of maximum profit rather than holding to expiration. If you collected $1.30, consider closing when the spread can be bought back for $0.33-$0.65. This "take profits early" approach improves your win rate over time because you remove the risk of a late reversal. For losing trades, many traders set a stop-loss at 2x the credit received (i.e., close if the spread moves against you to $2.60 in the example above). Rolling the spread—moving it out in time and/or down in strike—is another defensive tactic, but only do this if your original thesis is still intact.\n\nTime to expiration matters significantly. Most premium sellers initiate bull put spreads with 30-45 days to expiration (DTE). This window captures the steepest part of the theta decay curve while providing enough time for the trade to work. Avoid selling spreads with less than 14 DTE unless you are doing a very short-term trade, as gamma risk increases dramatically near expiration and the position can swing violently with small stock moves.',
  'text'::lesson_type,
  30,
  2,
  true,
  ARRAY[
    'A bull put spread is constructed by selling a higher-strike put and buying a lower-strike put for a net credit',
    'Max profit = net credit received; Max loss = spread width minus credit received',
    'Close winners at 50-75% of max profit to improve win rate and reduce risk of reversal',
    'Optimal entry is 30-45 DTE with the short strike at 25-35 delta for a 65-75% probability of profit'
  ],
  ARRAY[
    'How do I calculate my breakeven on a bull put spread?',
    'When should I roll a losing bull put spread vs. take the loss?',
    'What delta should I target for the short put in a credit spread?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "How do you construct a bull put spread?",
        "options": [
          {"id": "a", "text": "Buy a higher-strike put and sell a lower-strike put"},
          {"id": "b", "text": "Sell a higher-strike put and buy a lower-strike put"},
          {"id": "c", "text": "Buy a higher-strike call and sell a lower-strike call"},
          {"id": "d", "text": "Sell a higher-strike call and buy a lower-strike call"}
        ],
        "correct_answer": "b",
        "explanation": "A bull put spread is created by selling a put at a higher strike price and buying a put at a lower strike price with the same expiration. This creates a net credit and a bullish-to-neutral position."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "You sell a $100/$95 bull put spread for a net credit of $1.50. What is your maximum loss?",
        "options": [
          {"id": "a", "text": "$1.50 per share"},
          {"id": "b", "text": "$3.50 per share"},
          {"id": "c", "text": "$5.00 per share"},
          {"id": "d", "text": "$100.00 per share"}
        ],
        "correct_answer": "b",
        "explanation": "Maximum loss on a credit spread = width of spread minus credit received. The spread is $5 wide ($100 - $95), minus the $1.50 credit = $3.50 per share, or $350 per contract."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "What is the recommended DTE (days to expiration) for initiating a bull put spread?",
        "options": [
          {"id": "a", "text": "1-7 DTE"},
          {"id": "b", "text": "7-14 DTE"},
          {"id": "c", "text": "30-45 DTE"},
          {"id": "d", "text": "90-120 DTE"}
        ],
        "correct_answer": "c",
        "explanation": "30-45 DTE is optimal because it captures the steepest part of the theta decay curve while providing enough time for the trade to work. Shorter DTE increases gamma risk significantly."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "At what percentage of maximum profit should you typically close a winning bull put spread?",
        "options": [
          {"id": "a", "text": "10-25%"},
          {"id": "b", "text": "50-75%"},
          {"id": "c", "text": "90-95%"},
          {"id": "d", "text": "Always hold to 100% at expiration"}
        ],
        "correct_answer": "b",
        "explanation": "Closing at 50-75% of max profit is a best practice because it locks in gains, frees up capital, and removes the risk of a late reversal. Holding to expiration exposes you to unnecessary gamma risk."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "What is the breakeven price of a bull put spread with a $50 short strike and $1.80 net credit?",
        "options": [
          {"id": "a", "text": "$50.00"},
          {"id": "b", "text": "$51.80"},
          {"id": "c", "text": "$48.20"},
          {"id": "d", "text": "$46.40"}
        ],
        "correct_answer": "c",
        "explanation": "The breakeven on a bull put spread is the short strike minus the net credit received: $50.00 - $1.80 = $48.20. Below this price, the position starts losing money."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 12, Lesson 3: Bear Call Spreads: The Other Side
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c12_id,
  'Bear Call Spreads: The Other Side',
  'bear-call-spreads-the-other-side',
  E'## Bear Call Spreads: The Other Side\n\nA bear call spread (also called a call credit spread) is the mirror image of a bull put spread. It is a defined-risk, bearish-to-neutral strategy that profits from time decay and/or downward price movement. You construct it by **selling a call at a lower strike** and **buying a call at a higher strike** with the same expiration. Like the bull put spread, the net credit received is your maximum profit, and the width of the spread minus the credit is your maximum loss.\n\nLet''s walk through a specific trade. Suppose TSLA is trading at $240 and you believe it will stay below $260 for the next 30 days. You sell the $260 call for $4.00 and buy the $265 call for $2.50. Your net credit is $1.50 per share ($150 per contract). Maximum profit is $150 if TSLA stays below $260 at expiration. Maximum loss is ($265 - $260) - $1.50 = $3.50 per share ($350 per contract). Your breakeven is the short strike plus the credit: $260 + $1.50 = $261.50.\n\nBear call spreads serve a critical role in a premium seller''s toolkit because they provide a way to profit in flat-to-down markets. Many newer traders only sell put spreads (bullish), leaving them vulnerable to corrections. By incorporating bear call spreads, you can generate income regardless of market direction. This is especially useful when technical resistance levels are clearly defined—selling call spreads just above strong resistance gives you the dual tailwind of premium decay and a price ceiling that has historically held.\n\nOne important nuance with call credit spreads is the risk of **early assignment**. If your short call goes in-the-money and the underlying stock is approaching an ex-dividend date, the call buyer may exercise early to capture the dividend. This is most common with short-dated, deep-ITM calls on dividend-paying stocks. To mitigate this risk, avoid holding short calls through ex-dividend dates or close positions that are deep ITM before the ex-date. If you are assigned, simply exercise your long call to close the position—your max loss is still capped.\n\nManagement rules for bear call spreads are analogous to bull put spreads. Take profits at 50-75% of max credit. Set a stop-loss at 2x the credit received or when the underlying price crosses your short strike convincingly. Rolling up and out (moving to a higher strike and later expiration) is a viable defense if you still believe resistance will hold. The same 30-45 DTE guideline applies for optimal theta capture. Pairing bear call spreads with bull put spreads on the same underlying creates an iron condor, which is the subject of our next lesson.',
  'text'::lesson_type,
  25,
  3,
  true,
  ARRAY[
    'A bear call spread is constructed by selling a lower-strike call and buying a higher-strike call for a net credit',
    'Breakeven on a bear call spread = short call strike + net credit received',
    'Bear call spreads complement bull put spreads to generate income in any market direction',
    'Early assignment risk exists near ex-dividend dates on ITM short calls—close or roll before the ex-date'
  ],
  ARRAY[
    'How does a bear call spread differ from a bull put spread in terms of risk profile?',
    'What technical levels should I look for when placing a bear call spread?',
    'How do I handle early assignment on a call credit spread?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "How do you construct a bear call spread?",
        "options": [
          {"id": "a", "text": "Buy a lower-strike call and sell a higher-strike call"},
          {"id": "b", "text": "Sell a lower-strike call and buy a higher-strike call"},
          {"id": "c", "text": "Buy a lower-strike put and sell a higher-strike put"},
          {"id": "d", "text": "Sell a lower-strike put and buy a higher-strike put"}
        ],
        "correct_answer": "b",
        "explanation": "A bear call spread is created by selling a call at a lower strike and buying a call at a higher strike with the same expiration. This produces a net credit and profits when the stock stays below the short call strike."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "You sell a $200/$210 bear call spread for $2.00 credit. What is the breakeven price?",
        "options": [
          {"id": "a", "text": "$198.00"},
          {"id": "b", "text": "$200.00"},
          {"id": "c", "text": "$202.00"},
          {"id": "d", "text": "$208.00"}
        ],
        "correct_answer": "c",
        "explanation": "The breakeven on a bear call spread = short call strike + net credit. $200 + $2.00 = $202.00. Above this price, the position starts losing money."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "When is early assignment risk highest on a short call?",
        "options": [
          {"id": "a", "text": "When the call is deep out-of-the-money"},
          {"id": "b", "text": "Near the ex-dividend date when the call is in-the-money"},
          {"id": "c", "text": "Immediately after earnings announcements"},
          {"id": "d", "text": "On the first day the trade is opened"}
        ],
        "correct_answer": "b",
        "explanation": "Early assignment risk is highest when the short call is in-the-money near an ex-dividend date, because the call holder may exercise to capture the dividend."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "What is the maximum loss on a $150/$155 bear call spread sold for $1.25?",
        "options": [
          {"id": "a", "text": "$1.25 per share"},
          {"id": "b", "text": "$3.75 per share"},
          {"id": "c", "text": "$5.00 per share"},
          {"id": "d", "text": "$150.00 per share"}
        ],
        "correct_answer": "b",
        "explanation": "Maximum loss = spread width - credit received = ($155 - $150) - $1.25 = $3.75 per share ($375 per contract)."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "Why are bear call spreads important in a premium seller''s toolkit?",
        "options": [
          {"id": "a", "text": "They are the only way to profit from declining stocks"},
          {"id": "b", "text": "They allow income generation in flat-to-down markets, complementing bullish put spreads"},
          {"id": "c", "text": "They have unlimited profit potential"},
          {"id": "d", "text": "They require no margin or buying power"}
        ],
        "correct_answer": "b",
        "explanation": "Bear call spreads complement bull put spreads by allowing traders to generate income in flat-to-down markets. Without them, a premium seller is only positioned for bullish outcomes and vulnerable to corrections."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 12, Lesson 4: Iron Condors: Non-Directional Income
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c12_id,
  'Iron Condors: Non-Directional Income',
  'iron-condors-non-directional-income',
  E'## Iron Condors: Non-Directional Income\n\nAn iron condor is the combination of a **bull put spread** and a **bear call spread** on the same underlying with the same expiration. It is a non-directional, defined-risk strategy that profits when the stock stays within a range. You are simultaneously selling premium on both sides—collecting a put credit spread below the current price and a call credit spread above it. The total credit received from both spreads is your maximum profit.\n\nHere is a real-world example. SPY is trading at $450 with 35 days to expiration. You sell the $435/$430 bull put spread for $0.80 credit and sell the $465/$470 bear call spread for $0.70 credit. Your total credit is $1.50 per share ($150 per contract). Maximum profit is $150 if SPY stays between $435 and $465 at expiration. Maximum loss on either side is $5.00 (spread width) minus $1.50 (total credit) = $3.50 per share ($350 per contract). Your breakeven points are $433.50 on the downside ($435 - $1.50) and $466.50 on the upside ($465 + $1.50). That gives you a $33 profit zone, or roughly a 7.3% window around the current price.\n\nThe ideal environment for iron condors is when implied volatility is elevated (high IV rank or IV percentile above 50%) but you expect the underlying to trade in a range. Earnings announcements are a classic setup: IV inflates before earnings, then collapses after the announcement (IV crush). Many traders sell iron condors just before earnings to capture this volatility contraction. However, this is a high-risk approach because earnings moves can be extreme. A safer approach is to sell iron condors on broad indexes like SPY or IWM during elevated VIX periods, as indexes tend to be less volatile than individual stocks.\n\nManaging iron condors requires watching both sides independently. If the stock moves toward one of your short strikes, you have several choices: (1) close the entire condor if it reaches your loss threshold (typically 2x the credit); (2) close the threatened side and leave the profitable side open; or (3) roll the threatened side further out-of-the-money and/or out in time. A common technique is to close the winner side when it reaches 80%+ profit and then manage the challenged side as a standalone spread. Never add to a losing side by selling more premium—this is a classic mistake that dramatically increases risk.\n\nPosition sizing is particularly important with iron condors because you can only lose on one side at expiration, but during the trade, unrealized losses can spike on either side. Most professionals trade iron condors at a size where the maximum loss on one side represents 2-5% of their portfolio. With a consistent approach—30-45 DTE, 16-25 delta short strikes, close at 50% profit, stop at 2x credit—iron condors can produce steady monthly income with a win rate of 70-80% over large sample sizes.',
  'text'::lesson_type,
  30,
  4,
  true,
  ARRAY[
    'An iron condor = bull put spread + bear call spread on the same underlying and expiration',
    'Maximum profit is the total credit from both spreads; maximum loss is spread width minus total credit (on one side)',
    'Best in high IV environments where range-bound movement is expected (IV rank above 50%)',
    'Manage each side independently—close winners early, defend or cut losers at predefined thresholds'
  ],
  ARRAY[
    'How do I select the right width for my iron condor wings?',
    'Should I trade iron condors on individual stocks or indexes?',
    'How does IV crush after earnings affect iron condor profitability?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What is an iron condor composed of?",
        "options": [
          {"id": "a", "text": "A bull call spread and a bear put spread"},
          {"id": "b", "text": "A bull put spread and a bear call spread"},
          {"id": "c", "text": "Two bull put spreads at different strikes"},
          {"id": "d", "text": "A long straddle and a short strangle"}
        ],
        "correct_answer": "b",
        "explanation": "An iron condor consists of a bull put spread (selling premium below the market) and a bear call spread (selling premium above the market) on the same underlying with the same expiration."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "If you sell an iron condor with $5-wide spreads for a total credit of $1.80, what is your maximum loss?",
        "options": [
          {"id": "a", "text": "$1.80 per share"},
          {"id": "b", "text": "$3.20 per share"},
          {"id": "c", "text": "$5.00 per share"},
          {"id": "d", "text": "$8.20 per share"}
        ],
        "correct_answer": "b",
        "explanation": "Maximum loss on an iron condor = spread width - total credit received = $5.00 - $1.80 = $3.20 per share. You can only lose on one side at expiration."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "What is the ideal implied volatility environment for selling iron condors?",
        "options": [
          {"id": "a", "text": "Very low IV (IV rank below 10%)"},
          {"id": "b", "text": "Elevated IV (IV rank above 50%)"},
          {"id": "c", "text": "IV does not matter for iron condors"},
          {"id": "d", "text": "Only during zero-volatility periods"}
        ],
        "correct_answer": "b",
        "explanation": "Iron condors perform best when IV is elevated (IV rank above 50%) because higher implied volatility produces larger premiums. If IV then contracts, the position profits from both time decay and volatility contraction."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "The stock moves toward your short put strike in an iron condor. Which is NOT a recommended management action?",
        "options": [
          {"id": "a", "text": "Close the entire condor at your loss threshold"},
          {"id": "b", "text": "Close the threatened side and let the profitable side run"},
          {"id": "c", "text": "Sell more put spreads to collect additional credit on the losing side"},
          {"id": "d", "text": "Roll the threatened side further OTM and/or out in time"}
        ],
        "correct_answer": "c",
        "explanation": "Adding to a losing side by selling more premium is a classic mistake that dramatically increases risk exposure. Proper management involves closing, rolling, or accepting the defined loss."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "An iron condor on SPY has breakeven points at $433.50 and $466.50 with SPY at $450. How wide is the profit zone?",
        "options": [
          {"id": "a", "text": "$16.50"},
          {"id": "b", "text": "$33.00"},
          {"id": "c", "text": "$450.00"},
          {"id": "d", "text": "$900.00"}
        ],
        "correct_answer": "b",
        "explanation": "The profit zone is the distance between the two breakeven points: $466.50 - $433.50 = $33.00. As long as SPY stays within this range, the iron condor is profitable at expiration."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 12, Lesson 5: Managing Losing Spreads: Defense Tactics
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c12_id,
  'Managing Losing Spreads: Defense Tactics',
  'managing-losing-spreads-defense-tactics',
  E'## Managing Losing Spreads: Defense Tactics\n\nNo matter how skilled you become at selling credit spreads and iron condors, losing trades are inevitable. What separates consistently profitable traders from those who blow up is a **pre-defined management plan** executed with discipline. The goal is not to eliminate losses—it is to keep losses small and mechanical so that your winning trades (which should outnumber losers) accumulate into steady profits over time.\n\nThe most straightforward defense is a **hard stop-loss**. Many professional premium sellers set a rule: close the spread when the loss reaches 2x the initial credit received. For example, if you sold a bull put spread for $1.50 credit and it moves against you to a $3.00 debit to close, you exit. This means you lose $1.50 per share ($150 per contract)—the width of the original credit. Over hundreds of trades, this rule ensures no single loss is catastrophic. Some traders prefer a 1.5x stop or a fixed dollar amount; the key is consistency.\n\n**Rolling** is a more active defense that involves closing the current spread and simultaneously opening a new one, typically at a later expiration and/or different strike. Rolling out in time collects additional credit, which effectively lowers your breakeven. For instance, if your $100/$95 bull put spread is being challenged, you might close it for a loss and immediately sell the $95/$90 put spread expiring 30 days later for enough credit to partially offset the loss. The danger with rolling is that it can become a way to avoid accepting a loss—traders roll repeatedly and compound their exposure. Set a rule: roll only once per trade, and only if the fundamental thesis still holds.\n\n**Adjusting the untested side** of an iron condor is another tactic. If the stock drops and threatens your put side, your call side is likely profitable. You can buy back the call spread cheaply (locking in that profit) and then either accept the loss on the put side or roll the call side closer to at-the-money to collect additional premium. This "inversion" technique effectively narrows your condor, but be aware that it turns a non-directional trade into a directional bet—you are now adding bearish exposure.\n\nFinally, know when to simply **take the loss and move on**. If the underlying has had a fundamental change (earnings miss, sector rotation, macro event) that invalidates your original thesis, there is no amount of rolling or adjusting that will help. Close the trade, accept the defined loss, and deploy that capital into the next opportunity. Remember: with credit spreads, your maximum loss is always known in advance. This is the core advantage of defined-risk strategies—you never face a margin call or unlimited loss. Over a year of trading with 10-15 positions per month, a few max losses are simply the cost of doing business.',
  'text'::lesson_type,
  30,
  5,
  true,
  ARRAY[
    'Set a hard stop-loss rule (commonly 2x the credit received) and follow it consistently',
    'Rolling involves closing a losing spread and opening a new one at a later date and/or different strikes—limit to one roll per trade',
    'Adjusting the untested side of an iron condor can offset losses but converts the trade from non-directional to directional',
    'Accept defined losses and move on when the fundamental thesis has changed—this is the advantage of defined-risk strategies'
  ],
  ARRAY[
    'Should I roll a spread that has blown through both strikes?',
    'How do I decide between taking a loss and rolling a spread?',
    'What is the inversion technique for iron condors?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What is a common stop-loss rule for credit spreads?",
        "options": [
          {"id": "a", "text": "Close when the loss equals 0.5x the credit received"},
          {"id": "b", "text": "Close when the loss equals 2x the credit received"},
          {"id": "c", "text": "Never close a losing spread—always hold to expiration"},
          {"id": "d", "text": "Close only when the spread reaches maximum loss"}
        ],
        "correct_answer": "b",
        "explanation": "Many professional premium sellers close losing spreads when the loss reaches 2x the initial credit. This keeps losses manageable and prevents catastrophic drawdowns."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "What does ''rolling'' a credit spread involve?",
        "options": [
          {"id": "a", "text": "Adding more contracts to the same position"},
          {"id": "b", "text": "Closing the current spread and opening a new one at a later expiration and/or different strikes"},
          {"id": "c", "text": "Converting the spread into a naked option"},
          {"id": "d", "text": "Buying shares of the underlying stock"}
        ],
        "correct_answer": "b",
        "explanation": "Rolling means closing the current losing spread and simultaneously opening a new position at a later expiration and/or adjusted strikes. The goal is to collect additional credit to lower the breakeven."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "What is the primary danger of repeatedly rolling losing spreads?",
        "options": [
          {"id": "a", "text": "You collect too much premium"},
          {"id": "b", "text": "You compound exposure and avoid accepting a necessary loss"},
          {"id": "c", "text": "Rolling always results in additional commission fees only"},
          {"id": "d", "text": "There is no danger—rolling always improves the position"}
        ],
        "correct_answer": "b",
        "explanation": "The danger of repeated rolling is that it becomes a way to avoid accepting a loss. Each roll compounds your exposure to the same underlying and thesis, and if the stock continues moving against you, losses can escalate beyond what should have been a defined risk."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "What happens when you adjust the untested (profitable) side of an iron condor closer to the market?",
        "options": [
          {"id": "a", "text": "The trade remains perfectly non-directional"},
          {"id": "b", "text": "The trade converts from non-directional to directional"},
          {"id": "c", "text": "The maximum loss is eliminated"},
          {"id": "d", "text": "The trade automatically becomes profitable"}
        ],
        "correct_answer": "b",
        "explanation": "Moving the untested side closer to the current price converts the iron condor from a non-directional range trade into a directional bet. You are adding exposure in the opposite direction of the original threat."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "When should you simply take the loss on a credit spread rather than rolling or adjusting?",
        "options": [
          {"id": "a", "text": "Only when the position reaches maximum loss"},
          {"id": "b", "text": "When the underlying has a fundamental change that invalidates your original thesis"},
          {"id": "c", "text": "Never—always roll losing positions"},
          {"id": "d", "text": "Only on Fridays at expiration"}
        ],
        "correct_answer": "b",
        "explanation": "When the fundamental thesis has changed (earnings miss, macro event, sector rotation), rolling or adjusting will not help. Accept the defined loss and redeploy capital into the next opportunity."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- ------------------------------------------------------------
-- Course 13: The Wheel Strategy
-- ------------------------------------------------------------

INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'The Wheel Strategy',
  'the-wheel-strategy',
  'The ultimate income strategy combining cash-secured puts and covered calls. Learn to wheel high-quality stocks for consistent monthly income.',
  'advanced'::difficulty_level,
  8,
  70,
  'pro',
  true,
  13
)
RETURNING id INTO v_c13_id;

UPDATE courses SET learning_path_id = v_path4_id WHERE id = v_c13_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path4_id, v_c13_id, 2);

-- Course 13, Lesson 1: Cash-Secured Puts: Getting Paid to Buy
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c13_id,
  'Cash-Secured Puts: Getting Paid to Buy',
  'cash-secured-puts-getting-paid-to-buy',
  E'## Cash-Secured Puts: Getting Paid to Buy\n\nA cash-secured put (CSP) is the foundation of the wheel strategy. You sell a put option on a stock you''d be happy to own at a lower price, while holding enough cash in your account to buy 100 shares if assigned. Instead of placing a limit buy order and waiting, you **get paid** to wait. The premium you collect is yours to keep regardless of whether you end up buying the stock.\n\nHere is how it works in practice. Suppose you want to buy 100 shares of MSFT, currently trading at $380. Rather than buying at market price, you sell the $360 put expiring in 30 days for $3.50. You must have $36,000 in cash reserved in your account (the "cash-secured" part). Three outcomes are possible: (1) MSFT stays above $360—the put expires worthless and you keep the $350 premium, a 0.97% return on $36,000 in 30 days (11.7% annualized). (2) MSFT drops to $355—you are assigned and buy shares at $360, but your effective cost basis is $360 - $3.50 = $356.50, which is 6.2% below where the stock was when you sold the put. (3) MSFT drops to $340—you are assigned at $360 with a $356.50 cost basis, and the stock is below your cost basis, but you still got a better price than if you had bought at $380.\n\nStrike selection for CSPs should reflect a price where you are genuinely comfortable owning the stock. This is the critical distinction from speculative put selling: **you must want to own 100 shares at the strike price**. Most wheel traders sell puts at the 25-35 delta (roughly one standard deviation below the current price), which gives a probability of assignment of about 25-35%. The Goldilocks zone is a strike that is 5-10% below the current price for blue-chip stocks and 10-15% for more volatile names.\n\nTiming and expiration selection also matter. The sweet spot is 30-45 days to expiration, which captures the best theta decay per day of risk exposure. Selling puts on red days (when the stock is already down) is advantageous because implied volatility tends to spike on down moves, fattening the premium. Avoid selling puts immediately before earnings announcements unless you are comfortable with the post-earnings price—assignment risk spikes dramatically after large earnings moves.\n\nThe cash required for CSPs makes this a capital-intensive strategy. For a $100 stock, you need $10,000 reserved per contract. This is why wheeling works best with mid-priced, high-quality stocks in the $20-$100 range where the capital commitment per contract is manageable. Some brokers allow margin for CSPs, reducing the cash requirement, but be cautious—margin amplifies losses if the stock drops significantly and you are assigned at an unfavorable price.',
  'text'::lesson_type,
  30,
  1,
  true,
  ARRAY[
    'A cash-secured put requires holding enough cash to purchase 100 shares at the strike price if assigned',
    'Your effective cost basis when assigned = strike price minus premium collected',
    'Sell puts at 25-35 delta (5-10% below current price) on stocks you genuinely want to own',
    'The 30-45 DTE window provides the best theta decay per day of risk exposure'
  ],
  ARRAY[
    'What makes a good stock candidate for selling cash-secured puts?',
    'How do I calculate my annualized return on a cash-secured put?',
    'Should I sell puts before or after earnings announcements?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What does ''cash-secured'' mean in a cash-secured put?",
        "options": [
          {"id": "a", "text": "You use margin to cover the position"},
          {"id": "b", "text": "You hold enough cash to buy 100 shares at the strike price if assigned"},
          {"id": "c", "text": "You hedge the put with another option"},
          {"id": "d", "text": "You lock the cash in a separate savings account"}
        ],
        "correct_answer": "b",
        "explanation": "Cash-secured means you hold enough cash in your brokerage account to purchase 100 shares at the put''s strike price if the option is exercised and you are assigned."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "You sell a $50 put for $2.00 and get assigned. What is your effective cost basis per share?",
        "options": [
          {"id": "a", "text": "$52.00"},
          {"id": "b", "text": "$50.00"},
          {"id": "c", "text": "$48.00"},
          {"id": "d", "text": "$46.00"}
        ],
        "correct_answer": "c",
        "explanation": "Your effective cost basis = strike price - premium received = $50 - $2.00 = $48.00 per share. The premium collected lowers your actual purchase price."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "Why is selling puts on red days (when the stock is down) advantageous?",
        "options": [
          {"id": "a", "text": "Put premiums are cheaper on red days"},
          {"id": "b", "text": "Implied volatility spikes on down moves, increasing the premium collected"},
          {"id": "c", "text": "Assignment never happens on red days"},
          {"id": "d", "text": "Red days guarantee the stock will bounce back"}
        ],
        "correct_answer": "b",
        "explanation": "When stocks drop, implied volatility typically increases (fear premium), which makes put options more expensive. Selling puts on red days lets you collect fatter premiums."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "What is the recommended delta range for cash-secured put strike selection in the wheel strategy?",
        "options": [
          {"id": "a", "text": "5-10 delta (very far OTM)"},
          {"id": "b", "text": "25-35 delta"},
          {"id": "c", "text": "50 delta (at-the-money)"},
          {"id": "d", "text": "80-90 delta (deep ITM)"}
        ],
        "correct_answer": "b",
        "explanation": "The 25-35 delta range provides a good balance between premium collection and probability of not being assigned. This typically corresponds to a strike 5-10% below the current stock price."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "How much cash must be reserved to sell one cash-secured put at the $75 strike?",
        "options": [
          {"id": "a", "text": "$75"},
          {"id": "b", "text": "$750"},
          {"id": "c", "text": "$7,500"},
          {"id": "d", "text": "$75,000"}
        ],
        "correct_answer": "c",
        "explanation": "One option contract represents 100 shares. At a $75 strike, you need $75 x 100 = $7,500 in cash reserved to buy the shares if assigned."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 13, Lesson 2: Covered Calls: Income on Your Holdings
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c13_id,
  'Covered Calls: Income on Your Holdings',
  'covered-calls-income-on-your-holdings',
  E'## Covered Calls: Income on Your Holdings\n\nOnce you own 100 shares of stock (whether from CSP assignment or a direct purchase), selling covered calls is the natural next step in the wheel. A covered call involves **selling a call option against shares you already own**. You collect premium, and in exchange, you agree to sell your shares at the strike price if the option is exercised. The word "covered" means the short call is backed by your stock—there is no naked risk.\n\nLet''s continue our MSFT example. You were assigned at $360 with an effective cost basis of $356.50 (after the $3.50 put premium). MSFT is now trading at $358. You sell the $370 call expiring in 30 days for $2.80. Three scenarios play out: (1) MSFT stays below $370—the call expires worthless, you keep the $280 premium, and your cost basis drops further to $353.70 ($356.50 - $2.80). You sell another call next month. (2) MSFT rises above $370—your shares are called away at $370, and your total profit is ($370 - $356.50) + $2.80 = $16.30 per share, a 4.6% return in roughly 60 days. (3) MSFT drops to $340—the call expires worthless and you keep the premium, but your shares have an unrealized loss. Your adjusted cost basis of $353.70 provides a cushion.\n\nStrike selection for covered calls in the wheel strategy is typically at or above your cost basis. The goal is to get called away at a profit, not to sell your shares at a loss. If the stock is below your cost basis, you have two choices: sell a call above your cost basis for less premium (safer, preserves the ability to exit at a profit) or sell a call closer to the current price for more premium (generates more income but risks being called away at a loss). Most wheel traders prefer to sell calls at the 25-35 delta (roughly one standard deviation above), mirroring the put side of the strategy.\n\nAn important consideration is **dividends**. If you own dividend-paying stocks and sell covered calls, be aware that your short call might be exercised early just before the ex-dividend date if it is in-the-money. This is most likely when the remaining extrinsic value of the call is less than the dividend amount. To avoid losing your shares (and dividend) unexpectedly, either close or roll ITM calls before the ex-dividend date, or accept that early assignment is part of the strategy.\n\nCovered calls reduce your effective cost basis with each cycle, creating a compounding income effect. If you collect $2-$3 in premium per month on a $50 stock, that is $24-$36 per year—a 48-72% income yield on your cost basis, before accounting for any stock appreciation or dividends. This is why the wheel strategy is so popular among income-focused traders: it systematically monetizes time decay on stocks you are comfortable owning for the long term.',
  'text'::lesson_type,
  30,
  2,
  true,
  ARRAY[
    'A covered call = owning 100 shares + selling a call option against those shares for premium income',
    'Each premium collected reduces your effective cost basis, creating a compounding income effect',
    'Sell calls at or above your cost basis to ensure you exit at a profit if shares are called away',
    'Watch for early assignment risk near ex-dividend dates on ITM covered calls'
  ],
  ARRAY[
    'What strike should I sell my covered call at if the stock is below my cost basis?',
    'How does covered call income compare to dividend income?',
    'When should I roll a covered call vs. let shares get called away?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What makes a call ''covered''?",
        "options": [
          {"id": "a", "text": "You purchased insurance on the option"},
          {"id": "b", "text": "You own the 100 shares of stock that back the short call"},
          {"id": "c", "text": "You also bought a protective put"},
          {"id": "d", "text": "The call is deep out-of-the-money"}
        ],
        "correct_answer": "b",
        "explanation": "A call is ''covered'' when you own the underlying 100 shares of stock. If the call is exercised, you deliver your existing shares rather than having to buy them at market price (which would be naked/uncovered)."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "Your cost basis is $45.00 and the stock is at $43.00. You sell a $47 call for $1.00. If the stock rises to $50 and you are assigned, what is your total profit per share?",
        "options": [
          {"id": "a", "text": "$1.00"},
          {"id": "b", "text": "$2.00"},
          {"id": "c", "text": "$3.00"},
          {"id": "d", "text": "$5.00"}
        ],
        "correct_answer": "c",
        "explanation": "You are called away at $47 (the strike). Profit on shares = $47 - $45 = $2.00. Plus the $1.00 premium collected. Total profit = $3.00 per share. You miss the move from $47 to $50, but that is the tradeoff."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "Why is selling covered calls above your cost basis generally preferred in the wheel strategy?",
        "options": [
          {"id": "a", "text": "It collects more premium than selling below cost basis"},
          {"id": "b", "text": "It ensures you exit at a profit if shares are called away"},
          {"id": "c", "text": "It eliminates all downside risk"},
          {"id": "d", "text": "It prevents early assignment completely"}
        ],
        "correct_answer": "b",
        "explanation": "Selling calls at or above your cost basis ensures that if the stock rallies and your shares are called away, you still make a profit on the overall position (stock gain plus premiums collected)."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "When is early assignment most likely on a covered call?",
        "options": [
          {"id": "a", "text": "When the call is deep out-of-the-money"},
          {"id": "b", "text": "Just after the ex-dividend date"},
          {"id": "c", "text": "Just before the ex-dividend date when the call is ITM and extrinsic value is less than the dividend"},
          {"id": "d", "text": "On the first day the call is sold"}
        ],
        "correct_answer": "c",
        "explanation": "Early assignment is most likely just before the ex-dividend date when the call is in-the-money and the remaining extrinsic value is less than the dividend. The call holder exercises to capture the dividend."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "How does each cycle of covered call selling affect your cost basis?",
        "options": [
          {"id": "a", "text": "It increases your cost basis"},
          {"id": "b", "text": "It has no effect on cost basis"},
          {"id": "c", "text": "It reduces your cost basis by the premium collected"},
          {"id": "d", "text": "It only affects cost basis if the call is exercised"}
        ],
        "correct_answer": "c",
        "explanation": "Each premium collected from selling a covered call reduces your effective cost basis. Over time, this compounding effect can significantly lower the price at which you effectively purchased the stock."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 13, Lesson 3: The Full Wheel Cycle: Put to Assignment to Call
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c13_id,
  'The Full Wheel Cycle: Put to Assignment to Call',
  'full-wheel-cycle-put-assignment-call',
  E'## The Full Wheel Cycle: Put to Assignment to Call\n\nThe wheel strategy is a continuous cycle with four distinct phases: **(1) Sell cash-secured puts → (2) Get assigned shares → (3) Sell covered calls → (4) Get called away → Repeat.** Each phase generates income through option premium, and the cycle keeps turning as long as you maintain the position. Understanding the full cycle—and how each phase connects—is what transforms individual trades into a systematic income machine.\n\nLet''s trace a complete wheel cycle on a real stock. Assume you want to wheel AMD, currently trading at $150. **Phase 1:** You sell the $140 put (30 DTE) for $3.00 and collect $300. AMD stays above $140 and the put expires worthless. You sell another $140 put for $2.50, collecting $250. AMD drops to $138 and you are assigned. **Phase 2:** You now own 100 shares of AMD at an effective cost basis of $140 - $3.00 - $2.50 = $134.50 (accounting for both rounds of put premium). **Phase 3:** AMD is at $138, so you sell the $145 call (30 DTE) for $3.20, collecting $320. AMD rallies to $148 and your shares are called away at $145. **Phase 4:** Your total profit is ($145 - $134.50) + $3.20 = $13.70 per share, or $1,370 per contract. Over approximately 90 days and three option cycles, you earned a 9.8% return on the $14,000 initial capital at risk.\n\nThe key insight is that **you collect premium at every stage**. Whether the stock goes up (calls expire worthless, sell more calls), goes down (puts get assigned, transition to calls), or stays flat (both puts and calls expire worthless, collect premium on each), you generate income. The only scenario that truly hurts is a large, sustained drop in the stock while you hold shares—but even then, covered call premiums lower your cost basis each month, accelerating your path back to breakeven.\n\nRecord-keeping is essential for wheel traders. Track your **cumulative premium collected** per stock, your **adjusted cost basis** (original assignment price minus all premiums), and your **annualized return**. A spreadsheet or trading journal should log each leg: date, strike, expiration, premium, and whether you were assigned or expired. Many wheel traders find that their adjusted cost basis drops 20-40% below the original stock price after 6-12 months of consistent wheeling, providing a substantial margin of safety.\n\nThere are important tactical decisions at each transition point. When moving from puts to calls after assignment, some traders wait for a green day to sell the call (higher premiums due to elevated call prices). When a covered call is about to be exercised, decide whether you want to keep the shares (roll the call out in time) or let them go and restart the put-selling phase. If you enjoy owning the stock and collecting dividends, you might roll calls indefinitely. If you prefer the capital efficiency of CSPs, let the shares get called away and restart the wheel.',
  'text'::lesson_type,
  30,
  3,
  true,
  ARRAY[
    'The wheel cycle: sell CSPs → get assigned → sell covered calls → get called away → repeat',
    'Premium is collected at every stage of the cycle regardless of stock direction',
    'Track cumulative premium to calculate adjusted cost basis—it can drop 20-40% after 6-12 months of wheeling',
    'At each transition point, decide whether to keep shares (roll calls) or let them go (restart puts)'
  ],
  ARRAY[
    'Walk me through a complete wheel cycle with specific numbers.',
    'How do I decide whether to let shares get called away or roll the covered call?',
    'What is the biggest risk in the wheel strategy?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What is the correct order of the wheel strategy cycle?",
        "options": [
          {"id": "a", "text": "Buy stock → Sell puts → Sell calls → Repeat"},
          {"id": "b", "text": "Sell cash-secured puts → Get assigned → Sell covered calls → Get called away → Repeat"},
          {"id": "c", "text": "Sell covered calls → Get called away → Sell puts → Repeat"},
          {"id": "d", "text": "Buy calls → Exercise → Sell puts → Repeat"}
        ],
        "correct_answer": "b",
        "explanation": "The wheel starts with selling cash-secured puts. If assigned, you transition to selling covered calls on the shares. When shares are called away, you go back to selling puts and the cycle repeats."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "You sold two rounds of CSPs collecting $2.00 and $1.50 before assignment at $50, then sold a covered call for $2.00 and shares were called away at $53. What is your total profit per share?",
        "options": [
          {"id": "a", "text": "$3.00"},
          {"id": "b", "text": "$5.50"},
          {"id": "c", "text": "$8.50"},
          {"id": "d", "text": "$3.50"}
        ],
        "correct_answer": "c",
        "explanation": "Cost basis after premiums: $50 - $2.00 - $1.50 = $46.50. Called away at $53. Stock gain: $53 - $46.50 = $6.50. Plus covered call premium: $2.00. Total: $6.50 + $2.00 = $8.50. Alternatively: ($53 - $50) + $2.00 + $1.50 + $2.00 = $8.50."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "What is the main scenario that hurts a wheel trader?",
        "options": [
          {"id": "a", "text": "The stock stays flat for months"},
          {"id": "b", "text": "A large, sustained drop in the stock price after assignment"},
          {"id": "c", "text": "The stock rises sharply and shares get called away"},
          {"id": "d", "text": "Options expiring worthless"}
        ],
        "correct_answer": "b",
        "explanation": "A large, sustained decline after assignment is the biggest risk. While covered call premiums help lower cost basis, a major drop (e.g., 30-50%) can take many months of premium to recover from."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "Why is record-keeping essential for wheel traders?",
        "options": [
          {"id": "a", "text": "It is legally required for all option trades"},
          {"id": "b", "text": "To track cumulative premium collected and adjusted cost basis across multiple cycles"},
          {"id": "c", "text": "To predict future stock prices"},
          {"id": "d", "text": "It is only needed for tax purposes at year-end"}
        ],
        "correct_answer": "b",
        "explanation": "Tracking cumulative premium and adjusted cost basis is essential to understanding your true profit/loss and return on capital. Without it, you cannot accurately assess the strategy''s performance over time."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "When transitioning from CSPs to covered calls after assignment, when is the best time to sell the first call?",
        "options": [
          {"id": "a", "text": "Immediately at market open the next day regardless of price"},
          {"id": "b", "text": "Wait for a green day when call premiums are elevated"},
          {"id": "c", "text": "Wait until the stock returns to your original put strike"},
          {"id": "d", "text": "Sell the call before you are even assigned"}
        ],
        "correct_answer": "b",
        "explanation": "Waiting for a green (up) day to sell your first covered call is a common tactic because call premiums are higher when the stock is up. This lets you sell at a higher strike and/or collect more premium."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 13, Lesson 4: Stock Selection and Strike Optimization for Wheeling
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c13_id,
  'Stock Selection and Strike Optimization for Wheeling',
  'stock-selection-strike-optimization-wheeling',
  E'## Stock Selection and Strike Optimization for Wheeling\n\nThe wheel strategy''s success depends more on **which stocks you choose** than on any option tactic. Because the wheel can result in you holding shares for extended periods, you must apply the same fundamental analysis as a long-term investor. The ideal wheel candidate has four characteristics: (1) a strong, profitable business you''d be comfortable owning for years, (2) a stock price in the $20-$150 range to keep capital requirements manageable, (3) sufficient options liquidity (tight bid-ask spreads, high open interest), and (4) moderate-to-high implied volatility for decent premium.\n\nSpecific sectors and stocks lend themselves well to the wheel. Large-cap technology companies (AAPL, MSFT, AMD, NVDA), financial institutions (JPM, BAC, GS), consumer staples (KO, PEP, PG), and broad ETFs (SPY, QQQ, IWM) all have robust options markets. Avoid wheeling biotech stocks with binary catalyst events, meme stocks with unpredictable volatility, and any company with deteriorating fundamentals. A helpful screening filter: look for stocks with a forward P/E below 30, positive free cash flow, and IV rank above 30% for attractive premium.\n\nStrike optimization is about balancing **income**, **probability of profit**, and **capital efficiency**. A useful framework is the "1% per month" target. For a $100 stock, aim to collect at least $1.00 per month in combined put and call premium. On the put side, selling at the 30 delta strike typically achieves this with 30-45 DTE. On the call side, sell at or above your cost basis with a target of 30-delta as well. If the stock''s implied volatility is low and you cannot collect 1% per month, the stock may not be worth wheeling—capital can be deployed more efficiently elsewhere.\n\nSpread your wheel capital across 4-6 different stocks in different sectors to diversify single-stock risk. If you have a $100,000 wheel portfolio, allocate roughly $20,000-$25,000 per stock position (allowing for 1-2 contracts per name). This means a max loss on any one stock represents only 20-25% of your portfolio. Stagger your expirations so that not all positions expire in the same week—this smooths income and reduces concentration risk during expiration week.\n\nFinally, adapt your strike selection to market conditions. In bull markets, sell puts slightly further OTM (20-25 delta) and calls closer to ATM (35-40 delta) to capture upside while still generating income. In bear markets or corrections, sell puts closer to ATM (35-40 delta) for fatter premium and calls further OTM (20-25 delta) to give yourself room for a recovery. In range-bound markets, the standard 30-delta on both sides works well. This dynamic adjustment maximizes income across market cycles and prevents the common mistake of using a one-size-fits-all approach.',
  'text'::lesson_type,
  30,
  4,
  true,
  ARRAY[
    'Ideal wheel stocks: strong business, $20-$150 price range, liquid options, moderate-to-high IV',
    'Target 1% per month in combined put/call premium—if a stock cannot achieve this, deploy capital elsewhere',
    'Diversify across 4-6 stocks in different sectors with staggered expirations',
    'Adjust strike selection based on market regime: wider OTM in bull markets, closer to ATM in corrections'
  ],
  ARRAY[
    'What are the best stocks for the wheel strategy right now?',
    'How do I calculate if a stock gives enough premium to be worth wheeling?',
    'Should I wheel ETFs like SPY or individual stocks?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "Which of the following is NOT a characteristic of a good wheel candidate?",
        "options": [
          {"id": "a", "text": "Strong, profitable business you''d own for years"},
          {"id": "b", "text": "Binary catalyst events like FDA drug approvals"},
          {"id": "c", "text": "Sufficient options liquidity with tight bid-ask spreads"},
          {"id": "d", "text": "Moderate-to-high implied volatility for decent premium"}
        ],
        "correct_answer": "b",
        "explanation": "Stocks with binary catalyst events (like biotech FDA decisions) are poor wheel candidates because they can gap dramatically in either direction, leading to outsized losses that premium cannot offset."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "What is the ''1% per month'' target in wheel strike optimization?",
        "options": [
          {"id": "a", "text": "The stock should appreciate 1% per month"},
          {"id": "b", "text": "Combined put and call premium should yield at least 1% of the stock price per month"},
          {"id": "c", "text": "You should risk no more than 1% of portfolio per month"},
          {"id": "d", "text": "The option should decay 1% per day"}
        ],
        "correct_answer": "b",
        "explanation": "The 1% per month target means for a $100 stock, you should aim to collect at least $1.00 per month in combined premium across put and call cycles. Stocks that cannot achieve this threshold may not be worth wheeling."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "How many different stocks should a well-diversified wheel portfolio contain?",
        "options": [
          {"id": "a", "text": "1-2 stocks for concentration"},
          {"id": "b", "text": "4-6 stocks in different sectors"},
          {"id": "c", "text": "15-20 stocks for maximum diversification"},
          {"id": "d", "text": "As many as possible"}
        ],
        "correct_answer": "b",
        "explanation": "4-6 stocks in different sectors provides adequate diversification while keeping the portfolio manageable. Too few stocks creates concentration risk; too many makes the strategy difficult to manage and dilutes returns."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "In a bear market, how should you adjust your wheel strike selection?",
        "options": [
          {"id": "a", "text": "Stop selling puts entirely"},
          {"id": "b", "text": "Sell puts closer to ATM for fatter premium and calls further OTM for recovery room"},
          {"id": "c", "text": "Sell both puts and calls at ATM for maximum premium"},
          {"id": "d", "text": "Only sell calls, never puts"}
        ],
        "correct_answer": "b",
        "explanation": "In bear markets, selling puts closer to ATM captures elevated IV premiums while selling calls further OTM gives the stock room to recover. This adapts to the market regime rather than using a static approach."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "Why should you stagger option expiration dates across your wheel positions?",
        "options": [
          {"id": "a", "text": "To get more commission discounts"},
          {"id": "b", "text": "To smooth income and reduce concentration risk during expiration week"},
          {"id": "c", "text": "To confuse market makers"},
          {"id": "d", "text": "Staggering is not recommended—all positions should expire together"}
        ],
        "correct_answer": "b",
        "explanation": "Staggering expirations smooths income over the month and reduces the risk of all positions being under pressure during the same expiration week. It also provides more regular opportunities to adjust and redeploy capital."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- ============================================================
-- LEARNING PATH 5: LEAPS & Portfolio Management
-- ============================================================

INSERT INTO learning_paths (name, slug, description, tier_required, difficulty_level, estimated_hours, display_order, is_published, icon_name)
VALUES (
  'LEAPS & Portfolio Management',
  'leaps-portfolio-management',
  'Think long-term with LEAPS options and portfolio-level risk management. Build positions that compound over months while hedging against black swan events.',
  'executive',
  'advanced'::difficulty_level,
  12,
  5,
  true,
  'shield'
)
RETURNING id INTO v_path5_id;

-- ------------------------------------------------------------
-- Course 14: LEAPS Strategies & Portfolio Hedging
-- ------------------------------------------------------------

INSERT INTO courses (title, slug, description, difficulty_level, estimated_hours, passing_score, tier_required, is_published, display_order)
VALUES (
  'LEAPS Strategies & Portfolio Hedging',
  'leaps-strategies-portfolio-hedging',
  'Use long-dated options (LEAPS) as stock replacement, leverage tools, and portfolio hedges. Learn protective puts, collars, and tail-risk strategies.',
  'advanced'::difficulty_level,
  12,
  70,
  'executive',
  true,
  14
)
RETURNING id INTO v_c14_id;

UPDATE courses SET learning_path_id = v_path5_id WHERE id = v_c14_id;

INSERT INTO learning_path_courses (learning_path_id, course_id, sequence_order)
VALUES (v_path5_id, v_c14_id, 1);

-- Course 14, Lesson 1: LEAPS as Stock Replacement: Deep ITM Calls
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c14_id,
  'LEAPS as Stock Replacement: Deep ITM Calls',
  'leaps-stock-replacement-deep-itm-calls',
  E'## LEAPS as Stock Replacement: Deep ITM Calls\n\nLEAPS (Long-Term Equity Anticipation Securities) are options with expiration dates greater than 9 months out, typically 1-2 years. They behave much more like stock than short-dated options because their high time value means theta decay is minimal on a daily basis. The most powerful use of LEAPS is as a **stock replacement strategy**—buying deep in-the-money (ITM) LEAPS calls instead of buying 100 shares of stock outright.\n\nThe math behind stock replacement is compelling. Suppose AAPL is trading at $190 and you want bullish exposure. Buying 100 shares costs $19,000. Alternatively, you can buy a deep ITM LEAPS call with an 18-month expiration at the $140 strike for approximately $55.00 ($5,500 per contract). This call has a delta of roughly 0.85, meaning it moves $0.85 for every $1.00 AAPL moves. You are getting 85% of the stock''s upside for only 29% of the capital. Your leverage ratio is approximately 3:1, and the remaining $13,500 can sit in a money market fund earning interest.\n\nThe key metric for LEAPS stock replacement is the **delta**. You want a delta of 0.80 or higher, which typically means choosing a strike that is 20-30% in-the-money. At this depth, the option behaves very much like stock—small moves in the underlying produce nearly equivalent moves in your LEAPS. The extrinsic (time) value on a deep ITM LEAPS call is relatively small: in our example, the intrinsic value is $50 ($190 - $140) and the total cost is $55, so the extrinsic value is only $5.00. Over 18 months, that $5.00 erodes slowly—less than $0.10 per day. Compare this to the interest you earn on the $13,500 freed-up capital and the math is often favorable.\n\nThere are important tradeoffs to understand. First, LEAPS calls do not receive dividends. If the stock pays a 1.5% annual dividend, that is $285 per year you forfeit. Factor this into your cost comparison. Second, LEAPS have an expiration date—if the stock drops below your strike price and doesn''t recover, you can lose the entire premium paid. This is the maximum risk: $5,500 in our example versus $19,000 owning the stock. While the dollar loss is smaller, the percentage loss (100% of the option) is more severe. Third, implied volatility affects LEAPS pricing. If you buy when IV is high, you may overpay for time value. Look for periods when IV percentile is below 50% to get favorable entry prices.\n\nThe best candidates for LEAPS stock replacement are high-conviction, long-term holdings in mega-cap companies or broad ETFs like SPY and QQQ. These have deep, liquid options markets with tight bid-ask spreads on LEAPS strikes. Avoid using LEAPS as stock replacement on volatile small-caps or speculative names—the wide bid-ask spreads and high IV will eat into your returns. Plan to roll your LEAPS when they reach 6-9 months to expiration (before theta accelerates) by selling the current LEAPS and buying a new one further out in time.',
  'text'::lesson_type,
  30,
  1,
  true,
  ARRAY[
    'LEAPS are options with expiration dates greater than 9 months, typically 1-2 years out',
    'Deep ITM LEAPS calls (0.80+ delta) provide stock-like exposure at 25-35% of the capital cost',
    'Extrinsic value on deep ITM LEAPS is small—daily theta decay is minimal compared to short-dated options',
    'Roll LEAPS at 6-9 months to expiration before theta decay accelerates'
  ],
  ARRAY[
    'How deep in-the-money should I go for a LEAPS stock replacement?',
    'When should I roll my LEAPS to a new expiration?',
    'How does the cost of LEAPS compare to margin for leveraged stock exposure?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What defines a LEAPS option?",
        "options": [
          {"id": "a", "text": "An option with less than 30 days to expiration"},
          {"id": "b", "text": "An option with expiration greater than 9 months, typically 1-2 years"},
          {"id": "c", "text": "Any option on an S&P 500 stock"},
          {"id": "d", "text": "An option with a delta of exactly 1.00"}
        ],
        "correct_answer": "b",
        "explanation": "LEAPS (Long-Term Equity Anticipation Securities) are options with expiration dates greater than 9 months, typically ranging from 1 to 2 years. Their long duration means minimal daily theta decay."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "For LEAPS stock replacement, what minimum delta is recommended?",
        "options": [
          {"id": "a", "text": "0.30 (30 delta)"},
          {"id": "b", "text": "0.50 (50 delta, at-the-money)"},
          {"id": "c", "text": "0.80 (80 delta or higher)"},
          {"id": "d", "text": "1.00 (100 delta exactly)"}
        ],
        "correct_answer": "c",
        "explanation": "A delta of 0.80 or higher is recommended for stock replacement. This typically means choosing a strike 20-30% in-the-money, ensuring the option moves nearly dollar-for-dollar with the stock."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "What is the primary capital advantage of LEAPS stock replacement?",
        "options": [
          {"id": "a", "text": "LEAPS are free—they cost nothing"},
          {"id": "b", "text": "You get stock-like exposure for approximately 25-35% of the cost of buying shares"},
          {"id": "c", "text": "LEAPS always increase in value"},
          {"id": "d", "text": "You collect dividends on LEAPS"}
        ],
        "correct_answer": "b",
        "explanation": "Deep ITM LEAPS calls provide 80-90% of the stock''s upside for only 25-35% of the capital, freeing the remainder for other investments or interest-bearing instruments."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "When should you typically roll a LEAPS position to a new expiration?",
        "options": [
          {"id": "a", "text": "At the very last day before expiration"},
          {"id": "b", "text": "When the LEAPS reaches 6-9 months to expiration"},
          {"id": "c", "text": "Only if the stock has gone up"},
          {"id": "d", "text": "Never—hold LEAPS to expiration"}
        ],
        "correct_answer": "b",
        "explanation": "Roll LEAPS when they reach 6-9 months to expiration, before theta decay accelerates. This maintains the low-theta advantage of long-dated options and avoids the rapid time decay of shorter-dated contracts."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "What is a key disadvantage of LEAPS calls compared to owning stock?",
        "options": [
          {"id": "a", "text": "LEAPS cannot be sold before expiration"},
          {"id": "b", "text": "LEAPS call holders do not receive dividends"},
          {"id": "c", "text": "LEAPS have unlimited downside risk"},
          {"id": "d", "text": "LEAPS require more capital than buying stock"}
        ],
        "correct_answer": "b",
        "explanation": "LEAPS call holders do not receive dividends. If the underlying stock pays dividends, this income is forfeited and should be factored into the cost comparison with owning shares outright."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 14, Lesson 2: Poor Man's Covered Call (PMCC)
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c14_id,
  'Poor Man''s Covered Call (PMCC)',
  'poor-mans-covered-call-pmcc',
  E'## Poor Man''s Covered Call (PMCC)\n\nThe Poor Man''s Covered Call (PMCC) is a capital-efficient alternative to the traditional covered call. Instead of buying 100 shares of stock and selling a call against them, you **buy a deep ITM LEAPS call** and **sell a short-term out-of-the-money call** against it. The LEAPS call acts as a stock substitute, and the short call generates recurring income—just like a regular covered call, but with a fraction of the capital.\n\nLet''s build a PMCC on AMZN, trading at $180. A traditional covered call would require $18,000 for shares. Instead, buy the $140 strike LEAPS call expiring in 18 months for $45.00 ($4,500 per contract). This has a delta of approximately 0.82. Now sell the $190 call expiring in 30 days for $2.50 ($250). Your total capital outlay is $4,500 (versus $18,000), and you''re generating $250/month in premium. If AMZN stays below $190, the short call expires worthless, you keep the $250, and sell another call next month. If AMZN rallies past $190, your maximum profit is ($190 - $140) - $45.00 + $2.50 = $7.50 per share, or $750 per contract.\n\nThe critical rule for PMCC construction is: **the extrinsic value of your LEAPS must exceed the maximum potential loss from the short call**. If your LEAPS cost $45.00 and the intrinsic value is $40.00 ($180 - $140), the extrinsic value is $5.00. If you sell a $190 call for $2.50 and AMZN rockets to $220, you must deliver at $190 but your LEAPS is worth at least $80 ($220 - $140). You close both legs: sell LEAPS at $80, buy back short call at $30. Net = $80 - $30 = $50, minus your original $45 cost = $5.00 profit, plus the $2.50 premium = $7.50 total. The math works because your LEAPS has higher delta than the short call—it gains value faster.\n\nManaging the short call side follows the same rules as traditional covered calls. Take profit at 50-75% of max credit, roll the call up and/or out if the stock is approaching the strike, and be willing to close the short call early if implied volatility drops sharply (locking in a quick profit). The LEAPS side requires less management—just monitor your delta and plan to roll the LEAPS when it reaches 6-9 months to expiration.\n\nThe PMCC shines in several scenarios: you want covered call exposure but lack capital for 100 shares of high-priced stocks; you want to leverage your capital across multiple positions; or you want the defined risk of a LEAPS (you can only lose what you paid) instead of the full downside risk of stock ownership. The main risk is that the LEAPS can lose significant value if the stock drops well below your LEAPS strike—though your maximum loss is capped at the LEAPS cost minus any premiums collected from selling calls.',
  'text'::lesson_type,
  30,
  2,
  true,
  ARRAY[
    'A PMCC = long deep ITM LEAPS call + short near-term OTM call (a diagonal spread)',
    'Capital requirement is typically 25-35% of a traditional covered call',
    'Critical rule: LEAPS extrinsic value must exceed potential loss from short call assignment',
    'Maximum loss is capped at the LEAPS cost minus total premiums collected from selling calls'
  ],
  ARRAY[
    'How do I choose the right LEAPS strike for a PMCC?',
    'What happens if my short call is assigned on a PMCC?',
    'How does the return on capital compare between PMCC and traditional covered calls?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What is a Poor Man''s Covered Call?",
        "options": [
          {"id": "a", "text": "Selling a naked call on a stock you cannot afford"},
          {"id": "b", "text": "Buying a deep ITM LEAPS call and selling a short-term OTM call against it"},
          {"id": "c", "text": "Buying 100 shares and selling a LEAPS call"},
          {"id": "d", "text": "Selling both a put and a call at the same strike"}
        ],
        "correct_answer": "b",
        "explanation": "A Poor Man''s Covered Call uses a deep ITM LEAPS call as a stock substitute and sells a short-term OTM call against it to generate income, mimicking a traditional covered call at a fraction of the capital."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "If a stock trades at $100 and a traditional covered call needs $10,000, approximately how much capital would a PMCC require?",
        "options": [
          {"id": "a", "text": "$10,000 (same as traditional)"},
          {"id": "b", "text": "$2,500-$3,500"},
          {"id": "c", "text": "$500-$1,000"},
          {"id": "d", "text": "$15,000 (more than traditional)"}
        ],
        "correct_answer": "b",
        "explanation": "A PMCC typically requires 25-35% of the capital needed for a traditional covered call. For a $100 stock, that is approximately $2,500-$3,500 for the deep ITM LEAPS call."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "What is the critical construction rule for a PMCC?",
        "options": [
          {"id": "a", "text": "The short call must be ITM"},
          {"id": "b", "text": "Both options must have the same expiration"},
          {"id": "c", "text": "The extrinsic value of the LEAPS must exceed the potential loss from short call assignment"},
          {"id": "d", "text": "The LEAPS delta must be exactly 0.50"}
        ],
        "correct_answer": "c",
        "explanation": "The LEAPS extrinsic value must exceed the maximum potential loss from the short call. This ensures the position remains profitable even if the stock rallies sharply past the short call strike."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "What is the maximum loss on a PMCC?",
        "options": [
          {"id": "a", "text": "Unlimited"},
          {"id": "b", "text": "The cost of the LEAPS minus premiums collected from short calls"},
          {"id": "c", "text": "The width between the two strikes"},
          {"id": "d", "text": "The full stock price"}
        ],
        "correct_answer": "b",
        "explanation": "The maximum loss on a PMCC is the cost of the LEAPS call minus total premiums collected from selling short calls. This defined-risk characteristic is an advantage over traditional covered calls."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "When should you roll the LEAPS leg of a PMCC?",
        "options": [
          {"id": "a", "text": "Every week"},
          {"id": "b", "text": "When it reaches 6-9 months to expiration"},
          {"id": "c", "text": "Only when the stock hits a new all-time high"},
          {"id": "d", "text": "Never—let it expire"}
        ],
        "correct_answer": "b",
        "explanation": "Roll the LEAPS when it reaches 6-9 months to expiration, before theta decay accelerates. This maintains the capital efficiency and low-theta advantage of the PMCC structure."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 14, Lesson 3: Protective Puts and Portfolio Insurance
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c14_id,
  'Protective Puts and Portfolio Insurance',
  'protective-puts-portfolio-insurance',
  E'## Protective Puts and Portfolio Insurance\n\nA protective put is the simplest form of portfolio insurance: you **buy a put option on a stock (or ETF) you already own** to limit your downside risk. The combination of long stock plus long put creates a payoff profile identical to a **synthetic long call**—unlimited upside with a defined floor on losses. This is the options equivalent of buying insurance on your house: you pay a premium, and if disaster strikes, you are protected.\n\nHere is a practical example. You own 100 shares of NVDA at $800 and are worried about a market correction over the next 3 months. You buy the $750 put expiring in 90 days for $25.00 ($2,500 per contract). Your maximum loss is now capped: if NVDA drops to $600, $500, or even $0, your loss is limited to ($800 - $750) + $25 = $75 per share, or $7,500. Without the put, a drop to $600 would cost you $20,000. The tradeoff is the $2,500 premium—this is your "insurance cost." If NVDA stays above $750 and the put expires worthless, you lose the premium but keep all your upside.\n\nThe challenge with protective puts is **cost**. Buying puts on volatile stocks can cost 3-5% of the position value for 90 days of protection—that is 12-20% annualized, which significantly erodes returns. This is why most professional portfolio managers don''t buy puts continuously. Instead, they use protective puts **tactically**: before earnings announcements, during periods of elevated geopolitical risk, or when technical indicators suggest a correction is imminent.\n\nFor portfolio-level insurance, buying puts on broad market ETFs is more cost-effective than insuring individual positions. A single SPY put at the 5% OTM strike provides broad protection for a diversified equity portfolio at roughly 1-2% of portfolio value for 90 days. The key calculation is your **portfolio beta**: if your portfolio has a beta of 1.2 relative to the S&P 500, you need 1.2x the notional value of SPY puts to fully hedge. For a $500,000 portfolio with 1.2 beta, you would need puts covering $600,000 of SPY exposure.\n\nAn important concept is the **insurance deductible analogy**. Just like home insurance, you can choose your "deductible" by selecting different strike prices. An at-the-money put (zero deductible) is very expensive. A 10% OTM put (10% deductible) is much cheaper but only kicks in after a significant drop. Most portfolio managers find the 5-7% OTM sweet spot provides the best balance of cost and protection. Remember: the goal of portfolio insurance is not to eliminate all losses—it is to prevent catastrophic losses that take years to recover from.',
  'text'::lesson_type,
  25,
  3,
  true,
  ARRAY[
    'Long stock + long put = synthetic long call, providing unlimited upside with a defined loss floor',
    'Protective puts cost 3-5% per quarter on volatile stocks—use them tactically, not continuously',
    'SPY puts are more cost-effective for portfolio-level hedging than individual stock puts',
    'The 5-7% OTM strike typically provides the best balance between insurance cost and meaningful protection'
  ],
  ARRAY[
    'How much should I budget for portfolio insurance annually?',
    'Should I hedge individual stocks or use index puts?',
    'What is the synthetic equivalence between long stock + long put and a long call?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What position is synthetically equivalent to long stock + long put?",
        "options": [
          {"id": "a", "text": "Short call"},
          {"id": "b", "text": "Long call"},
          {"id": "c", "text": "Short put"},
          {"id": "d", "text": "Long straddle"}
        ],
        "correct_answer": "b",
        "explanation": "Long stock plus a long put creates a payoff profile identical to a synthetic long call: unlimited upside participation with a defined floor on maximum loss. This is a fundamental options equivalence."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "You own stock at $100 and buy a $90 put for $4.00. What is your maximum loss per share?",
        "options": [
          {"id": "a", "text": "$4.00"},
          {"id": "b", "text": "$10.00"},
          {"id": "c", "text": "$14.00"},
          {"id": "d", "text": "$100.00"}
        ],
        "correct_answer": "c",
        "explanation": "Maximum loss = (stock price - put strike) + put premium = ($100 - $90) + $4.00 = $14.00 per share. The put protects below $90, but you lose $10 on the stock before the put kicks in, plus the $4 premium paid."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "Why do professional portfolio managers typically use protective puts tactically rather than continuously?",
        "options": [
          {"id": "a", "text": "Protective puts are illegal to hold continuously"},
          {"id": "b", "text": "The cost (3-5% per quarter, 12-20% annualized) significantly erodes portfolio returns over time"},
          {"id": "c", "text": "Protective puts only work during bear markets"},
          {"id": "d", "text": "Brokers limit how often you can buy puts"}
        ],
        "correct_answer": "b",
        "explanation": "Continuous put buying costs 12-20% annualized, which would dramatically reduce portfolio returns. Tactical use—around earnings, geopolitical events, or technical breakdowns—provides protection when most needed at a manageable cost."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "Your portfolio has a beta of 1.3 and is worth $400,000. How much SPY notional value should your puts cover for a full hedge?",
        "options": [
          {"id": "a", "text": "$400,000"},
          {"id": "b", "text": "$307,692"},
          {"id": "c", "text": "$520,000"},
          {"id": "d", "text": "$800,000"}
        ],
        "correct_answer": "c",
        "explanation": "For a full hedge, multiply portfolio value by beta: $400,000 x 1.3 = $520,000 in SPY put notional value. A portfolio with beta greater than 1.0 moves more than the index, so more protection is needed."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "What strike price is considered the ''sweet spot'' for portfolio insurance puts?",
        "options": [
          {"id": "a", "text": "At-the-money (0% OTM)"},
          {"id": "b", "text": "2-3% OTM"},
          {"id": "c", "text": "5-7% OTM"},
          {"id": "d", "text": "20-25% OTM"}
        ],
        "correct_answer": "c",
        "explanation": "The 5-7% OTM strike provides the best balance between cost and protection. It is cheap enough to be affordable but close enough to provide meaningful protection against significant market drops."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 14, Lesson 4: Collar Strategy: Locking in Gains
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c14_id,
  'Collar Strategy: Locking in Gains',
  'collar-strategy-locking-in-gains',
  E'## Collar Strategy: Locking in Gains\n\nA collar is a three-part position: **long stock + protective put + covered call**. The covered call premium helps pay for the protective put, creating a low-cost or even zero-cost hedge. This makes collars the most practical hedging strategy for investors who want downside protection without the ongoing expense of buying puts. The tradeoff is capping your upside—the covered call limits how much you can profit if the stock rallies.\n\nLet''s build a collar on a profitable position. You bought GOOGL at $120 and it''s now at $175—a $55 unrealized gain per share. You want to protect these gains over the next 6 months. You buy the $160 put (6-month expiration) for $8.00 and sell the $190 call (same expiration) for $7.50. Your net cost is $0.50 per share ($50 per contract)—nearly a zero-cost collar. Your position is now bounded: minimum value is $160 (you can sell at $160 via the put) and maximum value is $190 (shares get called away). Regardless of what GOOGL does, your profit range is locked between $40 ($160 - $120) and $70 ($190 - $120) per share, minus the $0.50 collar cost.\n\nThe collar is particularly valuable in three situations: (1) **concentrated stock positions** where you have significant unrealized gains and cannot or do not want to sell (tax reasons, restricted stock, conviction); (2) **year-end tax planning** where you want to lock in gains for the current tax year while deferring the sale; (3) **pre-event protection** where you expect volatility but want to stay in the position. Corporate executives often use collars on company stock to manage concentrated positions without triggering a sale.\n\nDesigning an optimal collar involves choosing the put and call strikes carefully. A **zero-cost collar** sets the call strike so that the call premium exactly offsets the put cost. This typically means the put is 5-10% OTM and the call is 5-10% OTM, creating a 10-20% range of outcomes. A **net credit collar** uses a call strike closer to the current price, generating more premium than the put costs—you get paid to hedge, but with more upside limitation. A **net debit collar** uses a wider call strike, preserving more upside but requiring out-of-pocket cost for the hedge.\n\nOne important nuance: collars have **tax implications**. In some jurisdictions, establishing a collar on a stock position may be treated as a constructive sale, potentially triggering capital gains taxes even though you haven''t sold the shares. This is most likely when the collar is very tight (e.g., puts and calls both near at-the-money). Consult a tax professional before collaring positions with large unrealized gains. To reduce constructive sale risk, use wider collars where the put strike is at least 10% below current price and the call strike is at least 10% above.\n\nThe collar can also be viewed through the lens of options equivalence. Long stock + long put + short call = **long put spread** (bull put spread). Understanding this equivalence helps with position management: if the stock drops significantly, you can close the collar and you''re left with a realized loss that is bounded by your put protection. If the stock rallies to the call strike, you can roll the call up and out for a debit to extend your upside range.',
  'text'::lesson_type,
  25,
  4,
  true,
  ARRAY[
    'A collar = long stock + protective put + covered call, creating a bounded profit/loss range',
    'Zero-cost collars offset the put cost with call premium, typically creating a 10-20% range of outcomes',
    'Ideal for concentrated positions, tax planning, and pre-event protection',
    'Watch for constructive sale tax implications on tight collars—use 10%+ OTM strikes to reduce risk'
  ],
  ARRAY[
    'How do I set up a zero-cost collar on my stock position?',
    'What are the tax implications of collaring a stock with large unrealized gains?',
    'When should I use a collar vs. just selling the stock?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What are the three components of a collar?",
        "options": [
          {"id": "a", "text": "Long stock + long call + short put"},
          {"id": "b", "text": "Long stock + long put + short call"},
          {"id": "c", "text": "Short stock + long put + long call"},
          {"id": "d", "text": "Long stock + short put + short call"}
        ],
        "correct_answer": "b",
        "explanation": "A collar consists of long stock (which you already own), a long (protective) put to limit downside, and a short (covered) call to help pay for the put. This creates a bounded range of outcomes."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "What is a ''zero-cost collar''?",
        "options": [
          {"id": "a", "text": "A collar where no money changes hands ever"},
          {"id": "b", "text": "A collar where the call premium received approximately equals the put premium paid"},
          {"id": "c", "text": "A collar using free options from your broker"},
          {"id": "d", "text": "A collar that guarantees zero loss"}
        ],
        "correct_answer": "b",
        "explanation": "A zero-cost collar is structured so the premium received from selling the covered call offsets (or nearly offsets) the cost of buying the protective put, resulting in little to no net cost for the hedge."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "You bought stock at $80, it''s now at $120. You collar with a $110 put and $130 call for zero cost. What is your profit range?",
        "options": [
          {"id": "a", "text": "$0 to $50 per share"},
          {"id": "b", "text": "$30 to $50 per share"},
          {"id": "c", "text": "$10 to $30 per share"},
          {"id": "d", "text": "$110 to $130 per share"}
        ],
        "correct_answer": "b",
        "explanation": "Minimum profit = put strike - purchase price = $110 - $80 = $30. Maximum profit = call strike - purchase price = $130 - $80 = $50. The collar locks your gain within this range."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "Which scenario is MOST appropriate for using a collar?",
        "options": [
          {"id": "a", "text": "A speculative trade you entered yesterday"},
          {"id": "b", "text": "A concentrated stock position with significant unrealized gains you want to protect"},
          {"id": "c", "text": "A stock that is already at zero"},
          {"id": "d", "text": "A short position you want to hedge"}
        ],
        "correct_answer": "b",
        "explanation": "Collars are ideal for concentrated positions with large unrealized gains where the investor wants downside protection without selling (due to tax, restriction, or conviction reasons)."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "What tax risk can a tight collar create?",
        "options": [
          {"id": "a", "text": "Double taxation on dividends"},
          {"id": "b", "text": "A constructive sale, potentially triggering capital gains taxes"},
          {"id": "c", "text": "Automatic classification as a day trader"},
          {"id": "d", "text": "Loss of long-term capital gains treatment on all other positions"}
        ],
        "correct_answer": "b",
        "explanation": "A tight collar (both strikes near ATM) may be treated as a constructive sale, triggering capital gains taxes even though the stock was not sold. Using wider strikes (10%+ OTM on both sides) helps reduce this risk."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

-- Course 14, Lesson 5: Tail-Risk Hedging: Black Swan Protection
INSERT INTO lessons (course_id, title, slug, content_markdown, lesson_type, estimated_minutes, display_order, is_published, key_takeaways, ai_tutor_chips, quiz_data)
VALUES (
  v_c14_id,
  'Tail-Risk Hedging: Black Swan Protection',
  'tail-risk-hedging-black-swan-protection',
  E'## Tail-Risk Hedging: Black Swan Protection\n\nTail-risk hedging is the practice of protecting your portfolio against extreme, rare events—the "black swans" that can cause 30-50%+ market crashes. These events include pandemics (COVID-19 in March 2020: S&P 500 fell 34% in 23 trading days), financial crises (2008 GFC: S&P 500 fell 57% peak-to-trough), and geopolitical shocks. While these events are statistically rare, they are **portfolio-destroying** when they occur. A 50% loss requires a 100% gain to recover—the math of loss is brutally asymmetric.\n\nThe classic tail-risk hedge uses **deep out-of-the-money put options** on broad market indexes. The strategy, popularized by Nassim Taleb and implemented by funds like Universa Investments, involves continuously allocating a small percentage of the portfolio (typically 0.5-2%) to buying far OTM puts (20-30% below the current market). In normal markets, these puts expire worthless—a steady, small cost. But during a crash, they can explode in value by 10x-50x, offsetting portfolio losses.\n\nHere is how to implement a basic tail-risk hedge. Assume a $500,000 portfolio and you allocate 1% ($5,000 per year, or roughly $1,250 per quarter) to tail-risk puts. You buy SPY puts that are 20% OTM with 90 days to expiration. With SPY at $450, you buy $360 puts for approximately $1.00 each ($100 per contract). $1,250 buys 12 contracts, protecting roughly $432,000 of notional value. If a black swan event drops SPY 35% to $292.50, those $360 puts are now worth approximately $67.50 each—a 6,750% return. Your 12 contracts are worth $81,000, offsetting a significant portion of your $175,000 portfolio loss.\n\nThere are several refinements to the basic approach. **Ratio put spreads** (buy 1 put, sell 2-3 further OTM puts) reduce the cost of hedging in exchange for a hedging "sweet spot" that does not protect against the absolute worst-case scenario. **VIX call options** provide convex exposure to volatility spikes—the VIX typically doubles or triples during crashes, so VIX calls can surge 500-1000%. **Put ladders** distribute your hedge budget across multiple strike prices and expirations, providing layered protection. Some managers combine all three: SPY puts for directional protection, VIX calls for volatility convexity, and ratio spreads to reduce overall cost.\n\nThe psychological challenge of tail-risk hedging is watching your insurance cost money month after month, year after year, during a bull market. Most investors abandon their hedges precisely when they need them most—just before the crash. Discipline requires treating the hedge allocation as a non-negotiable expense, like portfolio management fees. The hedge is not meant to be profitable on its own; it is meant to keep your portfolio intact when everything else is falling apart. Professionals who maintained tail-risk hedges through 2020 were able to **rebalance into crashed assets** while everyone else was panic-selling, turning a defensive strategy into an offensive opportunity.',
  'text'::lesson_type,
  30,
  5,
  true,
  ARRAY[
    'Tail-risk hedges protect against 30-50%+ market crashes using deep OTM index puts or VIX calls',
    'Allocate 0.5-2% of portfolio annually to tail-risk hedging as a non-negotiable insurance cost',
    'A 50% portfolio loss requires a 100% gain to recover—the math of loss is asymmetric',
    'The real value of tail-risk hedges is enabling rebalancing into crashed assets while others panic-sell'
  ],
  ARRAY[
    'How much of my portfolio should I allocate to tail-risk hedging?',
    'Should I use SPY puts or VIX calls for black swan protection?',
    'How did tail-risk hedges perform during the COVID crash in March 2020?'
  ],
  '{
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "text": "What percentage of a portfolio is typically allocated to tail-risk hedging?",
        "options": [
          {"id": "a", "text": "0.5-2% annually"},
          {"id": "b", "text": "10-15% annually"},
          {"id": "c", "text": "25-30% annually"},
          {"id": "d", "text": "50% of the portfolio"}
        ],
        "correct_answer": "a",
        "explanation": "Professional tail-risk hedgers allocate 0.5-2% of portfolio value annually to deep OTM puts or volatility hedges. This is treated as a non-negotiable insurance cost that protects against catastrophic losses."
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "text": "A portfolio loses 50% of its value. What gain is required to return to the original value?",
        "options": [
          {"id": "a", "text": "50%"},
          {"id": "b", "text": "75%"},
          {"id": "c", "text": "100%"},
          {"id": "d", "text": "200%"}
        ],
        "correct_answer": "c",
        "explanation": "If a $100,000 portfolio drops 50% to $50,000, it needs a 100% gain ($50,000) to return to $100,000. This asymmetry is why preventing catastrophic losses is more important than maximizing gains."
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "text": "How far out-of-the-money are typical tail-risk hedge puts?",
        "options": [
          {"id": "a", "text": "At-the-money"},
          {"id": "b", "text": "5% OTM"},
          {"id": "c", "text": "20-30% OTM"},
          {"id": "d", "text": "50% OTM"}
        ],
        "correct_answer": "c",
        "explanation": "Tail-risk puts are typically bought 20-30% out-of-the-money. They are very cheap in normal markets but can increase 10-50x during extreme crash events, providing massive portfolio offset."
      },
      {
        "id": "q4",
        "type": "multiple_choice",
        "text": "Why do VIX call options serve as effective tail-risk hedges?",
        "options": [
          {"id": "a", "text": "The VIX always goes up over time"},
          {"id": "b", "text": "The VIX typically doubles or triples during market crashes, creating 500-1000% gains on calls"},
          {"id": "c", "text": "VIX calls are always free"},
          {"id": "d", "text": "The VIX is inversely correlated to bond prices"}
        ],
        "correct_answer": "b",
        "explanation": "During market crashes, the VIX (fear index) typically surges 2-3x or more. VIX call options have convex exposure to these spikes, potentially returning 500-1000% during the exact moments your portfolio needs protection most."
      },
      {
        "id": "q5",
        "type": "multiple_choice",
        "text": "What is the biggest strategic advantage of maintaining tail-risk hedges through a crash?",
        "options": [
          {"id": "a", "text": "The hedges generate enough profit to retire"},
          {"id": "b", "text": "You can rebalance into crashed assets while others are forced to panic-sell"},
          {"id": "c", "text": "You avoid paying taxes during the crash"},
          {"id": "d", "text": "Your broker provides additional margin during crashes"}
        ],
        "correct_answer": "b",
        "explanation": "The real strategic value of tail-risk hedges is that they preserve capital during crashes, enabling you to rebalance and buy assets at depressed prices while other investors are panic-selling. This turns a defensive strategy into an offensive opportunity."
      }
    ],
    "passing_score": 70
  }'::jsonb
);

END $$;
