BEGIN;

-- Social feed items
CREATE TABLE public.social_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item type polymorphism
  item_type TEXT NOT NULL CHECK (item_type IN (
    'trade_card',       -- Shared trade from journal
    'achievement',      -- Academy achievement
    'milestone',        -- Streak, rank up, etc.
    'highlight'         -- Admin-curated featured content
  )),

  -- Reference to source record
  reference_id UUID,                    -- Points to shared_trade_cards.id, user_achievements.id, etc.
  reference_table TEXT,                 -- 'shared_trade_cards', 'user_achievements', etc.

  -- Denormalized display data (avoids JOINs in feed queries)
  display_data JSONB NOT NULL DEFAULT '{}',
  -- For trade_card: { symbol, direction, pnl, pnl_pct, template, image_url, ai_grade }
  -- For achievement: { title, icon, type, xp_earned, verification_code }
  -- For milestone: { type, description, value }
  -- For highlight: { title, description, author_note, spotlight_type }

  -- Engagement counters (denormalized for performance)
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,

  -- Visibility
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members', 'private')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feed query indexes (critical for performance)
CREATE INDEX idx_feed_public_created
  ON public.social_feed_items(created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX idx_feed_user_created
  ON public.social_feed_items(user_id, created_at DESC);

CREATE INDEX idx_feed_type_created
  ON public.social_feed_items(item_type, created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX idx_feed_featured
  ON public.social_feed_items(is_featured, created_at DESC)
  WHERE is_featured = true;

CREATE INDEX idx_feed_likes
  ON public.social_feed_items(likes_count DESC, created_at DESC)
  WHERE visibility = 'public';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_social_feed_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_social_feed_items_updated_at
  BEFORE UPDATE ON public.social_feed_items
  FOR EACH ROW EXECUTE FUNCTION public.update_social_feed_items_updated_at();

-- RLS
ALTER TABLE public.social_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feed items"
  ON public.social_feed_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public feed items readable by authenticated"
  ON public.social_feed_items FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND visibility IN ('public', 'members')
  );

CREATE POLICY "Service role bypass"
  ON public.social_feed_items FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins manage all feed items"
  ON public.social_feed_items FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

COMMENT ON TABLE public.social_feed_items IS 'Social feed entries linking trades, achievements, and milestones';

-- Social likes
CREATE TABLE public.social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_item_id UUID NOT NULL REFERENCES social_feed_items(id) ON DELETE CASCADE,
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

CREATE POLICY "Likes readable by authenticated"
  ON public.social_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role bypass"
  ON public.social_likes FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to update likes_count on social_feed_items
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
END;
$$;

CREATE TRIGGER trg_update_likes_count
  AFTER INSERT OR DELETE ON public.social_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_feed_likes_count();

COMMENT ON TABLE public.social_likes IS 'User likes on social feed items';

COMMIT;
