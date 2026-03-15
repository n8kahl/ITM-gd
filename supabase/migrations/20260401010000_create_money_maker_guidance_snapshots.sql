CREATE TABLE IF NOT EXISTS public.money_maker_guidance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id UUID NULL,
  symbol VARCHAR(10) NOT NULL,
  direction VARCHAR(5) NOT NULL CHECK (direction IN ('long', 'short')),
  execution_state VARCHAR(30) NOT NULL,
  entry_price NUMERIC(10, 2) NOT NULL,
  stop_price NUMERIC(10, 2) NOT NULL,
  target1_price NUMERIC(10, 2) NOT NULL,
  target2_price NUMERIC(10, 2),
  entry_quality VARCHAR(15) NOT NULL,
  time_warning VARCHAR(30) NOT NULL,
  plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.money_maker_contract_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guidance_snapshot_id UUID NOT NULL REFERENCES public.money_maker_guidance_snapshots(id) ON DELETE CASCADE,
  candidate_label VARCHAR(20) NOT NULL,
  option_symbol VARCHAR(40) NOT NULL,
  expiry DATE NOT NULL,
  strike NUMERIC(10, 2) NOT NULL,
  option_type VARCHAR(4) NOT NULL CHECK (option_type IN ('call', 'put')),
  bid NUMERIC(10, 2),
  ask NUMERIC(10, 2),
  mid NUMERIC(10, 2),
  spread_pct NUMERIC(6, 2),
  delta NUMERIC(6, 3),
  theta NUMERIC(8, 3),
  implied_volatility NUMERIC(8, 4),
  open_interest INTEGER,
  volume INTEGER,
  premium_per_contract NUMERIC(10, 2),
  quality VARCHAR(10) NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.money_maker_guidance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_maker_contract_guidance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_money_maker_guidance_snapshots ON public.money_maker_guidance_snapshots;
CREATE POLICY users_manage_own_money_maker_guidance_snapshots
  ON public.money_maker_guidance_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS service_manage_money_maker_guidance_snapshots ON public.money_maker_guidance_snapshots;
CREATE POLICY service_manage_money_maker_guidance_snapshots
  ON public.money_maker_guidance_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS users_read_own_money_maker_contract_guidance ON public.money_maker_contract_guidance;
CREATE POLICY users_read_own_money_maker_contract_guidance
  ON public.money_maker_contract_guidance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.money_maker_guidance_snapshots snapshots
      WHERE snapshots.id = guidance_snapshot_id
        AND snapshots.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_manage_money_maker_contract_guidance ON public.money_maker_contract_guidance;
CREATE POLICY service_manage_money_maker_contract_guidance
  ON public.money_maker_contract_guidance
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mm_guidance_snapshots_user_symbol_created_at
  ON public.money_maker_guidance_snapshots(user_id, symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mm_guidance_snapshots_signal_created_at
  ON public.money_maker_guidance_snapshots(signal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mm_contract_guidance_snapshot_label
  ON public.money_maker_contract_guidance(guidance_snapshot_id, candidate_label);
