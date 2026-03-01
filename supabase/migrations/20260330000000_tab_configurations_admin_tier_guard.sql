-- Ensure tab_configurations.required_tier supports admin-tier tabs.
-- Idempotent guard for environments that missed earlier migration(s).

ALTER TABLE public.tab_configurations
  DROP CONSTRAINT IF EXISTS tab_configurations_required_tier_check;

ALTER TABLE public.tab_configurations
  ADD CONSTRAINT tab_configurations_required_tier_check
  CHECK (required_tier IN ('core', 'pro', 'executive', 'admin'));
