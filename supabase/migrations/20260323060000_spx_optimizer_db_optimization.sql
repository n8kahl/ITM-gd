-- SPX optimizer/backtest DB optimization: date-range scan + deterministic pagination support

CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_session_engine
  ON spx_setup_instances(session_date, engine_setup_id);

CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_session_setup_triggered
  ON spx_setup_instances(session_date, setup_type, regime, triggered_at);

DO $$
BEGIN
  IF to_regclass('public.ai_coach_tracked_setups') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_coach_tracked_setups_symbol_tracked_at ON ai_coach_tracked_setups(symbol, tracked_at, id)';
  END IF;
END
$$;
