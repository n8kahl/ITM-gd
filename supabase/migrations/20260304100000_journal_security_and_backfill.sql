-- Harden legacy journal RLS and backfill canonical journal_entries.
-- This migration is intentionally additive and forward-only.

-- =====================================================
-- 1) Lock down legacy trading_journal_entries policies
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'trading_journal_entries'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users read own journal entries" ON trading_journal_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Service role write for journal entries" ON trading_journal_entries';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_journal_read_own" ON trading_journal_entries';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_journal_insert_own" ON trading_journal_entries';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_journal_update_own" ON trading_journal_entries';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_journal_delete_own" ON trading_journal_entries';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_journal_service_role_all" ON trading_journal_entries';

    EXECUTE 'ALTER TABLE trading_journal_entries ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "legacy_journal_read_own"
      ON trading_journal_entries
      FOR SELECT TO authenticated
      USING (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_journal_insert_own"
      ON trading_journal_entries
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_journal_update_own"
      ON trading_journal_entries
      FOR UPDATE TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_journal_delete_own"
      ON trading_journal_entries
      FOR DELETE TO authenticated
      USING (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_journal_service_role_all"
      ON trading_journal_entries
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END
$$;

-- ===============================================
-- 2) Lock down legacy journal_streaks policies
-- ===============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'journal_streaks'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users read own streaks" ON journal_streaks';
    EXECUTE 'DROP POLICY IF EXISTS "Service role write for streaks" ON journal_streaks';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_streaks_read_own" ON journal_streaks';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_streaks_insert_own" ON journal_streaks';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_streaks_update_own" ON journal_streaks';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_streaks_delete_own" ON journal_streaks';
    EXECUTE 'DROP POLICY IF EXISTS "legacy_streaks_service_role_all" ON journal_streaks';

    EXECUTE 'ALTER TABLE journal_streaks ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "legacy_streaks_read_own"
      ON journal_streaks
      FOR SELECT TO authenticated
      USING (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_streaks_insert_own"
      ON journal_streaks
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_streaks_update_own"
      ON journal_streaks
      FOR UPDATE TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_streaks_delete_own"
      ON journal_streaks
      FOR DELETE TO authenticated
      USING (auth.uid()::text = user_id)';

    EXECUTE 'CREATE POLICY "legacy_streaks_service_role_all"
      ON journal_streaks
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END
$$;

-- ===============================================================
-- 3) Backfill legacy trading_journal_entries -> journal_entries
-- ===============================================================
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
  ai_analysis,
  setup_notes,
  execution_notes,
  lessons_learned,
  tags,
  rating,
  is_winner,
  created_at,
  updated_at
)
SELECT
  t.id,
  t.user_id::uuid,
  COALESCE(t.trade_date::timestamptz, t.created_at),
  t.symbol,
  CASE
    WHEN lower(coalesce(t.trade_type, '')) IN ('long', 'call', 'bullish', 'buy') THEN 'long'
    WHEN lower(coalesce(t.trade_type, '')) IN ('short', 'put', 'bearish', 'sell') THEN 'short'
    ELSE 'neutral'
  END,
  t.entry_price::numeric(10, 2),
  t.exit_price::numeric(10, 2),
  t.position_size::numeric(10, 2),
  t.profit_loss::numeric(10, 2),
  t.profit_loss_percent::numeric(5, 2),
  t.screenshot_url,
  t.screenshot_thumbnail_url,
  t.ai_analysis,
  t.setup_notes,
  t.execution_notes,
  t.lessons_learned,
  COALESCE(t.tags, '{}'::text[]),
  t.rating,
  t.is_winner,
  t.created_at,
  t.updated_at
FROM trading_journal_entries t
WHERE t.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
ON CONFLICT (id) DO NOTHING;
