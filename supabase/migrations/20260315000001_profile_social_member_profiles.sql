BEGIN;

CREATE TABLE public.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name TEXT CHECK (char_length(display_name) <= 50),
  bio TEXT CHECK (char_length(bio) <= 500),
  tagline TEXT CHECK (char_length(tagline) <= 120),
  custom_avatar_url TEXT,
  banner_url TEXT,

  top_symbols TEXT[] NOT NULL DEFAULT '{}',
  preferred_strategy TEXT,
  avg_hold_minutes INTEGER,
  trading_style TEXT CHECK (trading_style IN ('scalper', 'day_trader', 'swing_trader', 'position_trader')),

  whop_user_id TEXT,
  whop_affiliate_url TEXT,
  whop_membership_id TEXT,

  privacy_settings JSONB NOT NULL DEFAULT '{
    "show_transcript": true,
    "show_academy": true,
    "show_trades_in_feed": true,
    "show_on_leaderboard": true,
    "show_discord_roles": true,
    "profile_visibility": "public"
  }'::jsonb,

  notification_preferences JSONB NOT NULL DEFAULT '{
    "feed_likes": true,
    "feed_comments": true,
    "leaderboard_changes": true,
    "achievement_earned": true,
    "weekly_digest": true
  }'::jsonb,

  ai_preferences JSONB NOT NULL DEFAULT '{
    "risk_tolerance": "moderate",
    "preferred_symbols": [],
    "trading_style_notes": "",
    "account_size_range": ""
  }'::jsonb,

  profile_completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_profiles_user ON public.member_profiles(user_id);
CREATE INDEX idx_member_profiles_active ON public.member_profiles(last_active_at DESC);
CREATE INDEX idx_member_profiles_whop ON public.member_profiles(whop_user_id)
  WHERE whop_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_member_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_member_profiles_updated_at
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_member_profiles_updated_at();

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON public.member_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public profiles readable by authenticated"
  ON public.member_profiles FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND COALESCE(privacy_settings->>'profile_visibility', 'public') IN ('public', 'members')
  );

CREATE POLICY "Service role bypass member profiles"
  ON public.member_profiles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all member profiles"
  ON public.member_profiles FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

COMMENT ON TABLE public.member_profiles IS 'Extended member profile settings for profile hub and social surfaces';

COMMIT;
