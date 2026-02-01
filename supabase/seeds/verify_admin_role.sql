-- ============================================
-- VERIFY & FIX: Admin Role Mapping
-- ============================================
-- Run this in Supabase SQL Editor to diagnose and fix admin access issues

-- STEP 1: Check if admin_dashboard permission exists
SELECT 'Checking admin_dashboard permission...' as step;
SELECT id, name, description
FROM app_permissions
WHERE name = 'admin_dashboard';

-- If empty, create it:
INSERT INTO app_permissions (name, description)
VALUES ('admin_dashboard', 'Can access admin dashboard')
ON CONFLICT (name) DO NOTHING;

-- STEP 2: Check if Discord role mapping exists
SELECT 'Checking Discord role mapping...' as step;
SELECT
  drp.discord_role_id,
  drp.discord_role_name,
  ap.name as permission_name,
  ap.description
FROM discord_role_permissions drp
JOIN app_permissions ap ON drp.permission_id = ap.id
WHERE drp.discord_role_id = '1465515598640447662';

-- If empty, create it:
INSERT INTO discord_role_permissions (discord_role_id, discord_role_name, permission_id)
SELECT
  '1465515598640447662',
  'ITMAdmin',
  id
FROM app_permissions
WHERE name = 'admin_dashboard'
ON CONFLICT (discord_role_id, permission_id) DO UPDATE
SET discord_role_name = EXCLUDED.discord_role_name;

-- STEP 3: Check ALL Discord role mappings (to see what's configured)
SELECT 'All Discord role mappings:' as step;
SELECT
  drp.discord_role_id,
  drp.discord_role_name,
  ap.name as permission_name,
  ap.description
FROM discord_role_permissions drp
JOIN app_permissions ap ON drp.permission_id = ap.id
ORDER BY ap.name;

-- STEP 4: Check if you (the admin) have the Discord role in your profile
SELECT 'Your Discord profile:' as step;
SELECT
  user_id,
  discord_username,
  discord_roles,
  last_synced_at,
  CASE
    WHEN '1465515598640447662' = ANY(discord_roles::text[])
    THEN '✓ You HAVE the ITMAdmin role'
    ELSE '✗ You DO NOT have the ITMAdmin role'
  END as admin_role_status
FROM user_discord_profiles
WHERE discord_user_id IN (
  SELECT user_metadata->>'provider_id'
  FROM auth.users
  WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
)
ORDER BY last_synced_at DESC
LIMIT 1;

-- STEP 5: Check your current permissions
SELECT 'Your current permissions:' as step;
SELECT
  up.user_id,
  ap.name as permission_name,
  up.granted_by_role_name,
  up.granted_by_role_id
FROM user_permissions up
JOIN app_permissions ap ON up.permission_id = ap.id
WHERE up.user_id IN (
  SELECT id FROM auth.users
  WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
);

-- STEP 6: Check your JWT claims (app_metadata)
SELECT 'Your JWT claims (app_metadata):' as step;
SELECT
  id,
  email,
  raw_app_meta_data->>'is_admin' as is_admin_claim,
  raw_app_meta_data->>'is_member' as is_member_claim,
  raw_app_meta_data
FROM auth.users
WHERE email = current_setting('request.jwt.claims', true)::json->>'email';

-- STEP 7: Force refresh claims for current user (if needed)
-- Uncomment to manually trigger claim update:
/*
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'::jsonb
)
WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
  AND EXISTS (
    SELECT 1 FROM user_permissions up
    JOIN app_permissions ap ON up.permission_id = ap.id
    WHERE up.user_id = auth.users.id
      AND ap.name = 'admin_dashboard'
  );
*/

-- STEP 8: Summary
SELECT 'SUMMARY:' as step;
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM discord_role_permissions
      WHERE discord_role_id = '1465515598640447662'
    ) THEN '✓ Role mapping exists'
    ELSE '✗ Role mapping MISSING - run the INSERT above'
  END as role_mapping_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM app_permissions
      WHERE name = 'admin_dashboard'
    ) THEN '✓ Permission exists'
    ELSE '✗ Permission MISSING'
  END as permission_status;
