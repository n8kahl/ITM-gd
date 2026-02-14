-- Profile Social share-trade hardening:
-- 1) Ensure trade-cards storage bucket exists.
-- 2) Add storage policies for user-scoped trade-card paths.
-- 3) Enforce uniqueness for one shared card per (user, journal_entry).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-cards',
  'trade-cards',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload own trade cards" ON storage.objects;
CREATE POLICY "Users upload own trade cards"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trade-cards'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'shared'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users read own trade cards" ON storage.objects;
CREATE POLICY "Users read own trade cards"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trade-cards'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'shared'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users delete own trade cards" ON storage.objects;
CREATE POLICY "Users delete own trade cards"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trade-cards'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'shared'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

WITH duplicate_cards AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, journal_entry_id
      ORDER BY shared_at ASC, id ASC
    ) AS row_number
  FROM public.shared_trade_cards
)
DELETE FROM public.shared_trade_cards AS cards
USING duplicate_cards
WHERE cards.id = duplicate_cards.id
  AND duplicate_cards.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_cards_user_entry_unique
  ON public.shared_trade_cards(user_id, journal_entry_id);

DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    INSERT INTO public.app_settings (key, value)
    VALUES ('trade_share_discord_webhook_url', '')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END
$$;
