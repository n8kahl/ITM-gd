-- Phase 18 hardening: explicit RLS policies for spx_level_touches.
-- Access model: backend service role only (no direct client access).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spx_level_touches'
      AND policyname = 'service_role_manage_spx_level_touches'
  ) THEN
    CREATE POLICY service_role_manage_spx_level_touches
      ON public.spx_level_touches
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
