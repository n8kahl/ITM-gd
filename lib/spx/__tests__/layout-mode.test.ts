import { describe, expect, it } from 'vitest'

import { resolveSPXLayoutMode } from '@/lib/spx/layout-mode'
import type { Setup } from '@/lib/types/spx-command-center'

const baseSetup: Setup = {
  id: 'setup-1',
  type: 'fade_at_wall',
  direction: 'bullish',
  entryZone: { low: 6028, high: 6030 },
  stop: 6024,
  target1: { price: 6038, label: 'Target 1' },
  target2: { price: 6044, label: 'Target 2' },
  confluenceScore: 4,
  confluenceSources: ['level_quality'],
  clusterZone: {
    id: 'cluster-1',
    priceLow: 6028,
    priceHigh: 6032,
    clusterScore: 4.2,
    type: 'defended',
    sources: [
      { source: 'spx_call_wall', category: 'options', price: 6030, instrument: 'SPX' },
    ],
    testCount: 1,
    lastTestAt: '2026-02-19T00:00:00.000Z',
    held: true,
    holdRate: 0.68,
  },
  regime: 'compression',
  status: 'ready',
  probability: 67,
  recommendedContract: null,
  createdAt: '2026-02-19T00:00:00.000Z',
  triggeredAt: null,
}

describe('resolveSPXLayoutMode', () => {
  it('returns legacy mode when state-machine flag is disabled', () => {
    expect(resolveSPXLayoutMode({
      enabled: false,
      tradeMode: 'scan',
      selectedSetup: baseSetup,
    })).toBe('legacy')
  })

  it('returns in_trade when user is in trade focus', () => {
    expect(resolveSPXLayoutMode({
      enabled: true,
      tradeMode: 'in_trade',
      selectedSetup: baseSetup,
    })).toBe('in_trade')
  })

  it('returns evaluate when selected setup is actionable', () => {
    expect(resolveSPXLayoutMode({
      enabled: true,
      tradeMode: 'scan',
      selectedSetup: {
        ...baseSetup,
        status: 'triggered',
      },
    })).toBe('evaluate')
  })

  it('returns scan when selected setup is not actionable or missing', () => {
    expect(resolveSPXLayoutMode({
      enabled: true,
      tradeMode: 'scan',
      selectedSetup: {
        ...baseSetup,
        status: 'forming',
      },
    })).toBe('scan')

    expect(resolveSPXLayoutMode({
      enabled: true,
      tradeMode: 'scan',
      selectedSetup: null,
    })).toBe('scan')
  })
})
