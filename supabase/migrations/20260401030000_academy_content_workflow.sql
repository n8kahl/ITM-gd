-- Migration: Academy Content Draft/Publish Workflow (Phase 2, Slice 2.1)
-- Adds status column (draft/review/published) to academy_lessons,
-- backfills from is_published, and adds trigger to keep is_published in sync.

-- 1. Add new columns
ALTER TABLE academy_lessons
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'published')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id);

-- 2. Backfill: existing published lessons get status='published'
UPDATE academy_lessons
SET status = 'published',
    published_at = COALESCE(updated_at, created_at)
WHERE is_published = true AND status = 'draft';

-- 3. Backfill: existing unpublished lessons stay as 'draft' (already default)

-- 4. Create trigger to keep is_published in sync with status
CREATE OR REPLACE FUNCTION sync_academy_lesson_is_published()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_published := (NEW.status = 'published');
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_academy_lesson_is_published ON academy_lessons;
CREATE TRIGGER trg_sync_academy_lesson_is_published
  BEFORE INSERT OR UPDATE OF status ON academy_lessons
  FOR EACH ROW
  EXECUTE FUNCTION sync_academy_lesson_is_published();

-- 5. Index for filtering by status (admin queries)
CREATE INDEX IF NOT EXISTS idx_academy_lessons_status ON academy_lessons(status);

-- 6. RLS: existing policies cover academy_lessons; no new table created.
-- Admin routes use service role key which bypasses RLS.
