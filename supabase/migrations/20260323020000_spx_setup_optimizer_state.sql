-- SPX setup optimizer state (walk-forward scan profile + scorecard)

CREATE TABLE IF NOT EXISTS spx_setup_optimizer_state (
  id TEXT PRIMARY KEY DEFAULT 'active',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  scorecard JSONB NOT NULL DEFAULT '{}'::jsonb,
  scan_range_from DATE,
  scan_range_to DATE,
  training_from DATE,
  training_to DATE,
  validation_from DATE,
  validation_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spx_optimizer_state_status_updated
  ON spx_setup_optimizer_state(status, updated_at DESC);

ALTER TABLE spx_setup_optimizer_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spx_setup_optimizer_state'
      AND policyname = 'select_spx_setup_optimizer_state'
  ) THEN
    CREATE POLICY select_spx_setup_optimizer_state
      ON spx_setup_optimizer_state
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;
