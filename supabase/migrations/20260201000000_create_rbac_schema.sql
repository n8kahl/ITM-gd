-- RBAC Schema for SaaS Role-Based Access Control
-- Integrates Discord role-based permissions with course/lesson access

-- ============================================
-- 1. APP PERMISSIONS TABLE
-- ============================================
-- Defines available permissions in the system

CREATE TABLE IF NOT EXISTS app_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for permission lookups
CREATE INDEX IF NOT EXISTS idx_app_permissions_name ON app_permissions(name);

-- Enable RLS
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;

-- Public read, service_role write
CREATE POLICY "Public read for app_permissions" ON app_permissions
  FOR SELECT USING (true);

CREATE POLICY "Service role write for app_permissions" ON app_permissions
  FOR ALL USING (auth.role() = 'service_role');

-- Seed default permissions
INSERT INTO app_permissions (name, description) VALUES
  ('view_courses', 'Can view published courses'),
  ('view_premium_content', 'Can view premium lessons'),
  ('admin_dashboard', 'Can access admin dashboard'),
  ('manage_courses', 'Can create/edit/delete courses'),
  ('manage_members', 'Can manage team members')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. DISCORD ROLE PERMISSIONS TABLE
-- ============================================
-- Maps Discord roles to app permissions (many-to-many)

CREATE TABLE IF NOT EXISTS discord_role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_role_id TEXT NOT NULL,
  discord_role_name TEXT,
  permission_id UUID NOT NULL REFERENCES app_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(discord_role_id, permission_id)
);

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_discord_role_permissions_role_id ON discord_role_permissions(discord_role_id);
CREATE INDEX IF NOT EXISTS idx_discord_role_permissions_permission_id ON discord_role_permissions(permission_id);

-- Enable RLS
ALTER TABLE discord_role_permissions ENABLE ROW LEVEL SECURITY;

-- Service role only access
CREATE POLICY "Service role access for discord_role_permissions" ON discord_role_permissions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 3. COURSES TABLE
-- ============================================
-- Stores course metadata with Discord role gating

CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  discord_role_required TEXT,
  is_published BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_courses_order ON courses(display_order);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Public read for published courses, service_role write
CREATE POLICY "Public read published courses" ON courses
  FOR SELECT USING (is_published = true);

CREATE POLICY "Service role write for courses" ON courses
  FOR ALL USING (auth.role() = 'service_role');

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_courses_updated_at();

-- ============================================
-- 4. LESSONS TABLE
-- ============================================
-- Stores individual lessons within courses

CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  video_url TEXT,
  content_markdown TEXT,
  is_free_preview BOOLEAN DEFAULT false,
  duration_minutes INTEGER,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_slug ON lessons(slug);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(course_id, display_order);
CREATE INDEX IF NOT EXISTS idx_lessons_free_preview ON lessons(is_free_preview);

-- Enable RLS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Public read for free preview lessons, service_role write all
CREATE POLICY "Public read free preview lessons" ON lessons
  FOR SELECT USING (is_free_preview = true);

CREATE POLICY "Service role write for lessons" ON lessons
  FOR ALL USING (auth.role() = 'service_role');

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_lessons_updated_at();
