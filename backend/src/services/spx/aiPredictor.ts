import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { classifyCurrentRegime } from './regimeClassifier';
import type { ClusterZone, PredictionState, RegimeState, SPXLevel, UnifiedGEXLandscape } from './types';
import { normalizeProbabilities, nowIso, round } from './utils';

const PREDICTION_CACHE_KEY = 'spx_command_center:prediction';
const PREDICTION_CACHE_TTL_SECONDS = 15;
let predictionInFlight: Promise<PredictionState> | null = null;
type LevelData = {
  levels: SPXLevel[];
  clusters: ClusterZone[];
  generatedAt: string;
};

export async function getPredictionState(options?: {
  forceRefresh?: boolean;
  regimeState?: RegimeState;
  levelData?: LevelData;
  gexLandscape?: UnifiedGEXLandscape;
}): Promise<PredictionState> {
  const regimeState = options?.regimeState;
  const levelData = options?.levelData;
  const gexLandscape = options?.gexLandscape;
  const forceRefresh = options?.forceRefresh === true;
  const hasPrecomputedDependencies = Boolean(regimeState || levelData || gexLandscape);

  if (!forceRefresh && predictionInFlight) {
    return predictionInFlight;
  }

  const run = async (): Promise<PredictionState> => {
  if (!forceRefresh && !hasPrecomputedDependencies) {
    const cached = await cacheGet<PredictionState>(PREDICTION_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const [regime, levels, gex] = await Promise.all([
    regimeState
      ? Promise.resolve(regimeState)
      : classifyCurrentRegime({ forceRefresh }),
    levelData
      ? Promise.resolve(levelData)
      : getMergedLevels({ forceRefresh }),
    gexLandscape
      ? Promise.resolve(gexLandscape)
      : computeUnifiedGEXLandscape({ forceRefresh }),
  ]);

  const spot = gex.spx.spotPrice;
  const upside = levels.clusters
    .filter((zone) => zone.priceLow > spot)
    .sort((a, b) => a.priceLow - b.priceLow)
    .at(0) || null;

  const downside = levels.clusters
    .filter((zone) => zone.priceHigh < spot)
    .sort((a, b) => b.priceHigh - a.priceHigh)
    .at(0) || null;

  const expectedMove = Math.max(4, Math.abs(gex.combined.callWall - gex.combined.putWall) / 3.2);

  const directionRaw = (() => {
    switch (regime.regime) {
      case 'breakout':
        return regime.direction === 'bullish'
          ? { bullish: 58, bearish: 28, neutral: 14 }
          : { bullish: 28, bearish: 58, neutral: 14 };
      case 'trending':
        return regime.direction === 'bullish'
          ? { bullish: 54, bearish: 32, neutral: 14 }
          : { bullish: 32, bearish: 54, neutral: 14 };
      case 'compression':
        return { bullish: 33, bearish: 33, neutral: 34 };
      case 'ranging':
      default:
        return { bullish: 37, bearish: 35, neutral: 28 };
    }
  })();

  const magnitudeRaw = (() => {
    switch (regime.regime) {
      case 'breakout':
        return { small: 12, medium: 40, large: 48 };
      case 'trending':
        return { small: 20, medium: 54, large: 26 };
      case 'compression':
        return { small: 58, medium: 34, large: 8 };
      case 'ranging':
      default:
        return { small: 44, medium: 42, large: 14 };
    }
  })();

  const direction = normalizeProbabilities(Object.entries(directionRaw)) as PredictionState['direction'];
  const magnitude = normalizeProbabilities(Object.entries(magnitudeRaw)) as PredictionState['magnitude'];

  const probabilityCone = [5, 10, 15, 20, 30].map((minutesForward, index) => {
    const spread = expectedMove * (0.3 + index * 0.2);
    const directionalCenter = ((direction.bullish - direction.bearish) / 100) * spread * 0.45;

    return {
      minutesForward,
      high: round(spot + directionalCenter + spread, 2),
      low: round(spot + directionalCenter - spread, 2),
      center: round(spot + directionalCenter, 2),
      confidence: round(Math.max(12, regime.confidence - index * 7), 2),
    };
  });

  const prediction: PredictionState = {
    regime: regime.regime,
    direction,
    magnitude,
    timingWindow: {
      description: regime.regime === 'compression'
        ? 'Compression state: wait for break + flow confirmation before taking directional risk.'
        : regime.regime === 'breakout'
          ? 'Breakout state: momentum continuation setups have higher expectancy.'
          : 'Focus entries around defended zones and avoid mid-range chases.',
      actionable: regime.regime !== 'compression' || regime.confidence >= 70,
    },
    nextTarget: {
      upside: {
        price: upside ? round((upside.priceLow + upside.priceHigh) / 2, 2) : round(spot + expectedMove, 2),
        zone: upside?.type || 'projected',
      },
      downside: {
        price: downside ? round((downside.priceLow + downside.priceHigh) / 2, 2) : round(spot - expectedMove, 2),
        zone: downside?.type || 'projected',
      },
    },
    probabilityCone,
    confidence: round(regime.confidence, 2),
  };

  await cacheSet(PREDICTION_CACHE_KEY, prediction, PREDICTION_CACHE_TTL_SECONDS);

  logger.info('SPX prediction state updated', {
    regime: prediction.regime,
    confidence: prediction.confidence,
    upside: prediction.nextTarget.upside.price,
    downside: prediction.nextTarget.downside.price,
    timestamp: nowIso(),
  });

  return prediction;
  };

  if (forceRefresh) {
    return run();
  }

  predictionInFlight = run();
  try {
    return await predictionInFlight;
  } finally {
    predictionInFlight = null;
  }
}
