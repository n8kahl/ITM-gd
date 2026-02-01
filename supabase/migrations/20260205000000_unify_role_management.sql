-- 1. Add direct link between Pricing Tiers and Discord Roles
ALTER TABLE pricing_tiers
ADD COLUMN IF NOT EXISTS discord_role_id TEXT,
ADD COLUMN IF NOT EXISTS discord_role_name TEXT;

-- 2. Create an index for faster lookups during auth sync
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_role_id ON pricing_tiers(discord_role_id);

-- 3. (Optional) Migrate data if you have existing JSON mappings
-- This block attempts to migrate from app_settings if valid JSON exists
DO $$
DECLARE
  mapping_json JSONB;
  role_id TEXT;
  tier_key TEXT;
BEGIN
  -- Get the JSON mapping
  SELECT value::jsonb INTO mapping_json
  FROM app_settings
  WHERE key = 'role_tier_mapping';

  -- Iterate and update if exists
  IF mapping_json IS NOT NULL THEN
    FOR role_id, tier_key IN SELECT * FROM jsonb_each_text(mapping_json)
    LOOP
      UPDATE pricing_tiers
      SET discord_role_id = role_id
      WHERE id = tier_key;
    END LOOP;
  END IF;
END $$;
