-- Create function to auto-archive resolved conversations after 24 hours
CREATE OR REPLACE FUNCTION archive_old_resolved_conversations()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE chat_conversations
  SET
    status = 'archived',
    updated_at = NOW()
  WHERE
    status = 'resolved'
    AND last_message_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  RAISE NOTICE 'Archived % resolved conversations older than 24 hours', archived_count;

  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION archive_old_resolved_conversations() TO authenticated, service_role;

-- Note: To enable automatic scheduling, you have two options:
--
-- OPTION 1: Enable pg_cron extension in Supabase Dashboard
-- Go to Database > Extensions > Enable pg_cron
-- Then run this SQL manually in the SQL Editor:
--
-- SELECT cron.schedule(
--   'archive-resolved-conversations',  -- job name
--   '0 0 * * *',                        -- run at midnight every day
--   'SELECT archive_old_resolved_conversations()'
-- );
--
-- OPTION 2: Use a GitHub Action or external cron service
-- Call the function via Supabase Edge Function or direct RPC call
-- See: supabase/functions/cron-archive-conversations/index.ts

-- Create an RPC wrapper for easy calling from Edge Functions
CREATE OR REPLACE FUNCTION run_archive_job()
RETURNS json AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT archive_old_resolved_conversations() INTO result;
  RETURN json_build_object('archived_count', result, 'timestamp', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION run_archive_job() TO anon, authenticated, service_role;
