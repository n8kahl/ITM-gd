import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  __resetTierModelForTest,
  __setTierModelForTest,
  calculateRuleBasedTier,
  mapMLTierToSetupTier,
  predictSetupTier,
} from '@/lib/ml/tier-classifier'
import type { Setup } from '@/lib/types/spx-command-center'
import type { SetupFeatureVector } from '@/lib/ml/types'

function buildSetup(partial?: Partial<Setup>): Setup {
  return {
    id: 'tier-setup-1',
    type: 'trend_continuation',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6022,
    target1: { price: 6038, label: 'T1' },
    target2: { price: 6046, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['flow_confirmation'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 6028,
      priceHigh: 6030,
      clusterScore: 4,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: '2026-02-24T15:00:00.000Z',
      held: true,
      holdRate: 70,
    },
    regime: 'trending',
    status: 'ready',
    probability: 66,
    recommendedContract: null,
    createdAt: '2026-02-24T15:00:00.000Z',
    triggeredAt: null,
    ...partial,
  }
}

const FEATURE_VECTOR: SetupFeatureVector = {
  confluenceScore: 4.3,
  confluenceFlowAge: 2,
  confluenceEmaAlignment: 0.8,
  confluenceGexAlignment: 0.75,
  regimeType: 1,
  regimeCompatibility: 1,
  regimeAge: 20,
  flowBias: 0.5,
  flowRecency: 3,
  flowVolume: 90,
  flowSweepCount: 4,
  distanceToVWAP: 1.2,
  distanceToNearestCluster: 0.6,
  atr14: 8,
  atr7_14_ratio: 0.95,
  ivRank: 58,
  ivSkew: 1.2,
  putCallRatio: 0.85,
  netGex: 1400,
  minutesIntoSession: 165,
  dayOfWeek: 2,
  dte: 1,
  historicalWinRate: 0.64,
  historicalTestCount: 14,
  lastTestResult: 1,
}

describe('tier-classifier', () => {
  const previousTierEnabled = process.env.SPX_ML_TIER_ENABLED
  const previousTierRollout = process.env.SPX_ML_TIER_AB_PERCENT

  beforeEach(() => {
    __resetTierModelForTest()
    process.env.SPX_ML_TIER_ENABLED = 'true'
    process.env.SPX_ML_TIER_AB_PERCENT = '100'
  })

  afterEach(() => {
    __resetTierModelForTest()

    if (previousTierEnabled == null) delete process.env.SPX_ML_TIER_ENABLED
    else process.env.SPX_ML_TIER_ENABLED = previousTierEnabled

    if (previousTierRollout == null) delete process.env.SPX_ML_TIER_AB_PERCENT
    else process.env.SPX_ML_TIER_AB_PERCENT = previousTierRollout
  })

  it('falls back to rule-based tiering when ML is unavailable', () => {
    const setup = buildSetup({ tier: undefined, confluenceScore: 4.1 })
    expect(calculateRuleBasedTier(setup, 79)).toBe('sniper_primary')
    expect(calculateRuleBasedTier(setup, 73)).toBe('sniper_secondary')
    expect(calculateRuleBasedTier(setup, 61)).toBe('watchlist')
    expect(calculateRuleBasedTier(setup, 52)).toBe('skip')
  })

  it('predicts ML tier when user is enabled', () => {
    __setTierModelForTest({
      version: 'tier-test',
      interceptByTier: {
        sniper_primary: 2.3,
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

    const prediction = predictSetupTier(FEATURE_VECTOR, buildSetup(), {
      userId: 'tier-user',
      mlTierEnabled: true,
    })

    expect(prediction).toBe('sniper_primary')
  })

  it('applies setup-type-specific thresholds (fade_at_wall stricter than trend_continuation)', () => {
    __setTierModelForTest({
      version: 'tier-test',
      interceptByTier: {
        sniper_primary: 2.3,
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

    const trendPrediction = predictSetupTier(FEATURE_VECTOR, buildSetup({ type: 'trend_continuation' }), {
      userId: 'tier-user',
      mlTierEnabled: true,
    })
    const fadePrediction = predictSetupTier(FEATURE_VECTOR, buildSetup({ type: 'fade_at_wall' }), {
      userId: 'tier-user',
      mlTierEnabled: true,
    })

    expect(trendPrediction).toBe('sniper_primary')
    expect(fadePrediction).toBe('sniper_secondary')
  })

  it('maps skip to hidden setup tier', () => {
    expect(mapMLTierToSetupTier('skip')).toBe('hidden')
    expect(mapMLTierToSetupTier('watchlist')).toBe('watchlist')
  })
})
