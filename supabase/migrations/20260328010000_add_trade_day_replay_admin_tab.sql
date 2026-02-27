-- Add admin tier support for tab configurations and seed Trade Day Replay tab.
ALTER TABLE public.tab_configurations
  DROP CONSTRAINT IF EXISTS tab_configurations_required_tier_check;

ALTER TABLE public.tab_configurations
  ADD CONSTRAINT tab_configurations_required_tier_check
  CHECK (required_tier IN ('core', 'pro', 'executive', 'admin'));

INSERT INTO public.tab_configurations (
  tab_id,
  label,
  icon,
  path,
  required_tier,
  sort_order,
  is_required,
  mobile_visible,
  is_active
)
VALUES (
  'trade-day-replay',
  'Trade Day Replay',
  'Play',
  '/members/trade-day-replay',
  'admin',
  8,
  false,
  false,
  true
)
ON CONFLICT (tab_id)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  path = EXCLUDED.path,
  required_tier = EXCLUDED.required_tier,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required,
  mobile_visible = EXCLUDED.mobile_visible,
  is_active = EXCLUDED.is_active,
  updated_at = now();
