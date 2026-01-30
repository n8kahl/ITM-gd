-- ============================================
-- TradeITM Analytics Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. CONTACT FORM SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PAGE VIEWS TABLE
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  country TEXT,
  city TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CLICK EVENTS TABLE
CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  element_type TEXT NOT NULL, -- 'cta_button', 'pricing_card', 'nav_link', etc.
  element_label TEXT,
  element_value TEXT, -- e.g., 'Core Sniper', 'Pro Sniper', etc.
  page_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SESSIONS TABLE (for tracking unique visitors)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_views_count INTEGER DEFAULT 1,
  is_returning BOOLEAN DEFAULT FALSE
);

-- 5. CONVERSION EVENTS TABLE
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'modal_opened', 'form_submitted', 'purchase_initiated', etc.
  event_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing subscribers table to add more tracking fields (if needed)
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_session_id ON click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_click_events_element_type ON click_events(element_type);
CREATE INDEX IF NOT EXISTS idx_click_events_created_at ON click_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_session_id ON conversion_events(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_type ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- Create policies to allow inserts from anyone (for tracking) but reads only for authenticated users
CREATE POLICY "Allow anonymous inserts" ON contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON click_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON conversion_events FOR INSERT WITH CHECK (true);

-- For now, allow reads for everyone (you can restrict this later with proper auth)
CREATE POLICY "Allow all reads" ON contact_submissions FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON page_views FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON click_events FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON conversion_events FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON subscribers FOR SELECT USING (true);

-- Allow updates to sessions for tracking last_seen
CREATE POLICY "Allow session updates" ON sessions FOR UPDATE USING (true);

-- Create a function to get analytics summary
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
DO $$
BEGIN
  RAISE NOTICE '✅ Analytics schema created successfully!';
  RAISE NOTICE '📊 Tables created: contact_submissions, page_views, click_events, sessions, conversion_events';
  RAISE NOTICE '🔒 Row Level Security enabled with appropriate policies';
  RAISE NOTICE '⚡ Indexes created for optimal query performance';
END $$;
