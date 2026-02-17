-- Add 'mentorship' category to knowledge_base for Precision Cohort and private 1-on-1 mentorship
-- This migration adds support for the $1,500 90-day cohort and the $2,500 8-week 1-on-1 program

-- Step 1: Update the category constraint to include 'mentorship'
ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_category_check;
ALTER TABLE knowledge_base ADD CONSTRAINT knowledge_base_category_check
  CHECK (category IN ('pricing', 'features', 'proof', 'faq', 'technical', 'escalation', 'mentorship'));

-- Step 2: Insert Precision Cohort knowledge base entries

-- Entry 1: Core pricing and scarcity
INSERT INTO knowledge_base (category, question, answer, priority, metadata) VALUES
(
  'mentorship',
  'What is the Precision Cohort? | 90 day mentorship | Mentorship program | $1500 program',
  'The **Precision Cohort** is our exclusive 90-day mentorship program for serious traders who want direct guidance from our founder.

**Investment:** $1,500 for the full 90-day program
**Availability:** Limited to only 20 traders per cohort

This is NOT a signals service—it''s a complete trading transformation program. You''ll work directly with our team to develop YOUR trading edge.

The Cohort is designed for traders who are ready to commit to real growth, not just follow alerts.',
  10,
  '{"tags": ["mentorship", "cohort", "90-day", "precision", "1500"], "lead_score": 10}'::jsonb
);

-- Entry 2: Four pillars curriculum
INSERT INTO knowledge_base (category, question, answer, priority, metadata) VALUES
(
  'mentorship',
  'What are the four pillars? | What do I learn in the cohort? | Cohort curriculum | Mentorship program content | What does the cohort include?',
  'The Precision Cohort is built on **4 Core Pillars**:

📊 **Live Strategy Sessions** - Weekly live sessions breaking down real-time market structure and trade setups with our founder

🏗️ **Trade Architecture** - Learn to build trades from the ground up—entries, exits, position sizing, and risk management tailored to YOUR style

📈 **Portfolio Engineering** - Develop a complete portfolio strategy tailored to your capital, risk tolerance, and goals

🧠 **Mindset Mastery** - Overcome the psychology barriers that prevent consistent profitability

This is mentorship, not signals. You''ll learn to BECOME a trader, not just follow one.',
  10,
  '{"tags": ["mentorship", "pillars", "curriculum", "education"]}'::jsonb
);

-- Entry 3: Mentorship philosophy (differentiation)
INSERT INTO knowledge_base (category, question, answer, priority, metadata) VALUES
(
  'mentorship',
  'How is Precision Cohort different? | Mentorship vs signals | Why choose 90 day program | Cohort vs monthly',
  'The Precision Cohort is fundamentally different from our monthly tiers:

**Monthly Tiers (Core/Pro/Execute):** You receive trade alerts and educational commentary. You''re following our trades.

**Precision Cohort ($1,500 / 90 days):** You''re learning to think like us. We work directly with you to:
- Identify YOUR trading style and edge
- Build custom strategies for your capital and risk tolerance
- Develop the mindset of a consistently profitable trader
- Get personalized feedback on your actual trades

This is **Mentorship, not Signals**. We''re investing in YOUR success, not just sending you alerts to copy.',
  10,
  '{"tags": ["mentorship", "differentiation", "philosophy"]}'::jsonb
);

-- Entry 4: Application requirements (triggers escalation)
INSERT INTO knowledge_base (category, question, answer, priority, metadata) VALUES
(
  'mentorship',
  'How do I apply for Precision Cohort? | Cohort application | Join the cohort | 90 day program requirements | Apply for mentorship',
  'To apply for the Precision Cohort, we ask a few qualifying questions:

1. **Trading Experience**: How long have you been actively trading?
2. **Current Capital**: What''s your current trading account size?
3. **Time Commitment**: Can you commit to weekly live sessions?
4. **Goals**: What does success look like for you in 12 months?

We limit each cohort to **20 traders maximum** to ensure everyone gets personalized attention. Applications are reviewed personally by our team.

The Precision Cohort is our most exclusive path—it requires an application to ensure mutual fit.

Ready to apply? Click the "Apply for Cohort" button or let me connect you with our team to discuss your application.',
  10,
  '{"tags": ["mentorship", "application", "apply", "requirements"], "auto_escalate": true, "lead_score": 10}'::jsonb
);

-- Entry 5: Private 1-on-1 mentorship details
INSERT INTO knowledge_base (category, question, answer, priority, metadata) VALUES
(
  'mentorship',
  'What is private 1-on-1 mentorship? | 8 week mentorship | One-on-one coaching | $2500 program',
  'Our **Private 1-on-1 Precision Mentorship** is a focused 8-week coaching program for active traders who want direct accountability.

**Investment:** $2,500 for the full 8-week program
**Format:** Weekly private 1-on-1 video calls + direct support

This is hands-on coaching designed around your execution, risk management, and consistency goals.',
  10,
  '{"tags": ["mentorship", "1-on-1", "8-week", "2500", "private coaching"], "auto_escalate": true, "lead_score": 10}'::jsonb
);
