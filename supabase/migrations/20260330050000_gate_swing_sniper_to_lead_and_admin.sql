-- Restrict Swing Sniper tab visibility to Lead role holders and admin users.
-- Admins bypass Discord role checks in client auth logic.

ALTER TABLE public.tab_configurations
  ADD COLUMN IF NOT EXISTS required_discord_role_ids TEXT[] DEFAULT NULL;

INSERT INTO public.tab_configurations (
  tab_id,
  label,
  icon,
  path,
  required_tier,
  required_discord_role_ids,
  badge_text,
  badge_variant,
  sort_order,
  is_required,
  mobile_visible,
  is_active,
  description
)
VALUES (
  'swing-sniper',
  'Swing Sniper',
  'Radar',
  '/members/swing-sniper',
  'core',
  ARRAY['1465515598640447662'],
  'New',
  'champagne',
  5,
  false,
  true,
  true,
  'Options research workspace for catalysts, contract selection, and thesis monitoring'
)
ON CONFLICT (tab_id)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  path = EXCLUDED.path,
  required_tier = EXCLUDED.required_tier,
  required_discord_role_ids = EXCLUDED.required_discord_role_ids,
  badge_text = EXCLUDED.badge_text,
  badge_variant = EXCLUDED.badge_variant,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required,
  mobile_visible = EXCLUDED.mobile_visible,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = now();
