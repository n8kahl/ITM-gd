-- Canonical Discord role catalog for stable ID -> title/color resolution across app surfaces.

CREATE TABLE IF NOT EXISTS discord_guild_roles (
  discord_role_id TEXT PRIMARY KEY,
  discord_role_name TEXT NOT NULL,
  role_color INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  managed BOOLEAN NOT NULL DEFAULT false,
  mentionable BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_roles_name
  ON discord_guild_roles(discord_role_name);

CREATE INDEX IF NOT EXISTS idx_discord_guild_roles_position
  ON discord_guild_roles(position DESC);

ALTER TABLE discord_guild_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read discord_guild_roles" ON discord_guild_roles;
CREATE POLICY "Authenticated users read discord_guild_roles"
  ON discord_guild_roles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role all discord_guild_roles" ON discord_guild_roles;
CREATE POLICY "Service role all discord_guild_roles"
  ON discord_guild_roles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_discord_guild_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_discord_guild_roles_updated_at ON discord_guild_roles;
CREATE TRIGGER tr_discord_guild_roles_updated_at
  BEFORE UPDATE ON discord_guild_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_discord_guild_roles_updated_at();
