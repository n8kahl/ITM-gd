-- Align JWT is_member claim with members-area Discord role gate (not generic permission existence)
-- This prevents non-member permission grants from implicitly unlocking /members access.

CREATE OR REPLACE FUNCTION sync_permissions_to_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  has_admin_permission BOOLEAN;
  has_members_role BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Admin claim remains permission-derived.
  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN app_permissions ap ON up.permission_id = ap.id
    WHERE up.user_id = target_user_id
      AND ap.name = 'admin_dashboard'
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) INTO has_admin_permission;

  -- Member claim must mirror middleware role gate.
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.raw_app_meta_data->'discord_roles', '[]'::jsonb)) AS role_id
    WHERE u.id = target_user_id
      AND role_id IN ('1471195516070264863', '1465515598640447662')
  ) INTO has_members_role;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'is_admin', has_admin_permission,
    'is_member', has_members_role
  )
  WHERE id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

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
  has_members_role BOOLEAN;
BEGIN
  FOR user_record IN SELECT id, raw_app_meta_data FROM auth.users
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM user_permissions up
      JOIN app_permissions ap ON up.permission_id = ap.id
      WHERE up.user_id = user_record.id
        AND ap.name = 'admin_dashboard'
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ) INTO has_admin_permission;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(user_record.raw_app_meta_data->'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id IN ('1471195516070264863', '1465515598640447662')
    ) INTO has_members_role;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_admin', has_admin_permission,
      'is_member', has_members_role
    )
    WHERE id = user_record.id;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$;

SELECT refresh_all_user_claims();
