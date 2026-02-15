import { describe, expect, it } from 'vitest'

import { classifyRegime } from '@/lib/spx/engine'

describe('classifyRegime', () => {
  it('classifies breakout when strength and volume surge', () => {
    const regime = classifyRegime({
      netGex: -120000,
      volumeTrend: 'rising',
      rangeCompression: 0.2,
      breakoutStrength: 0.8,
      zoneContainment: 0.1,
    })

    expect(regime).toBe('breakout')
  })

  it('classifies compression when range tightens and volume fades', () => {
    const regime = classifyRegime({
      netGex: 240000,
      volumeTrend: 'falling',
      rangeCompression: 0.8,
      breakoutStrength: 0.3,
      zoneContainment: 0.7,
    })

    expect(regime).toBe('compression')
  })
})
