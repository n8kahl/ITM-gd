BEGIN;

CREATE TABLE public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_views_profile ON public.profile_views(profile_user_id, created_at DESC);
CREATE INDEX idx_profile_views_viewer ON public.profile_views(viewer_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile analytics"
  ON public.profile_views FOR SELECT
  USING (auth.uid() = profile_user_id);

CREATE POLICY "Authenticated insert profile views"
  ON public.profile_views FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role bypass profile views"
  ON public.profile_views FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.profile_views IS 'Stores profile view analytics events';

COMMIT;
