-- ============================================
-- TradeITM Analytics Database Schema (V2 - Safest)
-- Run in TWO steps to avoid column dependency issues
-- ============================================

-- STEP 1: Update subscribers table FIRST
-- ============================================
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- STEP 2: Create new tables
-- ============================================

-- Contact Form Submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Page Views
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

-- Click Events
CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  element_type TEXT NOT NULL,
  element_label TEXT,
  element_value TEXT,
  page_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_views_count INTEGER DEFAULT 1,
  is_returning BOOLEAN DEFAULT FALSE
);

-- Conversion Events
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_session_id ON click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_click_events_element_type ON click_events(element_type);
CREATE INDEX IF NOT EXISTS idx_click_events_created_at ON click_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_session_id ON conversion_events(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_type ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

-- Only create subscribers index if the column exists (skip if it fails)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscribers' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers(created_at DESC);
  END IF;
END $$;

-- STEP 4: Enable Row Level Security
-- ============================================
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create policies
-- ============================================
-- Drop existing policies if they exist to avoid conflicts
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
DROP POLICY IF EXISTS "Allow all reads" ON subscribers;
DROP POLICY IF EXISTS "Allow session updates" ON sessions;

-- Create new policies
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
CREATE POLICY "Allow all reads" ON subscribers FOR SELECT USING (true);

CREATE POLICY "Allow session updates" ON sessions FOR UPDATE USING (true);

-- STEP 6: Create analytics function
-- ============================================
CREATE OR REPLACE FUNCTION get_analytics_summary(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_page_views', (SELECT COUNT(*) FROM page_views WHERE created_at BETWEEN start_date AND end_date),
    'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM page_views WHERE created_at BETWEEN start_date AND end_date),
    'total_subscribers', (SELECT COUNT(*) FROM subscribers WHERE created_at BETWEEN start_date AND end_date),
    'total_contacts', (SELECT COUNT(*) FROM contact_submissions WHERE created_at BETWEEN start_date AND end_date),
    'total_clicks', (SELECT COUNT(*) FROM click_events WHERE created_at BETWEEN start_date AND end_date),
    'device_breakdown', (
      SELECT json_object_agg(device_type, count)
      FROM (
        SELECT device_type, COUNT(*) as count
        FROM page_views
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY device_type
      ) device_stats
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT '✅ Analytics schema created successfully!' AS status;
