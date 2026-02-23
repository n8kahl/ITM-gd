-- Add per-conversation access token hash for visitor-scoped chat sync.
-- Raw tokens are never stored in the database.

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS access_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_access_token_hash_unique
  ON public.chat_conversations (access_token_hash)
  WHERE access_token_hash IS NOT NULL;
