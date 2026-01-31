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

-- Only authenticated users can read settings
CREATE POLICY "Authenticated users can read settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can update settings
CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Grant access
GRANT SELECT, UPDATE ON app_settings TO authenticated;
