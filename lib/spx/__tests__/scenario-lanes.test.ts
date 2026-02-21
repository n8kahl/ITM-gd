import { describe, expect, it } from 'vitest'

import { buildSPXScenarioLanes } from '@/lib/spx/scenario-lanes'
import type { Setup } from '@/lib/types/spx-command-center'

function setupFixture(partial?: Partial<Setup>): Setup {
  return {
    id: 'setup-1',
    type: 'trend_continuation',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6023.5,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6046, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['regime_alignment', 'flow_confirmation'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6028,
      priceHigh: 6030,
      clusterScore: 4.2,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: null,
      held: true,
      holdRate: 67,
    },
    regime: 'trending',
    status: 'ready',
    probability: 66,
    recommendedContract: null,
    createdAt: '2026-02-21T14:00:00.000Z',
    triggeredAt: null,
    ...partial,
  }
}

describe('scenario lanes', () => {
  it('returns base, adverse, and acceleration lanes for bullish setup', () => {
    const lanes = buildSPXScenarioLanes(setupFixture(), 6031.25)
    expect(lanes).toHaveLength(3)
    expect(lanes.map((lane) => lane.type)).toEqual(['base', 'adverse', 'acceleration'])
    expect(lanes[0]?.price).toBe(6031.25)
    expect(lanes[1]?.price).toBeLessThan(lanes[0]!.price)
    expect(lanes[2]?.price).toBeGreaterThan(lanes[0]!.price)
  })

  it('returns directional lanes for bearish setup', () => {
    const lanes = buildSPXScenarioLanes(setupFixture({
      direction: 'bearish',
      stop: 6042,
      target1: { price: 6012, label: 'T1' },
      target2: { price: 6002, label: 'T2' },
    }), 6020)
    expect(lanes).toHaveLength(3)
    expect(lanes[1]?.price).toBeGreaterThan(lanes[0]!.price)
    expect(lanes[2]?.price).toBeLessThan(lanes[0]!.price)
  })
})
