import { describe, expect, it } from 'vitest'

import { buildSetupDisplayPolicy } from '@/lib/spx/setup-display-policy'
import type { PredictionState, Setup } from '@/lib/types/spx-command-center'

function buildSetup(partial?: Partial<Setup>): Setup {
  return {
    id: partial?.id ?? 'setup-1',
    type: partial?.type ?? 'mean_reversion',
    direction: partial?.direction ?? 'bullish',
    entryZone: { low: 6000, high: 6002 },
    stop: 5996,
    target1: { price: 6008, label: 'T1' },
    target2: { price: 6014, label: 'T2' },
    confluenceScore: 3.5,
    confluenceSources: ['regime_alignment'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 5999.5,
      priceHigh: 6002.5,
      clusterScore: 4.2,
      type: 'defended',
      sources: [],
      testCount: 1,
      lastTestAt: '2026-02-24T14:00:00.000Z',
      held: true,
      holdRate: 68,
    },
    regime: 'compression',
    status: 'ready',
    probability: 55,
    recommendedContract: null,
    createdAt: '2026-02-24T14:00:00.000Z',
    triggeredAt: null,
    ...partial,
  }
}

function buildPrediction(confidence: number): PredictionState {
  return {
    regime: 'compression',
    direction: { bullish: 70, bearish: 20, neutral: 10 },
    magnitude: { small: 40, medium: 40, large: 20 },
    timingWindow: { description: 'Now', actionable: true },
    nextTarget: {
      upside: { price: 6010, zone: 'call_wall' },
      downside: { price: 5985, zone: 'put_wall' },
    },
    probabilityCone: [],
    confidence,
  }
}

describe('setup display policy', () => {
  it('uses calibrated pWin for compression filter when available', () => {
    const selected = buildSetup({
      direction: 'bullish',
      pWinCalibrated: 0.7,
      probability: 40,
    })

    const result = buildSetupDisplayPolicy({
      setups: [
        selected,
        buildSetup({ id: 'setup-2', direction: 'bearish' }),
      ],
      regime: 'compression',
      prediction: buildPrediction(40),
      selectedSetup: selected,
    })

    expect(result.compressionFilterActive).toBe(true)
    expect(result.actionableTotalCount).toBe(1)
    expect(result.hiddenOppositeCount).toBe(1)
  })

  it('falls back to raw setup probability when pWinCalibrated is missing', () => {
    const selected = buildSetup({
      probability: 72,
      pWinCalibrated: undefined,
    })

    const result = buildSetupDisplayPolicy({
      setups: [selected],
      regime: 'compression',
      prediction: buildPrediction(40),
      selectedSetup: selected,
    })

    expect(result.compressionFilterActive).toBe(true)
  })

  it('does not enable compression filter when both calibrated and raw confidence are below threshold', () => {
    const selected = buildSetup({
      probability: 55,
      pWinCalibrated: 0.5,
    })

    const result = buildSetupDisplayPolicy({
      setups: [
        selected,
        buildSetup({ id: 'setup-2', direction: 'bearish' }),
      ],
      regime: 'compression',
      prediction: buildPrediction(40),
      selectedSetup: selected,
    })

    expect(result.compressionFilterActive).toBe(false)
    expect(result.actionableTotalCount).toBe(2)
  })
})
