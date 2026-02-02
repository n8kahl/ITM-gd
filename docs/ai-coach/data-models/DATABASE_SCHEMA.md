# AI Coach - Database Schema

**Status**: Ready for Implementation
**Last Updated**: 2026-02-03
**Version**: 1.0

---

## Overview

Complete PostgreSQL schema for AI Coach feature. All tables use Supabase (existing TITM database).

---

## Tables

### 1. ai_coach_users

**Purpose**: User profiles, subscription tiers, usage tracking

```sql
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

-- Indexes
CREATE INDEX idx_ai_coach_users_user_id ON ai_coach_users(user_id);
CREATE INDEX idx_ai_coach_users_subscription_tier ON ai_coach_users(subscription_tier);

-- RLS Policies
ALTER TABLE ai_coach_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON ai_coach_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON ai_coach_users FOR UPDATE
  USING (auth.uid() = user_id);
```

**Preferences JSONB Structure**:
```json
{
  "defaultSymbol": "SPX",
  "defaultTimeframe": "5m",
  "enableNotifications": true,
  "notificationChannels": ["in-app", "email"],
  "tradingStyle": "day-trading",
  "riskTolerance": "moderate"
}
```

---

### 2. ai_coach_sessions

**Purpose**: Chat sessions

```sql
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

-- Indexes
CREATE INDEX idx_ai_coach_sessions_user_id ON ai_coach_sessions(user_id);
CREATE INDEX idx_ai_coach_sessions_created_at ON ai_coach_sessions(created_at DESC);

-- RLS Policies
ALTER TABLE ai_coach_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON ai_coach_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON ai_coach_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON ai_coach_sessions FOR UPDATE
  USING (auth.uid() = user_id);
```

---

### 3. ai_coach_messages

**Purpose**: Chat message history

```sql
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

-- Indexes
CREATE INDEX idx_ai_coach_messages_session_id ON ai_coach_messages(session_id);
CREATE INDEX idx_ai_coach_messages_user_id ON ai_coach_messages(user_id);
CREATE INDEX idx_ai_coach_messages_created_at ON ai_coach_messages(created_at DESC);

-- RLS Policies
ALTER TABLE ai_coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON ai_coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON ai_coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Function Call JSONB Structure**:
```json
{
  "name": "get_key_levels",
  "arguments": {
    "symbol": "SPX",
    "timeframe": "intraday"
  },
  "called_at": "2026-02-03T12:05:30Z"
}
```

---

### 4. ai_coach_positions

**Purpose**: User positions (from screenshots or manual entry)

```sql
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

-- Indexes
CREATE INDEX idx_ai_coach_positions_user_id ON ai_coach_positions(user_id);
CREATE INDEX idx_ai_coach_positions_symbol ON ai_coach_positions(symbol);
CREATE INDEX idx_ai_coach_positions_status ON ai_coach_positions(status);
CREATE INDEX idx_ai_coach_positions_expiry ON ai_coach_positions(expiry) WHERE status = 'open';

-- RLS Policies
ALTER TABLE ai_coach_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON ai_coach_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON ai_coach_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON ai_coach_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON ai_coach_positions FOR DELETE
  USING (auth.uid() = user_id);
```

**Greeks JSONB Structure**:
```json
{
  "delta": 0.62,
  "gamma": 0.015,
  "theta": -32.00,
  "vega": 85.00,
  "calculatedAt": "2026-02-03T12:05:00Z"
}
```

---

### 5. ai_coach_trades

**Purpose**: Trade journal (closed positions)

```sql
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

-- Indexes
CREATE INDEX idx_ai_coach_trades_user_id ON ai_coach_trades(user_id);
CREATE INDEX idx_ai_coach_trades_symbol ON ai_coach_trades(symbol);
CREATE INDEX idx_ai_coach_trades_strategy ON ai_coach_trades(strategy);
CREATE INDEX idx_ai_coach_trades_entry_date ON ai_coach_trades(entry_date DESC);
CREATE INDEX idx_ai_coach_trades_outcome ON ai_coach_trades(trade_outcome);

