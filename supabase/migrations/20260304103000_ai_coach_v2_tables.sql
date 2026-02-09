-- AI Coach V2 database tables and trade-journal extensions.
-- Mirrors the V2 rebuild specification while keeping migrations idempotent.

-- ============================================
-- Helper trigger for updated_at columns
-- ============================================
CREATE OR REPLACE FUNCTION update_ai_coach_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1) Morning Briefs
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_morning_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_date DATE NOT NULL,
  brief_data JSONB NOT NULL,
  viewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, market_date)
);

ALTER TABLE ai_coach_morning_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_view_own_briefs ON ai_coach_morning_briefs;
CREATE POLICY users_view_own_briefs
  ON ai_coach_morning_briefs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_update_own_briefs ON ai_coach_morning_briefs;
CREATE POLICY users_update_own_briefs
  ON ai_coach_morning_briefs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS service_insert_briefs ON ai_coach_morning_briefs;
CREATE POLICY service_insert_briefs
  ON ai_coach_morning_briefs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_briefs_user_date
  ON ai_coach_morning_briefs(user_id, market_date DESC);

DROP TRIGGER IF EXISTS trigger_update_ai_coach_morning_briefs_updated_at ON ai_coach_morning_briefs;
CREATE TRIGGER trigger_update_ai_coach_morning_briefs_updated_at
  BEFORE UPDATE ON ai_coach_morning_briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_coach_v2_updated_at();

-- ============================================
-- 2) Detected Setups (system backtesting data)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_detected_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  setup_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'neutral')),
  signal_data JSONB NOT NULL,
  trade_suggestion JSONB,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'expired') OR outcome IS NULL),
  outcome_data JSONB,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_setups_symbol_type
  ON ai_coach_detected_setups(symbol, setup_type);
CREATE INDEX IF NOT EXISTS idx_setups_detected_at
  ON ai_coach_detected_setups(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_setups_outcome
  ON ai_coach_detected_setups(outcome) WHERE outcome IS NOT NULL;

-- ============================================
-- 3) User Watchlists
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  symbols TEXT[] NOT NULL DEFAULT ARRAY['SPX', 'NDX', 'SPY', 'QQQ'],
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_coach_watchlists_name_not_blank CHECK (length(btrim(name)) > 0)
);

ALTER TABLE ai_coach_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_watchlists ON ai_coach_watchlists;
CREATE POLICY users_manage_own_watchlists
  ON ai_coach_watchlists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watchlists_user
  ON ai_coach_watchlists(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlists_one_default_per_user
  ON ai_coach_watchlists(user_id) WHERE is_default = true;

DROP TRIGGER IF EXISTS trigger_update_ai_coach_watchlists_updated_at ON ai_coach_watchlists;
CREATE TRIGGER trigger_update_ai_coach_watchlists_updated_at
  BEFORE UPDATE ON ai_coach_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_coach_v2_updated_at();

-- ============================================
-- 4) Earnings Cache
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_earnings_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  earnings_date DATE NOT NULL,
  analysis_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '4 hours'),
  UNIQUE(symbol, earnings_date)
);

CREATE INDEX IF NOT EXISTS idx_earnings_symbol
  ON ai_coach_earnings_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_date
  ON ai_coach_earnings_cache(earnings_date);
CREATE INDEX IF NOT EXISTS idx_earnings_expires_at
  ON ai_coach_earnings_cache(expires_at);

-- ============================================
-- 5) Journal Insights
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_journal_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  insight_data JSONB NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_coach_journal_insights_period_check CHECK (period_end >= period_start)
);

ALTER TABLE ai_coach_journal_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_view_own_insights ON ai_coach_journal_insights;
CREATE POLICY users_view_own_insights
  ON ai_coach_journal_insights
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS service_insert_insights ON ai_coach_journal_insights;
CREATE POLICY service_insert_insights
  ON ai_coach_journal_insights
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_insights_user_period
  ON ai_coach_journal_insights(user_id, period_end DESC);

-- ============================================
-- 6) User Preferences (expanded)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_coach_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  default_risk_per_trade NUMERIC(10, 2) NOT NULL DEFAULT 100.00 CHECK (default_risk_per_trade >= 0),
  default_account_size NUMERIC(12, 2) CHECK (default_account_size IS NULL OR default_account_size >= 0),
  orb_period INTEGER NOT NULL DEFAULT 15 CHECK (orb_period IN (5, 15, 30)),
  chart_indicators JSONB NOT NULL DEFAULT '{"ema8": true, "ema21": true, "vwap": true, "rsi": false, "macd": false}',
  notification_preferences JSONB NOT NULL DEFAULT '{"setups": true, "alerts": true, "positionAdvice": true, "morningBrief": true}',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_coach_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_prefs ON ai_coach_user_preferences;
CREATE POLICY users_manage_own_prefs
  ON ai_coach_user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_ai_coach_user_preferences_updated_at ON ai_coach_user_preferences;
CREATE TRIGGER trigger_update_ai_coach_user_preferences_updated_at
  BEFORE UPDATE ON ai_coach_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_coach_v2_updated_at();

-- ============================================
-- 7) Add draft_status to existing ai_coach_trades
-- ============================================
ALTER TABLE ai_coach_trades
  ADD COLUMN IF NOT EXISTS draft_status TEXT DEFAULT 'published'
  CHECK (draft_status IN ('draft', 'reviewed', 'published'));

ALTER TABLE ai_coach_trades
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false;

ALTER TABLE ai_coach_trades
  ADD COLUMN IF NOT EXISTS session_context JSONB;

CREATE INDEX IF NOT EXISTS idx_trades_draft_status
  ON ai_coach_trades(user_id, draft_status)
  WHERE draft_status = 'draft';

