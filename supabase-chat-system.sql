-- ============================================
-- AI CHAT SYSTEM DATABASE SCHEMA
-- ============================================
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. CHAT CONVERSATIONS TABLE
-- ============================================
create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  visitor_name text,
  visitor_email text,
  status text default 'active' check (status in ('active', 'resolved', 'archived')),
  assigned_to uuid references auth.users(id),
  ai_handled boolean default true,
  escalation_reason text,
  lead_score int check (lead_score between 1 and 10),
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'frustrated')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_message_at timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb
);

-- Indexes for performance
create index idx_conversations_status on chat_conversations(status);
create index idx_conversations_assigned on chat_conversations(assigned_to);
create index idx_conversations_visitor on chat_conversations(visitor_id);
create index idx_conversations_last_message on chat_conversations(last_message_at desc);
create index idx_conversations_ai_handled on chat_conversations(ai_handled) where ai_handled = false;

-- ============================================
-- 2. CHAT MESSAGES TABLE
-- ============================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade not null,
  sender_type text not null check (sender_type in ('visitor', 'team', 'system')),
  sender_id uuid references auth.users(id),
  sender_name text,
  message_text text,
  image_url text,
  ai_generated boolean default false,
  ai_confidence float check (ai_confidence between 0 and 1),
  knowledge_base_refs uuid[],
  created_at timestamp with time zone default now(),
  read_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb
);

-- Indexes
create index idx_messages_conversation on chat_messages(conversation_id, created_at);
create index idx_messages_unread on chat_messages(conversation_id) where read_at is null;

-- ============================================
-- 3. KNOWLEDGE BASE TABLE
-- ============================================
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('pricing', 'features', 'proof', 'faq', 'technical', 'escalation')),
  question text not null,
  answer text not null,
  context text,
  image_urls text[],
  priority int default 5 check (priority between 1 and 10),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb
);

-- Full text search index
create index idx_kb_question_search on knowledge_base
  using gin(to_tsvector('english', question || ' ' || coalesce(context, '')));

create index idx_kb_category on knowledge_base(category) where is_active = true;

-- ============================================
-- 4. TEAM MEMBERS TABLE
-- ============================================
create table if not exists team_members (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar_url text,
  role text default 'agent' check (role in ('admin', 'agent')),
  status text default 'offline' check (status in ('online', 'away', 'offline')),
  last_seen_at timestamp with time zone default now(),
  notification_settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- ============================================
-- 5. TYPING INDICATORS TABLE
-- ============================================
create table if not exists team_typing_indicators (
  conversation_id uuid references chat_conversations(id) on delete cascade,
  team_member_id uuid references team_members(id),
  is_typing boolean default true,
  updated_at timestamp with time zone default now(),
  primary key (conversation_id, team_member_id)
);

-- ============================================
-- 6. CHAT ANALYTICS TABLE
-- ============================================
create table if not exists chat_analytics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  total_conversations int default 0,
  ai_only_conversations int default 0,
  human_conversations int default 0,
  escalations int default 0,
  conversations_to_signup int default 0,
  avg_response_time_seconds int,
  avg_ai_confidence float,
  busiest_hour int,
  top_categories text[],
  created_at timestamp with time zone default now(),
  unique (date)
);

-- ============================================
-- 7. SUGGESTED KB ENTRIES (AI LEARNING)
-- ============================================
create table if not exists suggested_kb_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  source_conversation_id uuid references chat_conversations(id),
  suggested_category text,
  status text default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update conversation's last_message_at
create or replace function update_conversation_last_message()
returns trigger as $$
begin
  update chat_conversations
  set last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  where id = NEW.conversation_id;
  return NEW;
end;
$$ language plpgsql;

-- Trigger to auto-update last_message_at
drop trigger if exists update_conversation_timestamp on chat_messages;
create trigger update_conversation_timestamp
  after insert on chat_messages
  for each row
  execute function update_conversation_last_message();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table knowledge_base enable row level security;
alter table team_members enable row level security;
alter table team_typing_indicators enable row level security;
alter table chat_analytics enable row level security;
alter table suggested_kb_entries enable row level security;

-- Policy: Team members can view all conversations
create policy "Team members can view all conversations"
  on chat_conversations for select
  using (
    exists (
      select 1 from team_members
      where team_members.id = auth.uid()
    )
  );

-- Policy: Team members can update conversations
create policy "Team members can update conversations"
  on chat_conversations for update
  using (
    exists (
      select 1 from team_members
      where team_members.id = auth.uid()
    )
  );

-- Policy: Anyone can create conversations (visitors)
create policy "Anyone can create conversations"
  on chat_conversations for insert
  with check (true);

-- Policy: Team members can view all messages
create policy "Team members can view all messages"
  on chat_messages for select
  using (
    exists (
      select 1 from team_members
      where team_members.id = auth.uid()
    )
  );

