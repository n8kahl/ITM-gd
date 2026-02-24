-- Reduce anonymous data exposure on chat tables with column-level grants.
-- Authenticated/admin/service_role paths remain unchanged.

REVOKE SELECT ON public.chat_conversations FROM anon;
REVOKE SELECT ON public.chat_messages FROM anon;

GRANT SELECT (
  id,
  ai_handled,
  escalation_reason,
  status,
  created_at,
  updated_at,
  last_message_at
) ON public.chat_conversations TO anon;

GRANT SELECT (
  id,
  conversation_id,
  sender_type,
  sender_name,
  message_text,
  image_url,
  ai_generated,
  ai_confidence,
  created_at,
  read_at
) ON public.chat_messages TO anon;
