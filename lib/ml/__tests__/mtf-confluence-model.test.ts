import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  __resetMTFConfluenceModelForTest,
  __setMTFConfluenceModelForTest,
  DEFAULT_MTF_TIMEFRAME_WEIGHTS,
  predictMTFConfluenceWeights,
} from '@/lib/ml/mtf-confluence-model'

describe('mtf-confluence-model', () => {
  const previousEnabled = process.env.SPX_ML_MTF_CONFLUENCE_ENABLED
  const previousRollout = process.env.SPX_ML_MTF_CONFLUENCE_AB_PERCENT

  beforeEach(() => {
    __resetMTFConfluenceModelForTest()
    process.env.SPX_ML_MTF_CONFLUENCE_ENABLED = 'true'
    process.env.SPX_ML_MTF_CONFLUENCE_AB_PERCENT = '100'
  })

  afterEach(() => {
    __resetMTFConfluenceModelForTest()

    if (previousEnabled == null) delete process.env.SPX_ML_MTF_CONFLUENCE_ENABLED
    else process.env.SPX_ML_MTF_CONFLUENCE_ENABLED = previousEnabled

    if (previousRollout == null) delete process.env.SPX_ML_MTF_CONFLUENCE_AB_PERCENT
    else process.env.SPX_ML_MTF_CONFLUENCE_AB_PERCENT = previousRollout
  })

  it('falls back to rule-based weights when feature is disabled', () => {
    const prediction = predictMTFConfluenceWeights({
      alignmentByTimeframe: { '1m': 0.6, '5m': 0.7, '15m': 0.65, '1h': 0.72 },
      regimeCompatibility: 0.8,
      flowBias: 0.2,
      confluenceScore: 4,
    }, {
      userId: 'user-1',
      enabledOverride: false,
    })

    expect(prediction.source).toBe('rule_based')
    expect(prediction.weights).toEqual(DEFAULT_MTF_TIMEFRAME_WEIGHTS)
  })

  it('produces normalized ML weights that sum to 1', () => {
    const prediction = predictMTFConfluenceWeights({
      alignmentByTimeframe: { '1m': 0.58, '5m': 0.71, '15m': 0.67, '1h': 0.74 },
      regimeCompatibility: 0.84,
      flowBias: 0.3,
      confluenceScore: 4.3,
    }, {
      userId: 'user-2',
      enabledOverride: true,
    })

    const total = prediction.weights['1m']
      + prediction.weights['5m']
      + prediction.weights['15m']
      + prediction.weights['1h']

    expect(prediction.source).toBe('ml')
    expect(total).toBeCloseTo(1, 6)
    expect(prediction.weights['5m']).toBeGreaterThan(0)
    expect(prediction.weights['1h']).toBeGreaterThan(0)
  })

  it('runs inference in sub-millisecond average time for shallow model', () => {
    __setMTFConfluenceModelForTest({
      version: 'perf-test',
      hiddenLayer: {
        weights: [
          [0.4, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05],
          [0.1, 0.45, 0.15, 0.1, 0.1, 0.05, 0.05],
          [0.1, 0.2, 0.45, 0.1, 0.05, 0.05, 0.05],
        ],
        bias: [0, 0, 0],
      },
      outputLayer: {
        weights: [
          [0.8, 0.2, 0.1, 0.1],
          [0.1, 0.8, 0.2, 0.1],
          [0.1, 0.2, 0.8, 0.2],
        ],
        bias: [0.1, 0.1, 0.1, 0.1],
      },
    })

    const input = {
      alignmentByTimeframe: { '1m': 0.6, '5m': 0.7, '15m': 0.65, '1h': 0.72 },
      regimeCompatibility: 0.8,
      flowBias: 0.25,
      confluenceScore: 4,
    }

    const iterations = 2000
    const start = performance.now()
    for (let i = 0; i < iterations; i += 1) {
      predictMTFConfluenceWeights(input, { userId: 'perf-user', enabledOverride: true })
    }
    const elapsedMs = performance.now() - start
    const avgMs = elapsedMs / iterations

    expect(avgMs).toBeLessThan(1)
  })
})
