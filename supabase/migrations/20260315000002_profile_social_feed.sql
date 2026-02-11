BEGIN;

CREATE TABLE public.social_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  item_type TEXT NOT NULL CHECK (item_type IN (
    'trade_card',
    'achievement',
    'milestone',
    'highlight'
  )),

  reference_id UUID,
  reference_table TEXT,
  display_data JSONB NOT NULL DEFAULT '{}',

  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,

  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members', 'private')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_public_created
  ON public.social_feed_items(created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX idx_feed_user_created
  ON public.social_feed_items(user_id, created_at DESC);

CREATE INDEX idx_feed_type_created
  ON public.social_feed_items(item_type, created_at DESC)
  WHERE visibility IN ('public', 'members');

CREATE INDEX idx_feed_featured
  ON public.social_feed_items(is_featured, created_at DESC)
  WHERE is_featured = true;

CREATE INDEX idx_feed_likes
  ON public.social_feed_items(likes_count DESC, created_at DESC)
  WHERE visibility IN ('public', 'members');

CREATE OR REPLACE FUNCTION public.update_social_feed_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_social_feed_items_updated_at
  BEFORE UPDATE ON public.social_feed_items
  FOR EACH ROW EXECUTE FUNCTION public.update_social_feed_items_updated_at();

ALTER TABLE public.social_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feed items"
  ON public.social_feed_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated read visible feed items"
  ON public.social_feed_items FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND visibility IN ('public', 'members')
  );

CREATE POLICY "Service role bypass social feed items"
  ON public.social_feed_items FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins manage social feed items"
  ON public.social_feed_items FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

COMMENT ON TABLE public.social_feed_items IS 'Unified social feed events for trades, achievements, milestones, and highlights';

CREATE TABLE public.social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_item_id UUID NOT NULL REFERENCES public.social_feed_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, feed_item_id)
);

CREATE INDEX idx_social_likes_item ON public.social_likes(feed_item_id);
CREATE INDEX idx_social_likes_user ON public.social_likes(user_id);

ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own likes"
  ON public.social_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read likes"
  ON public.social_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role bypass social likes"
  ON public.social_likes FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_feed_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_feed_items
    SET likes_count = likes_count + 1
    WHERE id = NEW.feed_item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_feed_items
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.feed_item_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_likes_count
  AFTER INSERT OR DELETE ON public.social_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_feed_likes_count();

COMMENT ON TABLE public.social_likes IS 'Per-user like interactions for social feed items';

COMMIT;
