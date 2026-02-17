-- Upgrade admin analytics RPC with funnel and engagement fields.
CREATE OR REPLACE FUNCTION get_admin_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  result JSON;
  period_start TIMESTAMPTZ;
BEGIN
  period_start := CURRENT_DATE - (p_days || ' days')::INTERVAL;

  -- Security: admin only
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT json_build_object(
    'total_members', (SELECT COUNT(*) FROM auth.users),
    'new_members', (
      SELECT COUNT(*) FROM auth.users
      WHERE created_at >= period_start
    ),
    'total_journal_entries', (
      SELECT COUNT(*) FROM journal_entries
      WHERE created_at >= period_start
    ),
    'ai_analysis_count', (
      SELECT COUNT(*) FROM journal_entries
      WHERE ai_analysis IS NOT NULL
        AND created_at >= period_start
    ),
    'ai_coach_sessions', (
      SELECT COUNT(*) FROM ai_coach_sessions
      WHERE created_at >= period_start
    ),
    'ai_coach_messages', (
      SELECT COUNT(*) FROM ai_coach_messages
      WHERE created_at >= period_start
    ),
    'shared_trade_cards', (
      SELECT COUNT(*) FROM shared_trade_cards
      WHERE shared_at >= period_start
    ),
    'active_users', (
      SELECT COUNT(DISTINCT user_id) FROM member_analytics_events
      WHERE created_at >= period_start
    ),
    'conversion_funnel', (
      SELECT json_build_object(
        'modal_opened', COUNT(*) FILTER (WHERE event_type = 'modal_opened'),
        'modal_closed', COUNT(*) FILTER (WHERE event_type = 'modal_closed'),
        'form_submitted', COUNT(*) FILTER (WHERE event_type = 'form_submitted'),
        'subscribed', COUNT(*) FILTER (WHERE event_type = 'subscription')
      )
      FROM conversion_events
      WHERE created_at >= period_start
    ),
    'daily_signups', (
      SELECT COALESCE(
        json_agg(
          json_build_object('date', signup_date, 'count', signups)
          ORDER BY signup_date ASC
        ),
        '[]'::json
      )
      FROM (
        SELECT created_at::DATE AS signup_date, COUNT(*) AS signups
        FROM auth.users
        WHERE created_at >= period_start
        GROUP BY created_at::DATE
      ) daily
    ),
    'ai_coach_avg_messages', (
      SELECT COALESCE(ROUND(AVG(message_count)::numeric, 2), 0)
      FROM ai_coach_sessions
      WHERE created_at >= period_start
    ),
    'top_referrers', (
      SELECT COALESCE(
        json_agg(
          json_build_object('referrer', referrer, 'count', views)
          ORDER BY views DESC
        ),
        '[]'::json
      )
      FROM (
        SELECT referrer, COUNT(*) AS views
        FROM page_views
        WHERE created_at >= period_start
          AND referrer IS NOT NULL
          AND referrer <> ''
        GROUP BY referrer
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) refs
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_analytics(INTEGER) TO authenticated;
