-- Remove synchronous refresh on journal writes. Refresh now happens via queued workers.
DROP TRIGGER IF EXISTS trigger_refresh_journal_analytics_cache ON journal_entries;
DROP FUNCTION IF EXISTS refresh_journal_analytics_cache_trigger();

-- Explicit refresh RPC used by debounced refresh queues.
CREATE OR REPLACE FUNCTION refresh_journal_analytics_cache()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW journal_analytics_cache;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_journal_analytics_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_journal_analytics_cache() TO service_role;
