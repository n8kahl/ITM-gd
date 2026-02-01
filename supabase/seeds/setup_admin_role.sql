-- ============================================
-- SETUP: Map Discord ITMAdmin Role to Admin Permission
-- ============================================
--
-- This seed file maps your Discord "highest access" role to the admin_dashboard permission.
-- Run this in the Supabase SQL Editor after the migration is applied.
--
-- Discord Role ID: 1465515598640447662
-- Permission: admin_dashboard
--

-- 1. Ensure the admin_dashboard permission exists
INSERT INTO app_permissions (name, description)
VALUES ('admin_dashboard', 'Can access admin dashboard')
ON CONFLICT (name) DO NOTHING;

-- 2. Map the Discord ITMAdmin role to admin_dashboard permission
INSERT INTO discord_role_permissions (discord_role_id, discord_role_name, permission_id)
SELECT
  '1465515598640447662',           -- Your Discord Role ID
  'ITMAdmin',                       -- Human-readable name
  id
FROM app_permissions
WHERE name = 'admin_dashboard'
ON CONFLICT (discord_role_id, permission_id) DO UPDATE
SET discord_role_name = EXCLUDED.discord_role_name;

-- 3. Verify the mapping was created
SELECT
  drp.discord_role_id,
  drp.discord_role_name,
  ap.name as permission_name,
  ap.description
FROM discord_role_permissions drp
JOIN app_permissions ap ON drp.permission_id = ap.id
WHERE drp.discord_role_id = '1465515598640447662';
