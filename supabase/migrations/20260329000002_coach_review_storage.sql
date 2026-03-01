-- Storage bucket + policies for coach-uploaded review screenshots.
-- Path convention: <journal_entry_id>/<filename>.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coach-review-screenshots',
  'coach-review-screenshots',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role upload coach screenshots" ON storage.objects;
CREATE POLICY "Service role upload coach screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-review-screenshots'
    AND auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Service role read coach screenshots" ON storage.objects;
CREATE POLICY "Service role read coach screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'coach-review-screenshots'
    AND auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Members read published coach screenshots" ON storage.objects;
CREATE POLICY "Members read published coach screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'coach-review-screenshots'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND EXISTS (
      SELECT 1
      FROM public.journal_entries je
      JOIN public.coach_trade_notes ctn
        ON ctn.journal_entry_id = je.id
      WHERE je.id = ((storage.foldername(name))[1])::uuid
        AND je.user_id = auth.uid()
        AND ctn.is_published = true
    )
  );

DROP POLICY IF EXISTS "Service role delete coach screenshots" ON storage.objects;
CREATE POLICY "Service role delete coach screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coach-review-screenshots'
    AND auth.role() = 'service_role'
  );

COMMIT;
