-- Academy seed expects lessons.is_published, but older lessons schemas may not include it.
-- Add the column and tighten the lessons read policy to published lessons only.

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Ensure member reads only see published lessons from published courses.
-- (Service role policies are handled elsewhere; this is the member-facing policy.)
DROP POLICY IF EXISTS "Authenticated read course lessons" ON lessons;
CREATE POLICY "Authenticated read course lessons" ON lessons
FOR SELECT USING (
  auth.role() = 'authenticated'
  AND is_published = true
  AND EXISTS (SELECT 1 FROM courses WHERE id = course_id AND is_published = true)
);

