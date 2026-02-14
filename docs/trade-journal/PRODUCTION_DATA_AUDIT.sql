-- Trade Journal / AI Coach Production Data Audit
-- Purpose: verify single source-of-truth usage and detect duplicate/placeholder drift.

-- 1) Canonical table inventory (journal + ai_coach namespace)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'journal%' OR table_name LIKE 'ai_coach%')
ORDER BY table_name;

-- 2) Journal entry health
SELECT
  count(*)::bigint AS journal_entries_total,
  count(*) FILTER (WHERE upper(symbol) = 'PENDING')::bigint AS pending_symbol_rows,
  count(*) FILTER (WHERE coalesce(is_draft, false) = true)::bigint AS draft_rows,
  count(*) FILTER (WHERE ai_analysis IS NOT NULL)::bigint AS ai_graded_rows
FROM public.journal_entries;

-- 3) Placeholder rows that should be draft-only
SELECT
  id,
  user_id,
  symbol,
  is_draft,
  draft_status,
  draft_expires_at,
  screenshot_url,
  created_at
FROM public.journal_entries
WHERE upper(symbol) = 'PENDING'
ORDER BY created_at DESC
LIMIT 100;

-- 4) ai_coach_trades volume by user and draft profile
SELECT
  user_id,
  count(*)::bigint AS total,
  count(*) FILTER (WHERE auto_generated IS true)::bigint AS auto_generated_total,
  count(*) FILTER (WHERE draft_status = 'draft')::bigint AS draft_total
FROM public.ai_coach_trades
GROUP BY user_id
ORDER BY total DESC;

-- 5) Duplicate signature detection in ai_coach_trades
WITH dupes AS (
  SELECT
    user_id,
    symbol,
    entry_date,
    entry_price,
    coalesce(quantity, 0) AS quantity,
    position_type,
    count(*) AS cnt
  FROM public.ai_coach_trades
  GROUP BY user_id, symbol, entry_date, entry_price, coalesce(quantity, 0), position_type
  HAVING count(*) > 1
)
SELECT
  user_id,
  count(*)::bigint AS duplicate_groups,
  sum(cnt - 1)::bigint AS duplicate_rows
FROM dupes
GROUP BY user_id
ORDER BY duplicate_rows DESC;

-- 6) Cross-table user overlap (drift indicator)
WITH journal_users AS (
  SELECT DISTINCT user_id FROM public.journal_entries
),
ai_trade_users AS (
  SELECT DISTINCT user_id FROM public.ai_coach_trades
)
SELECT
  (SELECT count(*) FROM journal_users)::bigint AS journal_user_count,
  (SELECT count(*) FROM ai_trade_users)::bigint AS ai_trade_user_count,
  (SELECT count(*) FROM journal_users ju JOIN ai_trade_users au USING (user_id))::bigint AS overlapping_users;

-- 7) Morning brief earnings payload quality
SELECT
  count(*)::bigint AS briefs_total,
  count(*) FILTER (
    WHERE jsonb_array_length(coalesce(brief_data->'earningsToday', '[]'::jsonb)) = 0
  )::bigint AS briefs_with_zero_earnings
FROM public.ai_coach_morning_briefs;
