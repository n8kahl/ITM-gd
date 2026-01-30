-- ============================================
-- STEP 1: Create Analytics Tables ONLY
-- Run this first to create the core tables
-- ============================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  country TEXT,
  city TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  element_type TEXT NOT NULL,
  element_label TEXT,
  element_value TEXT,
  page_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_views_count INTEGER DEFAULT 1,
  is_returning BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_session_id ON click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_click_events_created_at ON click_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- Drop and create policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anonymous inserts" ON contact_submissions;
  DROP POLICY IF EXISTS "Allow anonymous inserts" ON page_views;
  DROP POLICY IF EXISTS "Allow anonymous inserts" ON click_events;
  DROP POLICY IF EXISTS "Allow anonymous inserts" ON sessions;
  DROP POLICY IF EXISTS "Allow anonymous inserts" ON conversion_events;
  DROP POLICY IF EXISTS "Allow all reads" ON contact_submissions;
  DROP POLICY IF EXISTS "Allow all reads" ON page_views;
  DROP POLICY IF EXISTS "Allow all reads" ON click_events;
  DROP POLICY IF EXISTS "Allow all reads" ON sessions;
  DROP POLICY IF EXISTS "Allow all reads" ON conversion_events;
  DROP POLICY IF EXISTS "Allow session updates" ON sessions;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow anonymous inserts" ON contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON click_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON conversion_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all reads" ON contact_submissions FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON page_views FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON click_events FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON conversion_events FOR SELECT USING (true);

CREATE POLICY "Allow session updates" ON sessions FOR UPDATE USING (true);

SELECT '✅ Step 1 complete! Analytics tables created.' as status;
