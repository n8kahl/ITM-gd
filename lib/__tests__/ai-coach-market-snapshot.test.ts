import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

import {
  formatAICoachAgeLabel,
  formatAICoachFreshnessLabel,
  resolveAICoachMarketFreshnessStatus,
} from '@/lib/ai-coach/market-snapshot'

describe('ai coach market snapshot freshness', () => {
  it('marks closed market status as market-closed even when age is old', () => {
    const status = resolveAICoachMarketFreshnessStatus({
      marketStatus: 'closed',
      source: 'massive',
      ageMs: 5 * 60_000,
    })

    expect(status).toBe('market-closed')
    expect(formatAICoachFreshnessLabel(status)).toBe('Market Closed')
  })

  it('marks fallback source as stale during active market session', () => {
    const status = resolveAICoachMarketFreshnessStatus({
      marketStatus: 'open',
      source: 'fallback',
      ageMs: 1_000,
    })

    expect(status).toBe('stale')
    expect(formatAICoachFreshnessLabel(status)).toBe('Stale')
  })

  it('classifies age thresholds into live, delayed, and stale', () => {
    expect(resolveAICoachMarketFreshnessStatus({
      marketStatus: 'open',
      source: 'massive',
      ageMs: 10_000,
    })).toBe('live')

    expect(resolveAICoachMarketFreshnessStatus({
      marketStatus: 'open',
      source: 'massive',
      ageMs: 45_000,
    })).toBe('delayed')

    expect(resolveAICoachMarketFreshnessStatus({
      marketStatus: 'open',
      source: 'massive',
      ageMs: 150_000,
    })).toBe('stale')
  })

  it('formats freshness age labels for seconds and minutes', () => {
    expect(formatAICoachAgeLabel(900)).toBe('<1s old')
    expect(formatAICoachAgeLabel(12_000)).toBe('12s old')
    expect(formatAICoachAgeLabel(75_000)).toBe('1m old')
  })
})
