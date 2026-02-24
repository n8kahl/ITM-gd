-- Phase 18: persist zone touch history for price-action and cross-session quality scoring.
-- Resilient to phased environments where spx_cluster_zones may not yet exist.

CREATE TABLE IF NOT EXISTS public.spx_level_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_price NUMERIC(12,2) NOT NULL,
  zone_id UUID,
  setup_instance_id UUID,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('bounce', 'break', 'held', 'unknown')),
  volume NUMERIC(18,2),
  candle_pattern TEXT NOT NULL DEFAULT 'none' CHECK (
    candle_pattern IN ('engulfing_bull', 'engulfing_bear', 'doji', 'hammer', 'inverted_hammer', 'none')
  ),
  spread NUMERIC(12,4),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spx_setup_instances'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'spx_level_touches_setup_instance_id_fkey'
    ) THEN
      ALTER TABLE public.spx_level_touches
      ADD CONSTRAINT spx_level_touches_setup_instance_id_fkey
      FOREIGN KEY (setup_instance_id)
      REFERENCES public.spx_setup_instances(id)
      ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spx_cluster_zones'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'spx_level_touches_zone_id_fkey'
    ) THEN
      ALTER TABLE public.spx_level_touches
      ADD CONSTRAINT spx_level_touches_zone_id_fkey
      FOREIGN KEY (zone_id)
      REFERENCES public.spx_cluster_zones(id)
      ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_spx_level_touches_session_level
  ON public.spx_level_touches(session_date, level_price, tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_spx_level_touches_zone_time
  ON public.spx_level_touches(zone_id, tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_spx_level_touches_setup_instance
  ON public.spx_level_touches(setup_instance_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spx_level_touches_setup_instance_unique
  ON public.spx_level_touches(setup_instance_id);

ALTER TABLE public.spx_level_touches ENABLE ROW LEVEL SECURITY;
