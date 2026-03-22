-- ============================================================================
-- File: 20260402000000_academy_content_workflow.sql
-- Purpose: Phase 2 Content Revolution — draft/publish workflow + versioning
-- ============================================================================

-- 1. Content status enum
DO $$
BEGIN
  CREATE TYPE academy_content_status AS ENUM ('draft', 'review', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add workflow columns to academy_lessons
ALTER TABLE academy_lessons
  ADD COLUMN IF NOT EXISTS status academy_content_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id);

-- 3. Immutable lesson version history
CREATE TABLE IF NOT EXISTS academy_lesson_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content_snapshot jsonb NOT NULL,
  change_summary text,
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, version_number)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_academy_lessons_status ON academy_lessons(status);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_versions_lesson_id ON academy_lesson_versions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_versions_published_at ON academy_lesson_versions(published_at DESC);

-- 5. RLS policies for academy_lesson_versions
ALTER TABLE academy_lesson_versions ENABLE ROW LEVEL SECURITY;

-- Admins can read/write versions
CREATE POLICY admin_select_lesson_versions ON academy_lesson_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );

CREATE POLICY admin_insert_lesson_versions ON academy_lesson_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );

-- Members can read published versions (for rollback transparency)
CREATE POLICY member_select_published_versions ON academy_lesson_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
    )
  );
