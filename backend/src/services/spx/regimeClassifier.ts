import { cacheGet, cacheSet } from '../../config/redis';
import { getMinuteAggregates } from '../../config/massive';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import type { ClusterZone, RegimeState, SPXLevel, UnifiedGEXLandscape } from './types';
import { classifyRegimeFromSignals, ema, nowIso, round } from './utils';

const REGIME_CACHE_KEY = 'spx_command_center:regime';
const REGIME_CACHE_TTL_SECONDS = 15;
let regimeInFlight: Promise<RegimeState> | null = null;
type LevelData = {
  levels: SPXLevel[];
  clusters: ClusterZone[];
  generatedAt: string;
};
interface SessionTrendContext {
  volumeTrend: 'rising' | 'flat' | 'falling';
  trendStrength: number;
}

const REGIME_EMA_FAST_PERIOD = 21;
const REGIME_EMA_SLOW_PERIOD = 55;
const REGIME_TREND_SPREAD_POINTS = 8;
const REGIME_TREND_SLOPE_POINTS = 2.4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDateKey(): string {
  return toEasternTime(new Date()).dateStr;
}

function trendStrengthFromBars(bars: Array<{ c: number }>): number {
  const closes = bars
    .map((bar) => bar.c)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (closes.length < 8) return 0;

  const emaFast = ema(closes, Math.min(REGIME_EMA_FAST_PERIOD, closes.length));
  const emaSlow = ema(closes, Math.min(REGIME_EMA_SLOW_PERIOD, closes.length));

  const priorCloses = closes.slice(0, -3);
  const emaFastPrior = priorCloses.length > 0
    ? ema(priorCloses, Math.min(REGIME_EMA_FAST_PERIOD, priorCloses.length))
    : emaFast;

  const spreadScore = clamp(Math.abs(emaFast - emaSlow) / REGIME_TREND_SPREAD_POINTS, 0, 1);
  const slopeScore = clamp(Math.abs(emaFast - emaFastPrior) / REGIME_TREND_SLOPE_POINTS, 0, 1);
  return round((spreadScore * 0.55) + (slopeScore * 0.45), 4);
}

function volumeTrendFromBars(bars: Array<{ v: number }>): 'rising' | 'flat' | 'falling' {
  if (bars.length < 15) return 'flat';

  const last = bars.slice(-5).reduce((sum, bar) => sum + bar.v, 0) / 5;
  const prior = bars.slice(-10, -5).reduce((sum, bar) => sum + bar.v, 0) / 5;
  if (!Number.isFinite(last) || !Number.isFinite(prior) || prior <= 0) {
    return 'flat';
  }

  const ratio = last / prior;
  if (ratio > 1.2) return 'rising';
  if (ratio < 0.85) return 'falling';
  return 'flat';
}

async function getSessionTrendContext(): Promise<SessionTrendContext> {
  try {
    const bars = await getMinuteAggregates('I:SPX', getDateKey());
    if (!Array.isArray(bars) || bars.length < 8) {
      return {
        volumeTrend: 'flat',
        trendStrength: 0,
      };
    }

    return {
      volumeTrend: volumeTrendFromBars(bars),
      trendStrength: trendStrengthFromBars(bars),
    };
  } catch {
    return {
      volumeTrend: 'flat',
      trendStrength: 0,
    };
  }
}

function computeDirectionProbability(input: {
  spot: number;
  flip: number;
  regime: RegimeState['regime'];
}): { direction: RegimeState['direction']; probability: number; magnitude: RegimeState['magnitude']; confidence: number } {
  const distance = input.spot - input.flip;
  const directionalBias = Math.max(-1, Math.min(1, distance / 12));

  let base = 52 + directionalBias * 18;
  if (input.regime === 'breakout') base += 7;
  if (input.regime === 'compression') base -= 8;

  const bullishProb = Math.max(1, Math.min(99, base));
  const bearishProb = 100 - bullishProb;

  const direction: RegimeState['direction'] = Math.abs(bullishProb - bearishProb) < 6
    ? 'neutral'
    : bullishProb > bearishProb
      ? 'bullish'
      : 'bearish';

  const confidence = Math.max(30, Math.min(95, Math.abs(bullishProb - bearishProb) + (input.regime === 'breakout' ? 18 : 10)));

  const magnitude: RegimeState['magnitude'] = input.regime === 'breakout'
    ? 'large'
    : input.regime === 'trending'
      ? 'medium'
      : input.regime === 'compression'
        ? 'small'
        : 'medium';

  return {
    direction,
    probability: round(direction === 'bullish' ? bullishProb : direction === 'bearish' ? bearishProb : 100 - Math.abs(bullishProb - bearishProb), 2),
    magnitude,
    confidence: round(confidence, 2),
  };
}

