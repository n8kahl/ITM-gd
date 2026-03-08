-- Configurable members role gate + claims alignment
-- Ensures membership claim evaluation and runtime gate checks share the same role ID source.

INSERT INTO app_settings (key, value)
VALUES (
  'members_required_role_ids',
  '["1471195516070264863","1465515598640447662"]'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Safe app_settings read" ON app_settings;
CREATE POLICY "Safe app_settings read"
  ON app_settings FOR SELECT
  TO anon, authenticated
  USING (key IN ('role_tier_mapping', 'chat_widget_visible', 'members_required_role_ids'));

CREATE OR REPLACE FUNCTION get_members_allowed_role_ids()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_ids_raw TEXT;
  parsed_role_ids TEXT[];
  default_role_ids TEXT[] := ARRAY['1471195516070264863', '1465515598640447662'];
BEGIN
  SELECT value
  INTO role_ids_raw
  FROM app_settings
  WHERE key = 'members_required_role_ids'
  LIMIT 1;

  IF role_ids_raw IS NULL OR btrim(role_ids_raw) = '' THEN
    SELECT value
    INTO role_ids_raw
    FROM app_settings
    WHERE key = 'members_required_role_id'
    LIMIT 1;
  END IF;

  IF role_ids_raw IS NULL OR btrim(role_ids_raw) = '' THEN
    RETURN default_role_ids;
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
      RETURN default_role_ids;
    END;
  ELSE
    SELECT ARRAY(
      SELECT DISTINCT btrim(role_id)
      FROM unnest(string_to_array(role_ids_raw, ',')) AS role_id
      WHERE btrim(role_id) <> ''
    )
    INTO parsed_role_ids;
  END IF;

  IF parsed_role_ids IS NULL OR array_length(parsed_role_ids, 1) IS NULL THEN
    RETURN default_role_ids;
  END IF;

  RETURN parsed_role_ids;
END;
$$;

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
  members_allowed_role_ids TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  members_allowed_role_ids := get_members_allowed_role_ids();

  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN app_permissions ap ON up.permission_id = ap.id
    WHERE up.user_id = target_user_id
      AND ap.name = 'admin_dashboard'
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) INTO has_admin_permission;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.raw_app_meta_data->'discord_roles', '[]'::jsonb)) AS role_id
    WHERE u.id = target_user_id
      AND role_id = ANY(members_allowed_role_ids)
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
  members_allowed_role_ids TEXT[];
BEGIN
  members_allowed_role_ids := get_members_allowed_role_ids();

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
      WHERE role_id = ANY(members_allowed_role_ids)
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
