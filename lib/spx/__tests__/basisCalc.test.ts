import { describe, expect, it } from 'vitest'

import { computeBasisState } from '@/lib/spx/engine'

describe('computeBasisState', () => {
  it('calculates SPX/SPY basis and trend', () => {
    const basis = computeBasisState({
      spxPrice: 5900,
      spyPrice: 589,
      basisHistory: [6, 7, 8, 9],
    })

    expect(basis.current).toBeCloseTo(10, 2)
    expect(['expanding', 'stable', 'contracting']).toContain(basis.trend)
    expect(basis.ema5).toBeGreaterThan(0)
  })

  it('flags SPY leading when basis collapses', () => {
    const basis = computeBasisState({
      spxPrice: 5880,
      spyPrice: 589,
      basisHistory: [8, 8.2, 7.8, 7.6, 7.4],
    })

    expect(basis.leading).toBe('SPY')
  })
})
