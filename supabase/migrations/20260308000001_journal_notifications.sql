-- Journal notifications for server-side auto-journal delivery.
-- Supports in-app notices like "auto_journal_ready".

CREATE TABLE IF NOT EXISTS journal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('auto_journal_ready')),
  market_date DATE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type, market_date)
);

ALTER TABLE journal_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_journal_notifications ON journal_notifications;
CREATE POLICY users_select_own_journal_notifications
  ON journal_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_update_own_journal_notifications ON journal_notifications;
CREATE POLICY users_update_own_journal_notifications
  ON journal_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS service_role_manage_journal_notifications ON journal_notifications;
CREATE POLICY service_role_manage_journal_notifications
  ON journal_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_journal_notifications_user_unread
  ON journal_notifications(user_id, type, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_notifications_market_date
  ON journal_notifications(market_date DESC);

CREATE OR REPLACE FUNCTION update_journal_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_journal_notification_updated_at ON journal_notifications;
CREATE TRIGGER trigger_update_journal_notification_updated_at
  BEFORE UPDATE ON journal_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_notification_updated_at();

COMMENT ON TABLE journal_notifications IS 'In-app journal workflow notifications (e.g., auto-journal draft prompts).';
COMMENT ON COLUMN journal_notifications.type IS 'Notification type discriminator. Currently supports auto_journal_ready.';
COMMENT ON COLUMN journal_notifications.market_date IS 'ET market date for deduping day-level notices.';
