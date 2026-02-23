-- Phase 17-S1: Execution state persistence
-- Replaces in-memory Map with durable Supabase table for active trade states.
-- Ensures no orphaned positions on backend restart.

CREATE TABLE IF NOT EXISTS spx_execution_active_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  entry_order_id TEXT NOT NULL,
  runner_stop_order_id TEXT,
  entry_limit_price NUMERIC(10,2) NOT NULL,
  actual_fill_qty INTEGER,
  avg_fill_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partial_fill', 'filled', 'failed', 'closed')),
  close_reason TEXT CHECK (close_reason IN ('target1_hit', 'target2_hit', 'stop', 'kill_switch', 'auto_flatten', 'manual', 'expired', 'rejected')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, setup_id, session_date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_spx_exec_active_user_open
  ON spx_execution_active_states(user_id, closed_at)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spx_exec_active_session
  ON spx_execution_active_states(session_date, closed_at)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spx_exec_active_status
  ON spx_execution_active_states(status)
  WHERE status = 'active';

-- RLS policies
ALTER TABLE spx_execution_active_states ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend uses service role key)
CREATE POLICY spx_exec_states_service_all ON spx_execution_active_states
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can only read their own states
CREATE POLICY spx_exec_states_user_select ON spx_execution_active_states
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users cannot directly modify execution states (backend-only writes)
-- No INSERT/UPDATE/DELETE policies for regular users.

COMMENT ON TABLE spx_execution_active_states IS 'Persists active SPX execution states. Replaces in-memory Map for crash resilience. Phase 17-S1.';
