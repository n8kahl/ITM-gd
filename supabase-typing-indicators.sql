-- Typing indicators table for real-time "is typing" status
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

-- Upsert function for typing status
CREATE OR REPLACE FUNCTION set_typing_status(
  p_conversation_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_is_typing BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  IF p_is_typing THEN
    INSERT INTO team_typing_indicators (conversation_id, user_id, user_name, is_typing, updated_at)
    VALUES (p_conversation_id, p_user_id, p_user_name, true, NOW())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET is_typing = true, updated_at = NOW();
  ELSE
    DELETE FROM team_typing_indicators
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for upsert
ALTER TABLE team_typing_indicators
  ADD CONSTRAINT unique_typing_per_user_conversation
  UNIQUE (conversation_id, user_id);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE team_typing_indicators;

-- RLS policies
ALTER TABLE team_typing_indicators ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read typing indicators (visitors need to see when team is typing)
CREATE POLICY "Anyone can view typing indicators"
  ON team_typing_indicators FOR SELECT
  USING (true);

-- Allow authenticated users (team members) to insert/update/delete
CREATE POLICY "Team can manage typing indicators"
  ON team_typing_indicators FOR ALL
  USING (true);

-- Grant permissions
GRANT ALL ON team_typing_indicators TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_typing_status(UUID, UUID, TEXT, BOOLEAN) TO anon, authenticated;
