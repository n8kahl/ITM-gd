-- User-tracked scanner setups for workflow follow-up and notification routing.

CREATE TABLE IF NOT EXISTS ai_coach_tracked_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_opportunity_id TEXT,
  symbol TEXT NOT NULL,
  setup_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish', 'neutral')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'triggered', 'invalidated', 'archived')),
  opportunity_data JSONB NOT NULL,
  notes TEXT,
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_coach_tracked_setups_symbol_not_blank CHECK (length(btrim(symbol)) > 0),
  CONSTRAINT ai_coach_tracked_setups_setup_type_not_blank CHECK (length(btrim(setup_type)) > 0)
);

ALTER TABLE ai_coach_tracked_setups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_tracked_setups ON ai_coach_tracked_setups;
CREATE POLICY users_manage_own_tracked_setups
  ON ai_coach_tracked_setups
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tracked_setups_user_status
  ON ai_coach_tracked_setups(user_id, status, tracked_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracked_setups_symbol
  ON ai_coach_tracked_setups(symbol, tracked_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_setups_active_source
  ON ai_coach_tracked_setups(user_id, source_opportunity_id)
  WHERE source_opportunity_id IS NOT NULL AND status = 'active';

CREATE OR REPLACE FUNCTION update_ai_coach_tracked_setups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_coach_tracked_setups_updated_at ON ai_coach_tracked_setups;
CREATE TRIGGER trigger_update_ai_coach_tracked_setups_updated_at
  BEFORE UPDATE ON ai_coach_tracked_setups
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_coach_tracked_setups_updated_at();
