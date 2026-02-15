import { describe, expect, it } from 'vitest'
import { buildClusterZones } from '@/lib/spx/engine'
import type { SPXLevel } from '@/lib/types/spx-command-center'

function makeLevel(id: string, category: SPXLevel['category'], price: number): SPXLevel {
  return {
    id,
    symbol: 'SPX',
    category,
    source: id,
    price,
    strength: 'strong',
    timeframe: 'daily',
    metadata: {},
    chartStyle: {
      color: 'rgba(255,255,255,0.6)',
      lineStyle: 'solid',
      lineWidth: 1,
      labelFormat: id,
    },
  }
}

describe('buildClusterZones', () => {
  it('groups nearby levels and classifies fortress zones', () => {
    const levels: SPXLevel[] = [
      makeLevel('a', 'structural', 5900),
      makeLevel('b', 'options', 5901),
      makeLevel('c', 'fibonacci', 5902),
      makeLevel('d', 'tactical', 5902.5),
      makeLevel('e', 'intraday', 5903),
    ]

    const zones = buildClusterZones(levels)

    expect(zones).toHaveLength(1)
    expect(zones[0].type).toBe('fortress')
    expect(zones[0].clusterScore).toBeGreaterThanOrEqual(5)
  })

  it('separates distant levels into different zones', () => {
    const levels: SPXLevel[] = [
      makeLevel('a', 'structural', 5850),
      makeLevel('b', 'options', 5851),
      makeLevel('c', 'intraday', 5920),
    ]

    const zones = buildClusterZones(levels)

    expect(zones.length).toBeGreaterThanOrEqual(2)
    expect(zones[0].priceHigh).toBeLessThan(zones[zones.length - 1].priceLow)
  })
})
