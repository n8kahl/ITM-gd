BEGIN;

CREATE TABLE public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  category TEXT NOT NULL CHECK (category IN (
    'win_rate',
    'total_pnl',
    'longest_streak',
    'academy_xp',
    'discipline_score',
    'trade_count'
  )),

  rank INTEGER NOT NULL CHECK (rank > 0),
  value NUMERIC(12,4) NOT NULL,

  display_name TEXT,
  discord_avatar TEXT,
  discord_username TEXT,
  membership_tier TEXT,

  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leaderboard_lookup
  ON public.leaderboard_snapshots(period, category, snapshot_date DESC, rank ASC);

CREATE INDEX idx_leaderboard_user
  ON public.leaderboard_snapshots(user_id, period, category);

CREATE UNIQUE INDEX idx_leaderboard_unique_entry
  ON public.leaderboard_snapshots(period, category, snapshot_date, user_id);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read leaderboards"
  ON public.leaderboard_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role manages leaderboards"
  ON public.leaderboard_snapshots FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.leaderboard_snapshots IS 'Daily snapshot leaderboard entries by period/category';

COMMIT;
