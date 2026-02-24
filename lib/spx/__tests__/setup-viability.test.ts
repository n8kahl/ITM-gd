import { describe, expect, it } from 'vitest'

import { hasSetupPriceProgressionConflict } from '@/lib/spx/setup-viability'
import type { Setup } from '@/lib/types/spx-command-center'

function buildSetup(partial?: Partial<Setup>): Setup {
  return {
    id: partial?.id ?? 'setup-1',
    type: partial?.type ?? 'mean_reversion',
    direction: partial?.direction ?? 'bullish',
    entryZone: partial?.entryZone ?? { low: 6888, high: 6890 },
    stop: partial?.stop ?? 6882,
    target1: partial?.target1 ?? { price: 6893, label: 'T1' },
    target2: partial?.target2 ?? { price: 6896, label: 'T2' },
    confluenceScore: partial?.confluenceScore ?? 3.8,
    confluenceSources: partial?.confluenceSources ?? ['flow_confirmation'],
    clusterZone: partial?.clusterZone ?? {
      id: 'cluster-1',
      priceLow: 6887.5,
      priceHigh: 6890.5,
      clusterScore: 4.1,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: '2026-02-24T14:00:00.000Z',
      held: true,
      holdRate: 66,
    },
    regime: partial?.regime ?? 'ranging',
    status: partial?.status ?? 'ready',
    probability: partial?.probability ?? 62,
    recommendedContract: partial?.recommendedContract ?? null,
    createdAt: partial?.createdAt ?? '2026-02-24T14:00:00.000Z',
    triggeredAt: partial?.triggeredAt ?? null,
  }
}

describe('setup viability guard', () => {
  it('flags bullish pre-trigger setup when price has reached target1', () => {
    const setup = buildSetup({ direction: 'bullish', status: 'ready' })
    expect(hasSetupPriceProgressionConflict(setup, 6893)).toBe(true)
  })

  it('flags bearish pre-trigger setup when price has reached target1', () => {
    const setup = buildSetup({
      direction: 'bearish',
      status: 'forming',
      target1: { price: 6886, label: 'T1' },
    })
    expect(hasSetupPriceProgressionConflict(setup, 6886)).toBe(true)
  })

  it('does not flag triggered setups', () => {
    const setup = buildSetup({ status: 'triggered' })
    expect(hasSetupPriceProgressionConflict(setup, 6900)).toBe(false)
  })

  it('does not flag when price has not reached target1', () => {
    const setup = buildSetup({ direction: 'bullish', target1: { price: 6895, label: 'T1' } })
    expect(hasSetupPriceProgressionConflict(setup, 6892)).toBe(false)
  })

  it('does not flag invalid price values', () => {
    const setup = buildSetup()
    expect(hasSetupPriceProgressionConflict(setup, 0)).toBe(false)
    expect(hasSetupPriceProgressionConflict(setup, Number.NaN)).toBe(false)
  })
})
