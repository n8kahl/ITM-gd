-- Ensure SPX execution state persistence table and RLS policies exist in all environments.
-- This is intentionally idempotent to reconcile migration drift.

create extension if not exists pgcrypto;

create table if not exists public.spx_execution_active_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setup_id text not null,
  session_date date not null,
  symbol text not null,
  quantity integer not null check (quantity >= 1),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  entry_order_id text not null,
  runner_stop_order_id text,
  entry_limit_price numeric(10,2) not null,
  actual_fill_qty integer,
  avg_fill_price numeric(10,2),
  status text not null default 'active' check (status in ('active', 'partial_fill', 'filled', 'failed', 'closed')),
  close_reason text check (close_reason in ('target1_hit', 'target2_hit', 'stop', 'kill_switch', 'auto_flatten', 'manual', 'expired', 'rejected')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, setup_id, session_date)
);

create index if not exists idx_spx_exec_active_user_open
  on public.spx_execution_active_states(user_id, closed_at)
  where closed_at is null;

create index if not exists idx_spx_exec_active_session
  on public.spx_execution_active_states(session_date, closed_at)
  where closed_at is null;

create index if not exists idx_spx_exec_active_status
  on public.spx_execution_active_states(status)
  where status = 'active';

alter table public.spx_execution_active_states enable row level security;

drop policy if exists spx_exec_states_service_all on public.spx_execution_active_states;
create policy spx_exec_states_service_all on public.spx_execution_active_states
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists spx_exec_states_user_select on public.spx_execution_active_states;
create policy spx_exec_states_user_select on public.spx_execution_active_states
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.spx_execution_active_states is 'Persists active SPX execution states. Replaces in-memory map for crash resilience. Phase 17-S1.';