-- RLS Policies
ALTER TABLE ai_coach_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
  ON ai_coach_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON ai_coach_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON ai_coach_trades FOR UPDATE
  USING (auth.uid() = user_id);
```

**Entry Context JSONB Structure**:
```json
{
  "currentPrice": 5912.50,
  "pdh": 5930.00,
  "pml": 5885.00,
  "vwap": 5900.00,
  "atr": 47.25,
  "timeOfDay": "10:45 AM",
  "ivRank": 42,
  "technicalSetup": "Bounced off PMH support"
}
```

---

### 6. ai_coach_alerts

**Purpose**: User-configured price alerts

```sql
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

-- Indexes
CREATE INDEX idx_ai_coach_alerts_user_id ON ai_coach_alerts(user_id);
CREATE INDEX idx_ai_coach_alerts_symbol ON ai_coach_alerts(symbol);
CREATE INDEX idx_ai_coach_alerts_status ON ai_coach_alerts(status) WHERE status = 'active';

-- RLS Policies
ALTER TABLE ai_coach_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON ai_coach_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON ai_coach_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON ai_coach_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON ai_coach_alerts FOR DELETE
  USING (auth.uid() = user_id);
```

---

### 7. ai_coach_levels_cache

**Purpose**: Cached level calculations (Redis backup)

```sql
CREATE TABLE ai_coach_levels_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  levels_data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(symbol, timeframe)
);

-- Indexes
CREATE INDEX idx_ai_coach_levels_cache_symbol ON ai_coach_levels_cache(symbol);
CREATE INDEX idx_ai_coach_levels_cache_expires_at ON ai_coach_levels_cache(expires_at);

-- No RLS - Backend only table
```

**Levels Data JSONB Structure**:
```json
{
  "currentPrice": 5912.50,
  "resistance": [
    {
      "type": "PDH",
      "price": 5930.00,
      "distance": 17.50,
      "distancePct": 0.30,
      "distanceATR": 0.4
    }
  ],
  "support": [
    {
      "type": "PMH",
      "price": 5885.00,
      "distance": -27.50,
      "distancePct": -0.46,
      "distanceATR": -0.6
    }
  ],
  "pivots": {
    "standard": {
      "pp": 5890.00,
      "r1": 5910.00,
      "s1": 5870.00
    }
  },
  "indicators": {
    "vwap": 5900.00,
    "atr14": 47.25
  }
}
```

---

## Database Functions

### Function: Reset Query Count Monthly

```sql
CREATE OR REPLACE FUNCTION reset_query_counts()
RETURNS void AS $$
BEGIN
  UPDATE ai_coach_users
  SET
    query_count = 0,
    billing_period_start = now(),
    billing_period_end = now() + interval '1 month'
  WHERE billing_period_end < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule to run daily
-- (Use pg_cron or external scheduler)
```

### Function: Calculate Portfolio Greeks

```sql
CREATE OR REPLACE FUNCTION calculate_portfolio_greeks(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'netDelta', COALESCE(SUM((greeks->>'delta')::DECIMAL * quantity), 0),
    'netGamma', COALESCE(SUM((greeks->>'gamma')::DECIMAL * quantity), 0),
    'netTheta', COALESCE(SUM((greeks->>'theta')::DECIMAL * quantity), 0),
    'netVega', COALESCE(SUM((greeks->>'vega')::DECIMAL * quantity), 0)
  ) INTO result
  FROM ai_coach_positions
  WHERE user_id = p_user_id
    AND status = 'open'
    AND greeks IS NOT NULL;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: SELECT calculate_portfolio_greeks('user-uuid-here');
