-- User watchlists (4-5 symbols per user)
CREATE TABLE money_maker_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol varchar(10) NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- Signal history (every fired signal, for audit & backtesting)
CREATE TABLE money_maker_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol varchar(10) NOT NULL,
  strategy_type varchar(30) NOT NULL,
  direction varchar(5) NOT NULL,
  patience_candle_pattern varchar(20) NOT NULL,
  patience_candle_timeframe varchar(5) NOT NULL,
  confluence_score numeric(3,1) NOT NULL,
  confluence_levels jsonb NOT NULL,       -- [{source, price, weight}]
  is_king_queen boolean NOT NULL DEFAULT false,
  entry_price numeric(10,2) NOT NULL,
  stop_price numeric(10,2) NOT NULL,
  target_price numeric(10,2) NOT NULL,
  risk_reward_ratio numeric(4,2) NOT NULL,
  orb_regime varchar(20) NOT NULL,
  signal_rank smallint,
  status varchar(15) NOT NULL DEFAULT 'ready',
  triggered_at timestamptz DEFAULT now(),
  expired_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Default watchlist symbols (smart defaults)
CREATE TABLE money_maker_default_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol varchar(10) NOT NULL UNIQUE,
  display_name varchar(50) NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Seed smart defaults
INSERT INTO money_maker_default_symbols (symbol, display_name, display_order) VALUES
  ('SPY', 'S&P 500 ETF', 1),
  ('TSLA', 'Tesla', 2),
  ('AAPL', 'Apple', 3),
  ('NVDA', 'NVIDIA', 4),
  ('META', 'Meta Platforms', 5)
ON CONFLICT (symbol) DO NOTHING;

-- RLS Policies
ALTER TABLE money_maker_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_maker_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_maker_default_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist"
  ON money_maker_watchlists FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own signals"
  ON money_maker_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts signals"
  ON money_maker_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users read defaults"
  ON money_maker_default_symbols FOR SELECT
  USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_mm_watchlists_user ON money_maker_watchlists(user_id) WHERE is_active = true;
CREATE INDEX idx_mm_signals_user_time ON money_maker_signals(user_id, triggered_at DESC);
CREATE INDEX idx_mm_signals_symbol_time ON money_maker_signals(symbol, triggered_at DESC);
