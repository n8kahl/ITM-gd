/**
 * Market Context Builder
 *
 * Constructs a MarketContextSnapshot with regime tags from available SPX engine state.
 * Used by auto-draft creation and manual trade entry to pre-fill market context fields.
 *
 * Regime tags stored in market_context JSONB:
 *   vix_bucket, trend_state, gex_regime, time_bucket, regime_confidence
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 2, Slice 2E
 */

/** Minimal SPX engine snapshot the context builder needs. */
export interface SPXEngineSnapshot {
  spotPrice: number
  vwap: number
  atr14: number

  /** Volume relative to 20-day average (e.g. 1.2 = 120% of average) */
  volumeVsAvg?: number

  /** Previous day high/low/close */
  pdh?: number
  pdl?: number
  pdc?: number

  /** Pivot levels */
  pivotPP?: number
  pivotR1?: number
  pivotS1?: number

  /** VIX spot value */
  vixSpot?: number

  /** Regime classifier output */
  regime?: 'trending' | 'ranging' | 'compression' | 'breakout'
  regimeDirection?: 'bullish' | 'bearish' | 'neutral'
  regimeConfidence?: number

  /** GEX landscape summary */
  netGex?: number
  gexFlipPoint?: number

  /** Nearest support/resistance level */
  nearestLevel?: {
    name: string
    price: number
  }

  /** Setup type detected */
  setupType?: string
}

export type VixBucket = '<15' | '15-20' | '20-30' | '30+'
export type TrendState = 'trending_up' | 'trending_down' | 'ranging'
export type GexRegime = 'positive_gamma' | 'negative_gamma' | 'near_flip'
export type TimeBucket = 'open' | 'mid_morning' | 'lunch' | 'power_hour' | 'close'

/** Regime tags appended to market_context JSONB. */
export interface RegimeTags {
  vix_bucket: VixBucket
  trend_state: TrendState
  gex_regime: GexRegime
  time_bucket: TimeBucket
  regime_confidence: 'high' | 'low'
}

function classifyVixBucket(vix: number | undefined): VixBucket {
  if (vix == null || vix <= 0) return '15-20'
  if (vix < 15) return '<15'
  if (vix < 20) return '15-20'
  if (vix < 30) return '20-30'
  return '30+'
}

function classifyTrendState(
  regime: string | undefined,
  direction: string | undefined,
): TrendState {
  if (regime === 'trending' || regime === 'breakout') {
    return direction === 'bearish' ? 'trending_down' : 'trending_up'
  }
  return 'ranging'
}

function classifyGexRegime(
  netGex: number | undefined,
  flipPoint: number | undefined,
  spotPrice: number,
): GexRegime {
  if (netGex == null) return 'positive_gamma'

  // Near the flip point (within 0.5%)
  if (flipPoint != null && Math.abs(spotPrice - flipPoint) / spotPrice < 0.005) {
    return 'near_flip'
  }

  return netGex >= 0 ? 'positive_gamma' : 'negative_gamma'
}

function classifyTimeBucket(): TimeBucket {
  const now = new Date()
  // Convert to Eastern time approximation (UTC-5 / UTC-4)
  const utcHour = now.getUTCHours()
  const utcMinute = now.getUTCMinutes()
  const etHour = (utcHour - 5 + 24) % 24 // Simplified EST offset

  if (etHour < 10 || (etHour === 9 && utcMinute >= 30)) return 'open'
  if (etHour < 11 || (etHour === 10)) return 'mid_morning'
  if (etHour < 14) return 'lunch'
  if (etHour < 15 || (etHour === 14 && utcMinute >= 30)) return 'power_hour'
  return 'close'
}

/**
 * Builds regime tags from the current SPX engine state.
 */
export function buildRegimeTags(snapshot: SPXEngineSnapshot): RegimeTags {
  return {
    vix_bucket: classifyVixBucket(snapshot.vixSpot),
    trend_state: classifyTrendState(snapshot.regime, snapshot.regimeDirection),
    gex_regime: classifyGexRegime(snapshot.netGex, snapshot.gexFlipPoint, snapshot.spotPrice),
    time_bucket: classifyTimeBucket(),
    regime_confidence: (snapshot.regimeConfidence ?? 0) >= 0.6 ? 'high' : 'low',
  }
}

/**
 * Builds a full market context object suitable for storing in journal_entries.market_context.
 *
 * This merges the existing MarketContextSnapshot shape with regime tags.
 * The result can be passed directly to the journal API's market_context field.
 */
export function buildMarketContext(
  snapshot: SPXEngineSnapshot,
  exitSnapshot?: SPXEngineSnapshot | null,
): Record<string, unknown> {
  const distance = (price: number, level: number | undefined) =>
    level != null && level > 0 ? Math.round((price - level) * 100) / 100 : 0

  const nearestLevel = snapshot.nearestLevel ?? { name: 'VWAP', price: snapshot.vwap, distance: 0 }
  const nearestLevelDistance = Math.abs(snapshot.spotPrice - nearestLevel.price)

  const entryContext = {
    timestamp: new Date().toISOString(),
    price: snapshot.spotPrice,
    vwap: snapshot.vwap,
    atr14: snapshot.atr14,
    volumeVsAvg: snapshot.volumeVsAvg ?? 1,
    distanceFromPDH: distance(snapshot.spotPrice, snapshot.pdh),
    distanceFromPDL: distance(snapshot.spotPrice, snapshot.pdl),
    nearestLevel: {
      name: nearestLevel.name,
      price: nearestLevel.price,
      distance: Math.round(nearestLevelDistance * 100) / 100,
    },
  }

  const exitContext = exitSnapshot
    ? {
        timestamp: new Date().toISOString(),
        price: exitSnapshot.spotPrice,
        vwap: exitSnapshot.vwap,
        atr14: exitSnapshot.atr14,
        volumeVsAvg: exitSnapshot.volumeVsAvg ?? 1,
        distanceFromPDH: distance(exitSnapshot.spotPrice, exitSnapshot.pdh),
        distanceFromPDL: distance(exitSnapshot.spotPrice, exitSnapshot.pdl),
        nearestLevel: exitSnapshot.nearestLevel
          ? {
              name: exitSnapshot.nearestLevel.name,
              price: exitSnapshot.nearestLevel.price,
              distance: Math.round(Math.abs(exitSnapshot.spotPrice - exitSnapshot.nearestLevel.price) * 100) / 100,
            }
          : entryContext.nearestLevel,
      }
    : entryContext

  const dayContext = {
    marketTrend: snapshot.regimeDirection === 'bearish'
      ? 'bearish' as const
      : snapshot.regimeDirection === 'bullish'
        ? 'bullish' as const
        : 'neutral' as const,
    atrUsed: snapshot.atr14,
    sessionType: snapshot.regime === 'trending' || snapshot.regime === 'breakout'
      ? 'trending' as const
      : snapshot.regime === 'compression'
        ? 'range-bound' as const
        : 'volatile' as const,
    keyLevelsActive: {
      pdh: snapshot.pdh ?? 0,
      pdl: snapshot.pdl ?? 0,
      pdc: snapshot.pdc ?? 0,
      vwap: snapshot.vwap,
      atr14: snapshot.atr14,
      pivotPP: snapshot.pivotPP ?? 0,
      pivotR1: snapshot.pivotR1 ?? 0,
      pivotS1: snapshot.pivotS1 ?? 0,
    },
  }

  // Merge standard MarketContextSnapshot with regime tags
  const regimeTags = buildRegimeTags(snapshot)

  return {
    entryContext,
    exitContext,
    dayContext,
    ...regimeTags,
  }
}
