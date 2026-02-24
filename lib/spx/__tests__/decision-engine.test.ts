import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { __resetConfidenceModelForTest, __setConfidenceModelForTest } from '@/lib/ml/confidence-model'
import { __resetTierModelForTest, __setTierModelForTest } from '@/lib/ml/tier-classifier'
import {
  FLOW_BIAS_EWMA_DECAY,
  calculateRuleBasedConfidence,
  enrichSPXSetupWithDecisionEngine,
  evaluateSPXSetupDecision,
  flowAlignmentBias,
  regimeCompatibility,
} from '@/lib/spx/decision-engine'
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
  const previousABRollout = process.env.SPX_ML_CONFIDENCE_AB_PERCENT
  const previousMLEnabled = process.env.SPX_ML_CONFIDENCE_ENABLED
  const previousTierABRollout = process.env.SPX_ML_TIER_AB_PERCENT
  const previousTierEnabled = process.env.SPX_ML_TIER_ENABLED

  beforeEach(() => {
    __resetConfidenceModelForTest()
    __resetTierModelForTest()
    process.env.SPX_ML_CONFIDENCE_AB_PERCENT = '100'
    process.env.SPX_ML_CONFIDENCE_ENABLED = 'true'
    process.env.SPX_ML_TIER_AB_PERCENT = '100'
    process.env.SPX_ML_TIER_ENABLED = 'true'
  })

  afterEach(() => {
    __resetConfidenceModelForTest()
    __resetTierModelForTest()
    if (previousABRollout == null) delete process.env.SPX_ML_CONFIDENCE_AB_PERCENT
    else process.env.SPX_ML_CONFIDENCE_AB_PERCENT = previousABRollout

    if (previousMLEnabled == null) delete process.env.SPX_ML_CONFIDENCE_ENABLED
    else process.env.SPX_ML_CONFIDENCE_ENABLED = previousMLEnabled

    if (previousTierABRollout == null) delete process.env.SPX_ML_TIER_AB_PERCENT
    else process.env.SPX_ML_TIER_AB_PERCENT = previousTierABRollout

    if (previousTierEnabled == null) delete process.env.SPX_ML_TIER_ENABLED
    else process.env.SPX_ML_TIER_ENABLED = previousTierEnabled
  })

  it('uses EWMA flow weights where recent events carry more influence', () => {
    expect(FLOW_BIAS_EWMA_DECAY ** 0).toBe(1)
    expect(FLOW_BIAS_EWMA_DECAY ** 5).toBeCloseTo(0.44, 2)
    expect(FLOW_BIAS_EWMA_DECAY ** 10).toBeCloseTo(0.2, 2)
  })

  it('keeps the same sign as flat averaging when flow is strongly directional', () => {
    const events = [
      buildFlow('bullish', 'f1'),
      buildFlow('bullish', 'f2'),
      buildFlow('bullish', 'f3'),
      buildFlow('bullish', 'f4'),
      buildFlow('bullish', 'f5'),
      buildFlow('bullish', 'f6'),
      buildFlow('bullish', 'f7'),
      buildFlow('bullish', 'f8'),
      buildFlow('bullish', 'f9'),
      buildFlow('bearish', 'f10'),
    ]

    const ewma = flowAlignmentBias('bullish', events)
    const flat = ((9 - 1) / 10)
    expect(Math.sign(ewma)).toBe(Math.sign(flat))
  })

  it('converges mixed flow toward zero faster than flat averaging', () => {
    const events = [
      buildFlow('bullish', 'f1'),
      buildFlow('bearish', 'f2'),
      buildFlow('bullish', 'f3'),
      buildFlow('bearish', 'f4'),
      buildFlow('bullish', 'f5'),
      buildFlow('bearish', 'f6'),
      buildFlow('bullish', 'f7'),
      buildFlow('bullish', 'f8'),
      buildFlow('bullish', 'f9'),
      buildFlow('bullish', 'f10'),
      buildFlow('bullish', 'f11'),
      buildFlow('bullish', 'f12'),
    ]

    const ewma = flowAlignmentBias('bullish', events)
    const aligned = events.filter((event) => event.direction === 'bullish').length
    const flat = (aligned - (events.length - aligned)) / events.length
    expect(Math.abs(ewma)).toBeLessThan(Math.abs(flat))
  })

  it('scores regime compatibility across aligned, adjacent, mild, and strong conflicts', () => {
    expect(regimeCompatibility('trending', null)).toBe(0.5)
    expect(regimeCompatibility('trending', 'trending')).toBe(1)
    expect(regimeCompatibility('trending', 'breakout')).toBe(0.65)
    expect(regimeCompatibility('trending', 'compression')).toBe(0.3)
    expect(regimeCompatibility('trending', 'ranging')).toBe(0.15)
  })

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

  it('scales regime conflict penalties across aligned, mild, and strong conflict levels', () => {
    const setup = buildSetup()

    const aligned = evaluateSPXSetupDecision(setup, {
      regime: 'trending',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })
    const mildConflict = evaluateSPXSetupDecision(setup, {
      regime: 'compression',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })
    const strongConflict = evaluateSPXSetupDecision(setup, {
      regime: 'ranging',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(aligned.confidence).toBeGreaterThan(mildConflict.confidence)
    expect(mildConflict.confidence).toBeGreaterThan(strongConflict.confidence)
    expect(aligned.confidence).toBeCloseTo(88.41, 2)
    expect(mildConflict.confidence).toBeCloseTo(62.26, 2)
    expect(strongConflict.confidence).toBeCloseTo(53.23, 2)
  })

  it('keeps bearish fade confidence below 45% in a trending counter-regime', () => {
    const setup = buildSetup({
      type: 'fade_at_wall',
      direction: 'bearish',
      regime: 'ranging',
      confluenceScore: 2,
      probability: 50,
    })

    const result = evaluateSPXSetupDecision(setup, {
      regime: 'trending',
      prediction: {
        regime: 'trending',
        direction: { bullish: 84, bearish: 10, neutral: 6 },
        magnitude: { small: 25, medium: 45, large: 30 },
        timingWindow: { description: 'Immediate', actionable: true },
        nextTarget: {
          upside: { price: 6042, zone: 'call_wall' },
          downside: { price: 6022, zone: 'put_wall' },
        },
        probabilityCone: [],
        confidence: 74,
      },
      basis: {
        current: 0.8,
        trend: 'expanding',
        leading: 'SPX',
        ema5: 0.5,
        ema20: 0.2,
        zscore: 0.9,
      },
      gex: {
        netGex: 1500,
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

    expect(result.confidence).toBeLessThan(45)
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

  it('falls back to rule-based confidence when ML model is unavailable', () => {
    const setup = buildSetup()
    const context = {
      regime: 'trending' as const,
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      userId: 'user-123',
      mlConfidenceEnabled: true,
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    }

    const result = evaluateSPXSetupDecision(setup, context)
    const flowBias = flowAlignmentBias(setup.direction, context.flowEvents)
    const regimeScore = regimeCompatibility(setup.regime, context.regime)
    const expected = calculateRuleBasedConfidence({
      alignmentScore: result.alignmentScore,
      confluenceScore: setup.confluenceScore,
      probability: setup.probability,
      flowBias,
      regimeScore,
    })

    expect(result.confidenceSource).toBe('rule_based')
    expect(result.confidence).toBe(expected)
  })

  it('uses ML confidence when model is available and user is enabled', () => {
    const setup = buildSetup()
    __setConfidenceModelForTest({
      version: 'test-model',
      intercept: 0,
      features: {
        confluenceScore: 0.5,
      },
    })

    const result = evaluateSPXSetupDecision(setup, {
      regime: 'trending',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      userId: 'ml-user',
      mlConfidenceEnabled: true,
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(result.confidenceSource).toBe('ml')
    expect(result.confidence).toBeCloseTo(88.08, 2)
  })

  it('respects ML override when disabled for a user', () => {
    const setup = buildSetup()
    __setConfidenceModelForTest({
      version: 'test-model',
      intercept: 2,
      features: {
        confluenceScore: 0.6,
      },
    })

    const result = evaluateSPXSetupDecision(setup, {
      regime: 'trending',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      userId: 'ml-user',
      mlConfidenceEnabled: false,
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(result.confidenceSource).toBe('rule_based')
  })

  it('uses ML tier prediction when enabled', () => {
    __setTierModelForTest({
      version: 'tier-test',
      interceptByTier: {
        sniper_primary: 3,
        sniper_secondary: 0,
        watchlist: 0,
        skip: 0,
      },
      featureWeightsByTier: {
        sniper_primary: {},
        sniper_secondary: {},
        watchlist: {},
        skip: {},
      },
    })

    const enriched = enrichSPXSetupWithDecisionEngine(buildSetup({ tier: 'watchlist' }), {
      regime: 'trending',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      userId: 'tier-user',
      mlTierEnabled: true,
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(enriched.tier).toBe('sniper_primary')
  })

  it('uses rule-based tier fallback when ML tiering is disabled', () => {
    const enriched = enrichSPXSetupWithDecisionEngine(buildSetup({ tier: undefined, confluenceScore: 4.2 }), {
      regime: 'trending',
      prediction: null,
      basis: null,
      gex: null,
      flowEvents: [],
      userId: 'tier-user',
      mlTierEnabled: false,
      nowMs: Date.parse('2026-02-21T15:10:00.000Z'),
    })

    expect(enriched.tier).toBe('sniper_primary')
  })
})
