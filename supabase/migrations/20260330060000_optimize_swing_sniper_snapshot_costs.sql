-- Keep Swing Sniper snapshot reads/pruning efficient as universe usage scales.

DO $$
BEGIN
  IF to_regclass('public.swing_sniper_signal_snapshots') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_swing_sniper_signal_snapshots_user_source_date
      ON public.swing_sniper_signal_snapshots(user_id, captured_from, as_of_date DESC);

    CREATE INDEX IF NOT EXISTS idx_swing_sniper_signal_snapshots_user_source_asof
      ON public.swing_sniper_signal_snapshots(user_id, captured_from, as_of DESC);
  END IF;
END
$$;
