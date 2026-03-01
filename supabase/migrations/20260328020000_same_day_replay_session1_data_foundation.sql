-- Same-Day Replay Session 1 (Phase 1.1-1.4)
-- Data foundation DDL + RLS baseline.

-- =========================
-- Tables
-- =========================
CREATE TABLE IF NOT EXISTS public.replay_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date        DATE NOT NULL,
  symbol              TEXT NOT NULL DEFAULT 'SPX',
  captured_at         TIMESTAMPTZ NOT NULL,

  -- GEX Landscape
  gex_net_gamma       NUMERIC,
  gex_call_wall       NUMERIC,
  gex_put_wall        NUMERIC,
  gex_flip_point      NUMERIC,
  gex_key_levels      JSONB,
  gex_expiry_breakdown JSONB,

  -- Flow Window
  flow_bias_5m         TEXT,
  flow_bias_15m        TEXT,
  flow_bias_30m        TEXT,
  flow_event_count     INTEGER,
  flow_sweep_count     INTEGER,
  flow_bullish_premium NUMERIC,
  flow_bearish_premium NUMERIC,
  flow_events          JSONB,

  -- Regime
  regime               TEXT,
  regime_direction     TEXT,
  regime_probability   NUMERIC,
  regime_confidence    NUMERIC,
  regime_volume_trend  TEXT,

  -- Levels
  levels               JSONB,
  cluster_zones        JSONB,

  -- Multi-TF Confluence
  mtf_1h_trend         TEXT,
  mtf_15m_trend        TEXT,
  mtf_5m_trend         TEXT,
  mtf_1m_trend         TEXT,
  mtf_composite        NUMERIC,
  mtf_aligned          BOOLEAN,

  -- Environment Gate
  vix_value            NUMERIC,
  vix_regime           TEXT,
  env_gate_passed      BOOLEAN,
  env_gate_reasons     JSONB,
  macro_next_event     JSONB,
  session_minute_et    INTEGER,

  -- Basis State
  basis_value          NUMERIC,
  spx_price            NUMERIC,
  spy_price            NUMERIC,

  -- Confluence + Learning Metrics
  rr_ratio             NUMERIC,
  ev_r                 NUMERIC,
  memory_setup_type    TEXT,
  memory_test_count    INTEGER,
  memory_win_rate      NUMERIC,
  memory_hold_rate     NUMERIC,
  memory_confidence    NUMERIC,
  memory_score         NUMERIC,

  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discord_trade_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date     DATE NOT NULL,
  channel_id       TEXT NOT NULL,
  channel_name     TEXT,
  guild_id         TEXT NOT NULL,
  caller_name      TEXT,
  trade_count      INTEGER DEFAULT 0,
  net_pnl_pct      NUMERIC,
  session_start    TIMESTAMPTZ,
  session_end      TIMESTAMPTZ,
  session_summary  TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_date, channel_id)
);

