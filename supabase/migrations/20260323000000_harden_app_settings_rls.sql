-- Harden app_settings RLS: remove universal write access and restrict sensitive settings.

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can read settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON app_settings;
DROP POLICY IF EXISTS "Service role app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admin manage app_settings" ON app_settings;
DROP POLICY IF EXISTS "Safe app_settings read" ON app_settings;

CREATE POLICY "Service role app_settings"
  ON app_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin manage app_settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(auth.jwt() -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(auth.jwt() -> 'app_metadata' -> 'discord_roles', '[]'::jsonb)) AS role_id
      WHERE role_id = '1465515598640447662'
    )
  );

CREATE POLICY "Safe app_settings read"
  ON app_settings FOR SELECT
  TO anon, authenticated
  USING (key IN ('role_tier_mapping', 'chat_widget_visible'));

REVOKE INSERT, UPDATE, DELETE ON app_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON app_settings FROM authenticated;
GRANT SELECT ON app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON app_settings TO authenticated;
