BEGIN;

-- ==================================
-- Broker Credentials (Tradier-ready foundation)
-- ==================================
CREATE TABLE IF NOT EXISTS public.broker_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL DEFAULT 'tradier',
  account_id TEXT NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_credentials_active
  ON public.broker_credentials (broker_name, is_active, updated_at DESC);

ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broker_credentials'
      AND policyname = 'select_own_broker_credentials'
  ) THEN
    CREATE POLICY select_own_broker_credentials ON public.broker_credentials
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broker_credentials'
      AND policyname = 'upsert_own_broker_credentials'
  ) THEN
    CREATE POLICY upsert_own_broker_credentials ON public.broker_credentials
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- ==================================
-- Portfolio snapshots (for DTBP-aware sizing + monitoring)
-- ==================================
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_equity NUMERIC(14,2) NOT NULL,
  day_trade_buying_power NUMERIC(14,2) NOT NULL,
  realized_pnl_daily NUMERIC(14,2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_time
  ON public.portfolio_snapshots (user_id, snapshot_time DESC);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portfolio_snapshots'
      AND policyname = 'select_own_portfolio_snapshots'
  ) THEN
    CREATE POLICY select_own_portfolio_snapshots ON public.portfolio_snapshots
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portfolio_snapshots'
      AND policyname = 'insert_own_portfolio_snapshots'
  ) THEN
    CREATE POLICY insert_own_portfolio_snapshots ON public.portfolio_snapshots
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- ==================================
-- Setup instance execution fidelity columns
-- ==================================
ALTER TABLE public.spx_setup_instances
  ADD COLUMN IF NOT EXISTS broker_entry_order_id TEXT,
  ADD COLUMN IF NOT EXISTS broker_exit_order_ids TEXT[],
  ADD COLUMN IF NOT EXISTS actual_entry_price NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS actual_exit_price NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS actual_slippage_r NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS bid_ask_imbalance_at_trigger NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS delta_volume_at_trigger BIGINT,
  ADD COLUMN IF NOT EXISTS macro_alignment_score NUMERIC(6,2);

CREATE INDEX IF NOT EXISTS idx_spx_setup_instances_actual_slippage
  ON public.spx_setup_instances (session_date, actual_slippage_r)
  WHERE actual_slippage_r IS NOT NULL;

COMMIT;
