-- Enforce 1x1 mentee access scope:
-- - Allowed: journal, mentorship
-- - Not allowed: spx-command-center, swing-sniper
-- Role: 1468748795234881597

-- Ensure allowed tabs include 1x1 mentee role.
update public.tab_configurations as t
set required_discord_role_ids = (
  select array_agg(distinct role_id)
  from unnest(coalesce(t.required_discord_role_ids, array[]::text[]) || array['1468748795234881597']) as role_id
)
where t.tab_id in ('journal', 'mentorship');

-- Ensure restricted tabs do not include 1x1 mentee role.
update public.tab_configurations
set required_discord_role_ids = array_remove(coalesce(required_discord_role_ids, array[]::text[]), '1468748795234881597')
where tab_id in ('spx-command-center', 'swing-sniper');

-- Keep allowed tabs role-gated even when tier mapping is temporarily missing.
update public.tab_configurations
set is_required = true
where tab_id in ('journal', 'mentorship');

-- Preserve tier-based behavior on restricted sniper tabs.
update public.tab_configurations
set is_required = false
where tab_id in ('spx-command-center', 'swing-sniper');
