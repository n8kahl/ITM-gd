-- Remove anonymous direct table reads for chat once token-scoped sync is deployed.
-- Visitor chat reads should go through the `chat-visitor-sync` Edge Function.

DROP POLICY IF EXISTS "Visitor read chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitor read chat_messages" ON public.chat_messages;

REVOKE SELECT ON public.chat_conversations FROM anon;
REVOKE SELECT ON public.chat_messages FROM anon;
