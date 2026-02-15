import { describe, expect, it } from 'vitest'

import { recommendContract } from '@/lib/spx/engine'
import type { Setup } from '@/lib/types/spx-command-center'

const setup: Setup = {
  id: 'setup-2',
  type: 'trend_continuation',
  direction: 'bullish',
  entryZone: { low: 5896, high: 5899 },
  stop: 5892,
  target1: { price: 5908, label: 'TP1' },
  target2: { price: 5920, label: 'TP2' },
  confluenceScore: 4,
  confluenceSources: ['gex_alignment'],
  clusterZone: {
    id: 'zone-2',
    priceLow: 5894,
    priceHigh: 5900,
    clusterScore: 4.2,
    type: 'defended',
    sources: [],
    testCount: 0,
    lastTestAt: null,
    held: null,
    holdRate: null,
  },
  regime: 'trending',
  status: 'ready',
  probability: 71,
  recommendedContract: null,
  createdAt: '2026-02-15T15:00:00.000Z',
  triggeredAt: null,
}

describe('recommendContract', () => {
  it('selects best matching contract and computes R:R', () => {
    const recommendation = recommendContract(setup, [
      {
        strike: 5900,
        expiry: '2026-02-15',
        type: 'call',
        delta: 0.29,
        gamma: 0.08,
        theta: -0.41,
        vega: 0.11,
        bid: 4.6,
        ask: 4.8,
      },
      {
        strike: 5910,
        expiry: '2026-02-15',
        type: 'call',
        delta: 0.18,
        gamma: 0.05,
        theta: -0.31,
        vega: 0.08,
        bid: 2.2,
        ask: 2.4,
      },
    ])

    expect(recommendation).not.toBeNull()
    expect(recommendation?.type).toBe('call')
    expect(recommendation?.riskReward).toBeGreaterThan(1)
    expect(recommendation?.maxLoss).toBeGreaterThan(0)
  })
})
