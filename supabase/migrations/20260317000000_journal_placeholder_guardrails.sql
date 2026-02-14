-- Production guardrails for screenshot placeholder entries and draft hygiene.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS draft_status TEXT;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS draft_expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.journal_entries'::regclass
      AND conname = 'journal_entries_draft_status_check'
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_draft_status_check
      CHECK (
        draft_status IS NULL
        OR draft_status IN ('pending', 'confirmed', 'dismissed')
      );
  END IF;
END
$$;

-- Normalize existing rows with incomplete draft metadata.
UPDATE public.journal_entries
SET draft_status = 'pending'
WHERE coalesce(is_draft, false) = true
  AND (draft_status IS NULL OR draft_status NOT IN ('pending', 'confirmed', 'dismissed'));

-- Convert legacy screenshot placeholders into explicit drafts.
UPDATE public.journal_entries
SET is_draft = true,
    draft_status = 'pending',
    draft_expires_at = coalesce(draft_expires_at, now() + interval '7 days')
WHERE upper(symbol) = 'PENDING'
  AND screenshot_url IS NOT NULL
  AND coalesce(is_draft, false) = false
  AND entry_price IS NULL
  AND exit_price IS NULL
  AND pnl IS NULL;

-- Prevent non-draft placeholder rows from being created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.journal_entries'::regclass
      AND conname = 'journal_entries_no_pending_placeholder_check'
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_no_pending_placeholder_check
      CHECK (coalesce(is_draft, false) OR upper(symbol) <> 'PENDING');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_is_draft
  ON public.journal_entries(user_id, is_draft, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_draft_status
  ON public.journal_entries(user_id, draft_status)
  WHERE coalesce(is_draft, false) = true;

COMMIT;
