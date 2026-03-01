-- Phase 17-S2: Setup type and execution policy hardening.
-- 1) Align setup_type constraints with runtime detector output.
-- 2) Tighten execution table RLS policies to avoid cross-user access.
-- 3) Add PDT query index for execution fills.

DO $$
BEGIN
  IF to_regclass('public.spx_setups') IS NOT NULL THEN
    ALTER TABLE public.spx_setups
      DROP CONSTRAINT IF EXISTS spx_setups_setup_type_check;

    ALTER TABLE public.spx_setups
      ADD CONSTRAINT spx_setups_setup_type_check CHECK (
        setup_type IN (
          'fade_at_wall',
          'breakout_vacuum',
          'mean_reversion',
          'trend_continuation',
          'orb_breakout',
          'trend_pullback',
          'flip_reclaim',
          'vwap_reclaim',
          'vwap_fade_at_band'
        )
      );
  END IF;

  IF to_regclass('public.spx_setup_instances') IS NOT NULL THEN
    ALTER TABLE public.spx_setup_instances
      DROP CONSTRAINT IF EXISTS spx_setup_instances_setup_type_check;

    ALTER TABLE public.spx_setup_instances
      ADD CONSTRAINT spx_setup_instances_setup_type_check CHECK (
        setup_type IN (
          'fade_at_wall',
          'breakout_vacuum',
          'mean_reversion',
          'trend_continuation',
          'orb_breakout',
          'trend_pullback',
          'flip_reclaim',
          'vwap_reclaim',
          'vwap_fade_at_band'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_spx_setup_execution_fills_reported_user_time
  ON spx_setup_execution_fills(reported_by_user_id, executed_at DESC);

ALTER TABLE spx_setup_execution_fills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_spx_setup_execution_fills ON spx_setup_execution_fills;
DROP POLICY IF EXISTS select_spx_setup_execution_fills_owner ON spx_setup_execution_fills;
DROP POLICY IF EXISTS spx_setup_execution_fills_service_all ON spx_setup_execution_fills;

CREATE POLICY select_spx_setup_execution_fills_owner ON spx_setup_execution_fills
  FOR SELECT TO authenticated
  USING (reported_by_user_id = auth.uid());

CREATE POLICY spx_setup_execution_fills_service_all ON spx_setup_execution_fills
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE spx_execution_active_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spx_exec_states_service_all ON spx_execution_active_states;
DROP POLICY IF EXISTS spx_exec_states_user_select ON spx_execution_active_states;

CREATE POLICY spx_exec_states_service_all ON spx_execution_active_states
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY spx_exec_states_user_select ON spx_execution_active_states
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
