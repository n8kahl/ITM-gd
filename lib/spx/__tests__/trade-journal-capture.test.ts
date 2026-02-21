import { describe, expect, it } from 'vitest'

import {
  calculateSPXTradeAdherenceScore,
  createSPXTradeJournalArtifact,
  summarizeSPXTradeJournalArtifacts,
} from '@/lib/spx/trade-journal-capture'
import type { Setup } from '@/lib/types/spx-command-center'

function setupFixture(partial?: Partial<Setup>): Setup {
  return {
    id: 'setup-1',
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6024,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6044, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['level_quality', 'flow_confirmation'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6028,
      priceHigh: 6030,
      clusterScore: 4.1,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: null,
      held: true,
      holdRate: 69,
    },
    regime: 'ranging',
    status: 'triggered',
    probability: 72,
    recommendedContract: null,
    createdAt: '2026-02-21T14:00:00.000Z',
    triggeredAt: '2026-02-21T14:02:00.000Z',
    ...partial,
  }
}

describe('trade journal capture', () => {
  it('computes bounded adherence scores', () => {
    const score = calculateSPXTradeAdherenceScore({
      setup: setupFixture(),
      entryPrice: 6029,
      exitPrice: 6037.5,
      stop: 6024,
      target1: 6038,
      coachDecision: null,
    })
    expect(score).toBeGreaterThanOrEqual(5)
    expect(score).toBeLessThanOrEqual(99)
  })

  it('creates trade journal artifact with expectancy and risk context', () => {
    const artifact = createSPXTradeJournalArtifact({
      setup: setupFixture(),
      openedAt: '2026-02-21T14:02:00.000Z',
      closedAt: '2026-02-21T14:15:00.000Z',
      entryPrice: 6029,
      exitPrice: 6038.5,
      pnlPoints: 9.5,
      pnlDollars: 340,
      contractDescription: '6030C 2026-03-20',
      contractEntryMid: 2.3,
      contractExitMid: 3.1,
      timeframe: '1m',
      coachDecision: null,
    })
    expect(artifact.setupId).toBe('setup-1')
    expect(artifact.expectancyR).not.toBeNull()
    expect(artifact.riskContext.stop).toBe(6024)
    expect(artifact.holdDurationMinutes).toBe(13)
  })

  it('summarizes artifacts into readiness analytics', () => {
    const one = createSPXTradeJournalArtifact({
      setup: setupFixture({ regime: 'ranging' }),
      openedAt: '2026-02-21T14:02:00.000Z',
      closedAt: '2026-02-21T14:15:00.000Z',
      entryPrice: 6029,
      exitPrice: 6038.5,
      pnlPoints: 9.5,
      pnlDollars: 340,
      contractDescription: null,
      contractEntryMid: null,
      contractExitMid: null,
      timeframe: '1m',
      coachDecision: null,
    })
    const two = createSPXTradeJournalArtifact({
      setup: setupFixture({ id: 'setup-2', regime: 'breakout', direction: 'bearish' }),
      openedAt: '2026-02-21T15:02:00.000Z',
      closedAt: '2026-02-21T15:10:00.000Z',
      entryPrice: 6022,
      exitPrice: 6027,
      pnlPoints: -5,
      pnlDollars: -190,
      contractDescription: null,
      contractEntryMid: null,
      contractExitMid: null,
      timeframe: '5m',
      coachDecision: null,
    })

    const summary = summarizeSPXTradeJournalArtifacts([one, two])
    expect(summary.totalTrades).toBe(2)
    expect(summary.wins).toBe(1)
    expect(summary.losses).toBe(1)
    expect(summary.byRegime.length).toBeGreaterThan(0)
    expect(summary.averageAdherenceScore).toBeGreaterThan(0)
  })
})
