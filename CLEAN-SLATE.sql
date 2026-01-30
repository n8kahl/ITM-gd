-- ============================================
-- CLEAN SLATE: Drop Everything & Rebuild
-- ============================================

-- PART 1: DROP EVERYTHING
-- ============================================

-- Drop analytics function
DROP FUNCTION IF EXISTS get_analytics_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);

-- Drop all analytics tables
DROP TABLE IF EXISTS contact_submissions CASCADE;
DROP TABLE IF EXISTS page_views CASCADE;
DROP TABLE IF EXISTS click_events CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS conversion_events CASCADE;

-- PART 2: CREATE FRESH TABLES
-- ============================================

CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE page_views (
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

CREATE TABLE click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  element_type TEXT NOT NULL,
  element_label TEXT,
  element_value TEXT,
  page_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_views_count INTEGER DEFAULT 1,
  is_returning BOOLEAN DEFAULT FALSE
);

CREATE TABLE conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PART 3: CREATE INDEXES
-- ============================================

CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX idx_click_events_session_id ON click_events(session_id);
CREATE INDEX idx_click_events_created_at ON click_events(created_at DESC);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

-- PART 4: ENABLE RLS
-- ============================================

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- PART 5: CREATE POLICIES
-- ============================================

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

-- PART 6: UPDATE SUBSCRIBERS TABLE
-- ============================================

ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add policy for subscribers
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow all reads" ON subscribers;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow all reads" ON subscribers FOR SELECT USING (true);

-- PART 7: CREATE ANALYTICS FUNCTION (NO SUBSCRIBERS DEPENDENCY)
-- ============================================

CREATE FUNCTION get_analytics_summary(
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
    'total_subscribers', (SELECT COUNT(*) FROM subscribers),
    'total_contacts', (SELECT COUNT(*) FROM contact_submissions WHERE created_at BETWEEN start_date AND end_date),
    'total_clicks', (SELECT COUNT(*) FROM click_events WHERE created_at BETWEEN start_date AND end_date),
    'device_breakdown', (
      SELECT json_object_agg(device_type, count)
      FROM (
        SELECT COALESCE(device_type, 'unknown') as device_type, COUNT(*) as count
        FROM page_views
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY device_type
      ) device_stats
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- SUCCESS!
SELECT
  '✅ CLEAN SLATE COMPLETE!' as status,
  'All analytics tables created' as tables,
  'Subscribers updated' as subscribers,
  'Analytics function ready' as function_status;
