import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { getFibLevels } from './fibEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { classifyCurrentRegime } from './regimeClassifier';
import type { ClusterZone, Regime, Setup, SetupType } from './types';
import { nowIso, round, stableId } from './utils';

const SETUPS_CACHE_KEY = 'spx_command_center:setups';
const SETUPS_CACHE_TTL_SECONDS = 10;
const WIN_RATE_BY_SCORE: Record<number, number> = {
  1: 35,
  2: 45,
  3: 58,
  4: 71,
  5: 82,
};

function setupTypeForRegime(regime: Regime): SetupType {
  switch (regime) {
    case 'ranging':
      return 'fade_at_wall';
    case 'breakout':
      return 'breakout_vacuum';
    case 'trending':
      return 'trend_continuation';
    case 'compression':
    default:
      return 'mean_reversion';
  }
}

function isRegimeAligned(type: SetupType, regime: Regime): boolean {
  return (
    (type === 'fade_at_wall' && regime === 'ranging')
    || (type === 'breakout_vacuum' && regime === 'breakout')
    || (type === 'trend_continuation' && regime === 'trending')
    || (type === 'mean_reversion' && regime === 'compression')
  );
}

function setupDirection(zone: ClusterZone, currentPrice: number): 'bullish' | 'bearish' {
  const center = (zone.priceLow + zone.priceHigh) / 2;
  return center <= currentPrice ? 'bullish' : 'bearish';
}

function getTargetPrice(
  zones: ClusterZone[],
  currentPrice: number,
  direction: 'bullish' | 'bearish',
  fallbackDistance: number,
): { target1: number; target2: number } {
  const sorted = [...zones].sort((a, b) => a.priceLow - b.priceLow);

  if (direction === 'bullish') {
    const above = sorted.filter((zone) => zone.priceLow > currentPrice);
    const first = above[0];
    const second = above[1];
    return {
      target1: first ? round((first.priceLow + first.priceHigh) / 2, 2) : round(currentPrice + fallbackDistance, 2),
      target2: second ? round((second.priceLow + second.priceHigh) / 2, 2) : round(currentPrice + fallbackDistance * 2, 2),
    };
  }

  const below = sorted.filter((zone) => zone.priceHigh < currentPrice).sort((a, b) => b.priceHigh - a.priceHigh);
  const first = below[0];
  const second = below[1];
  return {
    target1: first ? round((first.priceLow + first.priceHigh) / 2, 2) : round(currentPrice - fallbackDistance, 2),
    target2: second ? round((second.priceLow + second.priceHigh) / 2, 2) : round(currentPrice - fallbackDistance * 2, 2),
  };
}

function calculateConfluence(input: {
  zone: ClusterZone;
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  flipPoint: number;
  netGex: number;
  fibTouch: boolean;
  regimeAligned: boolean;
  flowConfirmed: boolean;
}): { score: number; sources: string[] } {
  const sources: string[] = [];

  if (input.zone.type === 'fortress' || input.zone.type === 'defended') {
    sources.push('level_quality');
  }

  const gexAligned = input.direction === 'bullish'
    ? input.currentPrice >= input.flipPoint || input.netGex > 0
    : input.currentPrice <= input.flipPoint || input.netGex < 0;

  if (gexAligned) sources.push('gex_alignment');
  if (input.flowConfirmed) sources.push('flow_confirmation');
  if (input.fibTouch) sources.push('fibonacci_touch');
  if (input.regimeAligned) sources.push('regime_alignment');

  return {
    score: Math.min(5, sources.length),
    sources,
  };
}

function pickCandidateZones(zones: ClusterZone[], currentPrice: number): ClusterZone[] {
  return [...zones]
    .map((zone) => {
      const center = (zone.priceLow + zone.priceHigh) / 2;
      return {
        zone,
        distance: Math.abs(center - currentPrice),
      };
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.zone.clusterScore - a.zone.clusterScore;
    })
    .slice(0, 8)
    .map((item) => item.zone);
}

export async function detectActiveSetups(options?: { forceRefresh?: boolean }): Promise<Setup[]> {
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = await cacheGet<Setup[]>(SETUPS_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const [levels, gex, fibLevels, regimeState] = await Promise.all([
    getMergedLevels({ forceRefresh }),
    computeUnifiedGEXLandscape({ forceRefresh }),
    getFibLevels({ forceRefresh }),
    classifyCurrentRegime({ forceRefresh }),
  ]);

  const currentPrice = gex.spx.spotPrice;
  const candidateZones = pickCandidateZones(levels.clusters, currentPrice);
  const setupType = setupTypeForRegime(regimeState.regime);

  const sessionDate = new Date().toISOString().slice(0, 10);

  const setups: Setup[] = candidateZones.map((zone, idx) => {
    const direction = setupDirection(zone, currentPrice);
    const zoneCenter = (zone.priceLow + zone.priceHigh) / 2;

    const fibTouch = fibLevels.some((fib) => Math.abs(fib.price - zoneCenter) <= 0.5);
    const flowConfirmed = Math.abs(zoneCenter - currentPrice) <= 8 && zone.clusterScore >= 3;
    const regimeAligned = isRegimeAligned(setupType, regimeState.regime);

    const confluence = calculateConfluence({
      zone,
      direction,
      currentPrice,
      flipPoint: gex.combined.flipPoint,
      netGex: gex.combined.netGex,
      fibTouch,
      regimeAligned,
      flowConfirmed,
    });

    const fallbackDistance = Math.max(6, Math.abs(gex.combined.callWall - gex.combined.putWall) / 4);
    const { target1, target2 } = getTargetPrice(levels.clusters, zoneCenter, direction, fallbackDistance);

    const entryLow = round(zone.priceLow, 2);
    const entryHigh = round(zone.priceHigh, 2);
    const stop = direction === 'bullish'
      ? round(zone.priceLow - (zone.type === 'fortress' ? 2.5 : 1.5), 2)
      : round(zone.priceHigh + (zone.type === 'fortress' ? 2.5 : 1.5), 2);

    let status: Setup['status'] = confluence.score >= 3 ? 'ready' : 'forming';
    if (currentPrice >= entryLow && currentPrice <= entryHigh) {
      status = 'triggered';
    }

    const setupIdSeed = [
      sessionDate,
      setupType,
      direction,
      round(zone.priceLow, 2),
      round(zone.priceHigh, 2),
      round(zone.clusterScore, 2),
      idx + 1,
    ].join('|');

    return {
      id: stableId('spx_setup', setupIdSeed),
      type: setupType,
      direction,
      entryZone: { low: entryLow, high: entryHigh },
      stop,
      target1: { price: target1, label: 'Target 1' },
      target2: { price: target2, label: 'Target 2' },
      confluenceScore: confluence.score,
      confluenceSources: confluence.sources,
      clusterZone: zone,
      regime: regimeState.regime,
      status,
      probability: WIN_RATE_BY_SCORE[confluence.score] || 32,
      recommendedContract: null,
      createdAt: nowIso(),
      triggeredAt: status === 'triggered' ? nowIso() : null,
    };
  });

  await cacheSet(SETUPS_CACHE_KEY, setups, SETUPS_CACHE_TTL_SECONDS);

  logger.info('SPX setups detected', {
    count: setups.length,
    ready: setups.filter((setup) => setup.status === 'ready').length,
    triggered: setups.filter((setup) => setup.status === 'triggered').length,
  });

  return setups;
}

export async function getSetupById(id: string, options?: { forceRefresh?: boolean }): Promise<Setup | null> {
  const setups = await detectActiveSetups(options);
  return setups.find((setup) => setup.id === id) || null;
}
