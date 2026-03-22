-- Migration: Academy Lesson Version History (Phase 2, Slice 2.2)
-- Creates immutable version history table for lessons.
-- Every publish action creates a snapshot; rollback restores from snapshot.

CREATE TABLE IF NOT EXISTS academy_lesson_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  change_summary TEXT,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, version_number)
);

-- Index for listing versions by lesson (ordered by version)
CREATE INDEX IF NOT EXISTS idx_academy_lesson_versions_lesson_id
  ON academy_lesson_versions(lesson_id, version_number DESC);

-- Enable RLS
ALTER TABLE academy_lesson_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Admin read via service role (bypasses RLS).
-- Authenticated users can read versions for published lessons they can access.
CREATE POLICY "Users can read versions for published lessons"
  ON academy_lesson_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM academy_lessons
      WHERE academy_lessons.id = academy_lesson_versions.lesson_id
        AND academy_lessons.is_published = true
    )
  );

-- Policy: Only service role can insert/update/delete (admin operations).
-- No explicit policy needed — service role bypasses RLS.
