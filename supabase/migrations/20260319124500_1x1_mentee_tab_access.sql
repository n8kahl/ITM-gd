-- Ensure 1x1 mentee role can access Mentorship and Journal tabs only.
-- Role: 1468748795234881597 (1x1 mentee)

update public.tab_configurations as t
set required_discord_role_ids = (
  select array_agg(distinct role_id)
  from unnest(coalesce(t.required_discord_role_ids, array[]::text[]) || array['1468748795234881597']) as role_id
)
where t.tab_id in ('journal', 'mentorship');

-- Mark these tabs as required so role-gated access is not blocked by missing tier mappings.
update public.tab_configurations
set is_required = true
where tab_id in ('journal', 'mentorship');
