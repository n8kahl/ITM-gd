-- SPX Command Center foundation schema
-- Includes data tables, RLS, indexes, and tab configuration seed.

-- =========================
-- Table: spx_levels
-- =========================
CREATE TABLE IF NOT EXISTS spx_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL CHECK (symbol IN ('SPX', 'SPY')),
  level_type TEXT NOT NULL CHECK (level_type IN ('structural', 'tactical', 'intraday', 'options', 'fibonacci', 'spy_derived')),
  source TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  strength TEXT CHECK (strength IN ('strong', 'moderate', 'weak', 'dynamic', 'critical')),
  timeframe TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Table: spx_cluster_zones
-- =========================
CREATE TABLE IF NOT EXISTS spx_cluster_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_low NUMERIC(12,2) NOT NULL,
  price_high NUMERIC(12,2) NOT NULL,
  cluster_score NUMERIC(8,2) NOT NULL,
  source_breakdown JSONB NOT NULL,
  zone_type TEXT CHECK (zone_type IN ('fortress', 'defended', 'moderate', 'minor')),
  test_count INTEGER NOT NULL DEFAULT 0,
  last_test_at TIMESTAMPTZ,
  held BOOLEAN,
  hold_rate NUMERIC(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (price_high >= price_low)
);

-- =========================
-- Table: spx_setups
-- =========================
CREATE TABLE IF NOT EXISTS spx_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_type TEXT NOT NULL CHECK (setup_type IN ('fade_at_wall', 'breakout_vacuum', 'mean_reversion', 'trend_continuation')),
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish')),
  entry_zone_low NUMERIC(12,2),
  entry_zone_high NUMERIC(12,2),
  stop_price NUMERIC(12,2),
  target_1_price NUMERIC(12,2),
  target_2_price NUMERIC(12,2),
  confluence_score INTEGER NOT NULL CHECK (confluence_score BETWEEN 0 AND 5),
  confluence_sources JSONB NOT NULL,
  cluster_zone_id UUID REFERENCES spx_cluster_zones(id) ON DELETE SET NULL,
  regime TEXT CHECK (regime IN ('trending', 'ranging', 'compression', 'breakout')),
  status TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'ready', 'triggered', 'invalidated', 'expired')),
  probability NUMERIC(5,2),
  recommended_contract JSONB,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  CHECK (entry_zone_high IS NULL OR entry_zone_low IS NULL OR entry_zone_high >= entry_zone_low)
);

-- =========================
-- Table: spx_ai_coaching_log
-- =========================
CREATE TABLE IF NOT EXISTS spx_ai_coaching_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  coaching_type TEXT NOT NULL CHECK (coaching_type IN ('pre_trade', 'in_trade', 'behavioral', 'post_trade', 'alert')),
  setup_id UUID REFERENCES spx_setups(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  context_snapshot JSONB,
  trader_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Table: spx_gex_snapshots
-- =========================
CREATE TABLE IF NOT EXISTS spx_gex_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL CHECK (symbol IN ('SPX', 'SPY', 'COMBINED')),
  snapshot_time TIMESTAMPTZ NOT NULL,
  net_gex NUMERIC(18,2),
  flip_point NUMERIC(12,2),
  gex_by_strike JSONB NOT NULL,
  call_wall NUMERIC(12,2),
  put_wall NUMERIC(12,2),
  zero_gamma NUMERIC(12,2),
  key_levels JSONB,
  expiration_mix JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_spx_levels_symbol_active
  ON spx_levels(symbol)
  WHERE valid_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_spx_cluster_zones_active
  ON spx_cluster_zones(session_date, is_active);

CREATE INDEX IF NOT EXISTS idx_spx_setups_status
  ON spx_setups(session_date, status);

CREATE INDEX IF NOT EXISTS idx_spx_gex_snapshots_time
  ON spx_gex_snapshots(symbol, snapshot_time DESC);

CREATE INDEX IF NOT EXISTS idx_spx_ai_coaching_log_user
  ON spx_ai_coaching_log(user_id, session_date);

-- =========================
-- RLS
-- =========================
ALTER TABLE spx_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE spx_cluster_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE spx_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE spx_gex_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE spx_ai_coaching_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spx_levels' AND policyname = 'select_spx_levels'
  ) THEN
    CREATE POLICY select_spx_levels ON spx_levels
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spx_cluster_zones' AND policyname = 'select_spx_cluster_zones'
  ) THEN
    CREATE POLICY select_spx_cluster_zones ON spx_cluster_zones
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spx_setups' AND policyname = 'select_spx_setups'
  ) THEN
    CREATE POLICY select_spx_setups ON spx_setups
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spx_gex_snapshots' AND policyname = 'select_spx_gex_snapshots'
  ) THEN
    CREATE POLICY select_spx_gex_snapshots ON spx_gex_snapshots
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spx_ai_coaching_log' AND policyname = 'select_own_spx_ai_coaching_log'
  ) THEN
    CREATE POLICY select_own_spx_ai_coaching_log ON spx_ai_coaching_log
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spx_ai_coaching_log' AND policyname = 'insert_own_spx_ai_coaching_log'
  ) THEN
    CREATE POLICY insert_own_spx_ai_coaching_log ON spx_ai_coaching_log
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

-- =========================
-- Tab configuration alignment
-- =========================
-- Ensure SPX Command Center sits between Journal and AI Coach.
UPDATE tab_configurations
SET sort_order = 4
WHERE tab_id = 'ai-coach' AND sort_order <= 3;

UPDATE tab_configurations
SET sort_order = 5
WHERE tab_id = 'library' AND sort_order <= 4;

UPDATE tab_configurations
SET sort_order = 6
WHERE tab_id = 'social' AND sort_order <= 5;

UPDATE tab_configurations
SET sort_order = 7
WHERE tab_id = 'studio' AND sort_order <= 6;

INSERT INTO tab_configurations (
  tab_id,
  label,
  icon,
  path,
  required_tier,
  badge_text,
  badge_variant,
  description,
  mobile_visible,
  sort_order,
  is_required,
  is_active
) VALUES (
  'spx-command-center',
  'SPX Command Center',
  'Target',
  '/members/spx-command-center',
  'pro',
  'LIVE',
  'emerald',
  'Real-time SPX trading intelligence with AI coaching',
  true,
  3,
  false,
  true
)
ON CONFLICT (tab_id)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  path = EXCLUDED.path,
  required_tier = EXCLUDED.required_tier,
  badge_text = EXCLUDED.badge_text,
  badge_variant = EXCLUDED.badge_variant,
  description = EXCLUDED.description,
  mobile_visible = EXCLUDED.mobile_visible,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  updated_at = now();
