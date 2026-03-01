-- Coach review schema for trade journal admin review workflows.
-- Additive migration only.

BEGIN;

-- ============================================================
-- Coach Review Request Queue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'completed', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active request per entry (pending/in_review).
CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_review_requests_active_entry
  ON public.coach_review_requests(journal_entry_id)
  WHERE status IN ('pending', 'in_review');

CREATE INDEX IF NOT EXISTS idx_coach_review_status_requested
  ON public.coach_review_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_review_user_status
  ON public.coach_review_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_review_entry
  ON public.coach_review_requests(journal_entry_id);

-- ============================================================
-- Coach Trade Notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_trade_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  review_request_id UUID REFERENCES public.coach_review_requests(id) ON DELETE SET NULL,
  coach_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_response JSONB,
  internal_notes TEXT CHECK (char_length(internal_notes) <= 10000),
  ai_draft JSONB,
  screenshots TEXT[] NOT NULL DEFAULT '{}'::text[],
  market_data_snapshot JSONB,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_trade_notes_entry
  ON public.coach_trade_notes(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_published
  ON public.coach_trade_notes(journal_entry_id)
  WHERE is_published = true;

-- ============================================================
-- Coach Review Activity Log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_review_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id UUID REFERENCES public.coach_review_requests(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'requested',
      'claimed',
      'ai_generated',
      'draft_saved',
      'edited',
      'published',
      'unpublished',
      'dismissed',
      'screenshot_added',
      'screenshot_removed',
      'priority_changed'
    )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_activity_entry
  ON public.coach_review_activity_log(journal_entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_activity_request
  ON public.coach_review_activity_log(review_request_id, created_at DESC);

-- ============================================================
-- journal_entries denormalized coach review state
-- ============================================================
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS coach_review_status TEXT
    CHECK (coach_review_status IN ('pending', 'in_review', 'completed'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coach_review_requested_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_coach_review
  ON public.journal_entries(coach_review_status)
  WHERE coach_review_status IS NOT NULL;

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_coach_review_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coach_review_requests_updated ON public.coach_review_requests;
CREATE TRIGGER trg_coach_review_requests_updated
  BEFORE UPDATE ON public.coach_review_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_coach_review_updated_at();

DROP TRIGGER IF EXISTS trg_coach_trade_notes_updated ON public.coach_trade_notes;
CREATE TRIGGER trg_coach_trade_notes_updated
  BEFORE UPDATE ON public.coach_trade_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_coach_review_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.coach_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_trade_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_review_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own review requests" ON public.coach_review_requests;
CREATE POLICY "Members read own review requests"
  ON public.coach_review_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members insert own review requests" ON public.coach_review_requests;
CREATE POLICY "Members insert own review requests"
  ON public.coach_review_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all review requests" ON public.coach_review_requests;
CREATE POLICY "Admins read all review requests"
  ON public.coach_review_requests FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

DROP POLICY IF EXISTS "Service role full access to review requests" ON public.coach_review_requests;
CREATE POLICY "Service role full access to review requests"
  ON public.coach_review_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Members read own published notes" ON public.coach_trade_notes;
CREATE POLICY "Members read own published notes"
  ON public.coach_trade_notes FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.journal_entries je
      WHERE je.id = coach_trade_notes.journal_entry_id
        AND je.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins read all coach trade notes" ON public.coach_trade_notes;
CREATE POLICY "Admins read all coach trade notes"
  ON public.coach_trade_notes FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

DROP POLICY IF EXISTS "Service role full access to trade notes" ON public.coach_trade_notes;
CREATE POLICY "Service role full access to trade notes"
  ON public.coach_trade_notes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins read all activity log" ON public.coach_review_activity_log;
CREATE POLICY "Admins read all activity log"
  ON public.coach_review_activity_log FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

DROP POLICY IF EXISTS "Service role full access to activity log" ON public.coach_review_activity_log;
CREATE POLICY "Service role full access to activity log"
  ON public.coach_review_activity_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
