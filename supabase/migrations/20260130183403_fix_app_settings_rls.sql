-- Fix app_settings RLS policies to allow anon access

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can read settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can read settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON app_settings;

-- Create permissive policies
CREATE POLICY "Anyone can read settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update settings"
  ON app_settings FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can insert settings"
  ON app_settings FOR INSERT
  WITH CHECK (true);

-- Grant access to anon
GRANT SELECT, UPDATE, INSERT ON app_settings TO anon, authenticated;
