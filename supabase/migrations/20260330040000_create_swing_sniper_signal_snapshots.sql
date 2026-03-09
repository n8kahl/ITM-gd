-- Swing Sniper Phase 4 persistence for daily signal snapshot archive.

CREATE TABLE IF NOT EXISTS public.swing_sniper_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  as_of_date DATE NOT NULL,
  captured_from TEXT NOT NULL DEFAULT 'dossier'
    CHECK (captured_from IN ('universe', 'dossier', 'manual')),
  score INTEGER,
  direction TEXT NOT NULL CHECK (direction IN ('long_vol', 'short_vol', 'neutral')),
  setup_label TEXT,
  thesis TEXT,
  current_price NUMERIC(12, 4),
  current_iv NUMERIC(8, 4),
  realized_vol20 NUMERIC(8, 4),
  iv_rank NUMERIC(6, 2),
  iv_percentile NUMERIC(6, 2),
  iv_vs_rv_gap NUMERIC(8, 4),
  catalyst_date DATE,
  catalyst_days_until INTEGER,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT swing_sniper_signal_snapshots_user_symbol_day_unique UNIQUE (user_id, symbol, as_of_date)
);

ALTER TABLE public.swing_sniper_signal_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_swing_sniper_signal_snapshots ON public.swing_sniper_signal_snapshots;
CREATE POLICY users_manage_own_swing_sniper_signal_snapshots
  ON public.swing_sniper_signal_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS service_manage_swing_sniper_signal_snapshots ON public.swing_sniper_signal_snapshots;
CREATE POLICY service_manage_swing_sniper_signal_snapshots
  ON public.swing_sniper_signal_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_swing_sniper_signal_snapshots_user_symbol_asof
  ON public.swing_sniper_signal_snapshots(user_id, symbol, as_of DESC);

CREATE INDEX IF NOT EXISTS idx_swing_sniper_signal_snapshots_asof_date
  ON public.swing_sniper_signal_snapshots(user_id, as_of_date DESC);

DROP TRIGGER IF EXISTS trigger_update_swing_sniper_signal_snapshots_updated_at ON public.swing_sniper_signal_snapshots;
CREATE TRIGGER trigger_update_swing_sniper_signal_snapshots_updated_at
  BEFORE UPDATE ON public.swing_sniper_signal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_swing_sniper_updated_at();
