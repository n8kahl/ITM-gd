-- Add phone_number column to team_members for SMS notifications
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN team_members.phone_number IS 'Phone number for SMS notifications (format: +1XXXXXXXXXX)';

-- Create app_settings table for configurable settings like Zapier webhook URL
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default Zapier webhook URL (empty by default)
INSERT INTO app_settings (key, value) VALUES ('zapier_webhook_url', '')
ON CONFLICT (key) DO NOTHING;

-- RLS policies for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Anyone can read settings"
  ON app_settings FOR SELECT
  USING (true);

-- Allow anyone to update settings (admin page handles auth)
CREATE POLICY "Anyone can update settings"
  ON app_settings FOR UPDATE
  USING (true);

-- Allow anyone to insert settings
CREATE POLICY "Anyone can insert settings"
  ON app_settings FOR INSERT
  WITH CHECK (true);

-- Grant access to both anon and authenticated
GRANT SELECT, UPDATE, INSERT ON app_settings TO anon, authenticated;
