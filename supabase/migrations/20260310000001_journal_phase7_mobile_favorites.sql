-- Phase 7 mobile interactions: persist favorite trades for swipe actions.

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_favorite
  ON journal_entries(user_id, is_favorite, trade_date DESC);

COMMENT ON COLUMN journal_entries.is_favorite IS 'Member-marked favorite trade used by mobile swipe quick actions.';
