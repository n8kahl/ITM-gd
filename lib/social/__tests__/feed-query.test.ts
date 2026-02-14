import { describe, expect, it } from 'vitest'
import { buildFeedVisibilityFilter } from '@/lib/social/feed-query'

describe('buildFeedVisibilityFilter', () => {
  it('returns visibility filter with owner-private clause', () => {
    const filter = buildFeedVisibilityFilter('123e4567-e89b-12d3-a456-426614174000')
    expect(filter).toContain('visibility.in.(public,members)')
    expect(filter).toContain('visibility.eq.private')
    expect(filter).toContain('user_id.eq.123e4567-e89b-12d3-a456-426614174000')
  })

  it('strips unexpected characters from user id', () => {
    const filter = buildFeedVisibilityFilter('123e4567-e89b-12d3-a456-426614174000);drop')
    expect(filter).not.toContain('drop')
    expect(filter).toContain('user_id.eq.123e4567-e89b-12d3-a456-426614174000')
  })
})
