-- Add chat widget visibility setting to app_settings
-- Defaults to visible (true) so existing installations aren't affected

INSERT INTO app_settings (key, value) VALUES (
  'chat_widget_visible',
  'true'
)
ON CONFLICT (key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE app_settings IS 'Application-wide settings including AI prompt, Discord config, and chat widget visibility';
