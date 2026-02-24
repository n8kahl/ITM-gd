do $$
begin
  if to_regclass('public.ai_coach_tracked_setups') is not null then
    create index if not exists idx_tracked_setups_status_active
      on public.ai_coach_tracked_setups (status, tracked_at desc)
      where status = 'active';
  elsif to_regclass('public.archived_ai_coach_tracked_setups') is not null then
    create index if not exists idx_tracked_setups_status_active
      on public.archived_ai_coach_tracked_setups (status, tracked_at desc)
      where status = 'active';
  end if;
end $$;
