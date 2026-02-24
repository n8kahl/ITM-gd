create table if not exists public.dead_letter_queue (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  error_message text,
  error_stack text,
  source text not null,
  created_at timestamptz not null default now(),
  retried_at timestamptz,
  retry_count integer not null default 0,
  resolved boolean not null default false
);

create index if not exists idx_dlq_unresolved
  on public.dead_letter_queue (resolved, created_at desc)
  where resolved = false;

alter table public.dead_letter_queue enable row level security;

drop policy if exists dlq_service_role on public.dead_letter_queue;

create policy dlq_service_role
  on public.dead_letter_queue
  for all
  to service_role
  using (true)
  with check (true);
