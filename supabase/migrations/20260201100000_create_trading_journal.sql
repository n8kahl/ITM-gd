-- Trading Journal Schema
-- Supports AI-powered trade screenshot analysis

-- ============================================
-- 1. TRADING JOURNAL ENTRIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS trading_journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,                    -- Discord user ID or member ID

  -- Trade Details
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol TEXT,                              -- e.g., SPX, TSLA, AAPL
  trade_type TEXT,                          -- 'long', 'short', 'call', 'put'
  entry_price DECIMAL(12, 4),
  exit_price DECIMAL(12, 4),
  position_size INTEGER,
  profit_loss DECIMAL(12, 2),               -- Actual P&L in dollars
  profit_loss_percent DECIMAL(6, 2),        -- P&L as percentage

  -- Screenshot & Analysis
  screenshot_url TEXT,                      -- Supabase Storage URL
  screenshot_thumbnail_url TEXT,            -- Compressed thumbnail
  ai_analysis JSONB,                        -- GPT-4 Vision analysis result

  -- User Notes
  setup_notes TEXT,                         -- Why they entered
  execution_notes TEXT,                     -- How the trade went
  lessons_learned TEXT,                     -- Post-trade reflection

  -- Metadata
  tags TEXT[],                              -- ['breakout', 'trend-follow', 'scalp']
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),  -- Self-grade 1-5
  is_winner BOOLEAN,                        -- Quick flag for heatmap

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_journal_user_id ON trading_journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_trade_date ON trading_journal_entries(trade_date);
CREATE INDEX IF NOT EXISTS idx_journal_is_winner ON trading_journal_entries(is_winner);
CREATE INDEX IF NOT EXISTS idx_journal_created_at ON trading_journal_entries(created_at DESC);

-- Enable RLS
ALTER TABLE trading_journal_entries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own entries (service role for admin access)
CREATE POLICY "Users read own journal entries" ON trading_journal_entries
  FOR SELECT USING (true);  -- Will be filtered by user_id in API

CREATE POLICY "Service role write for journal entries" ON trading_journal_entries
  FOR ALL USING (auth.role() = 'service_role');

-- Update trigger
CREATE OR REPLACE FUNCTION update_journal_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON trading_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entries_updated_at();

-- ============================================
-- 2. JOURNAL STREAKS TABLE (for gamification)
-- ============================================

CREATE TABLE IF NOT EXISTS journal_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_entry_date DATE,
  total_entries INTEGER DEFAULT 0,
  total_winners INTEGER DEFAULT 0,
  total_losers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON journal_streaks(user_id);

ALTER TABLE journal_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own streaks" ON journal_streaks
  FOR SELECT USING (true);

CREATE POLICY "Service role write for streaks" ON journal_streaks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 3. STORAGE BUCKET FOR SCREENSHOTS
-- ============================================
-- Note: Run this via Supabase dashboard or separate migration
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('trade-screenshots', 'trade-screenshots', false)
-- ON CONFLICT DO NOTHING;
