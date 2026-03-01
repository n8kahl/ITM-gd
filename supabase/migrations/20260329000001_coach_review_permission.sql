-- Seed permission for member-initiated coach review requests.

INSERT INTO public.app_permissions (name, description)
VALUES ('flag_for_coach_review', 'Allows member to flag trades for coach review')
ON CONFLICT (name) DO NOTHING;

-- Default mapping: mirror trading-journal access roles so eligible members
-- can request coach review immediately after migration.
INSERT INTO public.discord_role_permissions (discord_role_id, discord_role_name, permission_id)
SELECT DISTINCT
  drp.discord_role_id,
  drp.discord_role_name,
  ap_new.id
FROM public.discord_role_permissions drp
JOIN public.app_permissions ap_existing
  ON ap_existing.id = drp.permission_id
JOIN public.app_permissions ap_new
  ON ap_new.name = 'flag_for_coach_review'
WHERE ap_existing.name = 'access_trading_journal'
ON CONFLICT (discord_role_id, permission_id) DO NOTHING;
