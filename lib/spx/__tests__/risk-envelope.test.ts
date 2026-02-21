import { describe, expect, it } from 'vitest'

import { evaluateSPXRiskEnvelopeEntryGate } from '@/lib/spx/risk-envelope'
import type { Setup } from '@/lib/types/spx-command-center'

function setupFixture(partial?: Partial<Setup>): Setup {
  return {
    id: 'setup-1',
    type: 'trend_continuation',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6024,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6045, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['regime_alignment', 'flow_confirmation'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6028,
      priceHigh: 6030,
      clusterScore: 4.1,
      type: 'defended',
      sources: [],
      testCount: 1,
      lastTestAt: null,
      held: true,
      holdRate: 66,
    },
    regime: 'trending',
    status: 'ready',
    score: 78,
    pWinCalibrated: 0.66,
    alignmentScore: 64,
    probability: 64,
    recommendedContract: null,
    createdAt: '2026-02-21T14:00:00.000Z',
    triggeredAt: null,
    ...partial,
  }
}

describe('risk envelope', () => {
  it('allows entry for healthy actionable setup', () => {
    const result = evaluateSPXRiskEnvelopeEntryGate({
      setup: setupFixture(),
      feedTrustBlocked: false,
    })

    expect(result.allowEntry).toBe(true)
    expect(result.reasonCode).toBe('allow')
  })

  it('blocks entry when feed trust is blocked', () => {
    const result = evaluateSPXRiskEnvelopeEntryGate({
      setup: setupFixture(),
      feedTrustBlocked: true,
    })

    expect(result.allowEntry).toBe(false)
    expect(result.reasonCode).toBe('feed_trust_blocked')
  })

  it('blocks entry on low alignment and low confidence', () => {
    const lowAlignment = evaluateSPXRiskEnvelopeEntryGate({
      setup: setupFixture({ alignmentScore: 40, pWinCalibrated: 0.7 }),
      feedTrustBlocked: false,
      minAlignmentScore: 52,
    })
    expect(lowAlignment.allowEntry).toBe(false)
    expect(lowAlignment.reasonCode).toBe('low_alignment')

    const lowConfidence = evaluateSPXRiskEnvelopeEntryGate({
      setup: setupFixture({ alignmentScore: 70, pWinCalibrated: 0.42 }),
      feedTrustBlocked: false,
      minConfidencePercent: 55,
    })
    expect(lowConfidence.allowEntry).toBe(false)
    expect(lowConfidence.reasonCode).toBe('low_confidence')
  })
})
