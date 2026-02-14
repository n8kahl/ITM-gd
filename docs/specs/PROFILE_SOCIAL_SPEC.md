# Profile Hub & Trade Social — Development Specification

**Version:** 1.0
**Date:** February 2026
**Status:** Approved for Development
**Target:** Q1 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture & Conventions](#2-architecture--conventions)
3. [Phase 1 — Database Migrations](#3-phase-1--database-migrations)
4. [Phase 2 — Type Definitions](#4-phase-2--type-definitions)
5. [Phase 3 — Validation Schemas](#5-phase-3--validation-schemas)
6. [Phase 4 — API Routes](#6-phase-4--api-routes)
7. [Phase 5 — Supabase RPC Functions](#7-phase-5--supabase-rpc-functions)
8. [Phase 6 — Components](#8-phase-6--components)
9. [Phase 7 — Profile Hub Page](#9-phase-7--profile-hub-page)
10. [Phase 8 — Trade Social Page](#10-phase-8--trade-social-page)
11. [Phase 9 — Trade Card Sharing Flow](#11-phase-9--trade-card-sharing-flow)
12. [Phase 10 — Leaderboard Edge Function](#12-phase-10--leaderboard-edge-function)
13. [Phase 11 — WHOP Integration](#13-phase-11--whop-integration)
14. [Phase 12 — Tests](#14-phase-12--tests)
15. [Phase 13 — Documentation](#15-phase-13--documentation)
16. [Phase 14 — Deployment](#16-phase-14--deployment)
17. [Appendix A — File Manifest](#appendix-a--file-manifest)
18. [Appendix B — Environment Variables](#appendix-b--environment-variables)

---

## 1. Overview

### What We're Building

Transform the existing basic Profile settings page and empty Social tab into a premium, data-rich member experience consisting of:

**Profile Hub** — A comprehensive trading identity center with 6 sections:
- Trader Identity Card (avatar, tier, rank, XP, bio, Trader DNA tags)
- Trading Transcript (verified stats from journal, AI grade distribution)
- Academy Progress & Credentials (courses, achievements, certifications)
- Discord & Community (enhanced role display, sync status)
- WHOP & Affiliate Hub (referral URL, tracking, earnings)
- Settings & Preferences (privacy, notifications, data export)

**Trade Social** — A community feed and engagement layer:
- Social Feed (shared trade cards, achievements, milestones)
- Trade Card Sharing from Journal (extends existing Satori pipeline)
- Leaderboards (win rate, P&L, streaks, XP, discipline)
- Achievement Gallery (community wall with verification)
- Community Highlights (featured trades, member spotlights)

### Existing Infrastructure We Leverage

| System | What It Provides |
|--------|-----------------|
| `journal_entries` table | Trade data, P&L, AI grades, discipline scores, moods |
| `shared_trade_cards` table | Already exists — template system, image URLs, public/featured flags |
| `user_xp` + `user_achievements` | XP totals, ranks, achievement history |
| `user_course_progress` + `user_lesson_progress` | Academy completion data |
| Trade Card Generator (`lib/academy/trade-card-generator.ts`) | Satori + Resvg PNG pipeline |
| Discord Integration | Role sync, avatar, username |
| `MemberAuthContext` | Auth state, permissions, tier, profile |

### What Does NOT Exist Yet

- Extended profile data (bio, tagline, privacy settings, WHOP URL)
- Social feed items table (the feed itself)
- Social likes table
- Leaderboard snapshots table
- Affiliate referrals table
- Profile views analytics table
- Any UI for social features
- Any API routes for social features
- WHOP API integration

---

## 2. Architecture & Conventions

### Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS 4 with CSS variables, `glass-card-heavy` utility
- **Database:** Supabase (PostgreSQL with RLS)
- **Auth:** Supabase SSR (`@supabase/ssr`) — always use `getUser()` not `getSession()`
- **Validation:** Zod
- **Icons:** Lucide React (stroke width 1.5)
- **Images:** `next/image` for all images
- **Imports:** `@/` alias for absolute imports
- **Fonts:** Inter (sans), Playfair Display (serif), Geist Mono (mono)
- **Rate Limiting:** Upstash Redis with in-memory fallback
- **Error Handling:** `lib/error-handler.ts` pattern with Sonner toasts
- **Tests:** Vitest (unit), Playwright (E2E)

### Design System Rules

- **Primary:** Emerald `#10B981` — use `var(--emerald-elite)` or `text-emerald-500`
- **Accent:** Champagne `#F5EDCC` — use `var(--champagne)` sparingly
- **FORBIDDEN:** Gold `#D4AF37` — never use
- **Background:** `#0A0A0B` (Onyx)
- **Cards:** `glass-card-heavy` class (bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5)
- **Dark mode only** — no light mode support
- **Mobile first** — always check `hidden md:flex` patterns

### API Route Pattern

```typescript
// Standard authenticated API route
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Business logic...
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Migration Pattern

```sql
BEGIN;

CREATE TABLE public.table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- columns...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_table_user ON public.table_name(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_table_name_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_table_name_updated_at
  BEFORE UPDATE ON public.table_name
  FOR EACH ROW EXECUTE FUNCTION public.update_table_name_updated_at();

-- RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their rows"
  ON public.table_name FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass"
  ON public.table_name FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
```

### Component Pattern

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, SomeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MyComponentProps {
  userId: string
  className?: string
}

export function MyComponent({ userId, className }: MyComponentProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MyType | null>(null)

  useEffect(() => {
    // fetch data...
  }, [userId])

  if (loading) {
    return (
      <Card className={cn('glass-card-heavy border-white/10', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('glass-card-heavy border-white/10', className)}>
      {/* content */}
    </Card>
  )
}
```

---

## 3. Phase 1 — Database Migrations

### Migration 1: `member_profiles`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_member_profiles.sql`

```sql
BEGIN;

-- Extended profile data for Profile Hub
CREATE TABLE public.member_profiles (
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

-- Indexes
CREATE INDEX idx_member_profiles_user ON public.member_profiles(user_id);
CREATE INDEX idx_member_profiles_active ON public.member_profiles(last_active_at DESC);
CREATE INDEX idx_member_profiles_whop ON public.member_profiles(whop_user_id)
  WHERE whop_user_id IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_member_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_member_profiles_updated_at
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_member_profiles_updated_at();

-- RLS
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON public.member_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public profiles readable by authenticated"
  ON public.member_profiles FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (privacy_settings->>'profile_visibility')::text IN ('public', 'members')
  );

CREATE POLICY "Service role bypass"
  ON public.member_profiles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all profiles"
  ON public.member_profiles FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

COMMENT ON TABLE public.member_profiles IS 'Extended member profile data for Profile Hub and social features';

COMMIT;
```

### Migration 2: `social_feed_items`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_social_feed.sql`

```sql
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
```

### Migration 3: `leaderboard_snapshots`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_leaderboards.sql`

```sql
BEGIN;

CREATE TABLE public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  category TEXT NOT NULL CHECK (category IN (
    'win_rate', 'total_pnl', 'longest_streak',
    'academy_xp', 'discipline_score', 'trade_count'
  )),

  rank INTEGER NOT NULL CHECK (rank > 0),
  value NUMERIC(12,4) NOT NULL,

  -- Denormalized user display data (avoids JOINs)
  display_name TEXT,
  discord_avatar TEXT,
  discord_username TEXT,
  membership_tier TEXT,

  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query indexes
CREATE INDEX idx_leaderboard_lookup
  ON public.leaderboard_snapshots(period, category, snapshot_date DESC, rank ASC);

CREATE INDEX idx_leaderboard_user
  ON public.leaderboard_snapshots(user_id, period, category);

CREATE UNIQUE INDEX idx_leaderboard_unique_entry
  ON public.leaderboard_snapshots(period, category, snapshot_date, user_id);

-- RLS
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboards readable by authenticated"
  ON public.leaderboard_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role manages leaderboards"
  ON public.leaderboard_snapshots FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.leaderboard_snapshots IS 'Pre-computed leaderboard rankings updated daily';

COMMIT;
```

### Migration 4: `affiliate_referrals`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_affiliate_referrals.sql`

```sql
BEGIN;

CREATE TABLE public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed_up', 'subscribed', 'churned', 'expired'
  )),

  -- WHOP data
  whop_checkout_id TEXT,
  whop_membership_id TEXT,
  referral_code TEXT NOT NULL,

  -- Earnings
  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_currency TEXT DEFAULT 'USD',
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMPTZ,

  -- Timestamps
  clicked_at TIMESTAMPTZ DEFAULT now(),
  signed_up_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON public.affiliate_referrals(referrer_id);
CREATE INDEX idx_referrals_code ON public.affiliate_referrals(referral_code);
CREATE INDEX idx_referrals_status ON public.affiliate_referrals(referrer_id, status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_affiliate_referrals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_affiliate_referrals_updated_at
  BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_referrals_updated_at();

-- RLS
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Service role manages referrals"
  ON public.affiliate_referrals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins view all referrals"
  ON public.affiliate_referrals FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

COMMENT ON TABLE public.affiliate_referrals IS 'WHOP affiliate referral tracking';

COMMIT;
```

### Migration 5: `profile_views`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_profile_views.sql`

```sql
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

CREATE POLICY "Users view own profile analytics"
  ON public.profile_views FOR SELECT
  USING (auth.uid() = profile_user_id);

CREATE POLICY "Authenticated users insert views"
  ON public.profile_views FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role bypass"
  ON public.profile_views FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.profile_views IS 'Analytics: profile view tracking';

COMMIT;
```

---

## 4. Phase 2 — Type Definitions

### File: `lib/types/social.ts`

```typescript
// ============================================================================
// PROFILE TYPES
// ============================================================================

export type ProfileVisibility = 'public' | 'members' | 'private'
export type TradingStyle = 'scalper' | 'day_trader' | 'swing_trader' | 'position_trader'

export interface PrivacySettings {
  show_transcript: boolean
  show_academy: boolean
  show_trades_in_feed: boolean
  show_on_leaderboard: boolean
  show_discord_roles: boolean
  profile_visibility: ProfileVisibility
}

export interface NotificationPreferences {
  feed_likes: boolean
  feed_comments: boolean
  leaderboard_changes: boolean
  achievement_earned: boolean
  weekly_digest: boolean
}

export interface AIPreferences {
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  preferred_symbols: string[]
  trading_style_notes: string
  account_size_range: string
}

export interface MemberProfile {
  id: string
  user_id: string
  display_name: string | null
  bio: string | null
  tagline: string | null
  custom_avatar_url: string | null
  banner_url: string | null
  top_symbols: string[]
  preferred_strategy: string | null
  avg_hold_minutes: number | null
  trading_style: TradingStyle | null
  whop_user_id: string | null
  whop_affiliate_url: string | null
  whop_membership_id: string | null
  privacy_settings: PrivacySettings
  notification_preferences: NotificationPreferences
  ai_preferences: AIPreferences
  profile_completed_at: string | null
  last_active_at: string
  created_at: string
  updated_at: string
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  show_transcript: true,
  show_academy: true,
  show_trades_in_feed: true,
  show_on_leaderboard: true,
  show_discord_roles: true,
  profile_visibility: 'public',
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  feed_likes: true,
  feed_comments: true,
  leaderboard_changes: true,
  achievement_earned: true,
  weekly_digest: true,
}

export const DEFAULT_AI_PREFERENCES: AIPreferences = {
  risk_tolerance: 'moderate',
  preferred_symbols: [],
  trading_style_notes: '',
  account_size_range: '',
}

// ============================================================================
// TRADING TRANSCRIPT TYPES
// ============================================================================

export interface TradingTranscript {
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number | null
  total_pnl: number
  profit_factor: number | null
  avg_pnl: number | null
  best_trade_pnl: number | null
  worst_trade_pnl: number | null
  best_month: string | null
  current_win_streak: number
  longest_win_streak: number
  avg_discipline_score: number | null
  avg_ai_grade: string | null
  ai_grade_distribution: Record<string, number>
  most_profitable_symbol: string | null
  most_traded_symbol: string | null
  avg_hold_duration_min: number | null
  equity_curve: Array<{ date: string; cumulative_pnl: number }>
}

// ============================================================================
// SOCIAL FEED TYPES
// ============================================================================

export type FeedItemType = 'trade_card' | 'achievement' | 'milestone' | 'highlight'
export type FeedVisibility = 'public' | 'members' | 'private'

export interface TradeCardDisplayData {
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  template: string
  image_url: string | null
  ai_grade: string | null
  strategy: string | null
  entry_price: number | null
  exit_price: number | null
}

export interface AchievementDisplayData {
  title: string
  icon: string
  type: string
  xp_earned: number
  verification_code: string
  tier: string
}

export interface MilestoneDisplayData {
  type: 'streak' | 'rank_up' | 'trade_count' | 'custom'
  description: string
  value: string | number
}

export interface HighlightDisplayData {
  title: string
  description: string
  author_note: string | null
  spotlight_type: 'trade_of_week' | 'member_spotlight' | 'community_note'
}

export type FeedDisplayData =
  | TradeCardDisplayData
  | AchievementDisplayData
  | MilestoneDisplayData
  | HighlightDisplayData

export interface SocialFeedItem {
  id: string
  user_id: string
  item_type: FeedItemType
  reference_id: string | null
  reference_table: string | null
  display_data: FeedDisplayData
  likes_count: number
  comments_count: number
  visibility: FeedVisibility
  is_featured: boolean
  is_pinned: boolean
  created_at: string
  updated_at: string

  // Joined data (from query)
  author?: {
    discord_username: string | null
    discord_avatar: string | null
    membership_tier: string | null
    display_name: string | null
  }
  user_has_liked?: boolean
}

export interface SocialLike {
  id: string
  user_id: string
  feed_item_id: string
  created_at: string
}

// ============================================================================
// FEED FILTERS & PAGINATION
// ============================================================================

export interface FeedFilters {
  type: FeedItemType | 'all'
  sort: 'latest' | 'most_liked' | 'top_pnl'
  featured_only: boolean
}

export const DEFAULT_FEED_FILTERS: FeedFilters = {
  type: 'all',
  sort: 'latest',
  featured_only: false,
}

export interface FeedPaginationParams {
  cursor?: string        // ISO timestamp of last item for cursor-based pagination
  limit: number          // Default 20
}

export interface FeedResponse {
  items: SocialFeedItem[]
  next_cursor: string | null
  has_more: boolean
  total_count?: number
}

// ============================================================================
// LEADERBOARD TYPES
// ============================================================================

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time'
export type LeaderboardCategory =
  | 'win_rate'
  | 'total_pnl'
  | 'longest_streak'
  | 'academy_xp'
  | 'discipline_score'
  | 'trade_count'

export interface LeaderboardEntry {
  id: string
  user_id: string
  rank: number
  value: number
  display_name: string | null
  discord_avatar: string | null
  discord_username: string | null
  membership_tier: string | null
  snapshot_date: string
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod
  category: LeaderboardCategory
  entries: LeaderboardEntry[]
  user_entry: LeaderboardEntry | null    // Current user's position
  snapshot_date: string
}

// ============================================================================
// AFFILIATE TYPES
// ============================================================================

export type ReferralStatus = 'pending' | 'signed_up' | 'subscribed' | 'churned' | 'expired'

export interface AffiliateReferral {
  id: string
  referrer_id: string
  referred_email: string | null
  status: ReferralStatus
  referral_code: string
  commission_amount: number
  commission_paid: boolean
  clicked_at: string
  signed_up_at: string | null
  subscribed_at: string | null
  created_at: string
}

export interface AffiliateStats {
  total_referrals: number
  active_referrals: number
  total_earnings: number
  unpaid_earnings: number
  conversion_rate: number | null
  referral_code: string
  affiliate_url: string
}

// ============================================================================
// PROFILE VIEW TYPES
// ============================================================================

export interface ProfileViewStats {
  total_views: number
  views_this_week: number
  views_this_month: number
  unique_viewers_this_month: number
}
```

---

## 5. Phase 3 — Validation Schemas

### File: `lib/validation/social.ts`

```typescript
import { z } from 'zod'

// Profile update validation
export const memberProfileUpdateSchema = z.object({
  display_name: z.string().max(50).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  tagline: z.string().max(120).nullable().optional(),
  trading_style: z.enum(['scalper', 'day_trader', 'swing_trader', 'position_trader']).nullable().optional(),
  whop_affiliate_url: z.string().url().nullable().optional(),
  privacy_settings: z.object({
    show_transcript: z.boolean(),
    show_academy: z.boolean(),
    show_trades_in_feed: z.boolean(),
    show_on_leaderboard: z.boolean(),
    show_discord_roles: z.boolean(),
    profile_visibility: z.enum(['public', 'members', 'private']),
  }).optional(),
  notification_preferences: z.object({
    feed_likes: z.boolean(),
    feed_comments: z.boolean(),
    leaderboard_changes: z.boolean(),
    achievement_earned: z.boolean(),
    weekly_digest: z.boolean(),
  }).optional(),
  ai_preferences: z.object({
    risk_tolerance: z.enum(['conservative', 'moderate', 'aggressive']),
    preferred_symbols: z.array(z.string().max(16)).max(20),
    trading_style_notes: z.string().max(500),
    account_size_range: z.string().max(50),
  }).optional(),
})

// Feed item creation (when sharing a trade)
export const createFeedItemSchema = z.object({
  item_type: z.enum(['trade_card', 'achievement', 'milestone']),
  reference_id: z.string().uuid(),
  reference_table: z.string().max(50),
  display_data: z.record(z.unknown()),
  visibility: z.enum(['public', 'members', 'private']).default('public'),
})

// Feed query params
export const feedQuerySchema = z.object({
  type: z.enum(['all', 'trade_card', 'achievement', 'milestone', 'highlight']).default('all'),
  sort: z.enum(['latest', 'most_liked', 'top_pnl']).default('latest'),
  featured_only: z.coerce.boolean().default(false),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// Leaderboard query params
export const leaderboardQuerySchema = z.object({
  period: z.enum(['weekly', 'monthly', 'all_time']).default('weekly'),
  category: z.enum([
    'win_rate', 'total_pnl', 'longest_streak',
    'academy_xp', 'discipline_score', 'trade_count'
  ]).default('win_rate'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

// Share trade card
export const shareTradeCardSchema = z.object({
  journal_entry_id: z.string().uuid(),
  template: z.enum(['dark-elite', 'emerald-gradient', 'champagne-premium', 'minimal', 'story']).default('dark-elite'),
  visibility: z.enum(['public', 'members', 'private']).default('public'),
  share_to_discord: z.boolean().default(false),
})
```

---

## 6. Phase 4 — API Routes

### Route 1: Profile CRUD

**File:** `app/api/members/profile/route.ts`

```
GET  /api/members/profile          — Get own extended profile (creates if not exists)
PATCH /api/members/profile         — Update profile fields
```

**GET behavior:**
1. Auth check via `createServerSupabaseClient()` + `getUser()`
2. Query `member_profiles` by `user_id`
3. If no row exists, INSERT with defaults and return
4. Return profile data

**PATCH behavior:**
1. Auth check
2. Validate body with `memberProfileUpdateSchema`
3. Sanitize string fields with `sanitizeString()` from `lib/sanitize.ts`
4. Update `member_profiles` row
5. Return updated profile

### Route 2: Profile by User ID (public)

**File:** `app/api/members/profile/[userId]/route.ts`

```
GET /api/members/profile/[userId]  — Get another user's public profile
```

**Behavior:**
1. Auth check (must be authenticated)
2. Query `member_profiles` where `user_id = params.userId`
3. Check `privacy_settings.profile_visibility` — if 'private', return 403
4. Record a `profile_views` entry (skip if viewer === profile owner)
5. Return filtered profile (only public fields based on privacy settings)
6. Also return joined data: membership tier, discord info from `member_profiles` view

### Route 3: Trading Transcript

**File:** `app/api/members/profile/transcript/route.ts`

```
GET /api/members/profile/transcript            — Own transcript
GET /api/members/profile/transcript?userId=X   — Another user's transcript (respects privacy)
```

**Behavior:**
1. Auth check
2. If `userId` param provided, check that user's `privacy_settings.show_transcript`
3. Call Supabase RPC function `get_trading_transcript(target_user_id)` (see Phase 5)
4. Return `TradingTranscript` object

### Route 4: Social Feed

**File:** `app/api/social/feed/route.ts`

```
GET  /api/social/feed                          — Get feed items with cursor pagination
POST /api/social/feed                          — Create a new feed item (share trade)
```

**GET behavior:**
1. Auth check
2. Validate query params with `feedQuerySchema`
3. Build Supabase query on `social_feed_items`:
   - Filter by `visibility IN ('public', 'members')`
   - Filter by `item_type` if not 'all'
   - Filter by `is_featured` if `featured_only`
   - Order by `created_at DESC` (latest), `likes_count DESC` (most_liked)
   - Cursor-based pagination: `WHERE created_at < cursor`
   - Limit + 1 to detect `has_more`
4. For each item, join author data from `member_profiles` (display_name) and member_profiles Supabase auth (discord_username, discord_avatar, membership_tier)
5. Check if current user has liked each item (subquery on `social_likes`)
6. Return `FeedResponse`

**POST behavior:**
1. Auth check
2. Validate body with `createFeedItemSchema`
3. Verify `reference_id` exists and belongs to user
4. Insert into `social_feed_items`
5. Return created item

### Route 5: Social Likes

**File:** `app/api/social/feed/[itemId]/like/route.ts`

```
POST   /api/social/feed/[itemId]/like          — Like a feed item
DELETE /api/social/feed/[itemId]/like          — Unlike a feed item
```

**POST behavior:**
1. Auth check
2. Insert into `social_likes` (unique constraint prevents duplicates)
3. Return { liked: true }

**DELETE behavior:**
1. Auth check
2. Delete from `social_likes` where `user_id = auth.uid()` and `feed_item_id = params.itemId`
3. Return { liked: false }

### Route 6: Leaderboards

**File:** `app/api/social/leaderboard/route.ts`

```
GET /api/social/leaderboard                    — Get leaderboard data
```

**Behavior:**
1. Auth check
2. Validate query with `leaderboardQuerySchema`
3. Query `leaderboard_snapshots` for latest `snapshot_date` matching `period` and `category`
4. Order by `rank ASC`, limit by `limit`
5. Also query current user's entry
6. Return `LeaderboardResponse`

### Route 7: Share Trade Card

**File:** `app/api/social/share-trade/route.ts`

```
POST /api/social/share-trade                   — Share a journal entry to the feed
```

**Behavior:**
1. Auth check
2. Validate body with `shareTradeCardSchema`
3. Fetch the `journal_entry` by `journal_entry_id` (verify ownership)
4. Check if already shared (query `shared_trade_cards` for duplicate)
5. Generate trade card image via the existing pipeline (`lib/academy/trade-card-generator.ts` — adapt for journal trade cards)
6. Upload image to Supabase Storage (`trade-cards` bucket)
7. Insert into `shared_trade_cards` table
8. Insert into `social_feed_items` with `item_type = 'trade_card'`
9. If `share_to_discord = true`, send webhook to Discord channel (future)
10. Return { feed_item, trade_card, image_url }

### Route 8: Affiliate Stats

**File:** `app/api/members/affiliate/route.ts`

```
GET /api/members/affiliate                     — Get affiliate stats and referrals
```

**Behavior:**
1. Auth check
2. Query `affiliate_referrals` where `referrer_id = user.id`
3. Query `member_profiles` for `whop_affiliate_url`
4. Compute stats: total, active, earnings, conversion rate
5. Return `AffiliateStats` + recent referrals list

### Route 9: Profile View Stats

**File:** `app/api/members/profile/views/route.ts`

```
GET /api/members/profile/views                 — Get profile view analytics
```

**Behavior:**
1. Auth check
2. Query `profile_views` counts for own profile
3. Return `ProfileViewStats`

---

## 7. Phase 5 — Supabase RPC Functions

### RPC: `get_trading_transcript`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_trading_transcript_rpc.sql`

```sql
BEGIN;

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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_trading_transcript(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_trading_transcript IS 'Compute trading transcript stats for a user from journal entries';

COMMIT;
```

### RPC: `compute_trader_dna`

**File:** `supabase/migrations/YYYYMMDDHHMMSS_trader_dna_rpc.sql`

```sql
BEGIN;

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

COMMIT;
```

---

## 8. Phase 6 — Components

### Component Manifest

Create the following components. Each should follow the conventions in Section 2.

```
components/profile/
├── trader-identity-card.tsx        # Hero card with avatar, tier, rank, XP, DNA tags
├── trading-transcript.tsx          # Verified stats display with sparkline
├── academy-progress-card.tsx       # Courses, achievements, XP bar
├── discord-community-card.tsx      # Discord roles, sync, server link
├── whop-affiliate-card.tsx         # Affiliate URL, referral stats, earnings
├── profile-settings-sheet.tsx      # Sheet/modal for privacy, notifications, preferences
├── profile-share-button.tsx        # Generate shareable profile card
├── privacy-toggle.tsx              # Reusable privacy toggle component
└── equity-sparkline.tsx            # Mini equity curve chart (use recharts)

components/social/
├── social-feed.tsx                 # Main feed container with infinite scroll
├── feed-item-card.tsx              # Individual feed item renderer (polymorphic by type)
├── feed-filter-bar.tsx             # Type/sort filter tabs
├── feed-trade-card.tsx             # Trade card display within feed
├── feed-achievement-card.tsx       # Achievement display within feed
├── feed-milestone-card.tsx         # Milestone display within feed
├── feed-highlight-card.tsx         # Admin highlight display
├── like-button.tsx                 # Like/unlike with optimistic UI
├── share-trade-sheet.tsx           # Sheet for sharing a trade (template picker)
├── leaderboard-table.tsx           # Leaderboard with tabs and user highlight
├── achievement-gallery.tsx         # Grid of community achievements
├── community-highlights.tsx        # Featured trades, member spotlight
└── community-stats-bar.tsx         # Aggregate community statistics
```

### Component Specifications

#### `trader-identity-card.tsx`

**Props:**
```typescript
interface TraderIdentityCardProps {
  profile: MemberProfile
  memberProfile: MemberAuthProfile  // From MemberAuthContext
  academyData: { rank: string; xp: number; nextRankXp: number } | null
  className?: string
}
```

**Behavior:**
- Display Discord avatar with tier-colored ring glow (conic-gradient border)
- Show display_name (falls back to discord_username)
- Tier badge: Core (emerald), Pro (blue), Executive (champagne)
- Academy rank + XP progress bar to next rank
- "Trader DNA" tags row: top_symbols, preferred_strategy, trading_style
- Member since date
- Bio text (if set)
- "Share Profile" and "Edit Profile" buttons

**Tier color mapping (reuse from `trade-card-generator.ts`):**
```typescript
const TIER_RING_COLORS = {
  core: 'from-emerald-500 via-emerald-400 to-emerald-600',
  pro: 'from-blue-500 via-blue-400 to-blue-600',
  executive: 'from-[#F3E5AB] via-[#E8D890] to-[#F3E5AB]',
}
```

#### `trading-transcript.tsx`

**Props:**
```typescript
interface TradingTranscriptProps {
  transcript: TradingTranscript | null
  isOwnProfile: boolean
  isPublic: boolean
  loading: boolean
  className?: string
}
```

**Behavior:**
- If loading, show glass-card with Loader2 spinner
- "VERIFIED STATS" badge with checkmark (emerald)
- Stats grid: Total Trades, Win Rate, Profit Factor, Best Month, Discipline, AI Grade Avg
- Mini equity curve sparkline (use `recharts` `<AreaChart>` with emerald fill)
- AI grade distribution bar (A/B/C/D/F horizontal bar)
- Privacy toggle (only shown if `isOwnProfile`)

#### `like-button.tsx`

**Props:**
```typescript
interface LikeButtonProps {
  feedItemId: string
  initialLiked: boolean
  initialCount: number
}
```

**Behavior:**
- Optimistic UI: toggle like state immediately, revert on error
- POST/DELETE to `/api/social/feed/[itemId]/like`
- Heart icon (filled when liked, outline when not)
- Count display next to icon
- Debounce rapid clicks (300ms)

#### `share-trade-sheet.tsx`

**Props:**
```typescript
interface ShareTradeSheetProps {
  journalEntry: JournalEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  onShared: (feedItem: SocialFeedItem) => void
}
```

**Behavior:**
- Sheet/drawer component (use Shadcn Sheet)
- Template selector: 5 templates with visual preview thumbnails
- Format selector: Landscape (feed), Story (Instagram), Square (Twitter)
- Visibility selector: Public, Members Only, Private
- "Share to Discord" toggle checkbox
- Preview of the generated card (call the generation API)
- "Share" button → POST to `/api/social/share-trade`
- Loading state during image generation
- Success toast with link to feed

---

## 9. Phase 7 — Profile Hub Page

### File: `app/members/profile/page.tsx`

**Complete rewrite** of the existing profile page. The new page renders all 6 sections.

**Data Loading Strategy:**
1. Use `useMemberAuth()` for auth state, permissions, and base profile
2. Fetch `MemberProfile` from `/api/members/profile` on mount (creates if not exists)
3. Fetch `TradingTranscript` from `/api/members/profile/transcript`
4. Fetch academy data from existing academy endpoints (user_xp, achievements)
5. All fetches in parallel via `Promise.all`

**Layout:**
```
<div className="max-w-4xl mx-auto space-y-6">
  <TraderIdentityCard />
  <TradingTranscript />
  <AcademyProgressCard />
  <DiscordCommunityCard />
  <WhopAffiliateCard />
  {/* Settings in a sheet triggered by gear icon in Identity Card */}
</div>
```

**Mobile:** All sections stack vertically. Identity Card avatar scales to 80px. Stats grid goes to 2 columns.

---

## 10. Phase 8 — Trade Social Page

### File: `app/members/social/page.tsx`

**New page** — add to tab configuration in admin settings.

**Layout (Desktop):**
```
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Main Feed - 2/3 width */}
  <div className="lg:col-span-2 space-y-4">
    <FeedFilterBar />
    <SocialFeed />
  </div>

  {/* Sidebar - 1/3 width */}
  <div className="space-y-6">
    <CommunityStatsBar />
    <LeaderboardTable period="weekly" category="win_rate" compact />
    <AchievementGallery compact limit={6} />
    <CommunityHighlights />
  </div>
</div>
```

**Mobile:** Single column, sidebar sections collapse into tabs or accordion.

**Tab Configuration:**
Add a new entry to `tab_configurations` for the Social tab:
```sql
INSERT INTO app_config.tab_configurations (
  tab_id, label, icon, path, required_tier, sort_order, is_active, mobile_visible
) VALUES (
  'social', 'Social', 'Users', '/members/social', 'core', 55, true, true
);
```

---

## 11. Phase 9 — Trade Card Sharing Flow

### Extend the Journal Page

In `components/journal/entry-detail-sheet.tsx`, add a "Share to Community" button that opens `<ShareTradeSheet>`.

**Condition:** Only show the share button if:
- Trade is closed (`is_open = false`)
- Trade has `pnl` data
- User hasn't already shared this entry (check `shared_trade_cards`)

### Trade Card Generator Adaptation

Create `lib/social/trade-card-generator.ts` that adapts the existing academy trade card generator for journal trades.

**Key differences from academy cards:**
- Shows P&L, win/loss, symbol, direction instead of course completion
- Uses journal entry data instead of achievement data
- Same Satori + Resvg pipeline
- Same template system (dark-elite, emerald-gradient, etc.)
- Same format options (landscape, story, square)

**Trade Card Metadata (journal variant):**
```typescript
interface JournalTradeCardMetadata {
  symbol: string
  direction: 'LONG' | 'SHORT'
  contractType: 'Stock' | 'Call' | 'Put'
  pnl: string              // Formatted: "+$1,240.00"
  pnlPercentage: string    // Formatted: "+12.4%"
  isWinner: boolean
  entryPrice: string
  exitPrice: string
  strategy: string | null
  aiGrade: string | null
  memberName: string
  memberTier: string
  tradeDate: string
  holdDuration: string | null
}
```

---

## 12. Phase 10 — Leaderboard Edge Function

### File: `supabase/functions/compute-leaderboards/index.ts`

**Purpose:** Daily scheduled function that computes leaderboard snapshots.

**Schedule:** Run via Supabase cron at 00:00 UTC daily.

**Logic:**
1. For each `(period, category)` combination:
   - Compute the time window (weekly = last 7 days, monthly = last 30 days, all_time = no filter)
   - Query `journal_entries` aggregated by `user_id` for the relevant metric
   - Only include users who have opted in (`member_profiles.privacy_settings.show_on_leaderboard = true`)
   - Rank by the metric, LIMIT 100
   - Delete old snapshots for this `(period, category, snapshot_date)` combination
   - Insert new rows into `leaderboard_snapshots`
2. Join user display data (discord_username, discord_avatar, membership_tier, display_name)

**Categories:**
- `win_rate`: `COUNT(pnl > 0) / COUNT(pnl IS NOT NULL) * 100` — minimum 10 trades
- `total_pnl`: `SUM(pnl)` — minimum 5 trades
- `longest_streak`: computed via window functions — minimum 5 trades
- `academy_xp`: from `user_xp.total_xp`
- `discipline_score`: `AVG(discipline_score)` — minimum 10 trades
- `trade_count`: `COUNT(*)` — no minimum

**Edge Function Pattern (follow existing convention):**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Auth: verify service role or cron trigger
  // Compute leaderboards
  // Insert snapshots
})
```

---

## 13. Phase 11 — WHOP Integration

### API Route: `app/api/webhooks/whop/route.ts`

**Purpose:** Receive WHOP webhooks for membership and referral events.

**Events to handle:**
- `membership.went_valid` — Referral converted to subscriber
- `membership.went_invalid` — Subscriber churned
- `payment.succeeded` — Commission earned
- `setup_intent.succeeded` — Payment method saved

**Security:** Verify webhook signature using WHOP webhook secret.

### Environment Variables

```bash
WHOP_API_KEY=whop_sk_...
WHOP_WEBHOOK_SECRET=whsec_...
WHOP_COMPANY_ID=biz_...
```

### Integration Points

1. **Profile page:** Display WHOP membership status, affiliate URL
2. **Affiliate Hub:** Show referral stats from `affiliate_referrals` table
3. **Webhook handler:** Update referral statuses and commission amounts

---

## 14. Phase 12 — Tests

### Unit Tests (Vitest)

**File locations follow existing pattern: `lib/**/__tests__/**/*.test.ts`**

#### `lib/validation/__tests__/social.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { memberProfileUpdateSchema, feedQuerySchema, shareTradeCardSchema } from '../social'

describe('memberProfileUpdateSchema', () => {
  it('validates a valid profile update', () => {
    const result = memberProfileUpdateSchema.safeParse({
      display_name: 'Alex Chen',
      bio: 'Options trader focused on SPY spreads',
      tagline: 'Consistency over home runs',
      trading_style: 'day_trader',
    })
    expect(result.success).toBe(true)
  })

  it('rejects display_name over 50 chars', () => {
    const result = memberProfileUpdateSchema.safeParse({
      display_name: 'A'.repeat(51),
    })
    expect(result.success).toBe(false)
  })

  it('rejects bio over 500 chars', () => {
    const result = memberProfileUpdateSchema.safeParse({
      bio: 'A'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid trading_style', () => {
    const result = memberProfileUpdateSchema.safeParse({
      trading_style: 'yolo_trader',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid privacy_settings', () => {
    const result = memberProfileUpdateSchema.safeParse({
      privacy_settings: {
        show_transcript: false,
        show_academy: true,
        show_trades_in_feed: true,
        show_on_leaderboard: false,
        show_discord_roles: true,
        profile_visibility: 'members',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid profile_visibility', () => {
    const result = memberProfileUpdateSchema.safeParse({
      privacy_settings: {
        show_transcript: true,
        show_academy: true,
        show_trades_in_feed: true,
        show_on_leaderboard: true,
        show_discord_roles: true,
        profile_visibility: 'everyone',
      },
    })
    expect(result.success).toBe(false)
  })

  it('validates WHOP affiliate URL', () => {
    const result = memberProfileUpdateSchema.safeParse({
      whop_affiliate_url: 'https://whop.com/checkout/abc123/?a=referral',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid WHOP URL', () => {
    const result = memberProfileUpdateSchema.safeParse({
      whop_affiliate_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('feedQuerySchema', () => {
  it('uses defaults for empty query', () => {
    const result = feedQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('all')
      expect(result.data.sort).toBe('latest')
      expect(result.data.limit).toBe(20)
      expect(result.data.featured_only).toBe(false)
    }
  })

  it('accepts valid filter params', () => {
    const result = feedQuerySchema.safeParse({
      type: 'trade_card',
      sort: 'most_liked',
      limit: '50',
      featured_only: 'true',
    })
    expect(result.success).toBe(true)
  })

  it('coerces limit string to number', () => {
    const result = feedQuerySchema.safeParse({ limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(25)
  })

  it('rejects limit over 50', () => {
    const result = feedQuerySchema.safeParse({ limit: 100 })
    expect(result.success).toBe(false)
  })

  it('accepts valid cursor', () => {
    const result = feedQuerySchema.safeParse({
      cursor: '2026-02-10T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('shareTradeCardSchema', () => {
  it('validates a valid share request', () => {
    const result = shareTradeCardSchema.safeParse({
      journal_entry_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      template: 'emerald-gradient',
      visibility: 'public',
      share_to_discord: false,
    })
    expect(result.success).toBe(true)
  })

  it('uses defaults', () => {
    const result = shareTradeCardSchema.safeParse({
      journal_entry_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.template).toBe('dark-elite')
      expect(result.data.visibility).toBe('public')
      expect(result.data.share_to_discord).toBe(false)
    }
  })

  it('rejects invalid UUID', () => {
    const result = shareTradeCardSchema.safeParse({
      journal_entry_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid template', () => {
    const result = shareTradeCardSchema.safeParse({
      journal_entry_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      template: 'neon-rainbow',
    })
    expect(result.success).toBe(false)
  })
})
```

### E2E Tests (Playwright)

**File:** `e2e/social.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Profile Hub', () => {
  test.beforeEach(async ({ page }) => {
    // Login via E2E bypass (existing pattern)
    await page.goto('/members/profile')
  })

  test('renders trader identity card', async ({ page }) => {
    await expect(page.locator('[data-testid="trader-identity-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="trader-avatar"]')).toBeVisible()
    await expect(page.locator('[data-testid="tier-badge"]')).toBeVisible()
  })

  test('renders trading transcript', async ({ page }) => {
    await expect(page.locator('[data-testid="trading-transcript"]')).toBeVisible()
    await expect(page.locator('[data-testid="verified-badge"]')).toBeVisible()
  })

  test('renders academy progress', async ({ page }) => {
    await expect(page.locator('[data-testid="academy-progress"]')).toBeVisible()
  })

  test('opens settings sheet', async ({ page }) => {
    await page.click('[data-testid="settings-button"]')
    await expect(page.locator('[data-testid="settings-sheet"]')).toBeVisible()
  })

  test('updates privacy settings', async ({ page }) => {
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="privacy-transcript-toggle"]')
    await page.click('[data-testid="save-settings"]')
    await expect(page.locator('[data-testid="settings-success-toast"]')).toBeVisible()
  })
})

test.describe('Trade Social Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/members/social')
  })

  test('renders feed with items', async ({ page }) => {
    await expect(page.locator('[data-testid="social-feed"]')).toBeVisible()
  })

  test('filters feed by type', async ({ page }) => {
    await page.click('[data-testid="filter-trade_card"]')
    // Verify only trade cards shown
    const items = page.locator('[data-testid="feed-item"]')
    const count = await items.count()
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveAttribute('data-item-type', 'trade_card')
    }
  })

  test('likes and unlikes a feed item', async ({ page }) => {
    const likeBtn = page.locator('[data-testid="like-button"]').first()
    const countBefore = await likeBtn.locator('[data-testid="like-count"]').textContent()
    await likeBtn.click()
    // Optimistic UI should update immediately
    await expect(likeBtn).toHaveAttribute('data-liked', 'true')
  })

  test('renders leaderboard', async ({ page }) => {
    await expect(page.locator('[data-testid="leaderboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="leaderboard-entry"]').first()).toBeVisible()
  })
})
```

---

## 15. Phase 13 — Documentation

### Update These Existing Docs

1. **`CLAUDE.md`** — Add Profile Hub and Social sections to feature list
2. **`docs/BRAND_GUIDELINES.md`** — Add social card template guidelines
3. **`README.md`** — Update feature list

### Create New Docs

1. **`docs/social/PROFILE_HUB.md`** — User-facing guide for Profile Hub features
2. **`docs/social/TRADE_SOCIAL.md`** — User-facing guide for Trade Social features
3. **`docs/social/PRIVACY.md`** — Privacy controls documentation
4. **`docs/api/SOCIAL_API.md`** — API reference for all new endpoints
5. **`docs/social/WHOP_INTEGRATION.md`** — WHOP integration setup guide

---

## 16. Phase 14 — Deployment

### Pre-Deployment Checklist

- [ ] All migrations applied to Supabase (use Supabase MCP `apply_migration`)
- [ ] RPC functions created and tested
- [ ] RLS policies verified (test with different user roles)
- [ ] Environment variables set (`WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`)
- [ ] Leaderboard edge function deployed
- [ ] Tab configuration updated (add Social tab)
- [ ] Unit tests passing (`pnpm test:unit`)
- [ ] E2E tests passing (`pnpm test:e2e`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Mobile responsive testing complete
- [ ] CSP headers updated if needed (no new external origins required)

### Migration Order

1. `member_profiles` (no dependencies)
2. `social_feed` + `social_likes` (depends on auth.users)
3. `leaderboard_snapshots` (depends on auth.users)
4. `affiliate_referrals` (depends on auth.users)
5. `profile_views` (depends on auth.users)
6. `trading_transcript_rpc` (depends on journal_entries)
7. `trader_dna_rpc` (depends on journal_entries, member_profiles)

### Post-Deployment

1. Run `compute_trader_dna` for all existing users with journal data
2. Run initial leaderboard computation
3. Verify feed renders correctly with empty state
4. Test sharing flow end-to-end
5. Monitor Sentry for errors

---

## Appendix A — File Manifest

### New Files to Create

```
# Database Migrations
supabase/migrations/YYYYMMDD000001_member_profiles.sql
supabase/migrations/YYYYMMDD000002_social_feed.sql
supabase/migrations/YYYYMMDD000003_leaderboards.sql
supabase/migrations/YYYYMMDD000004_affiliate_referrals.sql
supabase/migrations/YYYYMMDD000005_profile_views.sql
supabase/migrations/YYYYMMDD000006_trading_transcript_rpc.sql
supabase/migrations/YYYYMMDD000007_trader_dna_rpc.sql

# Types
lib/types/social.ts

# Validation
lib/validation/social.ts

# API Routes
app/api/members/profile/route.ts                       # GET, PATCH
app/api/members/profile/[userId]/route.ts              # GET
app/api/members/profile/transcript/route.ts            # GET
app/api/members/profile/views/route.ts                 # GET
app/api/members/affiliate/route.ts                     # GET
app/api/social/feed/route.ts                           # GET, POST
app/api/social/feed/[itemId]/like/route.ts             # POST, DELETE
app/api/social/leaderboard/route.ts                    # GET
app/api/social/share-trade/route.ts                    # POST
app/api/webhooks/whop/route.ts                         # POST

# Profile Components
components/profile/trader-identity-card.tsx
components/profile/trading-transcript.tsx
components/profile/academy-progress-card.tsx
components/profile/discord-community-card.tsx
components/profile/whop-affiliate-card.tsx
components/profile/profile-settings-sheet.tsx
components/profile/profile-share-button.tsx
components/profile/privacy-toggle.tsx
components/profile/equity-sparkline.tsx

# Social Components
components/social/social-feed.tsx
components/social/feed-item-card.tsx
components/social/feed-filter-bar.tsx
components/social/feed-trade-card.tsx
components/social/feed-achievement-card.tsx
components/social/feed-milestone-card.tsx
components/social/feed-highlight-card.tsx
components/social/like-button.tsx
components/social/share-trade-sheet.tsx
components/social/leaderboard-table.tsx
components/social/achievement-gallery.tsx
components/social/community-highlights.tsx
components/social/community-stats-bar.tsx

# Social Trade Card Generator
lib/social/trade-card-generator.ts

# Edge Functions
supabase/functions/compute-leaderboards/index.ts

# Pages
app/members/social/page.tsx                            # NEW page
app/members/profile/page.tsx                           # REWRITE existing

# Tests
lib/validation/__tests__/social.test.ts
e2e/social.spec.ts

# Documentation
docs/social/PROFILE_HUB.md
docs/social/TRADE_SOCIAL.md
docs/social/PRIVACY.md
docs/api/SOCIAL_API.md
docs/social/WHOP_INTEGRATION.md
```

### Files to Modify

```
app/members/profile/page.tsx                           # Complete rewrite
components/journal/entry-detail-sheet.tsx               # Add "Share to Community" button
contexts/MemberAuthContext.tsx                          # Add MemberProfile to context (optional)
```

---

## Appendix B — Environment Variables

### New Variables Required

```bash
# WHOP Integration
WHOP_API_KEY=whop_sk_...                               # WHOP Company API key
WHOP_WEBHOOK_SECRET=whsec_...                          # WHOP webhook signing secret
WHOP_COMPANY_ID=biz_...                                # WHOP Company ID
WHOP_DEFAULT_AFFILIATE_PLAN=plan_...                   # Default affiliate plan ID
```

### Existing Variables (no changes)

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```
