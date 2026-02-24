import { describe, expect, it } from 'vitest'

import { extractFeatures } from '@/lib/ml/feature-extractor'
import type { FeatureExtractionContext } from '@/lib/ml/types'
import type { Setup } from '@/lib/types/spx-command-center'

function buildSetup(partial?: Partial<Setup>): Setup {
  return {
    id: 'setup-feature-1',
    type: 'trend_continuation',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6022,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6044, label: 'T2' },
    confluenceScore: 4.2,
    confluenceSources: ['flow_confirmation', 'ema_alignment', 'gex_alignment'],
    confluenceBreakdown: {
      flow: 0.8,
      ema: 0.75,
      zone: 0.7,
      gex: 0.6,
      regime: 0.8,
      multiTF: 0.7,
      memory: 0.5,
      composite: 0.72,
      legacyEquivalent: 4,
      threshold: 3,
    },
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6029,
      priceHigh: 6031,
      clusterScore: 4,
      type: 'defended',
      sources: [],
      testCount: 4,
      lastTestAt: '2026-02-21T14:30:00.000Z',
      held: true,
      holdRate: 66,
    },
    regime: 'trending',
    status: 'ready',
    probability: 68,
    recommendedContract: {
      description: '6030C 0DTE',
      strike: 6030,
      expiry: '2026-02-25',
      type: 'call',
      delta: 0.47,
      gamma: 0.08,
      theta: -0.05,
      vega: 0.12,
      bid: 6.2,
      ask: 6.6,
      riskReward: 1.8,
      expectedPnlAtTarget1: 180,
      expectedPnlAtTarget2: 320,
      maxLoss: 660,
      reasoning: 'Momentum follow-through',
      daysToExpiry: 1,
      ivVsRealized: 0.22,
    },
    createdAt: '2026-02-24T15:00:00.000Z',
    triggeredAt: null,
    memoryContext: {
      tests: 12,
      resolved: 11,
      wins: 7,
      losses: 4,
      winRatePct: 63.6,
      confidence: 0.72,
      score: 0.8,
      lookbackSessions: 20,
      tolerancePoints: 4,
    },
    ...partial,
  }
}

function buildContext(partial?: Partial<FeatureExtractionContext>): FeatureExtractionContext {
  return {
    regime: 'trending',
    prediction: null,
    basis: null,
    gex: {
      netGex: 1350,
      flipPoint: 6030,
      callWall: 6060,
      putWall: 6000,
      zeroGamma: 6030,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T15:35:00.000Z',
    },
    flowEvents: [
      {
        id: 'flow-1',
        type: 'sweep',
        symbol: 'SPX',
        strike: 6030,
        expiry: '2026-02-25',
        size: 24,
        direction: 'bullish',
        premium: 250000,
        timestamp: '2026-02-24T15:34:00.000Z',
      },
      {
        id: 'flow-2',
        type: 'sweep',
        symbol: 'SPX',
        strike: 6040,
        expiry: '2026-02-25',
        size: 20,
        direction: 'bearish',
        premium: 180000,
        timestamp: '2026-02-24T15:33:00.000Z',
      },
      {
        id: 'flow-3',
        type: 'block',
        symbol: 'SPX',
        strike: 6025,
        expiry: '2026-02-25',
        size: 32,
        direction: 'bullish',
        premium: 410000,
        timestamp: '2026-02-24T15:32:00.000Z',
      },
    ],
    nowMs: Date.parse('2026-02-24T15:35:00.000Z'),
    metrics: {
      distanceToVWAP: 1.8,
      atr14: 9.4,
      atr7: 8.9,
      ivRank: 61,
      ivSkew: 2.3,
      putCallRatio: 0.91,
      dte: 1,
    },
    ...partial,
  }
}

describe('extractFeatures', () => {
  it('extracts all 25+ features from setup and context', () => {
    const setup = buildSetup()
    const context = buildContext()

    const vector = extractFeatures(setup, context)

    expect(Object.keys(vector).length).toBe(25)
    expect(vector.confluenceScore).toBe(4.2)
    expect(vector.confluenceEmaAlignment).toBe(0.75)
    expect(vector.regimeType).toBe(1)
    expect(vector.regimeCompatibility).toBe(1)
    expect(vector.flowSweepCount).toBe(2)
    expect(vector.flowVolume).toBe(76)
    expect(vector.distanceToVWAP).toBe(1.8)
    expect(vector.atr14).toBe(9.4)
    expect(vector.atr7_14_ratio).toBeCloseTo(0.9468, 4)
    expect(vector.ivRank).toBe(61)
    expect(vector.putCallRatio).toBe(0.91)
    expect(vector.netGex).toBe(1350)
    expect(vector.dayOfWeek).toBe(2)
    expect(vector.dte).toBe(1)
    expect(vector.historicalWinRate).toBe(0.636)
    expect(vector.historicalTestCount).toBe(12)
    expect(vector.lastTestResult).toBe(1)

    expect(JSON.parse(JSON.stringify(vector))).toEqual(vector)
  })

  it('handles missing data with stable numeric defaults', () => {
    const setup = buildSetup({
      confluenceBreakdown: undefined,
      recommendedContract: null,
      memoryContext: undefined,
      createdAt: 'invalid-date',
      clusterZone: {
        id: 'cluster-2',
        priceLow: 0,
        priceHigh: 0,
        clusterScore: 0,
        type: 'developing',
        sources: [],
        testCount: 0,
        lastTestAt: null,
        held: false,
        holdRate: 0,
      },
    })
    const context = buildContext({
      regime: null,
      gex: null,
      flowEvents: [],
      nowMs: undefined,
      metrics: undefined,
    })

    const vector = extractFeatures(setup, context)

    for (const value of Object.values(vector)) {
      expect(Number.isFinite(value)).toBe(true)
    }

    expect(vector.confluenceEmaAlignment).toBe(0)
    expect(vector.confluenceGexAlignment).toBe(0)
    expect(vector.regimeType).toBe(0)
    expect(vector.regimeCompatibility).toBe(0.5)
    expect(vector.flowBias).toBe(0)
    expect(vector.flowRecency).toBe(9999)
    expect(vector.distanceToVWAP).toBe(0)
    expect(vector.netGex).toBe(0)
    expect(vector.historicalWinRate).toBe(0.5)
    expect(vector.historicalTestCount).toBe(0)
    expect(vector.lastTestResult).toBe(-1)
  })
})
