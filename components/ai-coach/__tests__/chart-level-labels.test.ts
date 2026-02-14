import { describe, expect, it } from 'vitest'
import {
  resolveContext,
  sortLevelsByDistance,
  type ChartLevel,
} from '../chart-level-labels'

describe('chart-level-labels helpers', () => {
  it('sorts levels by absolute distance from current price', () => {
    const levels: ChartLevel[] = [
      { label: 'Far', price: 6200 },
      { label: 'Near', price: 6010 },
      { label: 'Mid', price: 6075 },
    ]

    const sorted = sortLevelsByDistance(levels, 6000, 3)
    expect(sorted.map((level) => level.label)).toEqual(['Near', 'Mid', 'Far'])
  })

  it('builds precise fallback context with points and percent', () => {
    const context = resolveContext(
      {
        label: 'PDH',
        price: 6050,
        side: 'resistance',
      },
      6000,
    )

    expect(context).toContain('+50.00 pts')
    expect(context).toContain('+0.83%')
  })
})
