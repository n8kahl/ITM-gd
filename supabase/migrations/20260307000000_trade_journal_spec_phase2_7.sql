-- Trade Journal Spec Implementation (Phases 2-7)
-- Adds advanced journal analytics fields, playbooks, behavioral insights,
-- import history, draft workflow fields, dashboard layout persistence,
-- and analytics RPC/materialized cache.

-- ============================================
-- 1) journal_entries extensions
-- ============================================
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC,
  ADD COLUMN IF NOT EXISTS initial_target NUMERIC,
  ADD COLUMN IF NOT EXISTS strategy TEXT,
  ADD COLUMN IF NOT EXISTS hold_duration_min INTEGER,
  ADD COLUMN IF NOT EXISTS mfe_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS mae_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS strike_price NUMERIC,
  ADD COLUMN IF NOT EXISTS expiration_date DATE,
  ADD COLUMN IF NOT EXISTS dte_at_entry INTEGER,
  ADD COLUMN IF NOT EXISTS dte_at_exit INTEGER,
  ADD COLUMN IF NOT EXISTS iv_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS iv_at_exit NUMERIC,
  ADD COLUMN IF NOT EXISTS delta_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS theta_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS gamma_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS vega_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS underlying_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS underlying_at_exit NUMERIC,
  ADD COLUMN IF NOT EXISTS mood_before TEXT,
  ADD COLUMN IF NOT EXISTS mood_after TEXT,
  ADD COLUMN IF NOT EXISTS discipline_score INTEGER,
  ADD COLUMN IF NOT EXISTS followed_plan BOOLEAN,
  ADD COLUMN IF NOT EXISTS deviation_notes TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS draft_status TEXT,
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS draft_expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_contract_type_check'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_contract_type_check
      CHECK (contract_type IS NULL OR contract_type IN ('stock', 'call', 'put', 'spread'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_mood_before_check'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_mood_before_check
      CHECK (mood_before IS NULL OR mood_before IN ('confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_mood_after_check'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_mood_after_check
      CHECK (mood_after IS NULL OR mood_after IN ('confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_discipline_score_check'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_discipline_score_check
      CHECK (discipline_score IS NULL OR discipline_score BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_draft_status_check'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_draft_status_check
      CHECK (draft_status IS NULL OR draft_status IN ('pending', 'confirmed', 'dismissed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_strategy ON journal_entries(user_id, strategy) WHERE strategy IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_contract_type ON journal_entries(user_id, contract_type) WHERE contract_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_draft_status ON journal_entries(user_id, draft_status) WHERE draft_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_session_id ON journal_entries(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_mood_before ON journal_entries(user_id, mood_before) WHERE mood_before IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_mood_after ON journal_entries(user_id, mood_after) WHERE mood_after IS NOT NULL;

COMMENT ON COLUMN journal_entries.stop_loss IS 'Stop loss used for R-multiple and risk metrics';
COMMENT ON COLUMN journal_entries.initial_target IS 'Initial target used for reward/risk analysis';
COMMENT ON COLUMN journal_entries.mfe_percent IS 'Maximum favorable excursion percent during trade';
COMMENT ON COLUMN journal_entries.mae_percent IS 'Maximum adverse excursion percent during trade';
COMMENT ON COLUMN journal_entries.contract_type IS 'stock/call/put/spread';
COMMENT ON COLUMN journal_entries.session_id IS 'AI Coach session UUID associated with the trade';
COMMENT ON COLUMN journal_entries.draft_status IS 'pending/confirmed/dismissed for auto-journal workflow';

-- ============================================
-- 2) Playbooks
-- ============================================
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB,
  entry_criteria TEXT,
  exit_criteria TEXT,
  risk_rules TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT playbooks_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_playbooks ON playbooks;
CREATE POLICY users_manage_own_playbooks
  ON playbooks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_playbooks_user_active ON playbooks(user_id, is_active, updated_at DESC);

DROP TRIGGER IF EXISTS trigger_update_playbooks_updated_at ON playbooks;
CREATE TRIGGER trigger_update_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entry_updated_at();

-- ============================================
-- 3) Behavioral insights
-- ============================================
CREATE TABLE IF NOT EXISTS ai_behavioral_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB,
  recommendation TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'positive')),
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_behavioral_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_behavioral_insights ON ai_behavioral_insights;
CREATE POLICY users_manage_own_behavioral_insights
  ON ai_behavioral_insights
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_behavioral_insights_user_date ON ai_behavioral_insights(user_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_behavioral_insights_user_dismissed ON ai_behavioral_insights(user_id, is_dismissed, created_at DESC);

-- ============================================
-- 4) Import history
-- ============================================
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_import_history ON import_history;
CREATE POLICY users_manage_own_import_history
  ON import_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_import_history_user_created_at ON import_history(user_id, created_at DESC);

-- ============================================
-- 5) Dashboard layout persistence
-- ============================================
ALTER TABLE ai_coach_user_preferences
  ADD COLUMN IF NOT EXISTS dashboard_layout JSONB;

COMMENT ON COLUMN ai_coach_user_preferences.dashboard_layout IS 'Custom analytics/dashboard widget layout for member dashboard';

-- ============================================
-- 6) Materialized analytics cache
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS journal_analytics_cache;

CREATE MATERIALIZED VIEW journal_analytics_cache AS
SELECT
  user_id,
  COUNT(*)::BIGINT AS total_trades,
  COUNT(*) FILTER (WHERE pnl > 0)::BIGINT AS winning_trades,
  COUNT(*) FILTER (WHERE pnl < 0)::BIGINT AS losing_trades,
  COALESCE(SUM(pnl), 0) AS total_pnl,
  COALESCE(AVG(pnl), 0) AS avg_pnl,
  COALESCE(MAX(pnl), 0) AS best_trade,
  COALESCE(MIN(pnl), 0) AS worst_trade,
  COALESCE(AVG(discipline_score), 0) AS avg_discipline_score,
  NOW() AS refreshed_at
FROM journal_entries
GROUP BY user_id;

CREATE UNIQUE INDEX idx_journal_analytics_cache_user_id
  ON journal_analytics_cache(user_id);

CREATE OR REPLACE FUNCTION refresh_journal_analytics_cache_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW journal_analytics_cache;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_journal_analytics_cache ON journal_entries;
CREATE TRIGGER trigger_refresh_journal_analytics_cache
  AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_journal_analytics_cache_trigger();

-- ============================================
-- 7) Advanced analytics RPC
-- ============================================
CREATE OR REPLACE FUNCTION get_advanced_analytics(target_user_id UUID, period TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  period_start TIMESTAMPTZ;
  result JSONB;
BEGIN
  IF auth.uid() IS DISTINCT FROM target_user_id
     AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = false
  THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  CASE period
    WHEN '7d' THEN period_start := NOW() - INTERVAL '7 days';
    WHEN '30d' THEN period_start := NOW() - INTERVAL '30 days';
    WHEN '90d' THEN period_start := NOW() - INTERVAL '90 days';
    WHEN '1y' THEN period_start := NOW() - INTERVAL '365 days';
    ELSE period_start := NOW() - INTERVAL '30 days';
  END CASE;

  WITH scoped AS (
    SELECT *
    FROM journal_entries
    WHERE user_id = target_user_id
      AND trade_date >= period_start
  ),
  closed AS (
    SELECT *
    FROM scoped
    WHERE pnl IS NOT NULL
  ),
  r_values AS (
    SELECT
      id,
      trade_date,
      CASE
        WHEN stop_loss IS NULL THEN NULL
        WHEN direction = 'long' AND entry_price IS NOT NULL AND stop_loss IS NOT NULL AND exit_price IS NOT NULL
          AND (entry_price - stop_loss) <> 0
          THEN (exit_price - entry_price) / NULLIF(entry_price - stop_loss, 0)
        WHEN direction = 'short' AND entry_price IS NOT NULL AND stop_loss IS NOT NULL AND exit_price IS NOT NULL
          AND (stop_loss - entry_price) <> 0
          THEN (entry_price - exit_price) / NULLIF(stop_loss - entry_price, 0)
        ELSE NULL
      END AS r_multiple
    FROM closed
  ),
  equity AS (
    SELECT
      id,
      trade_date,
      COALESCE(pnl, 0) AS pnl,
      SUM(COALESCE(pnl, 0)) OVER (ORDER BY trade_date, created_at, id) AS equity_curve
    FROM closed
  ),
  drawdowns AS (
    SELECT
      id,
      trade_date,
      equity_curve,
      MAX(equity_curve) OVER (ORDER BY trade_date, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_peak
    FROM equity
  ),
  drawdown_runs AS (
    SELECT
      id,
      trade_date,
      CASE WHEN equity_curve < running_peak THEN 1 ELSE 0 END AS in_drawdown,
      SUM(CASE WHEN equity_curve >= running_peak THEN 1 ELSE 0 END)
        OVER (ORDER BY trade_date, id) AS reset_group
    FROM drawdowns
  ),
  drawdown_durations AS (
    SELECT
      COUNT(*)::INT AS streak
    FROM drawdown_runs
    WHERE in_drawdown = 1
    GROUP BY reset_group
  ),
  ordered AS (
    SELECT
      id,
      trade_date,
      pnl,
      SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) OVER (ORDER BY trade_date, id) AS win_group,
      SUM(CASE WHEN pnl >= 0 THEN 1 ELSE 0 END) OVER (ORDER BY trade_date, id) AS loss_group
    FROM closed
  ),
  win_runs AS (
    SELECT win_group, COUNT(*)::INT AS streak
    FROM ordered
    WHERE pnl > 0
    GROUP BY win_group
  ),
  loss_runs AS (
    SELECT loss_group, COUNT(*)::INT AS streak
    FROM ordered
    WHERE pnl < 0
    GROUP BY loss_group
  ),
  hourly AS (
    SELECT
      EXTRACT(HOUR FROM trade_date AT TIME ZONE 'America/New_York')::INT AS hour_of_day,
      COALESCE(SUM(pnl), 0) AS pnl,
      COUNT(*)::INT AS trade_count
    FROM closed
    GROUP BY 1
    ORDER BY 1
  ),
  weekdays AS (
    SELECT
      EXTRACT(DOW FROM trade_date AT TIME ZONE 'America/New_York')::INT AS day_of_week,
      COALESCE(SUM(pnl), 0) AS pnl,
      COUNT(*)::INT AS trade_count
    FROM closed
    GROUP BY 1
    ORDER BY 1
  ),
  monthly AS (
    SELECT
      TO_CHAR(date_trunc('month', trade_date), 'YYYY-MM') AS month,
      COALESCE(SUM(pnl), 0) AS pnl,
      COUNT(*)::INT AS trade_count
    FROM closed
    GROUP BY 1
    ORDER BY 1
  ),
  symbol_stats AS (
    SELECT
      symbol,
      COUNT(*)::INT AS trade_count,
      COALESCE(SUM(pnl), 0) AS pnl,
      COALESCE(AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100, 0) AS win_rate
    FROM closed
    WHERE symbol IS NOT NULL
    GROUP BY symbol
    ORDER BY pnl DESC
    LIMIT 25
  ),
  direction_stats AS (
    SELECT
      direction,
      COUNT(*)::INT AS trade_count,
      COALESCE(SUM(pnl), 0) AS pnl,
      COALESCE(AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100, 0) AS win_rate
    FROM closed
    WHERE direction IS NOT NULL
    GROUP BY direction
  ),
  dte_buckets AS (
    SELECT
      CASE
        WHEN dte_at_entry IS NULL THEN 'unknown'
        WHEN dte_at_entry <= 7 THEN '0-7'
        WHEN dte_at_entry <= 30 THEN '8-30'
        ELSE '31+'
      END AS bucket,
      COUNT(*)::INT AS trade_count,
      COALESCE(SUM(pnl), 0) AS pnl,
      COALESCE(AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100, 0) AS win_rate
    FROM closed
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'period', period,
    'period_start', period_start,
    'total_trades', (SELECT COUNT(*) FROM scoped),
    'closed_trades', (SELECT COUNT(*) FROM closed),
    'winning_trades', (SELECT COUNT(*) FROM closed WHERE pnl > 0),
    'losing_trades', (SELECT COUNT(*) FROM closed WHERE pnl < 0),
    'win_rate', COALESCE((SELECT AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100 FROM closed), 0),
    'total_pnl', COALESCE((SELECT SUM(pnl) FROM closed), 0),
    'avg_pnl', COALESCE((SELECT AVG(pnl) FROM closed), 0),
    'expectancy', COALESCE(
      (SELECT
        (AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * COALESCE(AVG(CASE WHEN pnl > 0 THEN pnl END), 0))
        - ((1 - AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)) * ABS(COALESCE(AVG(CASE WHEN pnl < 0 THEN pnl END), 0)))
      FROM closed),
      0
    ),
    'profit_factor', COALESCE(
      (SELECT
        CASE
          WHEN ABS(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)) = 0 THEN NULL
          ELSE SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END)
               / ABS(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END))
        END
      FROM closed),
      0
    ),
    'avg_r_multiple', COALESCE((SELECT AVG(r_multiple) FROM r_values WHERE r_multiple IS NOT NULL), 0),
    'sharpe_ratio', COALESCE(
      (SELECT CASE WHEN STDDEV_SAMP(pnl) = 0 THEN 0 ELSE AVG(pnl) / STDDEV_SAMP(pnl) END FROM closed),
      0
    ),
    'sortino_ratio', COALESCE(
      (SELECT
        CASE
          WHEN STDDEV_SAMP(CASE WHEN pnl < 0 THEN pnl END) = 0 THEN 0
          ELSE AVG(pnl) / STDDEV_SAMP(CASE WHEN pnl < 0 THEN pnl END)
        END
      FROM closed),
      0
    ),
    'max_drawdown', COALESCE((SELECT MIN(equity_curve - running_peak) FROM drawdowns), 0),
    'max_drawdown_duration_days', COALESCE((SELECT MAX(streak) FROM drawdown_durations), 0),
    'consecutive_wins', COALESCE((SELECT MAX(streak) FROM win_runs), 0),
    'consecutive_losses', COALESCE((SELECT MAX(streak) FROM loss_runs), 0),
    'avg_hold_minutes', COALESCE((SELECT AVG(hold_duration_min) FROM closed WHERE hold_duration_min IS NOT NULL), 0),
    'avg_mfe_percent', COALESCE((SELECT AVG(mfe_percent) FROM closed WHERE mfe_percent IS NOT NULL), 0),
    'avg_mae_percent', COALESCE((SELECT AVG(mae_percent) FROM closed WHERE mae_percent IS NOT NULL), 0),
    'hourly_pnl', COALESCE((SELECT jsonb_agg(to_jsonb(hourly)) FROM hourly), '[]'::jsonb),
    'day_of_week_pnl', COALESCE((SELECT jsonb_agg(to_jsonb(weekdays)) FROM weekdays), '[]'::jsonb),
    'monthly_pnl', COALESCE((SELECT jsonb_agg(to_jsonb(monthly)) FROM monthly), '[]'::jsonb),
    'symbol_stats', COALESCE((SELECT jsonb_agg(to_jsonb(symbol_stats)) FROM symbol_stats), '[]'::jsonb),
    'direction_stats', COALESCE((SELECT jsonb_agg(to_jsonb(direction_stats)) FROM direction_stats), '[]'::jsonb),
    'dte_buckets', COALESCE((SELECT jsonb_agg(to_jsonb(dte_buckets)) FROM dte_buckets), '[]'::jsonb)
  )
  INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_advanced_analytics(UUID, TEXT) TO authenticated;

-- ============================================
-- 8) Refresh analytics cache now
-- ============================================
REFRESH MATERIALIZED VIEW journal_analytics_cache;
