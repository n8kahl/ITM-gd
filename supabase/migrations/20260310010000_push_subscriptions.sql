-- Web push subscriptions for member notifications (journal, alerts, briefs).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_push_subscriptions ON push_subscriptions;
CREATE POLICY users_select_own_push_subscriptions
  ON push_subscriptions
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS users_insert_own_push_subscriptions ON push_subscriptions;
CREATE POLICY users_insert_own_push_subscriptions
  ON push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS users_update_own_push_subscriptions ON push_subscriptions;
CREATE POLICY users_update_own_push_subscriptions
  ON push_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id::text)
  WITH CHECK ((auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS users_delete_own_push_subscriptions ON push_subscriptions;
CREATE POLICY users_delete_own_push_subscriptions
  ON push_subscriptions
  FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS service_role_manage_push_subscriptions ON push_subscriptions;
CREATE POLICY service_role_manage_push_subscriptions
  ON push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON push_subscriptions(user_id, is_active, updated_at DESC);

CREATE OR REPLACE FUNCTION update_push_subscription_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_push_subscription_updated_at ON push_subscriptions;
CREATE TRIGGER trigger_update_push_subscription_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_updated_at();

COMMENT ON TABLE push_subscriptions IS 'Browser push subscriptions used for member web notifications.';
COMMENT ON COLUMN push_subscriptions.subscription IS 'Raw PushSubscription JSON payload from browser PushManager.';
