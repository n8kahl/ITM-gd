-- Table: ai_coach_leaps_positions
-- Purpose: Track user LEAPS (Long-Term Equity Anticipation Securities) positions
-- Used by: /api/leaps routes, analyze_leaps_position AI function

CREATE TABLE IF NOT EXISTS ai_coach_leaps_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('CALL', 'PUT')),
  strike DECIMAL(10,2) NOT NULL,
  entry_price DECIMAL(10,2) NOT NULL,
  entry_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,

  -- Current market data (updated periodically)
  current_value DECIMAL(10,2),
  current_underlying DECIMAL(10,2),
  current_iv DECIMAL(6,4),

  -- Current Greeks
  current_delta DECIMAL(8,6),
  current_gamma DECIMAL(8,6),
  current_vega DECIMAL(10,4),
  current_theta DECIMAL(10,4),

  -- Entry Greeks (snapshot at time of entry)
  entry_delta DECIMAL(8,6),
  entry_gamma DECIMAL(8,6),
  entry_vega DECIMAL(10,4),
  entry_theta DECIMAL(10,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leaps_positions_user_id ON ai_coach_leaps_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_leaps_positions_symbol ON ai_coach_leaps_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_leaps_positions_expiry ON ai_coach_leaps_positions(expiry_date);

-- Enable RLS
ALTER TABLE ai_coach_leaps_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own LEAPS positions" ON ai_coach_leaps_positions;
CREATE POLICY "Users can view own LEAPS positions"
  ON ai_coach_leaps_positions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own LEAPS positions" ON ai_coach_leaps_positions;
CREATE POLICY "Users can insert own LEAPS positions"
  ON ai_coach_leaps_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own LEAPS positions" ON ai_coach_leaps_positions;
CREATE POLICY "Users can update own LEAPS positions"
  ON ai_coach_leaps_positions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own LEAPS positions" ON ai_coach_leaps_positions;
CREATE POLICY "Users can delete own LEAPS positions"
  ON ai_coach_leaps_positions FOR DELETE
  USING (auth.uid() = user_id);
