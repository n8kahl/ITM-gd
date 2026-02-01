-- Migration: Rename "Execute" tier to "Executive" tier
-- This updates the permission name and all references
-- Date: 2026-02-11

-- Step 1: Update the permission name in app_permissions
UPDATE app_permissions
SET
  name = 'access_executive_content',
  description = 'Access Executive Sniper content (full library, premium tools, maximum insights)'
WHERE name = 'access_execute_content';

-- Step 2: Update pricing tier ID and name
-- Note: We update the id column to 'executive' to match the new tier name
UPDATE pricing_tiers
SET
  id = 'executive',
  name = 'Executive Sniper',
  tagline = COALESCE(tagline, 'Maximum conviction, maximum execution')
WHERE id = 'execute';

-- Step 3: Update discord role permissions display name
UPDATE discord_role_permissions
SET discord_role_name = 'Executive Sniper'
WHERE discord_role_name = 'Execute Sniper';

-- Step 4: Update any role_tier_mapping in app_settings
-- This handles the JSON value stored in app_settings
UPDATE app_settings
SET value = REPLACE(value::text, '"execute"', '"executive"')::jsonb
WHERE key = 'role_tier_mapping'
  AND value::text LIKE '%"execute"%';

-- Verification queries (these will show in migration logs)
DO $$
BEGIN
  RAISE NOTICE 'Migration: Rename Execute to Executive - Verification';
  RAISE NOTICE '=============================================';
END $$;

-- Show updated permissions
SELECT 'Updated Permissions:' as check_type, name, description
FROM app_permissions
WHERE name LIKE '%executive%';

-- Show updated pricing tiers
SELECT 'Updated Pricing Tiers:' as check_type, id, name, tagline
FROM pricing_tiers
WHERE id = 'executive';

-- Show updated discord role permissions
SELECT 'Updated Discord Roles:' as check_type, discord_role_name, permission_id
FROM discord_role_permissions
WHERE discord_role_name = 'Executive Sniper';
