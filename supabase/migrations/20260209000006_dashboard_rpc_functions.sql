-- V3 Redesign: Dashboard RPC Functions
-- Provides efficient server-side aggregations for the member dashboard

-- ============================================
-- 1. GET DASHBOARD STATS
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID, p_period TEXT DEFAULT 'month')
RETURNS JSON AS $$
DECLARE
  result JSON;
  start_date TIMESTAMPTZ;
BEGIN
  start_date := CASE p_period
    WHEN 'week' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN 'month' THEN DATE_TRUNC('month', CURRENT_DATE)
    WHEN 'quarter' THEN DATE_TRUNC('quarter', CURRENT_DATE)
    WHEN 'year' THEN DATE_TRUNC('year', CURRENT_DATE)
    WHEN 'all' THEN '1970-01-01'::TIMESTAMPTZ
    ELSE DATE_TRUNC('month', CURRENT_DATE)
  END;

  -- Security: only the user or an admin can call this
  IF auth.uid() != p_user_id AND NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_trades', COUNT(*),
    'winning_trades', COUNT(*) FILTER (WHERE je.is_winner = true),
    'losing_trades', COUNT(*) FILTER (WHERE je.is_winner = false),
    'win_rate', ROUND(
      COUNT(*) FILTER (WHERE je.is_winner = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1
    ),
    'total_pnl', COALESCE(SUM(je.pnl), 0),
    'avg_pnl', ROUND(COALESCE(AVG(je.pnl), 0)::numeric, 2),
    'best_trade_pnl', MAX(je.pnl),
    'worst_trade_pnl', MIN(je.pnl),
    'avg_winner', ROUND(COALESCE(AVG(je.pnl) FILTER (WHERE je.is_winner = true), 0)::numeric, 2),
    'avg_loser', ROUND(COALESCE(AVG(je.pnl) FILTER (WHERE je.is_winner = false), 0)::numeric, 2),
    'profit_factor', ROUND(
      COALESCE(SUM(je.pnl) FILTER (WHERE je.pnl > 0), 0)::numeric /
      NULLIF(ABS(COALESCE(SUM(je.pnl) FILTER (WHERE je.pnl < 0), 0)), 0)::numeric, 2
    ),
    'avg_ai_grade', (
      SELECT je2.ai_analysis->>'grade'
      FROM journal_entries je2
      WHERE je2.user_id = p_user_id AND je2.ai_analysis IS NOT NULL
      ORDER BY je2.created_at DESC LIMIT 1
    ),
    'open_positions_count', (
      SELECT COUNT(*) FROM journal_entries
      WHERE user_id = p_user_id AND is_open = true
    )
  ) INTO result
  FROM journal_entries je
  WHERE je.user_id = p_user_id AND je.trade_date >= start_date;

  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, TEXT) TO authenticated;

-- ============================================
-- 2. GET EQUITY CURVE DATA
-- ============================================
CREATE OR REPLACE FUNCTION get_equity_curve(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(trade_date DATE, daily_pnl NUMERIC, cumulative_pnl NUMERIC) AS $$
BEGIN
  -- Security check
  IF auth.uid() != p_user_id AND NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    je.trade_date::DATE,
    SUM(je.pnl)::NUMERIC as daily_pnl,
    SUM(SUM(je.pnl)) OVER (ORDER BY je.trade_date::DATE)::NUMERIC as cumulative_pnl
  FROM journal_entries je
  WHERE je.user_id = p_user_id
    AND je.trade_date >= (CURRENT_DATE - (p_days || ' days')::INTERVAL)
  GROUP BY je.trade_date::DATE
  ORDER BY je.trade_date::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_equity_curve(UUID, INTEGER) TO authenticated;

-- ============================================
-- 3. GET TRADING CALENDAR HEATMAP
-- ============================================
CREATE OR REPLACE FUNCTION get_trading_calendar(p_user_id UUID, p_months INTEGER DEFAULT 6)
RETURNS TABLE(trade_date DATE, total_pnl NUMERIC, trade_count INTEGER) AS $$
BEGIN
  -- Security check
  IF auth.uid() != p_user_id AND NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    je.trade_date::DATE,
    SUM(je.pnl)::NUMERIC as total_pnl,
    COUNT(*)::INTEGER as trade_count
  FROM journal_entries je
  WHERE je.user_id = p_user_id
    AND je.trade_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
  GROUP BY je.trade_date::DATE
  ORDER BY je.trade_date::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_trading_calendar(UUID, INTEGER) TO authenticated;

-- ============================================
-- 4. GET ADMIN ANALYTICS
-- ============================================
CREATE OR REPLACE FUNCTION get_admin_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Security: admin only
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT json_build_object(
    'total_members', (SELECT COUNT(*) FROM auth.users),
    'new_members', (
      SELECT COUNT(*) FROM auth.users
      WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ),
    'total_journal_entries', (
      SELECT COUNT(*) FROM journal_entries
      WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ),
    'ai_analysis_count', (
      SELECT COUNT(*) FROM journal_entries
      WHERE ai_analysis IS NOT NULL
      AND created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ),
    'ai_coach_sessions', (
      SELECT COUNT(*) FROM ai_coach_sessions
      WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ),
    'ai_coach_messages', (
      SELECT COUNT(*) FROM ai_coach_messages
      WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ),
    'shared_trade_cards', (
      SELECT COUNT(*) FROM shared_trade_cards
      WHERE shared_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ),
    'active_users', (
      SELECT COUNT(DISTINCT user_id) FROM member_analytics_events
      WHERE created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_analytics(INTEGER) TO authenticated;

-- ============================================
-- 5. STORAGE BUCKET FOR TRADE SCREENSHOTS
-- ============================================
-- Create storage bucket for trade screenshots with proper RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can upload to their own folder
CREATE POLICY "Users upload own screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trade-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own screenshots
CREATE POLICY "Users read own screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own screenshots
CREATE POLICY "Users delete own screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON FUNCTION get_dashboard_stats IS 'Returns comprehensive journal statistics for the member dashboard';
COMMENT ON FUNCTION get_equity_curve IS 'Returns daily P&L with cumulative sum for equity curve chart';
COMMENT ON FUNCTION get_trading_calendar IS 'Returns daily aggregates for the trading calendar heatmap';
COMMENT ON FUNCTION get_admin_analytics IS 'Returns platform-wide analytics for the admin dashboard';
