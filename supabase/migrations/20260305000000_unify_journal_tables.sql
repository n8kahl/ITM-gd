-- ============================================
-- Journal Unification Migration
-- ============================================
-- Problem: API routes write to trading_journal_entries (legacy)
-- but dashboard RPCs read from journal_entries (canonical).
-- Trades created in Members Journal never appear in dashboard.
--
-- Solution: Migrate all data from trading_journal_entries into
-- journal_entries, then point all API routes at journal_entries.
-- Keep trading_journal_entries intact (secured by RLS from PR1)
-- until confirmed safe to drop.
--
-- Key field mappings:
--   trading_journal_entries.trade_type    -> journal_entries.direction
--   trading_journal_entries.profit_loss   -> journal_entries.pnl
--   trading_journal_entries.profit_loss_percent -> journal_entries.pnl_percentage
--   trading_journal_entries.user_id (TEXT) -> journal_entries.user_id (UUID)
-- ============================================

-- Step 1: Migrate existing data from legacy table to canonical table.
-- Only insert rows whose user_id can be resolved to a valid auth.users UUID.
-- Skip rows that already exist (by matching on user + symbol + trade_date + created_at).
INSERT INTO journal_entries (
  id,
  user_id,
  trade_date,
  symbol,
  direction,
  entry_price,
  exit_price,
  position_size,
  pnl,
  pnl_percentage,
  screenshot_url,
  screenshot_thumbnail_url,
  screenshot_storage_path,
  ai_analysis,
  setup_notes,
  execution_notes,
  lessons_learned,
  tags,
  rating,
  is_winner,
  market_context,
  entry_timestamp,
  exit_timestamp,
  is_open,
  smart_tags,
  verification,
  enriched_at,
  share_count,
  created_at,
  updated_at
)
SELECT
  tje.id,
  -- Resolve TEXT user_id to UUID: try direct cast, then lookup by id
  CASE
    WHEN tje.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN tje.user_id::uuid
    ELSE (SELECT au.id FROM auth.users au WHERE au.id::text = tje.user_id LIMIT 1)
  END,
  tje.trade_date::timestamptz,
  tje.symbol,
  -- Map trade_type to direction enum values
  CASE LOWER(tje.trade_type)
    WHEN 'long' THEN 'long'
    WHEN 'short' THEN 'short'
    WHEN 'call' THEN 'long'
    WHEN 'put' THEN 'short'
    ELSE 'neutral'
  END,
  tje.entry_price::numeric(10,2),
  tje.exit_price::numeric(10,2),
  tje.position_size::numeric(10,2),
  tje.profit_loss::numeric(10,2),
  tje.profit_loss_percent::numeric(5,2),
  tje.screenshot_url,
  tje.screenshot_thumbnail_url,
  tje.screenshot_storage_path,
  tje.ai_analysis,
  tje.setup_notes,
  tje.execution_notes,
  tje.lessons_learned,
  COALESCE(tje.tags, '{}'),
  tje.rating,
  tje.is_winner,
  tje.market_context,
  tje.entry_timestamp,
  tje.exit_timestamp,
  COALESCE(tje.is_open, false),
  COALESCE(tje.smart_tags, '{}'),
  tje.verification,
  tje.enriched_at,
  COALESCE(tje.share_count, 0),
  tje.created_at,
  tje.updated_at
FROM trading_journal_entries tje
WHERE
  -- Only migrate if user_id resolves to a valid auth user
  (
    (tje.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = tje.user_id::uuid))
    OR
    EXISTS (SELECT 1 FROM auth.users WHERE id::text = tje.user_id)
  )
  -- Skip rows that already exist in journal_entries
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = tje.id
  );

-- Step 2: Add a service_role policy to journal_entries so the API route
-- (which uses service_role key) can perform all operations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'journal_entries'
    AND policyname = 'Service role full access for journal entries'
  ) THEN
    CREATE POLICY "Service role full access for journal entries"
      ON journal_entries
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Step 3: Mark legacy table with a comment for future cleanup
COMMENT ON TABLE trading_journal_entries IS
  'DEPRECATED — migrated to journal_entries. Secured by RLS. Safe to drop after confirming no remaining reads.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- 1. Count comparison:
--    SELECT
--      (SELECT count(*) FROM trading_journal_entries) as legacy_count,
--      (SELECT count(*) FROM journal_entries) as canonical_count;
--
-- 2. Spot-check a user's data:
--    SELECT id, symbol, direction, pnl, trade_date
--    FROM journal_entries
--    WHERE user_id = '<some-uuid>'
--    ORDER BY trade_date DESC
--    LIMIT 10;
--
-- 3. Verify dashboard RPC works:
--    SELECT get_dashboard_stats('<user-uuid>', 'month');
