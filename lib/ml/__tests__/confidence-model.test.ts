import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  __resetConfidenceModelForTest,
  __setConfidenceModelForTest,
  isMLConfidenceEnabledForUser,
  predictConfidence,
} from '@/lib/ml/confidence-model'
import type { SetupFeatureVector } from '@/lib/ml/types'

const FEATURE_VECTOR: SetupFeatureVector = {
  confluenceScore: 4,
  confluenceFlowAge: 2,
  confluenceEmaAlignment: 0.8,
  confluenceGexAlignment: 0.7,
  regimeType: 1,
  regimeCompatibility: 1,
  regimeAge: 15,
  flowBias: 0.4,
  flowRecency: 2,
  flowVolume: 80,
  flowSweepCount: 3,
  distanceToVWAP: 1,
  distanceToNearestCluster: 0.8,
  atr14: 10,
  atr7_14_ratio: 0.95,
  ivRank: 60,
  ivSkew: 2,
  putCallRatio: 0.9,
  netGex: 1200,
  minutesIntoSession: 180,
  dayOfWeek: 2,
  dte: 1,
  historicalWinRate: 0.62,
  historicalTestCount: 12,
  lastTestResult: 1,
}

describe('confidence-model', () => {
  const previousABRollout = process.env.SPX_ML_CONFIDENCE_AB_PERCENT
  const previousMLEnabled = process.env.SPX_ML_CONFIDENCE_ENABLED

  beforeEach(() => {
    __resetConfidenceModelForTest()
    process.env.SPX_ML_CONFIDENCE_ENABLED = 'true'
    process.env.SPX_ML_CONFIDENCE_AB_PERCENT = '50'
  })

  afterEach(() => {
    __resetConfidenceModelForTest()

    if (previousABRollout == null) delete process.env.SPX_ML_CONFIDENCE_AB_PERCENT
    else process.env.SPX_ML_CONFIDENCE_AB_PERCENT = previousABRollout

    if (previousMLEnabled == null) delete process.env.SPX_ML_CONFIDENCE_ENABLED
    else process.env.SPX_ML_CONFIDENCE_ENABLED = previousMLEnabled
  })

  it('uses deterministic per-user rollout buckets for A/B gating', () => {
    const candidate = 'user-ml-rollout'
    const first = isMLConfidenceEnabledForUser(candidate)
    const second = isMLConfidenceEnabledForUser(candidate)
    expect(first).toBe(second)
  })

  it('returns null when model is missing and prediction when model is cached', () => {
    const userId = 'enabled-user'

    const noModel = predictConfidence(FEATURE_VECTOR, {
      userId,
      enabledOverride: true,
    })
    expect(noModel).toBeNull()

    __setConfidenceModelForTest({
      version: 'v1',
      intercept: -0.5,
      features: {
        confluenceScore: 0.5,
        flowBias: 0.8,
      },
    })

    const withModel = predictConfidence(FEATURE_VECTOR, {
      userId,
      enabledOverride: true,
    })

    expect(withModel).not.toBeNull()
    expect(withModel as number).toBeGreaterThan(0)
    expect(withModel as number).toBeLessThan(100)
  })
})
