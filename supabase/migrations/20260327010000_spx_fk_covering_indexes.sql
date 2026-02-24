-- SPX FK covering indexes for production query/delete performance.
-- Addresses unindexed FK lint findings for SPX tables.

create index if not exists idx_spx_setup_execution_fills_reported_by_user_id
  on public.spx_setup_execution_fills (reported_by_user_id)
  where reported_by_user_id is not null;

create index if not exists idx_spx_setup_optimizer_history_reverted_from_history_id
  on public.spx_setup_optimizer_history (reverted_from_history_id)
  where reverted_from_history_id is not null;
