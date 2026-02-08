-- V3 Redesign: Journal Enhancements for Massive.com Integration
-- Adds market context enrichment, trade replay, smart tags, and open positions

-- Add Massive.com enrichment columns to journal_entries (the canonical journal table)
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS screenshot_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_context JSONB,
  ADD COLUMN IF NOT EXISTS entry_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS smart_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verification JSONB,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Add same columns to legacy trading_journal_entries for compatibility
ALTER TABLE trading_journal_entries
  ADD COLUMN IF NOT EXISTS screenshot_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_context JSONB,
  ADD COLUMN IF NOT EXISTS entry_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS smart_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verification JSONB,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Add gamification enhancements to journal_streaks
ALTER TABLE journal_streaks
  ADD COLUMN IF NOT EXISTS best_ai_grade TEXT,
  ADD COLUMN IF NOT EXISTS avg_ai_grade TEXT,
  ADD COLUMN IF NOT EXISTS total_ai_analyses INTEGER DEFAULT 0;

-- Index for open positions (live P&L dashboard widget)
CREATE INDEX IF NOT EXISTS idx_journal_entries_open_positions
  ON journal_entries(user_id, is_open)
  WHERE is_open = true;

-- Index for enrichment queue (unenriched entries)
CREATE INDEX IF NOT EXISTS idx_journal_entries_unenriched
  ON journal_entries(created_at)
  WHERE market_context IS NULL AND is_open = false;

-- Index for smart tags (GIN for array search)
CREATE INDEX IF NOT EXISTS idx_journal_entries_smart_tags
  ON journal_entries USING GIN(smart_tags);

-- Same indexes on legacy table
CREATE INDEX IF NOT EXISTS idx_trading_journal_open_positions
  ON trading_journal_entries(user_id, is_open)
  WHERE is_open = true;

COMMENT ON COLUMN journal_entries.market_context IS 'MarketContextSnapshot from Massive.com — auto-enriched VWAP, ATR, levels, IV';
COMMENT ON COLUMN journal_entries.is_open IS 'True for open positions with live P&L tracking';
COMMENT ON COLUMN journal_entries.smart_tags IS 'Auto-detected tags from market context analysis';
COMMENT ON COLUMN journal_entries.verification IS 'TradeVerification result from Massive.com price matching';
COMMENT ON COLUMN journal_entries.enriched_at IS 'Timestamp when market_context was populated';
