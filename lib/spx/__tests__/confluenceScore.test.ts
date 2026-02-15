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
