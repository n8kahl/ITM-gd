-- User Permissions Table
-- Stores the effective permissions for each user after Discord role sync
-- This table is updated by the sync-discord-roles Edge Function

-- ============================================
-- 1. USER PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,                    -- Supabase Auth user ID
  discord_user_id TEXT,                     -- Discord user ID (snowflake)
  permission_id UUID NOT NULL REFERENCES app_permissions(id) ON DELETE CASCADE,
  granted_by_role_id TEXT,                  -- Which Discord role granted this permission
  granted_by_role_name TEXT,                -- Human-readable role name
  expires_at TIMESTAMPTZ,                   -- Optional expiration for time-limited permissions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_discord_user_id ON user_permissions(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users read own permissions" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all permissions
CREATE POLICY "Service role write for user_permissions" ON user_permissions
  FOR ALL USING (auth.role() = 'service_role');

-- Update trigger
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- ============================================
-- 2. USER DISCORD PROFILES TABLE
-- ============================================
-- Caches Discord profile data to avoid excessive API calls

CREATE TABLE IF NOT EXISTS user_discord_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,             -- Supabase Auth user ID
  discord_user_id TEXT NOT NULL,            -- Discord user ID (snowflake)
  discord_username TEXT,
  discord_discriminator TEXT,
  discord_avatar TEXT,
  discord_roles TEXT[],                     -- Array of Discord role IDs
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_profiles_user_id ON user_discord_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_profiles_discord_id ON user_discord_profiles(discord_user_id);

ALTER TABLE user_discord_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own discord profile" ON user_discord_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role write for discord_profiles" ON user_discord_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER discord_profiles_updated_at
  BEFORE UPDATE ON user_discord_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- ============================================
-- 3. HELPER FUNCTION: Get User Permissions
-- ============================================
-- Returns all active permissions for a user (excluding expired ones)

CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id UUID)
RETURNS TABLE (
  permission_name TEXT,
  permission_description TEXT,
  granted_by_role TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.name AS permission_name,
    ap.description AS permission_description,
    up.granted_by_role_name AS granted_by_role,
    up.expires_at
  FROM user_permissions up
  JOIN app_permissions ap ON up.permission_id = ap.id
  WHERE up.user_id = target_user_id
    AND (up.expires_at IS NULL OR up.expires_at > NOW());
END;
$$;

-- Grant execute to authenticated users (they can only query their own via RLS)
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;

-- ============================================
-- 4. HELPER FUNCTION: Check User Has Permission
-- ============================================
-- Quick check if a user has a specific permission

CREATE OR REPLACE FUNCTION user_has_permission(
  target_user_id UUID,
  permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN app_permissions ap ON up.permission_id = ap.id
    WHERE up.user_id = target_user_id
      AND ap.name = permission_name
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) INTO has_perm;

  RETURN has_perm;
END;
$$;

GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT) TO authenticated;