export async function classifyCurrentRegime(options?: {
  forceRefresh?: boolean;
  gexLandscape?: UnifiedGEXLandscape;
  levelData?: LevelData;
  volumeTrend?: 'rising' | 'flat' | 'falling';
  trendStrength?: number;
}): Promise<RegimeState> {
  const gexLandscape = options?.gexLandscape;
  const levelData = options?.levelData;
  const providedVolumeTrend = options?.volumeTrend;
  const providedTrendStrength = options?.trendStrength;
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedDependencies = Boolean(
    gexLandscape
      || levelData
      || providedVolumeTrend
      || Number.isFinite(providedTrendStrength),
  );
  if (!forceRefresh && regimeInFlight) {
    return regimeInFlight;
  }

  const run = async (): Promise<RegimeState> => {
  if (!forceRefresh && !hasPrecomputedDependencies) {
    const cached = await cacheGet<RegimeState>(REGIME_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const shouldFetchTrendContext = (
    providedVolumeTrend == null
    || !Number.isFinite(providedTrendStrength)
  );
  const trendContextPromise = shouldFetchTrendContext
    ? getSessionTrendContext()
    : Promise.resolve<SessionTrendContext>({
      volumeTrend: providedVolumeTrend as SessionTrendContext['volumeTrend'],
      trendStrength: clamp(providedTrendStrength as number, 0, 1),
    });

  const [gex, levels, trendContext] = await Promise.all([
    gexLandscape
      ? Promise.resolve(gexLandscape)
      : computeUnifiedGEXLandscape({ forceRefresh }),
    levelData
      ? Promise.resolve(levelData)
      : getMergedLevels({ forceRefresh }),
    trendContextPromise,
  ]);
  const volumeTrend = providedVolumeTrend ?? trendContext.volumeTrend;
  const trendStrength = Number.isFinite(providedTrendStrength)
    ? clamp(providedTrendStrength as number, 0, 1)
    : trendContext.trendStrength;

  const spot = gex.spx.spotPrice;
  const netGex = gex.combined.netGex;
  const fortressOrDefended = levels.clusters.filter((zone) => zone.type === 'fortress' || zone.type === 'defended');

  const containingZone = fortressOrDefended.find((zone) => spot >= zone.priceLow && spot <= zone.priceHigh);
  const zoneContainment = containingZone ? 0.9 : fortressOrDefended.length > 1 ? 0.55 : 0.3;

  const nearestDistance = fortressOrDefended
    .map((zone) => {
      const mid = (zone.priceLow + zone.priceHigh) / 2;
      return Math.abs(spot - mid);
    })
    .sort((a, b) => a - b)[0] ?? 20;

  const rangeCompression = Math.max(0, Math.min(1, 1 - (nearestDistance / 20)));
  const breakoutStrength = Math.max(0, Math.min(1, Math.abs(spot - gex.combined.flipPoint) / 18));

  const regime = classifyRegimeFromSignals({
    netGex,
    volumeTrend,
    rangeCompression,
    breakoutStrength,
    zoneContainment,
    trendStrength,
  });

  const directionStats = computeDirectionProbability({
    spot,
    flip: gex.combined.flipPoint,
    regime,
  });

  const state: RegimeState = {
    regime,
    direction: directionStats.direction,
    probability: directionStats.probability,
    magnitude: directionStats.magnitude,
    confidence: directionStats.confidence,
    timestamp: nowIso(),
  };

  await cacheSet(REGIME_CACHE_KEY, state, REGIME_CACHE_TTL_SECONDS);

  logger.info('SPX regime classified', {
    regime: state.regime,
    direction: state.direction,
    probability: state.probability,
    confidence: state.confidence,
    trendStrength: round(trendStrength, 4),
  });

  return state;
  };

  if (forceRefresh) {
    return run();
  }

  regimeInFlight = run();
  try {
    return await regimeInFlight;
  } finally {
    regimeInFlight = null;
  }
}
