-- Enable Row Level Security on all tables
ALTER TABLE ai_coach_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_alerts ENABLE ROW LEVEL SECURITY;

-- ai_coach_users policies
CREATE POLICY "Users can view own profile"
  ON ai_coach_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON ai_coach_users FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON ai_coach_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ai_coach_sessions policies
CREATE POLICY "Users can view own sessions"
  ON ai_coach_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON ai_coach_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON ai_coach_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ai_coach_messages policies
CREATE POLICY "Users can view own messages"
  ON ai_coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON ai_coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ai_coach_positions policies
CREATE POLICY "Users can view own positions"
  ON ai_coach_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON ai_coach_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON ai_coach_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON ai_coach_positions FOR DELETE
  USING (auth.uid() = user_id);

-- ai_coach_trades policies
CREATE POLICY "Users can view own trades"
  ON ai_coach_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON ai_coach_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON ai_coach_trades FOR UPDATE
  USING (auth.uid() = user_id);

-- ai_coach_alerts policies
CREATE POLICY "Users can view own alerts"
  ON ai_coach_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON ai_coach_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON ai_coach_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON ai_coach_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Note: ai_coach_levels_cache has NO RLS - Backend only table
