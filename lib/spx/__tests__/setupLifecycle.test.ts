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

  it.each([
    { regime: 'trending', status: 'forming', ttlMinutes: 15 },
    { regime: 'trending', status: 'ready', ttlMinutes: 25 },
    { regime: 'trending', status: 'triggered', ttlMinutes: 20 },
    { regime: 'breakout', status: 'forming', ttlMinutes: 10 },
    { regime: 'breakout', status: 'ready', ttlMinutes: 20 },
    { regime: 'breakout', status: 'triggered', ttlMinutes: 15 },
    { regime: 'compression', status: 'forming', ttlMinutes: 30 },
    { regime: 'compression', status: 'ready', ttlMinutes: 50 },
    { regime: 'compression', status: 'triggered', ttlMinutes: 30 },
    { regime: 'ranging', status: 'forming', ttlMinutes: 25 },
    { regime: 'ranging', status: 'ready', ttlMinutes: 45 },
    { regime: 'ranging', status: 'triggered', ttlMinutes: 25 },
  ] as const)(
    'uses regime-aware TTL for $regime $status',
    ({ regime, status, ttlMinutes }) => {
      const setup = {
        ...baseSetup,
        regime,
        status,
      } as Setup
      const atTtlMinusOneSecond = new Date('2026-02-15T14:00:00.000Z').getTime() + (ttlMinutes * 60_000) - 1_000
      const atTtlPlusOneSecond = new Date('2026-02-15T14:00:00.000Z').getTime() + (ttlMinutes * 60_000) + 1_000

      const beforeTtl = transitionSetupStatus(setup, {
        currentPrice: 5909,
        nowIso: new Date(atTtlMinusOneSecond).toISOString(),
      })
      expect(beforeTtl).toBe(status)

      const afterTtl = transitionSetupStatus(setup, {
        currentPrice: 5909,
        nowIso: new Date(atTtlPlusOneSecond).toISOString(),
      })
      expect(afterTtl).toBe(status === 'triggered' ? 'triggered' : 'expired')
    },
  )

  it('keeps legacy 30-minute default TTL when regime is missing', () => {
    const setupWithoutRegime = {
      ...baseSetup,
    } as unknown as Setup
    delete (setupWithoutRegime as Partial<Setup>).regime

    const at29m59s = transitionSetupStatus(setupWithoutRegime, {
      currentPrice: 5909,
      nowIso: '2026-02-15T14:29:59.000Z',
    })
    expect(at29m59s).toBe('forming')

    const at30m01s = transitionSetupStatus(setupWithoutRegime, {
      currentPrice: 5909,
      nowIso: '2026-02-15T14:30:01.000Z',
    })
    expect(at30m01s).toBe('expired')
  })
})
