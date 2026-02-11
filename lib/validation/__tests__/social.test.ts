import { describe, it, expect } from 'vitest'
import { memberProfileUpdateSchema, feedQuerySchema, shareTradeCardSchema, createFeedItemSchema, leaderboardQuerySchema } from '../social'

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

  it('accepts null values for nullable fields', () => {
    const result = memberProfileUpdateSchema.safeParse({
      display_name: null,
      bio: null,
      tagline: null,
      trading_style: null,
      whop_affiliate_url: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    const result = memberProfileUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('validates notification_preferences', () => {
    const result = memberProfileUpdateSchema.safeParse({
      notification_preferences: {
        feed_likes: false,
        feed_comments: false,
        leaderboard_changes: true,
        achievement_earned: true,
        weekly_digest: false,
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects notification_preferences with missing fields', () => {
    const result = memberProfileUpdateSchema.safeParse({
      notification_preferences: {
        feed_likes: false,
      },
    })
    expect(result.success).toBe(false)
  })

  it('validates ai_preferences', () => {
    const result = memberProfileUpdateSchema.safeParse({
      ai_preferences: {
        risk_tolerance: 'aggressive',
        preferred_symbols: ['SPY', 'QQQ', 'AAPL'],
        trading_style_notes: 'Focus on momentum setups',
        account_size_range: '25k-50k',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai_preferences with invalid risk_tolerance', () => {
    const result = memberProfileUpdateSchema.safeParse({
      ai_preferences: {
        risk_tolerance: 'yolo',
        preferred_symbols: [],
        trading_style_notes: '',
        account_size_range: '',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai_preferences with too many symbols', () => {
    const result = memberProfileUpdateSchema.safeParse({
      ai_preferences: {
        risk_tolerance: 'moderate',
        preferred_symbols: Array.from({ length: 21 }, (_, i) => `SYM${i}`),
        trading_style_notes: '',
        account_size_range: '',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects tagline over 120 chars', () => {
    const result = memberProfileUpdateSchema.safeParse({
      tagline: 'A'.repeat(121),
    })
    expect(result.success).toBe(false)
  })

  it('accepts exact max length values', () => {
    const result = memberProfileUpdateSchema.safeParse({
      display_name: 'A'.repeat(50),
      bio: 'B'.repeat(500),
      tagline: 'C'.repeat(120),
    })
    expect(result.success).toBe(true)
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

  it('rejects limit of 0', () => {
    const result = feedQuerySchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('accepts valid cursor', () => {
    const result = feedQuerySchema.safeParse({
      cursor: '2026-02-10T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid cursor format', () => {
    const result = feedQuerySchema.safeParse({
      cursor: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid item types', () => {
    for (const type of ['all', 'trade_card', 'achievement', 'milestone', 'highlight']) {
      const result = feedQuerySchema.safeParse({ type })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid item type', () => {
    const result = feedQuerySchema.safeParse({ type: 'post' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid sort options', () => {
    for (const sort of ['latest', 'most_liked', 'top_pnl']) {
      const result = feedQuerySchema.safeParse({ sort })
      expect(result.success).toBe(true)
    }
  })

  it('coerces featured_only string to boolean', () => {
    const result = feedQuerySchema.safeParse({ featured_only: 'true' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.featured_only).toBe(true)
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

  it('accepts all valid templates', () => {
    for (const template of ['dark-elite', 'emerald-gradient', 'champagne-premium', 'minimal', 'story']) {
      const result = shareTradeCardSchema.safeParse({
        journal_entry_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        template,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid visibility options', () => {
    for (const visibility of ['public', 'members', 'private']) {
      const result = shareTradeCardSchema.safeParse({
        journal_entry_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        visibility,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts share_to_discord as true', () => {
    const result = shareTradeCardSchema.safeParse({
      journal_entry_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      share_to_discord: true,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.share_to_discord).toBe(true)
  })
})

describe('createFeedItemSchema', () => {
  it('validates a valid feed item creation', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'trade_card',
      reference_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reference_table: 'shared_trade_cards',
      display_data: { symbol: 'SPY', pnl: 1500 },
      visibility: 'public',
    })
    expect(result.success).toBe(true)
  })

  it('uses default visibility', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'achievement',
      reference_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reference_table: 'user_achievements',
      display_data: { title: 'First Trade' },
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.visibility).toBe('public')
  })

  it('rejects invalid item_type', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'post',
      reference_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reference_table: 'posts',
      display_data: {},
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid reference_id', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'trade_card',
      reference_id: 'not-a-uuid',
      reference_table: 'shared_trade_cards',
      display_data: {},
    })
    expect(result.success).toBe(false)
  })

  it('accepts milestone item type', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'milestone',
      reference_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reference_table: 'user_achievements',
      display_data: { type: 'streak', value: 10 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects highlight item type (admin only)', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'highlight',
      reference_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reference_table: 'highlights',
      display_data: {},
    })
    expect(result.success).toBe(false)
  })
})

describe('leaderboardQuerySchema', () => {
  it('uses defaults for empty query', () => {
    const result = leaderboardQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe('weekly')
      expect(result.data.category).toBe('win_rate')
      expect(result.data.limit).toBe(10)
    }
  })

  it('accepts valid period and category', () => {
    const result = leaderboardQuerySchema.safeParse({
      period: 'monthly',
      category: 'total_pnl',
      limit: '50',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe('monthly')
      expect(result.data.category).toBe('total_pnl')
      expect(result.data.limit).toBe(50)
    }
  })

  it('accepts all valid periods', () => {
    for (const period of ['weekly', 'monthly', 'all_time']) {
      const result = leaderboardQuerySchema.safeParse({ period })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid categories', () => {
    for (const category of ['win_rate', 'total_pnl', 'longest_streak', 'academy_xp', 'discipline_score', 'trade_count']) {
      const result = leaderboardQuerySchema.safeParse({ category })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid period', () => {
    const result = leaderboardQuerySchema.safeParse({ period: 'daily' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = leaderboardQuerySchema.safeParse({ category: 'avg_pnl' })
    expect(result.success).toBe(false)
  })

  it('rejects limit over 100', () => {
    const result = leaderboardQuerySchema.safeParse({ limit: 200 })
    expect(result.success).toBe(false)
  })

  it('coerces limit string to number', () => {
    const result = leaderboardQuerySchema.safeParse({ limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(25)
  })
})
