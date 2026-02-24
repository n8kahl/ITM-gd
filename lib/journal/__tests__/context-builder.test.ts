import { describe, it, expect } from 'vitest'
import {
  buildRegimeTags,
  buildMarketContext,
  type SPXEngineSnapshot,
} from '../context-builder'

function makeSnapshot(overrides: Partial<SPXEngineSnapshot> = {}): SPXEngineSnapshot {
  return {
    spotPrice: 5100,
    vwap: 5090,
    atr14: 25,
    volumeVsAvg: 1.1,
    pdh: 5120,
    pdl: 5050,
    pdc: 5080,
    pivotPP: 5083,
    pivotR1: 5116,
    pivotS1: 5050,
    vixSpot: 18,
    regime: 'trending',
    regimeDirection: 'bullish',
    regimeConfidence: 0.75,
    netGex: 50_000_000,
    gexFlipPoint: 5000,
    ...overrides,
  }
}

describe('buildRegimeTags', () => {
  it('classifies VIX buckets correctly', () => {
    expect(buildRegimeTags(makeSnapshot({ vixSpot: 12 })).vix_bucket).toBe('<15')
    expect(buildRegimeTags(makeSnapshot({ vixSpot: 17 })).vix_bucket).toBe('15-20')
    expect(buildRegimeTags(makeSnapshot({ vixSpot: 25 })).vix_bucket).toBe('20-30')
    expect(buildRegimeTags(makeSnapshot({ vixSpot: 35 })).vix_bucket).toBe('30+')
  })

  it('classifies trend state from regime and direction', () => {
    expect(buildRegimeTags(makeSnapshot({ regime: 'trending', regimeDirection: 'bullish' })).trend_state).toBe('trending_up')
    expect(buildRegimeTags(makeSnapshot({ regime: 'trending', regimeDirection: 'bearish' })).trend_state).toBe('trending_down')
    expect(buildRegimeTags(makeSnapshot({ regime: 'ranging' })).trend_state).toBe('ranging')
    expect(buildRegimeTags(makeSnapshot({ regime: 'compression' })).trend_state).toBe('ranging')
    expect(buildRegimeTags(makeSnapshot({ regime: 'breakout', regimeDirection: 'bullish' })).trend_state).toBe('trending_up')
  })

  it('classifies GEX regime', () => {
    expect(buildRegimeTags(makeSnapshot({ netGex: 50_000_000, gexFlipPoint: 4900 })).gex_regime).toBe('positive_gamma')
    expect(buildRegimeTags(makeSnapshot({ netGex: -50_000_000, gexFlipPoint: 5200 })).gex_regime).toBe('negative_gamma')
    // Near flip (within 0.5% of spot)
    expect(buildRegimeTags(makeSnapshot({ netGex: 1000, gexFlipPoint: 5100, spotPrice: 5100 })).gex_regime).toBe('near_flip')
  })

  it('assigns regime confidence', () => {
    expect(buildRegimeTags(makeSnapshot({ regimeConfidence: 0.8 })).regime_confidence).toBe('high')
    expect(buildRegimeTags(makeSnapshot({ regimeConfidence: 0.4 })).regime_confidence).toBe('low')
    expect(buildRegimeTags(makeSnapshot({ regimeConfidence: undefined })).regime_confidence).toBe('low')
  })
})

describe('buildMarketContext', () => {
  it('returns a complete context object', () => {
    const snapshot = makeSnapshot()
    const context = buildMarketContext(snapshot)

    expect(context.entryContext).toBeDefined()
    expect(context.exitContext).toBeDefined()
    expect(context.dayContext).toBeDefined()
    expect(context.vix_bucket).toBe('15-20')
    expect(context.trend_state).toBe('trending_up')
    expect(context.gex_regime).toBe('positive_gamma')
  })

  it('includes correct entry context values', () => {
    const snapshot = makeSnapshot()
    const context = buildMarketContext(snapshot)
    const entry = context.entryContext as Record<string, unknown>

    expect(entry.price).toBe(5100)
    expect(entry.vwap).toBe(5090)
    expect(entry.atr14).toBe(25)
  })

  it('uses exit snapshot when provided', () => {
    const entry = makeSnapshot({ spotPrice: 5100 })
    const exit = makeSnapshot({ spotPrice: 5120, vwap: 5095 })
    const context = buildMarketContext(entry, exit)

    const exitCtx = context.exitContext as Record<string, unknown>
    expect(exitCtx.price).toBe(5120)
    expect(exitCtx.vwap).toBe(5095)
  })

  it('handles missing optional fields gracefully', () => {
    const snapshot: SPXEngineSnapshot = {
      spotPrice: 5100,
      vwap: 5090,
      atr14: 25,
    }

    const context = buildMarketContext(snapshot)
    expect(context.entryContext).toBeDefined()
    expect(context.dayContext).toBeDefined()
  })
})
