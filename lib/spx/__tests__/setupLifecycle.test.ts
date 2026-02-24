import { describe, expect, it } from 'vitest'

import { transitionSetupStatus } from '@/lib/spx/engine'
import type { Setup } from '@/lib/types/spx-command-center'

const baseSetup: Setup = {
  id: 'setup-1',
  type: 'fade_at_wall',
  direction: 'bearish',
  entryZone: { low: 5902, high: 5905 },
  stop: 5909,
  target1: { price: 5893, label: 'TP1' },
  target2: { price: 5884, label: 'TP2' },
  confluenceScore: 2,
  confluenceSources: [],
  clusterZone: {
    id: 'zone-1',
    priceLow: 5901,
    priceHigh: 5906,
    clusterScore: 5.2,
    type: 'fortress',
    sources: [],
    testCount: 0,
    lastTestAt: null,
    held: null,
    holdRate: null,
  },
  regime: 'ranging',
  status: 'forming',
  probability: 68,
  recommendedContract: null,
  createdAt: '2026-02-15T14:00:00.000Z',
  triggeredAt: null,
}

describe('transitionSetupStatus', () => {
  it('promotes setup from forming to ready at confluence >= 3', () => {
    const next = transitionSetupStatus(baseSetup, {
      currentPrice: 5907,
      nowIso: '2026-02-15T14:05:00.000Z',
      confluenceScore: 3,
    })

    expect(next).toBe('ready')
  })

  it('marks setup triggered when price enters entry zone', () => {
    const next = transitionSetupStatus(
      { ...baseSetup, status: 'ready', confluenceScore: 4 },
      {
        currentPrice: 5904,
        nowIso: '2026-02-15T14:06:00.000Z',
      },
    )

    expect(next).toBe('triggered')
  })

  it('marks setup triggered when bar is confirmed and latest bar close enters entry zone', () => {
    const next = transitionSetupStatus(
      { ...baseSetup, status: 'ready', confluenceScore: 4 },
      {
        currentPrice: 5910,
        latestBarClose: 5904,
        barConfirmed: true,
        nowIso: '2026-02-15T14:06:00.000Z',
      },
    )

    expect(next).toBe('triggered')
  })

  it('keeps setup ready when bar is not confirmed even if price is in entry zone', () => {
    const next = transitionSetupStatus(
      { ...baseSetup, status: 'ready', confluenceScore: 4 },
      {
        currentPrice: 5904,
        barConfirmed: false,
        nowIso: '2026-02-15T14:06:00.000Z',
      },
    )

    expect(next).toBe('ready')
  })

  it('preserves legacy behavior when barConfirmed is undefined', () => {
    const next = transitionSetupStatus(
      { ...baseSetup, status: 'ready', confluenceScore: 4 },
      {
        currentPrice: 5904,
        nowIso: '2026-02-15T14:06:00.000Z',
      },
    )

    expect(next).toBe('triggered')
  })

  it('keeps setup ready when latest bar close is outside entry zone even if current price is inside', () => {
    const next = transitionSetupStatus(
      { ...baseSetup, status: 'ready', confluenceScore: 4 },
      {
        currentPrice: 5904,
        latestBarClose: 5906,
        barConfirmed: true,
        nowIso: '2026-02-15T14:06:00.000Z',
      },
    )

    expect(next).toBe('ready')
  })

  it.each([5902, 5905])(
    'triggers at entry zone boundary when bar close is %d',
    (boundaryClose) => {
      const next = transitionSetupStatus(
        { ...baseSetup, status: 'ready', confluenceScore: 4 },
        {
          currentPrice: 5910,
          latestBarClose: boundaryClose,
          barConfirmed: true,
          nowIso: '2026-02-15T14:06:00.000Z',
        },
      )

      expect(next).toBe('triggered')
    },
  )

  it('expires setup after 30 minutes without trigger', () => {
    const next = transitionSetupStatus(baseSetup, {
      currentPrice: 5909,
      nowIso: '2026-02-15T14:40:01.000Z',
    })

    expect(next).toBe('expired')
  })
})
