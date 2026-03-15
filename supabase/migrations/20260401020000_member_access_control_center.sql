-- Member Access Control Center foundation.
-- Adds canonical guild roster, override policy, and access settings tables.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.discord_guild_members (
  discord_user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  nickname TEXT,
  avatar TEXT,
  discord_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_in_guild BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_user_id UUID,
  sync_source TEXT NOT NULL DEFAULT 'discord_guild_sync',
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_members_linked_user_id
  ON public.discord_guild_members(linked_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_guild_members_linked_user_id_unique
  ON public.discord_guild_members(linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discord_guild_members_roles
  ON public.discord_guild_members
  USING GIN (discord_roles);

CREATE INDEX IF NOT EXISTS idx_discord_guild_members_username_search
  ON public.discord_guild_members
  USING GIN (lower(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_discord_guild_members_global_name_search
  ON public.discord_guild_members
  USING GIN (lower(COALESCE(global_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_discord_guild_members_nickname_search
  ON public.discord_guild_members
  USING GIN (lower(COALESCE(nickname, '')) gin_trgm_ops);

ALTER TABLE public.discord_guild_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read discord_guild_members" ON public.discord_guild_members;
CREATE POLICY "Authenticated users read discord_guild_members"
  ON public.discord_guild_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role all discord_guild_members" ON public.discord_guild_members;
CREATE POLICY "Service role all discord_guild_members"
  ON public.discord_guild_members FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.member_access_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT,
  user_id UUID,
  override_type TEXT NOT NULL CHECK (
    override_type IN (
      'suspend_members_access',
      'allow_members_access',
      'allow_specific_tabs',
      'deny_specific_tabs',
      'temporary_admin'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID,
  revocation_reason TEXT,
  CONSTRAINT member_access_overrides_subject_check
    CHECK (discord_user_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_member_access_overrides_discord_user_id
  ON public.member_access_overrides(discord_user_id)
  WHERE discord_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_access_overrides_user_id
  ON public.member_access_overrides(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_access_overrides_active
  ON public.member_access_overrides(created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.member_access_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role all member_access_overrides" ON public.member_access_overrides;
CREATE POLICY "Service role all member_access_overrides"
  ON public.member_access_overrides FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.access_control_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  members_allowed_role_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  privileged_role_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  admin_role_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  default_linked_user_status TEXT NOT NULL DEFAULT 'inactive',
  allow_discord_role_mutation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.access_control_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read access_control_settings" ON public.access_control_settings;
CREATE POLICY "Authenticated users read access_control_settings"
  ON public.access_control_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role all access_control_settings" ON public.access_control_settings;
CREATE POLICY "Service role all access_control_settings"
  ON public.access_control_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.parse_access_control_role_ids(role_ids_raw TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_role_ids TEXT[];
BEGIN
  IF role_ids_raw IS NULL OR btrim(role_ids_raw) = '' THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  IF left(btrim(role_ids_raw), 1) = '[' THEN
    BEGIN
      SELECT ARRAY(
        SELECT DISTINCT btrim(role_id)
        FROM jsonb_array_elements_text(role_ids_raw::jsonb) AS role_id
        WHERE btrim(role_id) <> ''
      )
      INTO parsed_role_ids;
    EXCEPTION WHEN others THEN
      RETURN ARRAY[]::TEXT[];
    END;
  ELSE
    SELECT ARRAY(
      SELECT DISTINCT btrim(role_id)
      FROM unnest(string_to_array(role_ids_raw, ',')) AS role_id
      WHERE btrim(role_id) <> ''
    )
    INTO parsed_role_ids;
  END IF;

  RETURN COALESCE(parsed_role_ids, ARRAY[]::TEXT[]);
END;
$$;

INSERT INTO public.access_control_settings (
  singleton,
  members_allowed_role_ids,
  privileged_role_ids,
  admin_role_ids,
  default_linked_user_status,
  allow_discord_role_mutation
)
VALUES (
  true,
  COALESCE(
    (
      SELECT public.parse_access_control_role_ids(value)
      FROM public.app_settings
      WHERE key = 'members_required_role_ids'
      LIMIT 1
    ),
    ARRAY['1471195516070264863', '1465515598640447662']::TEXT[]
  ),
  ARRAY['1465515598640447662']::TEXT[],
  ARRAY['1465515598640447662']::TEXT[],
  'inactive',
  false
)
ON CONFLICT (singleton) DO UPDATE
SET
  members_allowed_role_ids = EXCLUDED.members_allowed_role_ids,
  privileged_role_ids = EXCLUDED.privileged_role_ids,
  admin_role_ids = EXCLUDED.admin_role_ids,
  default_linked_user_status = EXCLUDED.default_linked_user_status,
  allow_discord_role_mutation = EXCLUDED.allow_discord_role_mutation,
  updated_at = NOW();

UPDATE public.discord_guild_members AS gm
SET linked_user_id = udp.user_id
FROM public.user_discord_profiles AS udp
WHERE gm.discord_user_id = udp.discord_user_id
  AND (gm.linked_user_id IS DISTINCT FROM udp.user_id);

CREATE OR REPLACE FUNCTION public.update_member_access_control_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_discord_guild_members_updated_at ON public.discord_guild_members;
CREATE TRIGGER tr_discord_guild_members_updated_at
  BEFORE UPDATE ON public.discord_guild_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_access_control_updated_at();

DROP TRIGGER IF EXISTS tr_access_control_settings_updated_at ON public.access_control_settings;
CREATE TRIGGER tr_access_control_settings_updated_at
  BEFORE UPDATE ON public.access_control_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_access_control_updated_at();