-- Policy: Team members can insert messages
create policy "Team members can insert messages"
  on chat_messages for insert
  with check (
    sender_type = 'team' and exists (
      select 1 from team_members
      where team_members.id = auth.uid()
    )
  );

-- Policy: Anyone can insert visitor messages
create policy "Anyone can insert visitor messages"
  on chat_messages for insert
  with check (sender_type = 'visitor' or sender_type = 'system');

-- Policy: Knowledge base is readable by team members
create policy "Team can read knowledge base"
  on knowledge_base for select
  using (
    exists (
      select 1 from team_members
      where team_members.id = auth.uid()
    )
  );

-- Policy: Admins can manage knowledge base
create policy "Admins can manage knowledge base"
  on knowledge_base for all
  using (
    exists (
      select 1 from team_members
      where team_members.id = auth.uid()
      and team_members.role = 'admin'
    )
  );

-- Policy: Team members can view team roster
create policy "Team can view team members"
  on team_members for select
  using (
    exists (
      select 1 from team_members
      where team_members.id = auth.uid()
    )
  );

-- Policy: Team can update their own status
create policy "Team can update own status"
  on team_members for update
  using (id = auth.uid());

-- ============================================
-- INITIAL KNOWLEDGE BASE ENTRIES
-- ============================================

-- Pricing questions
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'pricing',
  'How much does it cost? | What are your prices? | Pricing? | Monthly cost? | How much to join?',
  'We offer three premium tiers:

• **Core Sniper ($199/mo)** - SPX day trade setups, morning watchlist, high-volume alerts, and educational commentary

• **Pro Sniper ($299/mo)** - Everything in Core PLUS LEAPS, advanced swing trades, position building logic, and market structure insights

• **Execute Sniper ($499/mo)** - Everything in Pro PLUS NDX real-time alerts, high-conviction LEAPS framework, and advanced risk scaling education

All tiers include our 30-day action-based money-back guarantee. Most serious traders choose Execute for maximum edge.',
  10,
  '{"tags": ["pricing", "tiers", "guarantee"]}'::jsonb
),

(
  'pricing',
  'What is the difference between Core, Pro, and Execute? | Which tier should I choose? | Core vs Pro vs Execute',
  'Here''s the breakdown:

**Core Sniper ($199)** is for disciplined traders who want full market exposure with SPX day trades and morning watchlists.

**Pro Sniper ($299)** adds LEAPS and swing trade strategies for traders scaling beyond day trades - more patience and strategy, not just speed.

**Execute Sniper ($499)** is for serious traders only. You get advanced NDX real-time alerts, high-conviction LEAPS, and maximum execution edge.

Think of it as: Core = Foundation, Pro = Advanced Strategy, Execute = Maximum Conviction.

Which tier sounds right for your trading goals?',
  10,
  '{"tags": ["pricing", "comparison", "tiers"]}'::jsonb
);

-- Proof/Results questions
insert into knowledge_base (category, question, answer, image_urls, priority, metadata) values
(
  'proof',
  'Do you have proof? | Show me results | Can I see recent wins? | Track record? | Is this legit? | Real results?',
  'Absolutely! Our verified win rate is **87% over 8+ years** of trading.

We target **100%+ returns per trade** with exact entries, stop losses, and take profits.

Recent member wins:
• NVDA call: +203%
• TSLA put: +156%
• AMD call: +167%
• SPY call: +142%

Every alert includes the full setup so you can learn AND earn. Want to see what our members are saying?',
  null,
  10,
  '{"tags": ["proof", "results", "wins", "credibility"]}'::jsonb
);

-- How it works
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'features',
  'How does it work? | What do I get? | How do you send alerts? | What happens after I join?',
  'Here''s exactly how it works:

1. **Instant Access** - Join and get immediate Discord invite
2. **Daily Alerts** - Receive 1-3 high-quality trade setups during market hours (9:30am-4pm ET)
3. **Complete Details** - Every alert includes exact entry price, stop loss, and take profit levels
4. **Real-Time Notifications** - Get instant Discord notifications on your phone/desktop
5. **Educational Commentary** - Learn the "why" behind each trade with detailed rationale

You''re not just getting signals - you''re learning a proven strategy from traders with 8+ years of experience.',
  9,
  '{"tags": ["features", "process", "onboarding"]}'::jsonb
),

(
  'features',
  'What makes you different? | Why TradeITM? | How are you better than other services?',
  'Three things set us apart:

**1. Execution-Focused Education** - We don''t just send alerts. Every trade includes the rationale, market structure insight, and position building logic so you actually learn.

**2. Verified Results** - 87% win rate over 8+ years, averaging 100%+ returns per trade. No fluff, just documented wins.

**3. Selective Community** - We limit Execute tier to serious traders only. You''re joining a community of disciplined traders, not hype-chasers.

Most services sell dreams. We teach edge.',
  8,
  '{"tags": ["differentiation", "value-prop", "education"]}'::jsonb
);

