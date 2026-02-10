-- Academy production hardening fixes
-- 1) Add lessons.is_published for curriculum seed compatibility
-- 2) Fix update_streak() logic so streaks increment correctly

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;

UPDATE lessons
SET is_published = true
WHERE is_published IS NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_is_published
ON lessons(is_published);

CREATE OR REPLACE FUNCTION update_streak(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_last_activity date;
  v_current_streak int;
  v_longest_streak int;
  v_next_streak int;
  v_next_longest int;
BEGIN
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_activity, v_current_streak, v_longest_streak
  FROM user_xp
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_xp (
      user_id,
      total_xp,
      current_rank,
      current_streak,
      longest_streak,
      last_activity_date
    )
    VALUES (p_user_id, 0, 'Rookie', 1, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN;
  END IF;

  IF v_last_activity = CURRENT_DATE THEN
    RETURN;
  END IF;

  IF v_last_activity = CURRENT_DATE - 1 THEN
    v_next_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    v_next_streak := 1;
  END IF;

  v_next_longest := GREATEST(COALESCE(v_longest_streak, 0), v_next_streak);

  UPDATE user_xp
  SET
    current_streak = v_next_streak,
    longest_streak = v_next_longest,
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
