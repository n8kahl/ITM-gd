-- Trade Journal V2 clean schema
-- Replaces legacy journal tables/migrations with one canonical schema.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.journal_analytics_cache;

DROP TABLE IF EXISTS public.trading_journal_entries CASCADE;
DROP TABLE IF EXISTS public.journal_quick_tags CASCADE;
DROP TABLE IF EXISTS public.journal_notifications CASCADE;
DROP TABLE IF EXISTS public.playbooks CASCADE;
DROP TABLE IF EXISTS public.behavioral_insights CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;

DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.import_history CASCADE;
DROP TABLE IF EXISTS public.journal_streaks CASCADE;

CREATE TABLE public.journal_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  trade_date              TIMESTAMPTZ NOT NULL DEFAULT now(),
  symbol                  TEXT NOT NULL CHECK (symbol ~ '^[A-Z0-9./]{1,16}$'),
  direction               TEXT NOT NULL DEFAULT 'long' CHECK (direction IN ('long', 'short')),
  contract_type           TEXT NOT NULL DEFAULT 'stock' CHECK (contract_type IN ('stock', 'call', 'put')),
  entry_price             NUMERIC(12,4),
  exit_price              NUMERIC(12,4),
  position_size           NUMERIC(12,4) CHECK (position_size > 0),
  pnl                     NUMERIC(12,2),
  pnl_percentage          NUMERIC(8,4),
  is_winner               BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN pnl IS NOT NULL THEN pnl > 0 ELSE NULL END
  ) STORED,
  is_open                 BOOLEAN NOT NULL DEFAULT false,

  entry_timestamp         TIMESTAMPTZ,
  exit_timestamp          TIMESTAMPTZ,
  CHECK (exit_timestamp IS NULL OR entry_timestamp IS NULL OR exit_timestamp >= entry_timestamp),

  stop_loss               NUMERIC(12,4),
  initial_target          NUMERIC(12,4),
  hold_duration_min       INTEGER CHECK (hold_duration_min >= 0),
  mfe_percent             NUMERIC(8,4),
  mae_percent             NUMERIC(8,4),

  strike_price            NUMERIC(12,4),
  expiration_date         DATE,
  dte_at_entry            INTEGER CHECK (dte_at_entry >= 0),
  iv_at_entry             NUMERIC(8,4) CHECK (iv_at_entry >= 0),
  delta_at_entry          NUMERIC(8,4),
  theta_at_entry          NUMERIC(8,4),
  gamma_at_entry          NUMERIC(8,4),
  vega_at_entry           NUMERIC(8,4),
  underlying_at_entry     NUMERIC(12,4),
  underlying_at_exit      NUMERIC(12,4),

  mood_before             TEXT CHECK (mood_before IN ('confident','neutral','anxious','frustrated','excited','fearful')),
  mood_after              TEXT CHECK (mood_after IN ('confident','neutral','anxious','frustrated','excited','fearful')),
  discipline_score        INTEGER CHECK (discipline_score BETWEEN 1 AND 5),
  followed_plan           BOOLEAN,
  deviation_notes         TEXT,

  strategy                TEXT,
  setup_notes             TEXT,
  execution_notes         TEXT,
  lessons_learned         TEXT,
  tags                    TEXT[] DEFAULT '{}',
  rating                  INTEGER CHECK (rating BETWEEN 1 AND 5),

  screenshot_url          TEXT,
  screenshot_storage_path TEXT,

  ai_analysis             JSONB,
  market_context          JSONB,

  import_id               UUID,

  is_favorite             BOOLEAN NOT NULL DEFAULT false,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_user_date ON public.journal_entries(user_id, trade_date DESC);
CREATE INDEX idx_journal_user_symbol ON public.journal_entries(user_id, symbol);
CREATE INDEX idx_journal_user_open ON public.journal_entries(user_id) WHERE is_open = true;
CREATE INDEX idx_journal_import ON public.journal_entries(import_id) WHERE import_id IS NOT NULL;

CREATE TABLE public.import_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker      TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  row_count   INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  duplicates  INTEGER NOT NULL DEFAULT 0,
  errors      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_streaks (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_entry_date DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP FUNCTION IF EXISTS public.update_journal_entries_updated_at();

CREATE OR REPLACE FUNCTION public.update_journal_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_journal_entries_updated_at();

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their entries"
  ON public.journal_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass"
  ON public.journal_entries
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all"
  ON public.journal_entries
  FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

CREATE POLICY "Users own their imports"
  ON public.import_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass imports"
  ON public.import_history
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all imports"
  ON public.import_history
  FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

CREATE POLICY "Users own their streaks"
  ON public.journal_streaks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass streaks"
  ON public.journal_streaks
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all streaks"
  ON public.journal_streaks
  FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'journal-screenshots',
  'journal-screenshots',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'journal-screenshots'
);

COMMIT;