```

### Function: Auto-Generate Trade from Closed Position

```sql
CREATE OR REPLACE FUNCTION position_to_trade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status = 'open' THEN
    INSERT INTO ai_coach_trades (
      user_id,
      symbol,
      position_type,
      strategy,
      entry_date,
      entry_price,
      exit_date,
      exit_price,
      quantity,
      pnl,
      pnl_pct,
      hold_time_days,
      trade_outcome
    ) VALUES (
      NEW.user_id,
      NEW.symbol,
      NEW.position_type,
      NEW.position_type, -- Could be smarter mapping
      NEW.entry_date,
      NEW.entry_price,
      NEW.close_date,
      NEW.close_price,
      NEW.quantity,
      NEW.pnl,
      NEW.pnl_pct,
      NEW.close_date - NEW.entry_date,
      CASE
        WHEN NEW.pnl > 0 THEN 'win'
        WHEN NEW.pnl < 0 THEN 'loss'
        ELSE 'breakeven'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER position_closed_trigger
  AFTER UPDATE ON ai_coach_positions
  FOR EACH ROW
  EXECUTE FUNCTION position_to_trade();
```

---

## Migrations

### Migration 1: Create Schema

File: `/supabase/migrations/20260203000001_ai_coach_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables (paste table definitions above)
-- ... (all CREATE TABLE statements)
```

### Migration 2: RLS Policies

File: `/supabase/migrations/20260203000002_ai_coach_rls.sql`

```sql
-- Enable RLS and create policies (paste RLS statements above)
-- ... (all RLS policies)
```

### Migration 3: Functions and Triggers

File: `/supabase/migrations/20260203000003_ai_coach_functions.sql`

```sql
-- Create functions (paste function definitions above)
-- ... (all CREATE FUNCTION and TRIGGER statements)
```

---

## Sample Data for Testing

```sql
-- Insert test user
INSERT INTO ai_coach_users (user_id, subscription_tier, query_limit)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Replace with real user UUID
  'pro',
  500
);

-- Insert test position
INSERT INTO ai_coach_positions (
  user_id,
  symbol,
  position_type,
  strike,
  expiry,
  quantity,
  entry_price,
  entry_date,
  current_price,
  greeks
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'SPX',
  'call',
  5900.00,
  '2026-02-07',
  10,
  45.20,
  '2026-02-01',
  52.80,
  '{"delta": 0.62, "gamma": 0.015, "theta": -32.00, "vega": 85.00}'::jsonb
);

-- Insert test alert
INSERT INTO ai_coach_alerts (
  user_id,
  symbol,
  alert_type,
  target_value,
  notification_channels
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'SPX',
  'price_above',
  5930.00,
  ARRAY['in-app', 'email']
);
```

---

## Database Backup & Maintenance

### Backup Strategy
- Supabase handles automatic backups (daily)
- Point-in-time recovery available
- Manual backups before major migrations

### Data Retention
- `ai_coach_messages`: Keep 90 days, then archive to cold storage
- `ai_coach_positions`: Keep all (user's trade history)
- `ai_coach_trades`: Keep all (permanent journal)
- `ai_coach_levels_cache`: Auto-expire old entries (TTL in expires_at column)

### Cleanup Jobs
```sql
-- Delete old cache entries (run daily)
DELETE FROM ai_coach_levels_cache
WHERE expires_at < now();

-- Archive old messages (run monthly)
-- Move messages older than 90 days to separate archive table
```

---

## Performance Optimization

### Query Optimization
- Use composite indexes for common queries
- Partition large tables if needed (e.g., messages by month)
- Use JSONB indexes for frequent JSONB queries

### Example JSONB Index
```sql
-- If you frequently query by Greeks values
CREATE INDEX idx_positions_greeks_delta
  ON ai_coach_positions ((greeks->>'delta'));
```

### Connection Pooling
- Use Supabase connection pooler
- Max connections: 100 (adjust based on load)

---

## Related Documentation

- [SYSTEM_OVERVIEW.md](../architecture/SYSTEM_OVERVIEW.md) - Overall architecture
- [API_CONTRACTS.md](../architecture/API_CONTRACTS.md) - API endpoints using this schema
- [TRADE_JOURNAL_SPEC.md](../features/trade-journal/SPEC.md) - Trade journal feature

---

**Document Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Nate | Complete database schema with 7 tables, functions, triggers |
