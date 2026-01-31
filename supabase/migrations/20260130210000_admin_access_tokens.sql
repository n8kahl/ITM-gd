-- Admin access tokens for magic links from Discord
-- These tokens allow one-click access to specific conversations

CREATE TABLE admin_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX idx_admin_tokens_token ON admin_access_tokens(token);

-- Index for cleanup of expired tokens
CREATE INDEX idx_admin_tokens_expires ON admin_access_tokens(expires_at);

-- RLS: Allow service role full access, anon can only read unexpired/unused tokens
ALTER TABLE admin_access_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role full access"
  ON admin_access_tokens
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Anon can read valid tokens (for verification)
CREATE POLICY "Anon can verify tokens"
  ON admin_access_tokens
  FOR SELECT
  USING (
    expires_at > NOW() AND used_at IS NULL
  );

-- Anon can mark tokens as used
CREATE POLICY "Anon can mark tokens used"
  ON admin_access_tokens
  FOR UPDATE
  USING (
    expires_at > NOW() AND used_at IS NULL
  );