-- Guarantee
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'faq',
  'Money back guarantee? | Can I get a refund? | Risk free? | What if I don''t like it?',
  'Yes! We offer a **30-day action-based money-back guarantee**.

Here''s how it works:
- Follow our trade alerts for 30 days
- Execute the setups we provide
- If you don''t see value, we''ll refund you

We''re confident in our edge because our members consistently hit 100%+ returns per trade.

*Terms and conditions apply - must demonstrate you''ve actively followed alerts.',
  9,
  '{"tags": ["guarantee", "refund", "risk"]}'::jsonb
);

-- Timing/Frequency
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'faq',
  'How many alerts per day? | When do alerts come? | How often? | Alert timing?',
  'You''ll receive **1-3 high-quality trade setups daily** during market hours (9:30am-4pm ET).

We focus on quality over quantity. Every alert is a setup our founder would take personally.

**Core tier**: SPX day trades
**Pro tier**: SPX + LEAPS + swing trades
**Execute tier**: SPX + LEAPS + NDX real-time alerts

Alerts come via instant Discord notifications, so you never miss an opportunity.',
  8,
  '{"tags": ["frequency", "timing", "alerts"]}'::jsonb
);

-- Requirements
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'faq',
  'How much money do I need? | Account size? | Minimum to start? | How much capital?',
  'We recommend:
- **Minimum: $1,000** to properly manage risk
- **Ideal: $5,000+** for full position sizing

Our risk management education (included in all tiers) teaches proper position sizing based on your account size.

Remember: Risk management is MORE important than the signals themselves. We''ll teach you both.',
  7,
  '{"tags": ["capital", "requirements", "risk-management"]}'::jsonb
),

(
  'faq',
  'Do I need experience? | Beginner friendly? | New to trading?',
  'All levels welcome!

**Beginners**: You''ll learn from day one with our educational commentary explaining every setup. We teach position sizing, risk management, and market structure.

**Experienced traders**: You''ll appreciate our high-conviction setups and advanced analysis in Pro/Execute tiers.

The key is discipline. We provide the edge, you need the discipline to follow the plan.',
  7,
  '{"tags": ["experience", "beginners", "education"]}'::jsonb
);

-- Platform/Technical
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'technical',
  'What platform? | What broker? | TD Ameritrade? | Robinhood? | Which app?',
  'Our alerts work with **any broker** that supports options trading:
- TD Ameritrade / ThinkorSwim
- Robinhood
- Webull
- Interactive Brokers
- Fidelity
- Charles Schwab
- E*TRADE

We provide the exact trade details (ticker, strike, expiration, entry/exit). You execute on your preferred platform.',
  6,
  '{"tags": ["platform", "broker", "technical"]}'::jsonb
);

-- Testimonials/Social Proof
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'proof',
  'What do members say? | Testimonials? | Reviews? | Success stories?',
  'Here''s what our members are saying:

**Michael C.** (Execute tier): "Turned $2,500 into $11,200 in my first month. The NVDA call alone was +203%."

**Sarah R.** (Pro tier): "Made back my entire membership cost in 2 days. Last week''s TSLA play hit +156%."

**David P.** (Execute tier): "$8,400 profit this month. My account has grown 180% in 6 months. Best investment I''ve made."

These aren''t cherry-picked wins - our 87% win rate is verified across 8+ years.',
  8,
  '{"tags": ["testimonials", "social-proof", "reviews"]}'::jsonb
);

-- Escalation triggers
insert into knowledge_base (category, question, answer, priority, metadata) values
(
  'escalation',
  'speak to human | talk to person | real person | agent | representative | customer service',
  '[ESCALATE] The visitor has requested to speak with a human team member.',
  10,
  '{"auto_escalate": true}'::jsonb
),

(
  'escalation',
  'ready to join | sign up now | how do I start | take my money | want to buy | ready to subscribe',
  '[ESCALATE] High-value lead ready to purchase.',
  10,
  '{"auto_escalate": true, "lead_score": 9}'::jsonb
),

(
  'escalation',
  'execute tier | $499 | serious trader | 6 figure | large account | professional trader',
  '[ESCALATE] High-value Execute tier interest detected.',
  10,
  '{"auto_escalate": true, "lead_score": 8}'::jsonb
);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
do $$
begin
  raise notice 'Chat system database schema created successfully!';
  raise notice 'Tables created: chat_conversations, chat_messages, knowledge_base, team_members, team_typing_indicators, chat_analytics, suggested_kb_entries';
  raise notice 'Initial knowledge base entries: % rows', (select count(*) from knowledge_base);
end $$;
