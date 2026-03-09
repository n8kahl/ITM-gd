-- Seed the Swing Sniper member tab for all authenticated members.

INSERT INTO public.tab_configurations (
  tab_id,
  label,
  icon,
  path,
  required_tier,
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
  badge_text = EXCLUDED.badge_text,
  badge_variant = EXCLUDED.badge_variant,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required,
  mobile_visible = EXCLUDED.mobile_visible,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = now();
