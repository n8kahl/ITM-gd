import { describe, expect, it } from 'vitest'

import { enrichCoachDecisionExplainability } from '@/lib/spx/coach-explainability'
import type { CoachDecisionBrief, Setup } from '@/lib/types/spx-command-center'

function setupFixture(): Setup {
  return {
    id: 'setup-1',
    type: 'trend_continuation',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6024,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6045, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['regime_alignment'],
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
      holdRate: 64,
    },
    regime: 'trending',
    status: 'ready',
    probability: 67,
    recommendedContract: null,
    createdAt: '2026-02-21T15:00:00.000Z',
    triggeredAt: null,
    decisionDrivers: ['Alignment strong', 'Flow confirms'],
    decisionRisks: ['Watch stop discipline'],
  }
}

function decisionFixture(): CoachDecisionBrief {
  return {
    decisionId: 'd1',
    setupId: 'setup-1',
    verdict: 'ENTER',
    confidence: 72,
    primaryText: 'Entry looks constructive.',
    why: ['Confluence is elevated.'],
    riskPlan: {},
    actions: [],
    severity: 'routine',
    freshness: {
      generatedAt: '2026-02-21T15:00:00.000Z',
      expiresAt: '2026-02-21T15:01:00.000Z',
      stale: false,
    },
    source: 'fallback_v1',
  }
}

describe('coach explainability enrichment', () => {
  it('appends drivers/risks/freshness to why lines', () => {
    const decision = decisionFixture()
    const setup = setupFixture()

    const enriched = enrichCoachDecisionExplainability(
      decision,
      setup,
      Date.parse('2026-02-21T15:00:20.000Z'),
    )

    expect(enriched.why.some((line) => /Driver:/.test(line))).toBe(true)
    expect(enriched.why.some((line) => /Risk:/.test(line))).toBe(true)
    expect(enriched.why.some((line) => /Freshness:/.test(line))).toBe(true)
  })

  it('fills missing risk plan defaults from setup context', () => {
    const enriched = enrichCoachDecisionExplainability(
      decisionFixture(),
      setupFixture(),
      Date.parse('2026-02-21T15:00:20.000Z'),
    )

    expect(enriched.riskPlan?.stop).toBe(6024)
    expect(enriched.riskPlan?.invalidation).toMatch(/invalid/i)
    expect(enriched.riskPlan?.positionGuidance).toBe('Watch stop discipline')
  })

  it('returns decision unchanged when setup is unavailable', () => {
    const decision = decisionFixture()
    const enriched = enrichCoachDecisionExplainability(decision, null)
    expect(enriched).toBe(decision)
  })
})
