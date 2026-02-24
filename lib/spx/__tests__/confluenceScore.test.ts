import { describe, expect, it } from 'vitest'

import { calculateConfluence } from '@/lib/spx/engine'

describe('calculateConfluence', () => {
  it('scores all signal layers', () => {
    const result = calculateConfluence({
      zoneType: 'fortress',
      gexAligned: true,
      flowConfirmed: true,
      fibTouch: true,
      regimeAligned: true,
    })

    expect(result.score).toBe(5)
    expect(result.sources).toHaveLength(5)
  })

  it('does not score weak zone quality', () => {
    const result = calculateConfluence({
      zoneType: 'minor',
      gexAligned: false,
      flowConfirmed: false,
      fibTouch: false,
      regimeAligned: true,
    })

    expect(result.score).toBe(1)
    expect(result.sources).toEqual(['regime_alignment'])
  })
})

describe('memory edge confluence bonus', () => {
  function memoryEdgeBonus(input: {
    winRate: number
    totalTests: number
    regimeCompatibility: number
  }): number {
    if (input.winRate < 0.55) return 0
    if (input.totalTests < 5) return 0
    if (input.regimeCompatibility < 0.65) return 0
    return Math.min(1, (input.winRate - 0.5) * 2)
  }

  it('scales to 0.2 at winRate=0.60 with sufficient tests and regime alignment', () => {
    expect(memoryEdgeBonus({ winRate: 0.6, totalTests: 10, regimeCompatibility: 0.8 })).toBeCloseTo(0.2, 6)
  })

  it('scales to 0.5 at winRate=0.75 with sufficient tests and regime alignment', () => {
    expect(memoryEdgeBonus({ winRate: 0.75, totalTests: 8, regimeCompatibility: 0.7 })).toBeCloseTo(0.5, 6)
  })

  it('returns 0 when winRate is below 0.55', () => {
    expect(memoryEdgeBonus({ winRate: 0.5, totalTests: 10, regimeCompatibility: 0.8 })).toBe(0)
  })

  it('returns 0 when sample size is below 5', () => {
    expect(memoryEdgeBonus({ winRate: 0.7, totalTests: 3, regimeCompatibility: 0.8 })).toBe(0)
  })

  it('returns 0 when regime compatibility is below 0.65', () => {
    expect(memoryEdgeBonus({ winRate: 0.7, totalTests: 10, regimeCompatibility: 0.4 })).toBe(0)
  })
})
