-- Swing Sniper Phase 1 persistence for watchlists and saved theses.

CREATE OR REPLACE FUNCTION public.update_swing_sniper_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.swing_sniper_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbols TEXT[] NOT NULL DEFAULT '{}',
  selected_symbol TEXT,
  filters JSONB NOT NULL DEFAULT '{"preset":"all","minScore":0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT swing_sniper_watchlists_user_unique UNIQUE (user_id)
);

ALTER TABLE public.swing_sniper_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_swing_sniper_watchlists ON public.swing_sniper_watchlists;
CREATE POLICY users_manage_own_swing_sniper_watchlists
  ON public.swing_sniper_watchlists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS service_manage_swing_sniper_watchlists ON public.swing_sniper_watchlists;
CREATE POLICY service_manage_swing_sniper_watchlists
  ON public.swing_sniper_watchlists
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_swing_sniper_watchlists_user
  ON public.swing_sniper_watchlists(user_id);

DROP TRIGGER IF EXISTS trigger_update_swing_sniper_watchlists_updated_at ON public.swing_sniper_watchlists;
CREATE TRIGGER trigger_update_swing_sniper_watchlists_updated_at
  BEFORE UPDATE ON public.swing_sniper_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_swing_sniper_updated_at();

CREATE TABLE IF NOT EXISTS public.swing_sniper_saved_theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  score INTEGER,
  setup_label TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long_vol', 'short_vol', 'neutral')),
  thesis TEXT NOT NULL,
  iv_rank_at_save NUMERIC(6, 2),
  catalyst_label TEXT,
  catalyst_date DATE,
  monitor_note TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT swing_sniper_saved_theses_user_symbol_unique UNIQUE (user_id, symbol)
);

ALTER TABLE public.swing_sniper_saved_theses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_swing_sniper_saved_theses ON public.swing_sniper_saved_theses;
CREATE POLICY users_manage_own_swing_sniper_saved_theses
  ON public.swing_sniper_saved_theses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS service_manage_swing_sniper_saved_theses ON public.swing_sniper_saved_theses;
CREATE POLICY service_manage_swing_sniper_saved_theses
  ON public.swing_sniper_saved_theses
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_swing_sniper_saved_theses_user_saved_at
  ON public.swing_sniper_saved_theses(user_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_swing_sniper_saved_theses_symbol
  ON public.swing_sniper_saved_theses(symbol);

DROP TRIGGER IF EXISTS trigger_update_swing_sniper_saved_theses_updated_at ON public.swing_sniper_saved_theses;
CREATE TRIGGER trigger_update_swing_sniper_saved_theses_updated_at
  BEFORE UPDATE ON public.swing_sniper_saved_theses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_swing_sniper_updated_at();
