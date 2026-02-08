-- V3 Redesign: Tab Configuration System
-- Admin-configurable member sidebar tabs per tier
-- Replaces hardcoded tab arrays in MemberAuthContext

CREATE TABLE IF NOT EXISTS tab_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  path TEXT NOT NULL,
  required_tier TEXT NOT NULL
    CHECK (required_tier IN ('core', 'pro', 'executive')),
  badge_text TEXT,
  badge_variant TEXT
    CHECK (badge_variant IN ('emerald', 'champagne', 'destructive') OR badge_variant IS NULL),
  description TEXT,
  mobile_visible BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tab_id)
);

-- Seed with defaults matching the Redesign Spec Section 5.2
INSERT INTO tab_configurations (tab_id, label, icon, path, required_tier, sort_order, is_required, mobile_visible, description)
VALUES
  ('dashboard', 'Command Center', 'LayoutDashboard', '/members', 'core', 0, true, true, 'Your trading command center with live market data'),
  ('journal', 'Trade Journal', 'BookOpen', '/members/journal', 'core', 1, false, true, 'Log and analyze your trades with AI insights'),
  ('ai-coach', 'AI Coach', 'Bot', '/members/ai-coach', 'pro', 2, false, true, 'Your personal AI trading coach'),
  ('library', 'Training Library', 'GraduationCap', '/members/library', 'pro', 3, false, false, 'Premium trading education and courses'),
  ('studio', 'Trade Studio', 'Palette', '/members/studio', 'executive', 4, false, false, 'Advanced trade visualization and analysis'),
  ('profile', 'Profile', 'UserCircle', '/members/profile', 'core', 99, true, true, 'Your profile and account settings')
ON CONFLICT (tab_id) DO NOTHING;

-- RLS: Only admins can write, members read via API
ALTER TABLE tab_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on tab_configurations" ON tab_configurations
  FOR ALL USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean)
  );

CREATE POLICY "Authenticated users can read tab_configurations" ON tab_configurations
  FOR SELECT TO authenticated USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_tab_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tab_configurations_updated_at
  BEFORE UPDATE ON tab_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_configurations_updated_at();

-- Index for sorting
CREATE INDEX IF NOT EXISTS idx_tab_configurations_sort ON tab_configurations(sort_order ASC);

COMMENT ON TABLE tab_configurations IS 'Admin-configurable member sidebar tabs, replaces hardcoded TABS arrays';
