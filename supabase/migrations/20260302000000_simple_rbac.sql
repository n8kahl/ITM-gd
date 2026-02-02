-- Simple RBAC: Discord Roles → Allowed Tabs
-- This migration creates a clean permissions system where Discord roles
-- directly map to which member area tabs a user can access.

-- Create app_config schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app_config;

-- Role Permissions Table
-- Maps Discord role IDs to allowed member area tabs
CREATE TABLE app_config.role_permissions (
  discord_role_id TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  role_color TEXT, -- Discord role color for UI display
  allowed_tabs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_config.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read permissions (to check their own access)
CREATE POLICY "Authenticated users can read permissions"
  ON app_config.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can modify permissions
CREATE POLICY "Admins can manage permissions"
  ON app_config.role_permissions
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

-- Function: Get Allowed Tabs for a User
-- Returns the union of all allowed_tabs from roles the user has
CREATE OR REPLACE FUNCTION public.get_user_allowed_tabs(user_id uuid)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_roles TEXT[];
  result_tabs TEXT[];
BEGIN
  -- Get user's Discord roles from app_metadata
  SELECT COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(
          raw_app_meta_data->'discord_roles',
          '[]'::jsonb
        )
      )
    ),
    ARRAY[]::TEXT[]
  )
  INTO user_roles
  FROM auth.users
  WHERE id = user_id;

  -- If no roles, return empty array
  IF user_roles IS NULL OR array_length(user_roles, 1) IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Get distinct union of allowed_tabs for all user's roles
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT tab),
    ARRAY[]::TEXT[]
  )
  INTO result_tabs
  FROM (
    SELECT UNNEST(allowed_tabs) as tab
    FROM app_config.role_permissions
    WHERE discord_role_id = ANY(user_roles)
  ) tabs;

  RETURN result_tabs;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_allowed_tabs(uuid) TO authenticated;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION app_config.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON app_config.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION app_config.update_updated_at_column();

-- Insert default permissions for common tiers
-- These will be overridden when syncing with actual Discord roles
INSERT INTO app_config.role_permissions (discord_role_id, role_name, allowed_tabs) VALUES
  ('core_sniper', 'Core Sniper', ARRAY['dashboard', 'library', 'profile']),
  ('pro_sniper', 'Pro Sniper', ARRAY['dashboard', 'journal', 'library', 'profile']),
  ('executive_sniper', 'Executive Sniper', ARRAY['dashboard', 'journal', 'library', 'profile'])
ON CONFLICT (discord_role_id) DO NOTHING;

-- Comments
COMMENT ON TABLE app_config.role_permissions IS 'Maps Discord roles to allowed member area tabs';
COMMENT ON FUNCTION public.get_user_allowed_tabs IS 'Returns array of tab IDs a user can access based on their Discord roles';
