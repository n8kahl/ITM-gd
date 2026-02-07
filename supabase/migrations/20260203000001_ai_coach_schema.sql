-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: ai_coach_users
-- Purpose: User profiles, subscription tiers, usage tracking
CREATE TABLE ai_coach_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('lite', 'pro', 'elite')),
  query_count INTEGER NOT NULL DEFAULT 0,
  query_limit INTEGER NOT NULL, -- Set based on tier: lite=100, pro=500, elite=999999
  billing_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Indexes for ai_coach_users
CREATE INDEX idx_ai_coach_users_user_id ON ai_coach_users(user_id);
CREATE INDEX idx_ai_coach_users_subscription_tier ON ai_coach_users(subscription_tier);

-- Table 2: ai_coach_sessions
-- Purpose: Chat sessions
CREATE TABLE ai_coach_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- Auto-generated from first message
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for ai_coach_sessions
CREATE INDEX idx_ai_coach_sessions_user_id ON ai_coach_sessions(user_id);
CREATE INDEX idx_ai_coach_sessions_created_at ON ai_coach_sessions(created_at DESC);

-- Table 3: ai_coach_messages
-- Purpose: Chat message history
CREATE TABLE ai_coach_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES ai_coach_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  function_call JSONB, -- If AI called a function
  function_response JSONB, -- Response from function
  tokens_used INTEGER, -- For cost tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for ai_coach_messages
CREATE INDEX idx_ai_coach_messages_session_id ON ai_coach_messages(session_id);
CREATE INDEX idx_ai_coach_messages_user_id ON ai_coach_messages(user_id);
CREATE INDEX idx_ai_coach_messages_created_at ON ai_coach_messages(created_at DESC);

-- Table 4: ai_coach_positions
-- Purpose: User positions (from screenshots or manual entry)
CREATE TABLE ai_coach_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL, -- SPX, NDX, etc.
  position_type TEXT NOT NULL CHECK (position_type IN ('call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock', 'other')),
  strike DECIMAL(10,2), -- NULL for stock positions
  expiry DATE, -- NULL for stock positions
  quantity INTEGER NOT NULL,
  entry_price DECIMAL(10,2) NOT NULL,
  entry_date DATE NOT NULL,
  current_price DECIMAL(10,2), -- Updated periodically
  current_value DECIMAL(10,2), -- calculated: quantity * current_price * 100
  pnl DECIMAL(10,2), -- calculated: (current_price - entry_price) * quantity * 100
  pnl_pct DECIMAL(5,2), -- calculated: (current_price - entry_price) / entry_price * 100
  greeks JSONB, -- {delta, gamma, theta, vega}
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  close_date DATE,
  close_price DECIMAL(10,2),
  notes TEXT,
  tags TEXT[], -- For categorization
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'screenshot', 'csv_import')),
  screenshot_url TEXT, -- If uploaded via screenshot
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for ai_coach_positions
CREATE INDEX idx_ai_coach_positions_user_id ON ai_coach_positions(user_id);
CREATE INDEX idx_ai_coach_positions_symbol ON ai_coach_positions(symbol);
CREATE INDEX idx_ai_coach_positions_status ON ai_coach_positions(status);
CREATE INDEX idx_ai_coach_positions_expiry ON ai_coach_positions(expiry) WHERE status = 'open';

-- Table 5: ai_coach_trades
-- Purpose: Trade journal (closed positions)
CREATE TABLE ai_coach_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  position_type TEXT NOT NULL,
  strategy TEXT, -- "iron_condor", "call_debit_spread", etc.
  entry_date DATE NOT NULL,
  entry_price DECIMAL(10,2) NOT NULL,
  exit_date DATE NOT NULL,
  exit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  pnl DECIMAL(10,2) NOT NULL, -- Final P&L
  pnl_pct DECIMAL(5,2) NOT NULL,
  hold_time_days INTEGER NOT NULL, -- exit_date - entry_date
  trade_outcome TEXT NOT NULL CHECK (trade_outcome IN ('win', 'loss', 'breakeven')),
  entry_context JSONB, -- Market conditions at entry
  exit_reason TEXT,
  lessons_learned TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for ai_coach_trades
CREATE INDEX idx_ai_coach_trades_user_id ON ai_coach_trades(user_id);
CREATE INDEX idx_ai_coach_trades_symbol ON ai_coach_trades(symbol);
CREATE INDEX idx_ai_coach_trades_strategy ON ai_coach_trades(strategy);
CREATE INDEX idx_ai_coach_trades_entry_date ON ai_coach_trades(entry_date DESC);
CREATE INDEX idx_ai_coach_trades_outcome ON ai_coach_trades(trade_outcome);

-- Table 6: ai_coach_alerts
-- Purpose: User-configured price alerts
CREATE TABLE ai_coach_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'level_approach', 'level_break', 'volume_spike')),
  target_value DECIMAL(10,2) NOT NULL, -- Price level or threshold
  condition_met BOOLEAN NOT NULL DEFAULT false,
  triggered_at TIMESTAMPTZ,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_channels TEXT[], -- ['in-app', 'email', 'push']
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ -- Optional expiry
);

-- Indexes for ai_coach_alerts
CREATE INDEX idx_ai_coach_alerts_user_id ON ai_coach_alerts(user_id);
CREATE INDEX idx_ai_coach_alerts_symbol ON ai_coach_alerts(symbol);
CREATE INDEX idx_ai_coach_alerts_status ON ai_coach_alerts(status) WHERE status = 'active';

-- Table 7: ai_coach_levels_cache
-- Purpose: Cached level calculations (Redis backup)
CREATE TABLE ai_coach_levels_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  levels_data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(symbol, timeframe)
);

-- Indexes for ai_coach_levels_cache
CREATE INDEX idx_ai_coach_levels_cache_symbol ON ai_coach_levels_cache(symbol);
CREATE INDEX idx_ai_coach_levels_cache_expires_at ON ai_coach_levels_cache(expires_at);
