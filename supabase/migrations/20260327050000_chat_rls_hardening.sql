-- Harden chat RLS policies:
-- 1) Remove broad public/authenticated write policies on chat tables.
-- 2) Preserve service role + admin write access.
-- 3) Keep compatibility read policies for visitor widget until visitor-scoped auth is introduced.

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- =========================
-- chat_conversations
-- =========================
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Public can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Public can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can view their conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Service role manage chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Admin manage chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitor read chat_conversations" ON public.chat_conversations;

CREATE POLICY "Service role manage chat_conversations"
  ON public.chat_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin manage chat_conversations"
  ON public.chat_conversations
  FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(auth.jwt() -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(auth.jwt() -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  );

-- Compatibility policy for visitor widget read path.
CREATE POLICY "Visitor read chat_conversations"
  ON public.chat_conversations
  FOR SELECT
  TO anon, authenticated
  USING (COALESCE(length(btrim(visitor_id)), 0) > 0);

-- =========================
-- chat_messages
-- =========================
DROP POLICY IF EXISTS "Public can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can insert visitor messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Public can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Visitors can view their conversation messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Service role manage chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admin manage chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Visitor read chat_messages" ON public.chat_messages;

CREATE POLICY "Service role manage chat_messages"
  ON public.chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin manage chat_messages"
  ON public.chat_messages
  FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(auth.jwt() -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(auth.jwt() -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  );

-- Compatibility policy for visitor widget read path.
CREATE POLICY "Visitor read chat_messages"
  ON public.chat_messages
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND COALESCE(length(btrim(c.visitor_id)), 0) > 0
    )
  );

-- Lock down raw table writes for anon. Authenticated writes are still RLS-guarded to admin-only.
REVOKE INSERT, UPDATE, DELETE ON public.chat_conversations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.chat_conversations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM authenticated;

GRANT SELECT ON public.chat_conversations TO anon, authenticated;
GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
