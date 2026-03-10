-- Add Money Maker tab to tab_configurations (admin only)
INSERT INTO public.tab_configurations (
  tab_id,
  label,
  icon,
  path,
  required_tier,
  sort_order,
  is_required,
  mobile_visible,
  description,
  is_active
) VALUES (
  'money-maker',
  'Money Maker',
  'Target',
  '/members/money-maker',
  'admin',
  4,
  false,
  true,
  'High-Precision KCU Strategy Signals',
  true
) ON CONFLICT (tab_id) DO UPDATE SET
  required_tier = EXCLUDED.required_tier,
  is_active = EXCLUDED.is_active;
