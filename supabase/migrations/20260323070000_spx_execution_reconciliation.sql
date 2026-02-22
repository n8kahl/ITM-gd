-- SPX execution fill reconciliation.
-- Tracks broker/manual/proxy fills against setup transition references.

CREATE TABLE IF NOT EXISTS spx_setup_execution_fills (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  engine_setup_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('entry', 'partial', 'exit')),
  phase TEXT CHECK (phase IN ('triggered', 'target1_hit', 'target2_hit', 'invalidated', 'expired')),
  source TEXT NOT NULL CHECK (source IN ('proxy', 'manual', 'broker_tradier', 'broker_other')),
  fill_price NUMERIC(12,4) NOT NULL,
  fill_qty NUMERIC(12,4),
  executed_at TIMESTAMPTZ NOT NULL,
  transition_event_id TEXT,
  reference_price NUMERIC(12,4),
  slippage_points NUMERIC(12,4),
  slippage_bps NUMERIC(12,2),
  broker_order_id TEXT,
  broker_execution_id TEXT,
  reported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spx_setup_execution_fills_broker_execution_id
  ON spx_setup_execution_fills(broker_execution_id)
  WHERE broker_execution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spx_setup_execution_fills_setup_session_time
  ON spx_setup_execution_fills(engine_setup_id, session_date, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_spx_setup_execution_fills_source_time
  ON spx_setup_execution_fills(source, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_spx_setup_execution_fills_transition_event
  ON spx_setup_execution_fills(transition_event_id)
  WHERE transition_event_id IS NOT NULL;

ALTER TABLE spx_setup_execution_fills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spx_setup_execution_fills'
      AND policyname = 'select_spx_setup_execution_fills'
  ) THEN
    CREATE POLICY select_spx_setup_execution_fills ON spx_setup_execution_fills
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spx_setup_execution_fills'
      AND policyname = 'insert_spx_setup_execution_fills'
  ) THEN
    CREATE POLICY insert_spx_setup_execution_fills ON spx_setup_execution_fills
      FOR INSERT TO authenticated
      WITH CHECK (reported_by_user_id IS NULL OR reported_by_user_id = auth.uid());
  END IF;
END
$$;
