-- Ensure journal-screenshots bucket and RLS policies are present and aligned
-- with the client upload path format: {user_id}/{entry_or_new}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'journal-screenshots',
  'journal-screenshots',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload own journal screenshots" ON storage.objects;
CREATE POLICY "Users upload own journal screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users read own journal screenshots" ON storage.objects;
CREATE POLICY "Users read own journal screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own journal screenshots" ON storage.objects;
CREATE POLICY "Users delete own journal screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
