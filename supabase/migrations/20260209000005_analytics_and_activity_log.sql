-- V3 Redesign: Member Analytics Events + Admin Activity Log

-- ============================================
-- 1. MEMBER ANALYTICS EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS member_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analytics_user_time ON member_analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_type_time ON member_analytics_events(event_type, created_at DESC);

ALTER TABLE member_analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own analytics events" ON member_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all events
CREATE POLICY "Admins can read all analytics events" ON member_analytics_events
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

-- ============================================
-- 2. ADMIN ACTIVITY LOG
-- ============================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_log_time ON admin_activity_log(created_at DESC);
CREATE INDEX idx_admin_log_admin ON admin_activity_log(admin_user_id, created_at DESC);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write activity log
CREATE POLICY "Admins manage activity log" ON admin_activity_log
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

COMMENT ON TABLE member_analytics_events IS 'Tracks member engagement events for admin analytics dashboard';
COMMENT ON TABLE admin_activity_log IS 'Audit trail for admin actions (settings changes, role edits, etc.)';
