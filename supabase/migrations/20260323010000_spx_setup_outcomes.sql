-- SPX Command Center outcome tracking for measurable T1/T2 win rates.

-- ==================================
-- Table: spx_setup_instances
-- ==================================
CREATE TABLE IF NOT EXISTS spx_setup_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_setup_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  setup_type TEXT NOT NULL CHECK (setup_type IN ('fade_at_wall', 'breakout_vacuum', 'mean_reversion', 'trend_continuation')),
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish')),
  regime TEXT CHECK (regime IN ('trending', 'ranging', 'compression', 'breakout')),
  entry_zone_low NUMERIC(12,2),
  entry_zone_high NUMERIC(12,2),
  stop_price NUMERIC(12,2),
  target_1_price NUMERIC(12,2),
  target_2_price NUMERIC(12,2),
  score NUMERIC(6,2),
  p_win_calibrated NUMERIC(6,4),
  ev_r NUMERIC(8,3),
  tier TEXT CHECK (tier IN ('sniper_primary', 'sniper_secondary', 'watchlist', 'hidden')),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at TIMESTAMPTZ,
  latest_status TEXT NOT NULL DEFAULT 'forming' CHECK (latest_status IN ('forming', 'ready', 'triggered', 'invalidated', 'expired')),
  latest_invalidation_reason TEXT,
  t1_hit_at TIMESTAMPTZ,
  t2_hit_at TIMESTAMPTZ,
  stop_hit_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  final_outcome TEXT CHECK (final_outcome IN ('t2_before_stop', 't1_before_stop', 'stop_before_t1', 'invalidated_other', 'expired_unresolved')),
  final_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (engine_setup_id, session_date),
  CHECK (entry_zone_high IS NULL OR entry_zone_low IS NULL OR entry_zone_high >= entry_zone_low)
);

-- ==================================
-- Table: spx_setup_transitions
-- ==================================
CREATE TABLE IF NOT EXISTS spx_setup_transitions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  engine_setup_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  from_phase TEXT NOT NULL CHECK (from_phase IN ('ready', 'triggered', 'target1_hit', 'target2_hit', 'invalidated', 'expired')),
  to_phase TEXT NOT NULL CHECK (to_phase IN ('ready', 'triggered', 'target1_hit', 'target2_hit', 'invalidated', 'expired')),
  reason TEXT NOT NULL CHECK (reason IN ('entry', 'stop', 'target1', 'target2')),
  price NUMERIC(12,2) NOT NULL,
  event_ts TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================================
-- Indexes
-- ==================================
CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_session_outcome
  ON spx_setup_instances(session_date, final_outcome);

CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_triggered
  ON spx_setup_instances(session_date, triggered_at)
  WHERE triggered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_dimensions
  ON spx_setup_instances(session_date, setup_type, regime, tier);

CREATE INDEX IF NOT EXISTS idx_spx_setup_transitions_setup_ts
  ON spx_setup_transitions(engine_setup_id, event_ts);

CREATE INDEX IF NOT EXISTS idx_spx_setup_transitions_session_phase
  ON spx_setup_transitions(session_date, to_phase);

-- ==================================
-- RLS
-- ==================================
ALTER TABLE spx_setup_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE spx_setup_transitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'spx_setup_instances' AND policyname = 'select_spx_setup_instances'
  ) THEN
    CREATE POLICY select_spx_setup_instances ON spx_setup_instances
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'spx_setup_transitions' AND policyname = 'select_spx_setup_transitions'
  ) THEN
    CREATE POLICY select_spx_setup_transitions ON spx_setup_transitions
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END
$$;
