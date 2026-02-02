-- Trade Journal: Complete Schema with AI Analysis
-- This migration creates the journal_entries table and related structures

-- Create journal_entries table
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trade metadata
  trade_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol TEXT,
  direction TEXT CHECK (direction IN ('long', 'short', 'neutral')),

  -- Trade financials
  entry_price NUMERIC(10, 2),
  exit_price NUMERIC(10, 2),
  position_size NUMERIC(10, 2),
  pnl NUMERIC(10, 2),
  pnl_percentage NUMERIC(5, 2),

  -- Media
  screenshot_url TEXT,
  screenshot_thumbnail_url TEXT,

  -- AI Analysis (stored as JSONB for flexibility)
  ai_analysis JSONB,

  -- User notes
  setup_notes TEXT,
  execution_notes TEXT,
  lessons_learned TEXT,

  -- Tags and categorization
  tags TEXT[] DEFAULT '{}',
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_winner BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_trade_date ON journal_entries(trade_date DESC);
CREATE INDEX idx_journal_entries_symbol ON journal_entries(symbol);
CREATE INDEX idx_journal_entries_tags ON journal_entries USING GIN(tags);
CREATE INDEX idx_journal_entries_is_winner ON journal_entries(is_winner) WHERE is_winner IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage their own entries
CREATE POLICY "Users can view own journal entries"
  ON journal_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own journal entries"
  ON journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: Admins can view all entries (for oversight)
CREATE POLICY "Admins can view all journal entries"
  ON journal_entries
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_journal_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_journal_entry_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entry_updated_at();

-- Journal Stats View (for dashboard)
CREATE OR REPLACE VIEW journal_stats AS
SELECT
  user_id,
  COUNT(*) as total_trades,
  COUNT(*) FILTER (WHERE is_winner = true) as winning_trades,
  COUNT(*) FILTER (WHERE is_winner = false) as losing_trades,
  ROUND(
    (COUNT(*) FILTER (WHERE is_winner = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100),
    2
  ) as win_rate,
  SUM(pnl) as total_pnl,
  AVG(pnl) as avg_pnl,
  MAX(pnl) as best_trade,
  MIN(pnl) as worst_trade,
  COUNT(DISTINCT symbol) as unique_symbols,
  MAX(trade_date) as last_trade_date
FROM journal_entries
GROUP BY user_id;

-- Grant access to stats view
GRANT SELECT ON journal_stats TO authenticated;

-- RLS for stats view
ALTER VIEW journal_stats SET (security_invoker = true);

-- Helper function: Get journal statistics for a user
CREATE OR REPLACE FUNCTION get_journal_stats(target_user_id UUID)
RETURNS TABLE (
  total_trades BIGINT,
  winning_trades BIGINT,
  losing_trades BIGINT,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  avg_pnl NUMERIC,
  best_trade NUMERIC,
  worst_trade NUMERIC,
  unique_symbols BIGINT,
  last_trade_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    js.total_trades,
    js.winning_trades,
    js.losing_trades,
    js.win_rate,
    js.total_pnl,
    js.avg_pnl,
    js.best_trade,
    js.worst_trade,
    js.unique_symbols,
    js.last_trade_date
  FROM journal_stats js
  WHERE js.user_id = target_user_id
    AND (
      auth.uid() = target_user_id -- User can see own stats
      OR (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true -- Or is admin
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_journal_stats(UUID) TO authenticated;

-- Comments
COMMENT ON TABLE journal_entries IS 'Stores trading journal entries with P&L tracking and AI analysis';
COMMENT ON COLUMN journal_entries.ai_analysis IS 'JSONB field containing AI-generated trade analysis';
COMMENT ON VIEW journal_stats IS 'Aggregated statistics per user for dashboard display';
