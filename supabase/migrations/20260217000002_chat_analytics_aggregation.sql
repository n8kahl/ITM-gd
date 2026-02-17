-- Daily chat analytics aggregation pipeline.
-- This migration adds a database aggregation function and attempts to schedule it
-- via pg_cron when the extension is enabled.

CREATE TABLE IF NOT EXISTS chat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  ai_only_conversations INTEGER NOT NULL DEFAULT 0,
  human_conversations INTEGER NOT NULL DEFAULT 0,
  escalations INTEGER NOT NULL DEFAULT 0,
  conversations_to_signup INTEGER NOT NULL DEFAULT 0,
  avg_response_time_seconds INTEGER,
  avg_ai_confidence DOUBLE PRECISION,
  busiest_hour INTEGER,
  top_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION aggregate_chat_analytics_for_date(
  p_date DATE DEFAULT ((NOW() AT TIME ZONE 'UTC')::DATE - 1)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts TIMESTAMPTZ := (p_date::timestamp AT TIME ZONE 'UTC');
  v_end_ts TIMESTAMPTZ := ((p_date + 1)::timestamp AT TIME ZONE 'UTC');
  v_total_conversations INTEGER := 0;
  v_ai_only_conversations INTEGER := 0;
  v_human_conversations INTEGER := 0;
  v_escalations INTEGER := 0;
  v_conversations_to_signup INTEGER := 0;
  v_avg_response_time_seconds INTEGER := NULL;
  v_avg_ai_confidence DOUBLE PRECISION := NULL;
  v_busiest_hour INTEGER := NULL;
  v_top_categories TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.chat_conversations') IS NULL OR to_regclass('public.chat_messages') IS NULL THEN
    RETURN json_build_object(
      'status', 'skipped',
      'reason', 'chat tables are missing',
      'date', p_date
    );
  END IF;

  SELECT COUNT(*)
  INTO v_total_conversations
  FROM chat_conversations c
  WHERE c.created_at >= v_start_ts
    AND c.created_at < v_end_ts;

  WITH day_conversations AS (
    SELECT c.id
    FROM chat_conversations c
    WHERE c.created_at >= v_start_ts
      AND c.created_at < v_end_ts
  ),
  human_flags AS (
    SELECT
      dc.id,
      EXISTS (
        SELECT 1
        FROM chat_messages m
        WHERE m.conversation_id = dc.id
          AND m.sender_type = 'team'
          AND COALESCE(m.ai_generated, false) = false
      ) AS has_human_message
    FROM day_conversations dc
  )
  SELECT
    COALESCE(SUM(CASE WHEN has_human_message THEN 0 ELSE 1 END), 0),
    COALESCE(SUM(CASE WHEN has_human_message THEN 1 ELSE 0 END), 0)
  INTO v_ai_only_conversations, v_human_conversations
  FROM human_flags;

  SELECT COUNT(*)
  INTO v_escalations
  FROM chat_conversations c
  WHERE c.created_at >= v_start_ts
    AND c.created_at < v_end_ts
    AND (c.escalation_reason IS NOT NULL OR COALESCE(c.ai_handled, true) = false);

  IF to_regclass('public.subscribers') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_conversations_to_signup
    FROM chat_conversations c
    WHERE c.created_at >= v_start_ts
      AND c.created_at < v_end_ts
      AND COALESCE(TRIM(c.visitor_email), '') <> ''
      AND EXISTS (
        SELECT 1
        FROM subscribers s
        WHERE LOWER(s.email) = LOWER(c.visitor_email)
      );
  END IF;

  WITH day_conversations AS (
    SELECT c.id
    FROM chat_conversations c
    WHERE c.created_at >= v_start_ts
      AND c.created_at < v_end_ts
  ),
  first_visitor AS (
    SELECT m.conversation_id, MIN(m.created_at) AS first_visitor_at
    FROM chat_messages m
    JOIN day_conversations dc ON dc.id = m.conversation_id
    WHERE m.sender_type = 'visitor'
    GROUP BY m.conversation_id
  ),
  first_response AS (
    SELECT m.conversation_id, MIN(m.created_at) AS first_response_at
    FROM chat_messages m
    JOIN day_conversations dc ON dc.id = m.conversation_id
    WHERE m.sender_type = 'team'
    GROUP BY m.conversation_id
  )
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fr.first_response_at - fv.first_visitor_at)))::numeric)::INTEGER
  INTO v_avg_response_time_seconds
  FROM first_visitor fv
  JOIN first_response fr ON fr.conversation_id = fv.conversation_id
  WHERE fr.first_response_at >= fv.first_visitor_at;

  SELECT ROUND(AVG(m.ai_confidence)::numeric, 4)::DOUBLE PRECISION
  INTO v_avg_ai_confidence
  FROM chat_messages m
  WHERE m.created_at >= v_start_ts
    AND m.created_at < v_end_ts
    AND COALESCE(m.ai_generated, false) = true
    AND m.ai_confidence IS NOT NULL;

  SELECT EXTRACT(HOUR FROM m.created_at AT TIME ZONE 'UTC')::INTEGER
  INTO v_busiest_hour
  FROM chat_messages m
  WHERE m.created_at >= v_start_ts
    AND m.created_at < v_end_ts
  GROUP BY 1
  ORDER BY COUNT(*) DESC, 1
  LIMIT 1;

  WITH day_messages AS (
    SELECT LOWER(COALESCE(m.message_text, '')) AS message_text
    FROM chat_messages m
    WHERE m.created_at >= v_start_ts
      AND m.created_at < v_end_ts
      AND m.sender_type = 'visitor'
  ),
  categorized AS (
    SELECT CASE
      WHEN message_text ~ '(price|pricing|cost|subscription|plan|billing|\\$)' THEN 'pricing'
      WHEN message_text ~ '(proof|results|win rate|performance|pnl|profit)' THEN 'proof'
      WHEN message_text ~ '(feature|indicator|alert|signal|automation|tool)' THEN 'features'
      WHEN message_text ~ '(how |what |when |where |why |faq|question)' THEN 'faq'
      WHEN message_text ~ '(error|bug|login|access|technical|issue|api)' THEN 'technical'
      WHEN message_text ~ '(cancel|refund|complaint|angry|frustrated|escalat)' THEN 'escalation'
      ELSE 'general'
    END AS category
    FROM day_messages
  )
  SELECT COALESCE(
    ARRAY_AGG(rankings.category ORDER BY rankings.count DESC, rankings.category),
    ARRAY[]::TEXT[]
  )
  INTO v_top_categories
  FROM (
    SELECT category, COUNT(*) AS count
    FROM categorized
    GROUP BY category
    ORDER BY count DESC, category
    LIMIT 5
  ) rankings;

  INSERT INTO chat_analytics (
    date,
    total_conversations,
    ai_only_conversations,
    human_conversations,
    escalations,
    conversations_to_signup,
    avg_response_time_seconds,
    avg_ai_confidence,
    busiest_hour,
    top_categories
  )
  VALUES (
    p_date,
    v_total_conversations,
    v_ai_only_conversations,
    v_human_conversations,
    v_escalations,
    v_conversations_to_signup,
    v_avg_response_time_seconds,
    v_avg_ai_confidence,
    v_busiest_hour,
    v_top_categories
  )
  ON CONFLICT (date) DO UPDATE SET
    total_conversations = EXCLUDED.total_conversations,
    ai_only_conversations = EXCLUDED.ai_only_conversations,
    human_conversations = EXCLUDED.human_conversations,
    escalations = EXCLUDED.escalations,
    conversations_to_signup = EXCLUDED.conversations_to_signup,
    avg_response_time_seconds = EXCLUDED.avg_response_time_seconds,
    avg_ai_confidence = EXCLUDED.avg_ai_confidence,
    busiest_hour = EXCLUDED.busiest_hour,
    top_categories = EXCLUDED.top_categories;

  RETURN json_build_object(
    'status', 'ok',
    'date', p_date,
    'total_conversations', v_total_conversations,
    'ai_only_conversations', v_ai_only_conversations,
    'human_conversations', v_human_conversations,
    'escalations', v_escalations,
    'conversations_to_signup', v_conversations_to_signup,
    'avg_response_time_seconds', v_avg_response_time_seconds,
    'avg_ai_confidence', v_avg_ai_confidence,
    'busiest_hour', v_busiest_hour,
    'top_categories', v_top_categories
  );
END;
$$;

CREATE OR REPLACE FUNCTION run_chat_analytics_job(
  p_date DATE DEFAULT ((NOW() AT TIME ZONE 'UTC')::DATE - 1)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN aggregate_chat_analytics_for_date(p_date);
END;
$$;

GRANT EXECUTE ON FUNCTION aggregate_chat_analytics_for_date(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION run_chat_analytics_job(DATE) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE $sql$SELECT cron.unschedule('aggregate-chat-analytics-daily')$sql$;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    EXECUTE $sql$
      SELECT cron.schedule(
        'aggregate-chat-analytics-daily',
        '5 0 * * *',
        'SELECT run_chat_analytics_job(((NOW() AT TIME ZONE ''UTC'')::DATE - 1));'
      )
    $sql$;
  ELSE
    RAISE NOTICE 'pg_cron extension is not enabled; schedule run_chat_analytics_job() externally.';
  END IF;
END;
$$;
