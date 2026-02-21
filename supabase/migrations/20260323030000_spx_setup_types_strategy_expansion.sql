-- Expand SPX setup-type contracts for strategy diversification.
-- Adds ORB breakout, trend pullback, and flip reclaim families.

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
          'flip_reclaim'
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
          'flip_reclaim'
        )
      );
  END IF;
END
$$;
