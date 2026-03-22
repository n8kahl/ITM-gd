-- Edge function execution log for monitoring execution time and error rates
create table if not exists public.edge_function_logs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  status text not null check (status in ('success', 'error')),
  execution_time_ms integer not null,
  error_message text,
  invoked_at timestamptz not null default now()
);

create index if not exists idx_efl_function_name_invoked
  on public.edge_function_logs (function_name, invoked_at desc);

create index if not exists idx_efl_status_invoked
  on public.edge_function_logs (status, invoked_at desc);

alter table public.edge_function_logs enable row level security;

drop policy if exists efl_service_role on public.edge_function_logs;

create policy efl_service_role
  on public.edge_function_logs
  for all
  to service_role
  using (true)
  with check (true);
