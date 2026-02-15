import { describe, expect, it } from 'vitest'

import { makeFibLevelsFromRange } from '@/lib/spx/engine'

describe('makeFibLevelsFromRange', () => {
  it('computes retracement and extension levels', () => {
    const levels = makeFibLevelsFromRange({
      swingHigh: 6000,
      swingLow: 5900,
      timeframe: 'daily',
      crossValidated: true,
    })

    const level618 = levels.find((level) => level.ratio === 0.618)
    expect(level618).toBeDefined()
    expect(level618?.price).toBeCloseTo(5938.2, 1)
    expect(level618?.crossValidated).toBe(true)

    const extension = levels.find((level) => level.ratio === 1.618)
    expect(extension?.direction).toBe('extension')
  })
})
