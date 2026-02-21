import { describe, expect, it } from 'vitest'

import { enrichSPXSetupWithDecisionEngine, evaluateSPXSetupDecision } from '@/lib/spx/decision-engine'
import type { FlowEvent, Setup } from '@/lib/types/spx-command-center'

function buildSetup(partial?: Partial<Setup>): Setup {
  return {
    id: 'setup-1',
    type: 'trend_continuation',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6023,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6045, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['regime_alignment', 'flow_confirmation'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6028,
      priceHigh: 6030,
      clusterScore: 4.2,
      type: 'defended',
      sources: [],
      testCount: 1,
      lastTestAt: '2026-02-21T14:00:00.000Z',
      held: true,
      holdRate: 67,
    },
    regime: 'trending',
    status: 'ready',
    probability: 66,
    recommendedContract: null,
    createdAt: '2026-02-21T14:00:00.000Z',
    triggeredAt: null,
    ...partial,
  }
}

function buildFlow(direction: FlowEvent['direction'], id: string): FlowEvent {
  return {
    id,
    type: 'sweep',
    symbol: 'SPX',
    strike: 6030,
    expiry: '2026-03-20',
    size: 24,
    direction,
    premium: 980_000,
    timestamp: '2026-02-21T15:00:00.000Z',
  }
}

describe('decision engine', () => {
  it('produces stronger alignment/confidence for aligned bullish signals', () => {
    const setup = buildSetup()
    const result = evaluateSPXSetupDecision(setup, {
      regime: 'trending',
      prediction: {
        regime: 'trending',
        direction: { bullish: 68, bearish: 24, neutral: 8 },
        magnitude: { small: 25, medium: 50, large: 25 },
        timingWindow: { description: 'Now', actionable: true },
        nextTarget: {
          upside: { price: 6040, zone: 'call_wall' },
          downside: { price: 6020, zone: 'put_wall' },
        },
        probabilityCone: [],
        confidence: 71,
      },
      basis: {
        current: 0.5,
        trend: 'expanding',
        leading: 'SPX',
        ema5: 0.4,
        ema20: 0.2,
        zscore: 0.6,
      },
      gex: {
        netGex: 1200,
        flipPoint: 6025,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6025,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-21T15:00:00.000Z',
      },
      flowEvents: [
        buildFlow('bullish', 'f1'),
        buildFlow('bullish', 'f2'),
        buildFlow('bullish', 'f3'),
        buildFlow('bearish', 'f4'),
      ],
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(result.alignmentScore).toBeGreaterThan(60)
    expect(result.confidence).toBeGreaterThan(70)
    expect(result.confidenceTrend).toBe('up')
    expect(result.drivers.length).toBeGreaterThan(0)
  })

  it('degrades confidence when signals conflict', () => {
    const setup = buildSetup({
      direction: 'bearish',
      regime: 'breakout',
      probability: 62,
      confluenceScore: 3,
    })

    const result = evaluateSPXSetupDecision(setup, {
      regime: 'ranging',
      prediction: {
        regime: 'ranging',
        direction: { bullish: 64, bearish: 22, neutral: 14 },
        magnitude: { small: 50, medium: 35, large: 15 },
        timingWindow: { description: 'Wait', actionable: false },
        nextTarget: {
          upside: { price: 6040, zone: 'call_wall' },
          downside: { price: 6020, zone: 'put_wall' },
        },
        probabilityCone: [],
        confidence: 53,
      },
      basis: {
        current: -0.4,
        trend: 'contracting',
        leading: 'SPX',
        ema5: -0.2,
        ema20: -0.1,
        zscore: -0.3,
      },
      gex: {
        netGex: 1600,
        flipPoint: 6025,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6025,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-21T15:00:00.000Z',
      },
      flowEvents: [
        buildFlow('bullish', 'f1'),
        buildFlow('bullish', 'f2'),
        buildFlow('bullish', 'f3'),
      ],
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(result.alignmentScore).toBeLessThan(50)
    expect(result.confidenceTrend).toBe('down')
    expect(result.risks.some((risk) => /regime mismatch|flow/i.test(risk))).toBe(true)
  })

  it('enriches setup with deterministic decision fields', () => {
    const setup = buildSetup()
    const enriched = enrichSPXSetupWithDecisionEngine(setup, {
      regime: 'trending',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(typeof enriched.score).toBe('number')
    expect(typeof enriched.pWinCalibrated).toBe('number')
    expect(typeof enriched.evR).toBe('number')
    expect(typeof enriched.alignmentScore).toBe('number')
    expect(['up', 'flat', 'down']).toContain(enriched.confidenceTrend)
    expect(Array.isArray(enriched.decisionDrivers)).toBe(true)
    expect(Array.isArray(enriched.decisionRisks)).toBe(true)
  })
})
