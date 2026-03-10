-- Discord Alert Console foundation (Phase 1, Slice 1)
-- Adds admin-managed Discord config + alert console preferences and
-- extends existing Discord replay tables with alert-console metadata.

BEGIN;

-- Existing table extensions
ALTER TABLE public.discord_trade_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'discord_bot';

DO $$
BEGIN
  ALTER TABLE public.discord_trade_sessions
    ADD CONSTRAINT discord_trade_sessions_source_check
    CHECK (source IN ('discord_bot', 'admin_console'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.discord_messages
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'discord_bot',
  ADD COLUMN IF NOT EXISTS admin_alert_id UUID,
  ADD COLUMN IF NOT EXISTS webhook_status TEXT NOT NULL DEFAULT 'sent';

DO $$
BEGIN
  ALTER TABLE public.discord_messages
    ADD CONSTRAINT discord_messages_source_check
    CHECK (source IN ('discord_bot', 'admin_console'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.discord_messages
    ADD CONSTRAINT discord_messages_webhook_status_check
    CHECK (webhook_status IN ('sent', 'failed', 'resent'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admin-managed Discord connection settings
CREATE TABLE IF NOT EXISTS public.discord_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token TEXT,
  bot_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  guild_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  alert_channel_id TEXT,
  alert_channel_name TEXT,
  delivery_method TEXT NOT NULL DEFAULT 'bot'
    CHECK (delivery_method IN ('bot', 'webhook')),
  webhook_url TEXT,
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'error', 'reconnecting')),
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  configured_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-admin alert console defaults
CREATE TABLE IF NOT EXISTS public.admin_alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_tickers TEXT[] NOT NULL DEFAULT ARRAY['SPX']::TEXT[],
  recent_tickers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  max_recent_tickers INTEGER NOT NULL DEFAULT 5,
  default_size_tag TEXT NOT NULL DEFAULT 'full'
    CHECK (default_size_tag IN ('full', 'light', 'lotto')),
  default_stop_pct NUMERIC DEFAULT 20,
  default_strikes_per_side INTEGER NOT NULL DEFAULT 10,
  default_mention_everyone BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_alert_preferences_user_id
  ON public.admin_alert_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_discord_config_updated_at
  ON public.discord_config (updated_at DESC);

-- RLS
ALTER TABLE public.discord_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alert_preferences ENABLE ROW LEVEL SECURITY;

-- discord_config: admin read/write + service role runtime access
DROP POLICY IF EXISTS "select_discord_config_admin" ON public.discord_config;
DROP POLICY IF EXISTS "insert_discord_config_admin" ON public.discord_config;
DROP POLICY IF EXISTS "update_discord_config_admin" ON public.discord_config;
DROP POLICY IF EXISTS "delete_discord_config_admin" ON public.discord_config;
DROP POLICY IF EXISTS "select_discord_config_service_role" ON public.discord_config;
DROP POLICY IF EXISTS "insert_discord_config_service_role" ON public.discord_config;
DROP POLICY IF EXISTS "update_discord_config_service_role" ON public.discord_config;
DROP POLICY IF EXISTS "delete_discord_config_service_role" ON public.discord_config;

CREATE POLICY "select_discord_config_admin"
  ON public.discord_config
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "insert_discord_config_admin"
  ON public.discord_config
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "update_discord_config_admin"
  ON public.discord_config
  FOR UPDATE
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "delete_discord_config_admin"
  ON public.discord_config
  FOR DELETE
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "select_discord_config_service_role"
  ON public.discord_config
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "insert_discord_config_service_role"
  ON public.discord_config
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "update_discord_config_service_role"
  ON public.discord_config
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_discord_config_service_role"
  ON public.discord_config
  FOR DELETE
  TO service_role
  USING (true);

-- admin_alert_preferences: admin can manage own row
DROP POLICY IF EXISTS "select_admin_alert_preferences_own_admin" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "insert_admin_alert_preferences_own_admin" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "update_admin_alert_preferences_own_admin" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "delete_admin_alert_preferences_own_admin" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "select_admin_alert_preferences_service_role" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "insert_admin_alert_preferences_service_role" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "update_admin_alert_preferences_service_role" ON public.admin_alert_preferences;
DROP POLICY IF EXISTS "delete_admin_alert_preferences_service_role" ON public.admin_alert_preferences;

CREATE POLICY "select_admin_alert_preferences_own_admin"
  ON public.admin_alert_preferences
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "insert_admin_alert_preferences_own_admin"
  ON public.admin_alert_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "update_admin_alert_preferences_own_admin"
  ON public.admin_alert_preferences
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "delete_admin_alert_preferences_own_admin"
  ON public.admin_alert_preferences
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "select_admin_alert_preferences_service_role"
  ON public.admin_alert_preferences
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "insert_admin_alert_preferences_service_role"
  ON public.admin_alert_preferences
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "update_admin_alert_preferences_service_role"
  ON public.admin_alert_preferences
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_admin_alert_preferences_service_role"
  ON public.admin_alert_preferences
  FOR DELETE
  TO service_role
  USING (true);

COMMIT;
