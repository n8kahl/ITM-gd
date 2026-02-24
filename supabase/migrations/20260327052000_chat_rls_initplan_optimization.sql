-- Optimize chat admin RLS predicates for planner init plans.
-- Supabase recommends wrapping auth.jwt() calls in SELECT to avoid per-row re-evaluation.

DROP POLICY IF EXISTS "Admin manage chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Admin manage chat_messages" ON public.chat_messages;

CREATE POLICY "Admin manage chat_conversations"
  ON public.chat_conversations
  FOR ALL
  TO authenticated
  USING (
    COALESCE((((SELECT auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean), false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE((SELECT auth.jwt()) -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)
      ) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  )
  WITH CHECK (
    COALESCE((((SELECT auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean), false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE((SELECT auth.jwt()) -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)
      ) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  );

CREATE POLICY "Admin manage chat_messages"
  ON public.chat_messages
  FOR ALL
  TO authenticated
  USING (
    COALESCE((((SELECT auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean), false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE((SELECT auth.jwt()) -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)
      ) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  )
  WITH CHECK (
    COALESCE((((SELECT auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean), false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE((SELECT auth.jwt()) -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)
      ) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  );
