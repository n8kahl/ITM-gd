-- Journal Screenshots: Supabase Storage bucket + RLS policies
-- Bucket: journal-screenshots (PRIVATE)
-- Path convention: {user_id}/{entry_id|"new"}/{timestamp}-{random}.{ext}

-- 1) Create the storage bucket (private, 5MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'journal-screenshots',
  'journal-screenshots',
  false,
  5242880,  -- 5MB in bytes
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- 2) RLS policies for the journal-screenshots bucket
--    These use storage.objects and filter on bucket_id + owner path prefix.

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'journal-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own screenshots
CREATE POLICY "Users can read own screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'journal-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update (overwrite) their own screenshots
CREATE POLICY "Users can update own screenshots"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'journal-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own screenshots
CREATE POLICY "Users can delete own screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'journal-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role bypasses RLS by default, so no extra policy needed for
-- server-side signed URL generation.
