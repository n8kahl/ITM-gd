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
