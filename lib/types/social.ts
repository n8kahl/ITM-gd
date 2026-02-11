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
