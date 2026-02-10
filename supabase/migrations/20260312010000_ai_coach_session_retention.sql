-- AI Coach session retention and archival support

ALTER TABLE ai_coach_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days');

ALTER TABLE ai_coach_sessions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE ai_coach_sessions
SET expires_at = NOW() + INTERVAL '90 days'
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON ai_coach_sessions (expires_at)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_coach_messages_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_message_id UUID,
  session_id UUID NOT NULL REFERENCES ai_coach_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  function_call JSONB,
  function_response JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_coach_messages_archive ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_archive_session_id
  ON ai_coach_messages_archive (session_id);

CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_archive_user_id
  ON ai_coach_messages_archive (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_archive_archived_at
  ON ai_coach_messages_archive (archived_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_coach_messages_archive_original_message_id
  ON ai_coach_messages_archive (original_message_id)
  WHERE original_message_id IS NOT NULL;
