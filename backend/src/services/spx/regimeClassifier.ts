import { cacheGet, cacheSet } from '../../config/redis';
import { getMinuteAggregates } from '../../config/massive';
import { logger } from '../../lib/logger';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import type { RegimeState } from './types';
import { classifyRegimeFromSignals, nowIso, round } from './utils';

const REGIME_CACHE_KEY = 'spx_command_center:regime';
const REGIME_CACHE_TTL_SECONDS = 5;

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getVolumeTrend(): Promise<'rising' | 'flat' | 'falling'> {
  try {
    const bars = await getMinuteAggregates('I:SPX', getDateKey());
    if (!Array.isArray(bars) || bars.length < 15) {
      return 'flat';
    }

    const last = bars.slice(-5).reduce((sum, bar) => sum + bar.v, 0) / 5;
    const prior = bars.slice(-10, -5).reduce((sum, bar) => sum + bar.v, 0) / 5;
    if (!Number.isFinite(last) || !Number.isFinite(prior) || prior <= 0) {
      return 'flat';
    }

    const ratio = last / prior;
    if (ratio > 1.2) return 'rising';
    if (ratio < 0.85) return 'falling';
    return 'flat';
  } catch {
    return 'flat';
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

export async function classifyCurrentRegime(options?: { forceRefresh?: boolean }): Promise<RegimeState> {
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = await cacheGet<RegimeState>(REGIME_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const [gex, levels, volumeTrend] = await Promise.all([
    computeUnifiedGEXLandscape({ forceRefresh }),
    getMergedLevels({ forceRefresh }),
    getVolumeTrend(),
  ]);

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
  });

  return state;
}
