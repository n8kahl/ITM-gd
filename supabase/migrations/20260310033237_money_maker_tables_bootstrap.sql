-- Reconciles production after the original Money Maker table migration was
-- missing from remote migration history. Keep this idempotent so fresh
-- environments can run both the original migration and this bootstrap safely.
CREATE TABLE IF NOT EXISTS public.money_maker_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol varchar(10) NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, symbol)
);

CREATE TABLE IF NOT EXISTS public.money_maker_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  symbol varchar(10) NOT NULL,
  strategy_type varchar(30) NOT NULL,
  direction varchar(5) NOT NULL,
  patience_candle_pattern varchar(20) NOT NULL,
  patience_candle_timeframe varchar(5) NOT NULL,
  confluence_score numeric(3,1) NOT NULL,
  confluence_levels jsonb NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.money_maker_default_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol varchar(10) NOT NULL UNIQUE,
  display_name varchar(50) NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true
);

INSERT INTO public.money_maker_default_symbols (symbol, display_name, display_order) VALUES
  ('SPY', 'S&P 500 ETF', 1),
  ('TSLA', 'Tesla', 2),
  ('AAPL', 'Apple', 3),
  ('NVDA', 'NVIDIA', 4),
  ('META', 'Meta Platforms', 5)
ON CONFLICT (symbol) DO NOTHING;

ALTER TABLE public.money_maker_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_maker_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_maker_default_symbols ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'money_maker_watchlists'
      AND policyname = 'Users manage own watchlist'
  ) THEN
    CREATE POLICY "Users manage own watchlist"
      ON public.money_maker_watchlists FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'money_maker_signals'
      AND policyname = 'Users read own signals'
  ) THEN
    CREATE POLICY "Users read own signals"
      ON public.money_maker_signals FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'money_maker_signals'
      AND policyname = 'System inserts signals'
  ) THEN
    CREATE POLICY "System inserts signals"
      ON public.money_maker_signals FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'money_maker_default_symbols'
      AND policyname = 'Authenticated users read defaults'
  ) THEN
    CREATE POLICY "Authenticated users read defaults"
      ON public.money_maker_default_symbols FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mm_watchlists_user ON public.money_maker_watchlists(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mm_signals_user_time ON public.money_maker_signals(user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_signals_symbol_time ON public.money_maker_signals(symbol, triggered_at DESC);
