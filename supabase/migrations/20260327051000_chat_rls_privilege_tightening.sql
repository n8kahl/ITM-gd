-- Tighten legacy table grants for chat tables.
-- Keep only privileges required by application paths:
-- - anon: SELECT
-- - authenticated: SELECT + DML (RLS restricts writes to admins)

REVOKE TRIGGER, TRUNCATE, REFERENCES ON public.chat_conversations FROM anon;
REVOKE TRIGGER, TRUNCATE, REFERENCES ON public.chat_messages FROM anon;
REVOKE TRIGGER, TRUNCATE, REFERENCES ON public.chat_conversations FROM authenticated;
REVOKE TRIGGER, TRUNCATE, REFERENCES ON public.chat_messages FROM authenticated;

GRANT SELECT ON public.chat_conversations TO anon, authenticated;
GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
