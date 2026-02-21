-- Backtest profitability telemetry fields for SPX setup instances.

ALTER TABLE spx_setup_instances
  ADD COLUMN IF NOT EXISTS realized_r NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS entry_fill_price NUMERIC(12,4);

CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_realized_r
  ON spx_setup_instances(session_date, realized_r)
  WHERE realized_r IS NOT NULL;
