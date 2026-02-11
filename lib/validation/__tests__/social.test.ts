import { describe, expect, it } from 'vitest'
import {
  memberProfileUpdateSchema,
  feedQuerySchema,
  leaderboardQuerySchema,
  shareTradeCardSchema,
  createFeedItemSchema,
} from '@/lib/validation/social'

describe('memberProfileUpdateSchema', () => {
  it('accepts valid nested updates', () => {
    const parsed = memberProfileUpdateSchema.parse({
      privacy_settings: {
        show_transcript: false,
        profile_visibility: 'members',
      },
      ai_preferences: {
        risk_tolerance: 'moderate',
        preferred_symbols: ['spy', 'aapl'],
      },
    })

    expect(parsed.privacy_settings?.show_transcript).toBe(false)
    expect(parsed.ai_preferences?.preferred_symbols).toEqual(['SPY', 'AAPL'])
  })

  it('rejects invalid profile visibility', () => {
    const result = memberProfileUpdateSchema.safeParse({
      privacy_settings: {
        profile_visibility: 'everyone',
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects empty payload', () => {
    const result = memberProfileUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects too many preferred symbols', () => {
    const result = memberProfileUpdateSchema.safeParse({
      ai_preferences: {
        preferred_symbols: Array.from({ length: 21 }, (_, idx) => `SYM${idx}`),
      },
    })

    expect(result.success).toBe(false)
  })
})

describe('createFeedItemSchema', () => {
  it('accepts a valid feed item payload', () => {
    const parsed = createFeedItemSchema.parse({
      item_type: 'trade_card',
      reference_id: '65f5874a-2c75-4fe7-a4b5-833a42267137',
      reference_table: 'shared_trade_cards',
      display_data: { symbol: 'SPY' },
    })

    expect(parsed.visibility).toBe('public')
  })

  it('rejects unsupported feed item type', () => {
    const result = createFeedItemSchema.safeParse({
      item_type: 'highlight',
      reference_id: '65f5874a-2c75-4fe7-a4b5-833a42267137',
      reference_table: 'social_feed_items',
      display_data: {},
    })

    expect(result.success).toBe(false)
  })
})

describe('feedQuerySchema', () => {
  it('applies expected defaults', () => {
    const parsed = feedQuerySchema.parse({})
    expect(parsed.type).toBe('all')
    expect(parsed.sort).toBe('latest')
    expect(parsed.featured_only).toBe(false)
    expect(parsed.limit).toBe(20)
  })

  it('accepts top_pnl sort', () => {
    const parsed = feedQuerySchema.parse({ sort: 'top_pnl' })
    expect(parsed.sort).toBe('top_pnl')
  })

  it('rejects invalid cursor', () => {
    const result = feedQuerySchema.safeParse({ cursor: 'not-a-date' })
    expect(result.success).toBe(false)
  })
})

describe('leaderboardQuerySchema', () => {
  it('accepts valid leaderboard query', () => {
    const parsed = leaderboardQuerySchema.parse({
      period: 'monthly',
      category: 'discipline_score',
      limit: 50,
    })

    expect(parsed.period).toBe('monthly')
    expect(parsed.category).toBe('discipline_score')
    expect(parsed.limit).toBe(50)
  })
})

describe('shareTradeCardSchema', () => {
  it('validates share payload and defaults discord flag', () => {
    const parsed = shareTradeCardSchema.parse({
      journal_entry_id: '65f5874a-2c75-4fe7-a4b5-833a42267137',
      template: 'dark-elite',
      visibility: 'members',
    })

    expect(parsed.share_to_discord).toBe(false)
  })

  it('rejects unsupported template', () => {
    const result = shareTradeCardSchema.safeParse({
      journal_entry_id: '65f5874a-2c75-4fe7-a4b5-833a42267137',
      template: 'clean',
    })

    expect(result.success).toBe(false)
  })
})
