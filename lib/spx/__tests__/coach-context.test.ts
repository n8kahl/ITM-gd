import { describe, expect, it } from 'vitest'

import { distanceToStopPoints, isFlowDivergence, summarizeFlowAlignment } from '@/lib/spx/coach-context'

describe('coach context helpers', () => {
  it('summarizes directional flow alignment', () => {
    const summary = summarizeFlowAlignment([
      { direction: 'bullish', premium: 120_000 },
      { direction: 'bearish', premium: 80_000 },
      { direction: 'bullish', premium: 20_000 },
    ], 'bullish')

    expect(summary).not.toBeNull()
    expect(summary?.alignmentPct).toBe(64)
    expect(summary?.bullishPremium).toBe(140_000)
    expect(summary?.bearishPremium).toBe(80_000)
  })

  it('detects divergence threshold correctly', () => {
    expect(isFlowDivergence(41)).toBe(true)
    expect(isFlowDivergence(42)).toBe(false)
    expect(isFlowDivergence(35, 38)).toBe(true)
  })

  it('computes directional distance to stop', () => {
    expect(distanceToStopPoints(6040, { direction: 'bullish', stop: 6036 })).toBe(4)
    expect(distanceToStopPoints(6032, { direction: 'bearish', stop: 6036 })).toBe(4)
  })
})
