-- =====================================================================
-- COMBINED MIGRATION: Profile Hub + Trade Social
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Order: member_profiles → social_feed → leaderboards → affiliate → profile_views → RPCs
-- =====================================================================

-- =====================================================================
-- 1. MEMBER PROFILES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  display_name TEXT CHECK (char_length(display_name) <= 50),
  bio TEXT CHECK (char_length(bio) <= 500),
  tagline TEXT CHECK (char_length(tagline) <= 120),
  custom_avatar_url TEXT,
  banner_url TEXT,

  -- Trader DNA (computed, cached)
  top_symbols TEXT[] DEFAULT '{}',
  preferred_strategy TEXT,
  avg_hold_minutes INTEGER,
  trading_style TEXT CHECK (trading_style IN ('scalper', 'day_trader', 'swing_trader', 'position_trader')),

  -- WHOP Integration
  whop_user_id TEXT,
  whop_affiliate_url TEXT,
  whop_membership_id TEXT,

  -- Privacy Settings (JSONB for flexibility)
  privacy_settings JSONB NOT NULL DEFAULT '{
    "show_transcript": true,
    "show_academy": true,
    "show_trades_in_feed": true,
    "show_on_leaderboard": true,
    "show_discord_roles": true,
    "profile_visibility": "public"
  }'::jsonb,

  -- Notification Preferences
  notification_preferences JSONB NOT NULL DEFAULT '{
    "feed_likes": true,
    "feed_comments": true,
    "leaderboard_changes": true,
    "achievement_earned": true,
    "weekly_digest": true
  }'::jsonb,

  -- AI Coach Preferences
  ai_preferences JSONB NOT NULL DEFAULT '{
    "risk_tolerance": "moderate",
    "preferred_symbols": [],
    "trading_style_notes": "",
    "account_size_range": ""
  }'::jsonb,

  -- Metadata
  profile_completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_profiles_user ON public.member_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_member_profiles_active ON public.member_profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_profiles_whop ON public.member_profiles(whop_user_id)
  WHERE whop_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_member_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_member_profiles_updated_at ON public.member_profiles;
CREATE TRIGGER trg_member_profiles_updated_at
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_member_profiles_updated_at();

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_profiles' AND policyname = 'Users manage own profile') THEN
    CREATE POLICY "Users manage own profile"
      ON public.member_profiles FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_profiles' AND policyname = 'Public profiles readable by authenticated') THEN
    CREATE POLICY "Public profiles readable by authenticated"
      ON public.member_profiles FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND (privacy_settings->>'profile_visibility')::text IN ('public', 'members')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_profiles' AND policyname = 'Service role bypass') THEN
    CREATE POLICY "Service role bypass"
      ON public.member_profiles FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_profiles' AND policyname = 'Admins read all profiles') THEN
    CREATE POLICY "Admins read all profiles"
      ON public.member_profiles FOR SELECT
      USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);
  END IF;
END $$;

COMMENT ON TABLE public.member_profiles IS 'Extended member profile data for Profile Hub and social features';


