-- Add Discord role-level tab gating and seed Sniper Mentorship tab configuration.

ALTER TABLE public.tab_configurations
  ADD COLUMN IF NOT EXISTS required_discord_role_ids TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.tab_configurations.required_discord_role_ids IS
  'Optional list of Discord role IDs required to see a tab; admin users still bypass this gate in app logic.';

CREATE INDEX IF NOT EXISTS idx_tab_configurations_required_discord_role_ids
  ON public.tab_configurations
  USING GIN (required_discord_role_ids);

INSERT INTO public.tab_configurations (
  tab_id,
  label,
  icon,
  path,
  required_tier,
  required_discord_role_ids,
  sort_order,
  is_required,
  mobile_visible,
  is_active,
  description
)
VALUES (
  'mentorship',
  'Mentorship',
  'Crosshair',
  '/members/mentorship',
  'core',
  ARRAY['1468748795234881597'],
  9,
  false,
  true,
  true,
  '8-week Sniper Mentorship curriculum with week-by-week modules'
)
ON CONFLICT (tab_id)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  path = EXCLUDED.path,
  required_tier = EXCLUDED.required_tier,
  required_discord_role_ids = EXCLUDED.required_discord_role_ids,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required,
  mobile_visible = EXCLUDED.mobile_visible,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = now();
