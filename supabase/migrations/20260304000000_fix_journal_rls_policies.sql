-- ============================================
-- Fix RLS Policies for Journal Tables
-- ============================================
-- Problem: trading_journal_entries and journal_streaks had
-- FOR SELECT USING (true) which allows any authenticated user
-- (or even anon key holder) to read ALL rows across users.
--
-- Fix: Replace permissive SELECT policies with user_id = auth.uid()::text
-- scoping. Add proper INSERT/UPDATE/DELETE policies.
-- Note: user_id is TEXT (Discord ID), but auth.uid() returns UUID,
-- so we cast appropriately.
-- ============================================

-- ============================================
-- 1. FIX trading_journal_entries RLS
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE trading_journal_entries ENABLE ROW LEVEL SECURITY;

-- Drop the permissive read policy
DROP POLICY IF EXISTS "Users read own journal entries" ON trading_journal_entries;

-- Drop any existing per-operation policies to avoid conflicts
DROP POLICY IF EXISTS "journal_entries_select_own" ON trading_journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert_own" ON trading_journal_entries;
DROP POLICY IF EXISTS "journal_entries_update_own" ON trading_journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete_own" ON trading_journal_entries;

-- Keep the service role policy (for backend operations)
-- It already exists: "Service role write for journal entries"
-- DROP + recreate to ensure it's correct
DROP POLICY IF EXISTS "Service role write for journal entries" ON trading_journal_entries;

CREATE POLICY "Service role write for journal entries" ON trading_journal_entries
  FOR ALL USING (auth.role() = 'service_role');

-- SELECT: users can only read their own entries
CREATE POLICY "journal_entries_select_own" ON trading_journal_entries
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- INSERT: users can only insert entries for themselves
CREATE POLICY "journal_entries_insert_own" ON trading_journal_entries
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- UPDATE: users can only update their own entries
CREATE POLICY "journal_entries_update_own" ON trading_journal_entries
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- DELETE: users can only delete their own entries
CREATE POLICY "journal_entries_delete_own" ON trading_journal_entries
  FOR DELETE
  USING (user_id = auth.uid()::text);


-- ============================================
-- 2. FIX journal_streaks RLS
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE journal_streaks ENABLE ROW LEVEL SECURITY;

-- Drop the permissive read policy
DROP POLICY IF EXISTS "Users read own streaks" ON journal_streaks;

-- Drop any existing per-operation policies to avoid conflicts
DROP POLICY IF EXISTS "journal_streaks_select_own" ON journal_streaks;
DROP POLICY IF EXISTS "journal_streaks_insert_own" ON journal_streaks;
DROP POLICY IF EXISTS "journal_streaks_update_own" ON journal_streaks;
DROP POLICY IF EXISTS "journal_streaks_delete_own" ON journal_streaks;

-- Keep the service role policy (for backend operations)
DROP POLICY IF EXISTS "Service role write for streaks" ON journal_streaks;

CREATE POLICY "Service role write for streaks" ON journal_streaks
  FOR ALL USING (auth.role() = 'service_role');

-- SELECT: users can only read their own streaks
CREATE POLICY "journal_streaks_select_own" ON journal_streaks
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- INSERT: users can only insert streak rows for themselves
CREATE POLICY "journal_streaks_insert_own" ON journal_streaks
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- UPDATE: users can only update their own streak rows
CREATE POLICY "journal_streaks_update_own" ON journal_streaks
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- DELETE: users can only delete their own streak rows
CREATE POLICY "journal_streaks_delete_own" ON journal_streaks
  FOR DELETE
  USING (user_id = auth.uid()::text);


-- ============================================
-- VERIFICATION QUERIES
-- Run these in Supabase SQL editor to confirm:
-- ============================================
--
-- 1. Check RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE tablename IN ('trading_journal_entries', 'journal_streaks');
--    -- Both should show rowsecurity = true
--
-- 2. Check policies exist:
--    SELECT tablename, policyname, cmd, qual
--    FROM pg_policies
--    WHERE tablename IN ('trading_journal_entries', 'journal_streaks')
--    ORDER BY tablename, policyname;
--    -- Should see *_select_own, *_insert_own, *_update_own, *_delete_own
--    -- plus service role policies
--
-- 3. Test with anon key (should return 0 rows):
--    SELECT count(*) FROM trading_journal_entries;
--    -- If using anon key with no auth, returns 0
--
-- 4. Test cross-user access (set role to a user, try reading another user's data):
--    SET request.jwt.claim.sub = 'user-id-A';
--    SELECT * FROM trading_journal_entries WHERE user_id = 'user-id-B';
--    -- Should return 0 rows
