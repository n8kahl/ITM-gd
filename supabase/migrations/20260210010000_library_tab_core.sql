-- Make Training Library available to all members (no tier gating).
-- This migration intentionally updates only the library tab to avoid overwriting admin customizations.

UPDATE tab_configurations
SET required_tier = 'core',
    description = COALESCE(NULLIF(description, ''), 'Trading education and courses')
WHERE tab_id = 'library'
  AND required_tier <> 'core';