CREATE TABLE IF NOT EXISTS public.discord_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID REFERENCES public.discord_trade_sessions(id),
  discord_msg_id   TEXT NOT NULL UNIQUE,
  author_name      TEXT NOT NULL,
  author_id        TEXT NOT NULL,
  content          TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL,
  is_signal        BOOLEAN DEFAULT false,
  signal_type      TEXT,
  parsed_trade_id  UUID,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discord_parsed_trades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID REFERENCES public.discord_trade_sessions(id),
  trade_index        INTEGER NOT NULL,

  -- Contract
  symbol             TEXT NOT NULL,
  strike             NUMERIC NOT NULL,
  contract_type      TEXT NOT NULL,
  expiry             TEXT,

  -- Entry
  direction          TEXT DEFAULT 'long',
  entry_price        NUMERIC,
  entry_timestamp    TIMESTAMPTZ,
  sizing             TEXT,

  -- Stop/Target
  initial_stop       NUMERIC,
  target_1           NUMERIC,
  target_2           NUMERIC,

  -- Thesis
  thesis_text        TEXT,
  entry_condition    TEXT,

  -- Lifecycle
  lifecycle_events   JSONB DEFAULT '[]',

  -- Outcome
  final_pnl_pct      NUMERIC,
  is_winner          BOOLEAN,
  fully_exited       BOOLEAN DEFAULT false,
  exit_timestamp     TIMESTAMPTZ,

  -- Snapshot link
  entry_snapshot_id  UUID REFERENCES public.replay_snapshots(id),

  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.symbol_profiles (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol                       TEXT NOT NULL UNIQUE,
  display_name                 TEXT NOT NULL,

  -- Level Engine Config
  round_number_interval        NUMERIC DEFAULT 50,
  opening_range_minutes        INTEGER DEFAULT 30,
  level_cluster_radius         NUMERIC DEFAULT 3.0,

  -- GEX Config
  gex_scaling_factor           NUMERIC DEFAULT 1.0,
  gex_cross_symbol             TEXT,
  gex_strike_window            NUMERIC DEFAULT 220,

  -- Flow Config
  flow_min_premium             NUMERIC DEFAULT 10000,
  flow_min_volume              INTEGER DEFAULT 10,
  flow_directional_min         NUMERIC DEFAULT 50000,

  -- MTF Config
  mtf_ema_fast                 INTEGER DEFAULT 21,
  mtf_ema_slow                 INTEGER DEFAULT 55,
  mtf_1h_weight                NUMERIC DEFAULT 0.55,
  mtf_15m_weight               NUMERIC DEFAULT 0.20,
  mtf_5m_weight                NUMERIC DEFAULT 0.15,
  mtf_1m_weight                NUMERIC DEFAULT 0.10,

  -- Regime Config
  regime_breakout_threshold    NUMERIC DEFAULT 0.7,
  regime_compression_threshold NUMERIC DEFAULT 0.65,

  -- Massive.com Ticker
  massive_ticker               TEXT NOT NULL,
  massive_options_ticker       TEXT,

  is_active                    BOOLEAN DEFAULT true,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.replay_drill_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  session_id         UUID NOT NULL REFERENCES public.discord_trade_sessions(id),
  parsed_trade_id    UUID REFERENCES public.discord_parsed_trades(id),
  decision_at        TIMESTAMPTZ NOT NULL,
  direction          TEXT NOT NULL,
  strike             NUMERIC,
  stop_level         NUMERIC,
  target_level       NUMERIC,
  learner_rr         NUMERIC,
  learner_pnl_pct    NUMERIC,
  actual_pnl_pct     NUMERIC,
  engine_direction   TEXT,
  direction_match    BOOLEAN,
  score              NUMERIC,
  feedback_summary   TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_replay_snapshots_session
  ON public.replay_snapshots (session_date, symbol, captured_at);

CREATE INDEX IF NOT EXISTS idx_discord_messages_session
  ON public.discord_messages (session_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_discord_parsed_trades_session
  ON public.discord_parsed_trades (session_id, trade_index);

CREATE INDEX IF NOT EXISTS idx_replay_drill_results_user_time
  ON public.replay_drill_results (user_id, decision_at DESC);

CREATE INDEX IF NOT EXISTS idx_replay_drill_results_session
  ON public.replay_drill_results (session_id, created_at);

-- =========================
-- RLS
-- =========================
ALTER TABLE public.replay_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_trade_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_parsed_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_drill_results ENABLE ROW LEVEL SECURITY;

-- replay_snapshots: admin-only read, service-role writes.
DROP POLICY IF EXISTS "select_replay_snapshots_admin" ON public.replay_snapshots;
DROP POLICY IF EXISTS "insert_replay_snapshots_service_role" ON public.replay_snapshots;
DROP POLICY IF EXISTS "update_replay_snapshots_service_role" ON public.replay_snapshots;
DROP POLICY IF EXISTS "delete_replay_snapshots_service_role" ON public.replay_snapshots;

CREATE POLICY "select_replay_snapshots_admin"
  ON public.replay_snapshots
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "insert_replay_snapshots_service_role"
  ON public.replay_snapshots
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "update_replay_snapshots_service_role"
  ON public.replay_snapshots
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_replay_snapshots_service_role"
  ON public.replay_snapshots
  FOR DELETE
  TO service_role
  USING (true);

-- discord_trade_sessions: admin-only read, service-role writes.
DROP POLICY IF EXISTS "select_discord_trade_sessions_admin" ON public.discord_trade_sessions;
DROP POLICY IF EXISTS "insert_discord_trade_sessions_service_role" ON public.discord_trade_sessions;
DROP POLICY IF EXISTS "update_discord_trade_sessions_service_role" ON public.discord_trade_sessions;
DROP POLICY IF EXISTS "delete_discord_trade_sessions_service_role" ON public.discord_trade_sessions;

CREATE POLICY "select_discord_trade_sessions_admin"
  ON public.discord_trade_sessions
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "insert_discord_trade_sessions_service_role"
  ON public.discord_trade_sessions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "update_discord_trade_sessions_service_role"
  ON public.discord_trade_sessions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_discord_trade_sessions_service_role"
  ON public.discord_trade_sessions
  FOR DELETE
  TO service_role
  USING (true);

-- discord_messages: admin-only read, service-role writes.
DROP POLICY IF EXISTS "select_discord_messages_admin" ON public.discord_messages;
DROP POLICY IF EXISTS "insert_discord_messages_service_role" ON public.discord_messages;
DROP POLICY IF EXISTS "update_discord_messages_service_role" ON public.discord_messages;
DROP POLICY IF EXISTS "delete_discord_messages_service_role" ON public.discord_messages;

CREATE POLICY "select_discord_messages_admin"
  ON public.discord_messages
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "insert_discord_messages_service_role"
  ON public.discord_messages
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "update_discord_messages_service_role"
  ON public.discord_messages
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_discord_messages_service_role"
  ON public.discord_messages
  FOR DELETE
  TO service_role
  USING (true);

-- discord_parsed_trades: admin-only read, service-role writes.
DROP POLICY IF EXISTS "select_discord_parsed_trades_admin" ON public.discord_parsed_trades;
DROP POLICY IF EXISTS "insert_discord_parsed_trades_service_role" ON public.discord_parsed_trades;
DROP POLICY IF EXISTS "update_discord_parsed_trades_service_role" ON public.discord_parsed_trades;
DROP POLICY IF EXISTS "delete_discord_parsed_trades_service_role" ON public.discord_parsed_trades;

CREATE POLICY "select_discord_parsed_trades_admin"
  ON public.discord_parsed_trades
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "insert_discord_parsed_trades_service_role"
  ON public.discord_parsed_trades
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "update_discord_parsed_trades_service_role"
  ON public.discord_parsed_trades
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_discord_parsed_trades_service_role"
  ON public.discord_parsed_trades
  FOR DELETE
  TO service_role
  USING (true);

-- symbol_profiles: admin-only reads and writes.
DROP POLICY IF EXISTS "select_symbol_profiles_admin" ON public.symbol_profiles;
DROP POLICY IF EXISTS "insert_symbol_profiles_admin" ON public.symbol_profiles;
DROP POLICY IF EXISTS "update_symbol_profiles_admin" ON public.symbol_profiles;
DROP POLICY IF EXISTS "delete_symbol_profiles_admin" ON public.symbol_profiles;

CREATE POLICY "select_symbol_profiles_admin"
  ON public.symbol_profiles
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "insert_symbol_profiles_admin"
  ON public.symbol_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "update_symbol_profiles_admin"
  ON public.symbol_profiles
  FOR UPDATE
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "delete_symbol_profiles_admin"
  ON public.symbol_profiles
  FOR DELETE
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- replay_drill_results: owner/admin read + write.
DROP POLICY IF EXISTS "select_replay_drill_results_owner_or_admin" ON public.replay_drill_results;
DROP POLICY IF EXISTS "insert_replay_drill_results_owner_or_admin" ON public.replay_drill_results;
DROP POLICY IF EXISTS "update_replay_drill_results_owner_or_admin" ON public.replay_drill_results;
DROP POLICY IF EXISTS "delete_replay_drill_results_owner_or_admin" ON public.replay_drill_results;

CREATE POLICY "select_replay_drill_results_owner_or_admin"
  ON public.replay_drill_results
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "insert_replay_drill_results_owner_or_admin"
  ON public.replay_drill_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "update_replay_drill_results_owner_or_admin"
  ON public.replay_drill_results
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );

CREATE POLICY "delete_replay_drill_results_owner_or_admin"
  ON public.replay_drill_results
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  );
