-- Typing indicators table for real-time "is typing" status
-- Handle case where table may already exist with different schema

-- Drop existing table if it has wrong schema (no user_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'team_typing_indicators'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'team_typing_indicators' AND column_name = 'user_id'
    ) THEN
      DROP TABLE team_typing_indicators CASCADE;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS team_typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  is_typing BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation
  ON team_typing_indicators(conversation_id, is_typing);

-- Auto-cleanup old typing indicators (after 10 seconds of no update)
CREATE OR REPLACE FUNCTION cleanup_stale_typing_indicators()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM team_typing_indicators
  WHERE updated_at < NOW() - INTERVAL '10 seconds';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cleanup on any insert/update
DROP TRIGGER IF EXISTS trigger_cleanup_typing ON team_typing_indicators;
CREATE TRIGGER trigger_cleanup_typing
  AFTER INSERT OR UPDATE ON team_typing_indicators
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_stale_typing_indicators();

-- Add unique constraint for upsert (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_typing_per_user_conversation'
  ) THEN
    ALTER TABLE team_typing_indicators
      ADD CONSTRAINT unique_typing_per_user_conversation
      UNIQUE (conversation_id, user_id);
  END IF;
END $$;

-- Enable realtime for the table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE team_typing_indicators;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies
ALTER TABLE team_typing_indicators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view typing indicators" ON team_typing_indicators;
DROP POLICY IF EXISTS "Team can manage typing indicators" ON team_typing_indicators;

-- Allow anyone to read typing indicators (visitors need to see when team is typing)
CREATE POLICY "Anyone can view typing indicators"
  ON team_typing_indicators FOR SELECT
  USING (true);

-- Allow anyone to insert/update/delete (for simplicity with admin placeholder ID)
CREATE POLICY "Team can manage typing indicators"
  ON team_typing_indicators FOR ALL
  USING (true);

-- Grant permissions
GRANT ALL ON team_typing_indicators TO anon, authenticated;
