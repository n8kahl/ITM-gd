import { describe, expect, it } from 'vitest'
import type { FibonacciLevelsResponse } from '@/lib/api/ai-coach'
import {
  mapChartTimeframeToFibTimeframe,
  mapFibonacciResponseToAnnotations,
  mergeLevelAnnotations,
} from '../chart-level-utils'

describe('chart-level-utils', () => {
  it('maps unsupported chart timeframes to closest fibonacci timeframe', () => {
    expect(mapChartTimeframeToFibTimeframe('1m')).toBe('5m')
    expect(mapChartTimeframeToFibTimeframe('4h')).toBe('1h')
    expect(mapChartTimeframeToFibTimeframe('1D')).toBe('daily')
  })

  it('maps fibonacci response into chart annotations with emphasized major levels', () => {
    const response: FibonacciLevelsResponse = {
      symbol: 'SPX',
      timeframe: '5m',
      direction: 'retracement',
      levels: {
        level_0: 6100,
        level_236: 6075,
        level_382: 6050,
        level_500: 6030,
        level_618: 6010,
        level_786: 5990,
        level_100: 5960,
      },
      currentPrice: 6042,
      calculatedAt: new Date().toISOString(),
    }

    const annotations = mapFibonacciResponseToAnnotations(response)
    expect(annotations).toHaveLength(7)
    expect(annotations[2]).toMatchObject({
      label: 'Fib 38.2%',
      lineWidth: 2,
      strength: 'strong',
    })
    expect(annotations[4]).toMatchObject({
      label: 'Fib 61.8%',
      lineWidth: 2,
      strength: 'strong',
    })
  })

  it('deduplicates levels while preserving order', () => {
    const merged = mergeLevelAnnotations(
      [
        { price: 6000, label: 'Pivot', color: '#fff' },
        { price: 6050, label: 'Fib 38.2%', color: '#aaa' },
      ],
      [
        { price: 6050, label: 'Fib 38.2%', color: '#bbb' },
        { price: 6010, label: 'Fib 61.8%', color: '#bbb' },
      ],
    )

    expect(merged).toHaveLength(3)
    expect(merged.map((level) => level.label)).toEqual([
      'Pivot',
      'Fib 38.2%',
      'Fib 61.8%',
    ])
  })
})