-- =====================================================================
-- 2. SOCIAL FEED ITEMS + LIKES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.social_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  item_type TEXT NOT NULL CHECK (item_type IN (
    'trade_card', 'achievement', 'milestone', 'highlight'
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

CREATE INDEX IF NOT EXISTS idx_feed_public_created
  ON public.social_feed_items(created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_feed_user_created
  ON public.social_feed_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_type_created
  ON public.social_feed_items(item_type, created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_feed_featured
  ON public.social_feed_items(is_featured, created_at DESC)
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_feed_likes
  ON public.social_feed_items(likes_count DESC, created_at DESC)
  WHERE visibility = 'public';

CREATE OR REPLACE FUNCTION public.update_social_feed_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_social_feed_items_updated_at ON public.social_feed_items;
CREATE TRIGGER trg_social_feed_items_updated_at
  BEFORE UPDATE ON public.social_feed_items
  FOR EACH ROW EXECUTE FUNCTION public.update_social_feed_items_updated_at();

ALTER TABLE public.social_feed_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_feed_items' AND policyname = 'Users manage own feed items') THEN
    CREATE POLICY "Users manage own feed items"
      ON public.social_feed_items FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_feed_items' AND policyname = 'Public feed items readable by authenticated') THEN
    CREATE POLICY "Public feed items readable by authenticated"
      ON public.social_feed_items FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND visibility IN ('public', 'members')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_feed_items' AND policyname = 'Service role bypass') THEN
    CREATE POLICY "Service role bypass"
      ON public.social_feed_items FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_feed_items' AND policyname = 'Admins manage all feed items') THEN
    CREATE POLICY "Admins manage all feed items"
      ON public.social_feed_items FOR ALL
      USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);
  END IF;
END $$;

COMMENT ON TABLE public.social_feed_items IS 'Social feed entries linking trades, achievements, and milestones';

-- Social likes table
CREATE TABLE IF NOT EXISTS public.social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_item_id UUID NOT NULL REFERENCES social_feed_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, feed_item_id)
);

CREATE INDEX IF NOT EXISTS idx_social_likes_item ON public.social_likes(feed_item_id);
CREATE INDEX IF NOT EXISTS idx_social_likes_user ON public.social_likes(user_id);

ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_likes' AND policyname = 'Users manage own likes') THEN
    CREATE POLICY "Users manage own likes"
      ON public.social_likes FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_likes' AND policyname = 'Likes readable by authenticated') THEN
    CREATE POLICY "Likes readable by authenticated"
      ON public.social_likes FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_likes' AND policyname = 'Service role bypass') THEN
    CREATE POLICY "Service role bypass"
      ON public.social_likes FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Likes count trigger
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

DROP TRIGGER IF EXISTS trg_update_likes_count ON public.social_likes;
CREATE TRIGGER trg_update_likes_count
  AFTER INSERT OR DELETE ON public.social_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_feed_likes_count();

COMMENT ON TABLE public.social_likes IS 'User likes on social feed items';


-- =====================================================================
-- 3. LEADERBOARD SNAPSHOTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  category TEXT NOT NULL CHECK (category IN (
    'win_rate', 'total_pnl', 'longest_streak',
    'academy_xp', 'discipline_score', 'trade_count'
  )),

  rank INTEGER NOT NULL CHECK (rank > 0),
  value NUMERIC(12,4) NOT NULL,

  display_name TEXT,
  discord_avatar TEXT,
  discord_username TEXT,
  membership_tier TEXT,

  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_lookup
  ON public.leaderboard_snapshots(period, category, snapshot_date DESC, rank ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_user
  ON public.leaderboard_snapshots(user_id, period, category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_unique_entry
  ON public.leaderboard_snapshots(period, category, snapshot_date, user_id);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard_snapshots' AND policyname = 'Leaderboards readable by authenticated') THEN
    CREATE POLICY "Leaderboards readable by authenticated"
      ON public.leaderboard_snapshots FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard_snapshots' AND policyname = 'Service role manages leaderboards') THEN
    CREATE POLICY "Service role manages leaderboards"
      ON public.leaderboard_snapshots FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.leaderboard_snapshots IS 'Pre-computed leaderboard rankings updated daily';


-- =====================================================================
-- 4. AFFILIATE REFERRALS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed_up', 'subscribed', 'churned', 'expired'
  )),

  whop_checkout_id TEXT,
  whop_membership_id TEXT,
  referral_code TEXT NOT NULL,

  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_currency TEXT DEFAULT 'USD',
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMPTZ,

  clicked_at TIMESTAMPTZ DEFAULT now(),
  signed_up_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.affiliate_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.affiliate_referrals(referrer_id, status);

CREATE OR REPLACE FUNCTION public.update_affiliate_referrals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_referrals_updated_at ON public.affiliate_referrals;
CREATE TRIGGER trg_affiliate_referrals_updated_at
  BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_referrals_updated_at();

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_referrals' AND policyname = 'Users view own referrals') THEN
    CREATE POLICY "Users view own referrals"
      ON public.affiliate_referrals FOR SELECT
      USING (auth.uid() = referrer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_referrals' AND policyname = 'Service role manages referrals') THEN
    CREATE POLICY "Service role manages referrals"
      ON public.affiliate_referrals FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_referrals' AND policyname = 'Admins view all referrals') THEN
    CREATE POLICY "Admins view all referrals"
      ON public.affiliate_referrals FOR SELECT
      USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);
  END IF;
END $$;

COMMENT ON TABLE public.affiliate_referrals IS 'WHOP affiliate referral tracking';


-- =====================================================================
-- 5. PROFILE VIEWS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON public.profile_views(profile_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON public.profile_views(viewer_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_views' AND policyname = 'Users view own profile analytics') THEN
    CREATE POLICY "Users view own profile analytics"
      ON public.profile_views FOR SELECT
      USING (auth.uid() = profile_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_views' AND policyname = 'Authenticated users insert views') THEN
    CREATE POLICY "Authenticated users insert views"
      ON public.profile_views FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_views' AND policyname = 'Service role bypass') THEN
    CREATE POLICY "Service role bypass"
      ON public.profile_views FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.profile_views IS 'Analytics: profile view tracking';


-- =====================================================================
-- 6. TRADING TRANSCRIPT RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_trading_transcript(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_trades', COUNT(*),
    'winning_trades', COUNT(*) FILTER (WHERE pnl > 0),
    'losing_trades', COUNT(*) FILTER (WHERE pnl < 0),
    'win_rate', CASE
      WHEN COUNT(*) FILTER (WHERE pnl IS NOT NULL) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE pnl > 0)::NUMERIC /
            COUNT(*) FILTER (WHERE pnl IS NOT NULL)::NUMERIC) * 100, 1)
      ELSE NULL
    END,
    'total_pnl', COALESCE(SUM(pnl), 0),
    'profit_factor', CASE
      WHEN ABS(COALESCE(SUM(pnl) FILTER (WHERE pnl < 0), 0)) > 0
      THEN ROUND(COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) /
            ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 2)
      ELSE NULL
    END,
    'avg_pnl', ROUND(AVG(pnl), 2),
    'best_trade_pnl', MAX(pnl),
    'worst_trade_pnl', MIN(pnl),
    'most_profitable_symbol', (
      SELECT symbol FROM public.journal_entries
      WHERE user_id = target_user_id AND is_open = false
      GROUP BY symbol ORDER BY SUM(pnl) DESC LIMIT 1
    ),
    'most_traded_symbol', (
      SELECT symbol FROM public.journal_entries
      WHERE user_id = target_user_id
      GROUP BY symbol ORDER BY COUNT(*) DESC LIMIT 1
    ),
    'avg_discipline_score', ROUND(AVG(discipline_score), 1),
    'avg_hold_duration_min', ROUND(AVG(hold_duration_min)),
    'ai_grade_distribution', (
      SELECT COALESCE(jsonb_object_agg(grade, cnt), '{}'::jsonb)
      FROM (
        SELECT ai_analysis->>'grade' AS grade, COUNT(*) AS cnt
        FROM public.journal_entries
        WHERE user_id = target_user_id AND ai_analysis IS NOT NULL
        GROUP BY ai_analysis->>'grade'
      ) grades
    )
  ) INTO result
  FROM public.journal_entries
  WHERE user_id = target_user_id AND is_open = false;

  -- Add equity curve (last 90 data points)
  result = result || jsonb_build_object('equity_curve', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', trade_date::date,
      'cumulative_pnl', running_pnl
    ) ORDER BY trade_date), '[]'::jsonb)
    FROM (
      SELECT trade_date,
             SUM(pnl) OVER (ORDER BY trade_date) AS running_pnl
      FROM public.journal_entries
      WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
      ORDER BY trade_date DESC
      LIMIT 90
    ) curve
  ));

  -- Add streak data
  result = result || jsonb_build_object(
    'current_win_streak', (
      SELECT COUNT(*)
      FROM (
        SELECT pnl, ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS rn
        FROM public.journal_entries
        WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
      ) recent
      WHERE pnl > 0
      AND rn = (
        SELECT MIN(rn) FROM (
          SELECT pnl, ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS rn
          FROM public.journal_entries
          WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
        ) inner_q WHERE pnl > 0
      ) + rn - (
        SELECT MIN(rn) FROM (
          SELECT pnl, ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS rn
          FROM public.journal_entries
          WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
        ) inner_q WHERE pnl > 0
      )
    ),
    'longest_win_streak', 0  -- Simplified; compute in application layer
  );

  -- Compute best month
  result = result || jsonb_build_object('best_month', (
    SELECT TO_CHAR(trade_date, 'Mon YYYY')
    FROM public.journal_entries
    WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
    GROUP BY TO_CHAR(trade_date, 'Mon YYYY'), DATE_TRUNC('month', trade_date)
    ORDER BY SUM(pnl) DESC
    LIMIT 1
  ));

  -- Compute avg AI grade
  result = result || jsonb_build_object('avg_ai_grade', (
    SELECT CASE
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 3.5 THEN 'A'
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 2.5 THEN 'B'
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 1.5 THEN 'C'
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 0.5 THEN 'D'
      ELSE 'F'
    END
    FROM public.journal_entries
    WHERE user_id = target_user_id AND ai_analysis IS NOT NULL
  ));

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trading_transcript(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_trading_transcript IS 'Compute trading transcript stats for a user from journal entries';


-- =====================================================================
-- 7. TRADER DNA RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION public.compute_trader_dna(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'top_symbols', (
      SELECT COALESCE(array_agg(symbol ORDER BY cnt DESC), '{}')
      FROM (
        SELECT symbol, COUNT(*) AS cnt
        FROM public.journal_entries
        WHERE user_id = target_user_id
        GROUP BY symbol
        ORDER BY cnt DESC
        LIMIT 5
      ) top
    ),
    'preferred_strategy', (
      SELECT strategy
      FROM public.journal_entries
      WHERE user_id = target_user_id AND strategy IS NOT NULL
      GROUP BY strategy
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'avg_hold_minutes', (
      SELECT ROUND(AVG(hold_duration_min))::INTEGER
      FROM public.journal_entries
      WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL
    ),
    'trading_style', CASE
      WHEN (SELECT AVG(hold_duration_min) FROM public.journal_entries
            WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL) < 15
        THEN 'scalper'
      WHEN (SELECT AVG(hold_duration_min) FROM public.journal_entries
            WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL) < 390
        THEN 'day_trader'
      WHEN (SELECT AVG(hold_duration_min) FROM public.journal_entries
            WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL) < 2880
        THEN 'swing_trader'
      ELSE 'position_trader'
    END
  ) INTO result;

  -- Update member_profiles with computed DNA
  UPDATE public.member_profiles
  SET
    top_symbols = (result->>'top_symbols')::text[],
    preferred_strategy = result->>'preferred_strategy',
    avg_hold_minutes = (result->>'avg_hold_minutes')::integer,
    trading_style = result->>'trading_style'
  WHERE user_id = target_user_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_trader_dna(UUID) TO authenticated;

-- =====================================================================
-- DONE! All 7 migrations applied.
-- Tables created: member_profiles, social_feed_items, social_likes,
--   leaderboard_snapshots, affiliate_referrals, profile_views
-- Functions created: get_trading_transcript, compute_trader_dna
-- =====================================================================
