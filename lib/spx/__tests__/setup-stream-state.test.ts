import { describe, expect, it } from 'vitest'
import type { Setup } from '@/lib/types/spx-command-center'
import {
  mergeActionableSetups,
  mergeSetup,
  setupLifecycleEpoch,
  shouldKeepExistingSetup,
} from '@/lib/spx/setup-stream-state'

function makeSetup(overrides?: Partial<Setup>): Setup {
  return {
    id: overrides?.id ?? 'setup-1',
    type: overrides?.type ?? 'trend_pullback',
    direction: overrides?.direction ?? 'bullish',
    entryZone: overrides?.entryZone ?? { low: 6000, high: 6002 },
    stop: overrides?.stop ?? 5996,
    target1: overrides?.target1 ?? { price: 6006, label: 'T1' },
    target2: overrides?.target2 ?? { price: 6010, label: 'T2' },
    confluenceScore: overrides?.confluenceScore ?? 4,
    confluenceSources: overrides?.confluenceSources ?? ['flow_alignment'],
    clusterZone: overrides?.clusterZone ?? {
      id: 'zone-1',
      priceLow: 5998,
      priceHigh: 6004,
      clusterScore: 72,
      type: 'defended',
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: null,
      holdRate: null,
    },
    regime: overrides?.regime ?? 'trending',
    status: overrides?.status ?? 'ready',
    probability: overrides?.probability ?? 62,
    recommendedContract: overrides?.recommendedContract ?? null,
    createdAt: overrides?.createdAt ?? '2026-02-24T14:00:00.000Z',
    triggeredAt: overrides?.triggeredAt ?? null,
    statusUpdatedAt: overrides?.statusUpdatedAt,
  }
}

describe('setup-stream-state', () => {
  it('uses statusUpdatedAt as primary lifecycle recency anchor', () => {
    const setup = makeSetup({
      createdAt: '2026-02-24T14:00:00.000Z',
      triggeredAt: '2026-02-24T14:01:00.000Z',
      statusUpdatedAt: '2026-02-24T14:02:00.000Z',
    })
    expect(setupLifecycleEpoch(setup)).toBe(Date.parse('2026-02-24T14:02:00.000Z'))
  })

  it('keeps triggered setup during short out-of-order downgrade packets', () => {
    const existing = makeSetup({
      status: 'triggered',
      triggeredAt: '2026-02-24T14:10:00.000Z',
      statusUpdatedAt: '2026-02-24T14:10:00.000Z',
    })
    const incoming = makeSetup({
      status: 'ready',
      statusUpdatedAt: '2026-02-24T14:10:05.000Z',
    })

    expect(shouldKeepExistingSetup(existing, incoming, { triggeredDowngradeGraceMs: 10_000 })).toBe(true)
    expect(mergeSetup(existing, incoming, { triggeredDowngradeGraceMs: 10_000 }).status).toBe('triggered')
  })

  it('accepts downgrade when incoming status update is beyond grace window', () => {
    const existing = makeSetup({
      status: 'triggered',
      triggeredAt: '2026-02-24T14:10:00.000Z',
      statusUpdatedAt: '2026-02-24T14:10:00.000Z',
    })
    const incoming = makeSetup({
      status: 'ready',
      statusUpdatedAt: '2026-02-24T14:10:30.000Z',
    })

    expect(shouldKeepExistingSetup(existing, incoming, { triggeredDowngradeGraceMs: 5_000 })).toBe(false)
    expect(mergeSetup(existing, incoming, { triggeredDowngradeGraceMs: 5_000 }).status).toBe('ready')
  })

  it('prunes missing setups after short retention budget', () => {
    const existing = makeSetup({
      id: 'stale-1',
      status: 'ready',
      statusUpdatedAt: '2026-02-24T14:00:00.000Z',
    })
    const result = mergeActionableSetups([existing], [], {
      nowMs: Date.parse('2026-02-24T14:01:00.000Z'),
      retentionMs: 15_000,
    })
    expect(result).toHaveLength(0)
  })

  it('retains recently missing setup within retention budget', () => {
    const existing = makeSetup({
      id: 'recent-1',
      status: 'triggered',
      statusUpdatedAt: '2026-02-24T14:00:55.000Z',
      triggeredAt: '2026-02-24T14:00:55.000Z',
    })
    const result = mergeActionableSetups([existing], [], {
      nowMs: Date.parse('2026-02-24T14:01:00.000Z'),
      retentionMs: 10_000,
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('recent-1')
  })
})
