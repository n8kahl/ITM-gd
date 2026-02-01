-- Migration: Sync user permissions to JWT claims (app_metadata)
-- This enables middleware to check permissions without database calls
-- The trigger fires on user_permissions changes and updates auth.users.raw_app_meta_data

-- ============================================
-- 1. SYNC PERMISSIONS TO CLAIMS FUNCTION
-- ============================================
-- Updates auth.users.raw_app_meta_data with is_admin and is_member flags
-- SECURITY DEFINER allows this function to update auth.users

CREATE OR REPLACE FUNCTION sync_permissions_to_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  has_admin_permission BOOLEAN;
  has_any_permission BOOLEAN;
BEGIN
  -- Determine the user_id based on trigger operation
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Check if user has admin_dashboard permission
  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN app_permissions ap ON up.permission_id = ap.id
    WHERE up.user_id = target_user_id
      AND ap.name = 'admin_dashboard'
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) INTO has_admin_permission;

  -- Check if user has ANY permission (implies valid member)
  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    WHERE up.user_id = target_user_id
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) INTO has_any_permission;

  -- Update auth.users.raw_app_meta_data
  -- Merge with existing metadata to preserve other fields
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'is_admin', has_admin_permission,
    'is_member', has_any_permission
  )
  WHERE id = target_user_id;

  -- Return appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================
-- 2. CREATE TRIGGER ON USER_PERMISSIONS
-- ============================================
-- Fires after INSERT, UPDATE, or DELETE on user_permissions

DROP TRIGGER IF EXISTS on_permission_change ON user_permissions;

CREATE TRIGGER on_permission_change
  AFTER INSERT OR UPDATE OR DELETE
  ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION sync_permissions_to_claims();

-- ============================================
-- 3. UTILITY FUNCTION: Refresh All User Claims
-- ============================================
-- Useful for initial migration and manual re-sync

CREATE OR REPLACE FUNCTION refresh_all_user_claims()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
  has_admin_permission BOOLEAN;
  has_any_permission BOOLEAN;
BEGIN
  -- Iterate through all users in auth.users
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    -- Check if user has admin_dashboard permission
    SELECT EXISTS (
      SELECT 1
      FROM user_permissions up
      JOIN app_permissions ap ON up.permission_id = ap.id
      WHERE up.user_id = user_record.id
        AND ap.name = 'admin_dashboard'
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ) INTO has_admin_permission;

    -- Check if user has ANY permission
    SELECT EXISTS (
      SELECT 1
      FROM user_permissions up
      WHERE up.user_id = user_record.id
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ) INTO has_any_permission;

    -- Update auth.users.raw_app_meta_data
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_admin', has_admin_permission,
      'is_member', has_any_permission
    )
    WHERE id = user_record.id;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$;

-- ============================================
-- 4. BACKFILL EXISTING USERS
-- ============================================
-- Run this once to update all existing users' metadata

SELECT refresh_all_user_claims();
