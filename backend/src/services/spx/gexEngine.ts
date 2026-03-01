import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { calculateGEXProfile } from '../options/gexCalculator';
import type { GEXProfile as OptionsGEXProfile, GEXStrikeData } from '../options/types';
import type { SymbolProfile } from './symbolProfile';
import { resolveSymbolProfile } from './symbolProfile';
import type { GEXProfile } from './types';
import { nowIso, round } from './utils';

const GEX_CACHE_KEY = 'spx_command_center:gex:unified';
const GEX_CACHE_TTL_SECONDS = 15;
const GEX_STALE_CACHE_KEY = 'spx_command_center:gex:unified:stale';
const GEX_STALE_CACHE_TTL_SECONDS = 300;
const SPY_TO_SPX_GEX_SCALE = 0.1;
const COMBINED_GEX_SPOT_WINDOW_POINTS = 220;
const DEFAULT_PRIMARY_STRIKE_RANGE = 10;
const DEFAULT_CROSS_STRIKE_RANGE = 12;
const DEFAULT_MAX_EXPIRATIONS = 1;
export interface UnifiedGEXLandscapePayload {
  spx: GEXProfile;
  spy: GEXProfile;
  combined: GEXProfile;
}

const gexInFlightBySymbol = new Map<string, Promise<UnifiedGEXLandscapePayload>>();

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    const handle = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    if (typeof handle === 'object' && typeof (handle as NodeJS.Timeout).unref === 'function') {
      (handle as NodeJS.Timeout).unref();
    }
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([promise, timeoutAfter(timeoutMs)]);
}

function toStrikePair(strike: number, gex: number): { strike: number; gex: number } {
  return {
    strike: round(strike, 2),
    gex: round(gex, 2),
  };
}

function toInternalProfile(
  symbol: 'SPX' | 'SPY' | 'COMBINED',
  profile: OptionsGEXProfile,
  strikeTransform: (value: number) => number = (value) => value,
): GEXProfile {
  const converted = profile.gexByStrike.map((item) => ({
    strike: strikeTransform(item.strike),
    gex: item.gexValue,
  }));

  const callWall = converted
    .filter((item) => item.gex > 0)
    .sort((a, b) => b.gex - a.gex)
    .at(0)?.strike ?? strikeTransform(profile.maxGEXStrike ?? profile.spotPrice);

  const putWall = converted
    .filter((item) => item.gex < 0)
    .sort((a, b) => a.gex - b.gex)
    .at(0)?.strike ?? strikeTransform(profile.maxGEXStrike ?? profile.spotPrice);

  const flipPoint = strikeTransform(profile.flipPoint ?? profile.spotPrice);

  const keyLevels = converted
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 10)
    .map((item) => ({
      strike: round(item.strike, 2),
      gex: round(item.gex, 2),
      type: item.gex >= 0 ? 'call_wall' as const : 'put_wall' as const,
    }));

  return {
    symbol,
    spotPrice: round(profile.spotPrice, 2),
    netGex: round(converted.reduce((sum, item) => sum + item.gex, 0), 2),
    flipPoint: round(flipPoint, 2),
    callWall: round(callWall, 2),
    putWall: round(putWall, 2),
    zeroGamma: round(flipPoint, 2),
    gexByStrike: converted.map((item) => toStrikePair(item.strike, item.gex)),
    keyLevels,
    expirationBreakdown: {},
    timestamp: profile.calculatedAt || nowIso(),
  };
}

function mergeStrikeMaps(
  spx: GEXStrikeData[],
  spy: GEXStrikeData[],
  basis: number,
  spyToSpxScale: number,
): Array<{ strike: number; gex: number }> {
  const merged = new Map<number, number>();

  const addValue = (strike: number, gex: number): void => {
    const roundedStrike = round(strike, 1);
    merged.set(roundedStrike, (merged.get(roundedStrike) || 0) + gex);
  };

  for (const level of spx) {
    addValue(level.strike, level.gexValue);
  }

  for (const level of spy) {
    const convertedStrike = level.strike * 10 + basis;
    // Convert SPY gamma exposure into SPX-point context.
    // SPY is ~1/10th SPX index level, so 1 SPX point ~= 0.1 SPY point.
    addValue(convertedStrike, level.gexValue * spyToSpxScale);
  }

  return Array.from(merged.entries())
    .map(([strike, gex]) => ({ strike, gex: round(gex, 2) }))
    .sort((a, b) => a.strike - b.strike);
}

function buildCombinedProfile(
  spxProfile: OptionsGEXProfile,
  spyProfile: OptionsGEXProfile,
  config?: {
    strikeWindowPoints?: number;
    spyToSpxScale?: number;
  },
): GEXProfile {
  const strikeWindowPoints = config?.strikeWindowPoints ?? COMBINED_GEX_SPOT_WINDOW_POINTS;
  const spyToSpxScale = config?.spyToSpxScale ?? SPY_TO_SPX_GEX_SCALE;
  const basis = spxProfile.spotPrice - spyProfile.spotPrice * 10;
  const mergedStrikePairs = mergeStrikeMaps(spxProfile.gexByStrike, spyProfile.gexByStrike, basis, spyToSpxScale);
  const contextualStrikePairs = mergedStrikePairs.filter((item) => (
    Math.abs(item.strike - spxProfile.spotPrice) <= strikeWindowPoints
  ));
  const strikePairs = contextualStrikePairs.length >= 16 ? contextualStrikePairs : mergedStrikePairs;

  const callWall = strikePairs
    .filter((item) => item.gex > 0)
    .sort((a, b) => b.gex - a.gex)
    .at(0)?.strike ?? spxProfile.spotPrice;

  const putWall = strikePairs
    .filter((item) => item.gex < 0)
    .sort((a, b) => a.gex - b.gex)
    .at(0)?.strike ?? spxProfile.spotPrice;

  const flipPoint = strikePairs
    .sort((a, b) => Math.abs(a.gex) - Math.abs(b.gex))
    .at(0)?.strike ?? spxProfile.spotPrice;

  const keyLevels = [...strikePairs]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 10)
    .map((item) => ({
      strike: round(item.strike, 2),
      gex: round(item.gex, 2),
      type: item.gex >= 0 ? 'call_wall' as const : 'put_wall' as const,
    }));

  return {
    symbol: 'COMBINED',
    spotPrice: round(spxProfile.spotPrice, 2),
    netGex: round(strikePairs.reduce((sum, item) => sum + item.gex, 0), 2),
    flipPoint: round(flipPoint, 2),
    callWall: round(callWall, 2),
    putWall: round(putWall, 2),
    zeroGamma: round(flipPoint, 2),
    gexByStrike: strikePairs,
    keyLevels,
    expirationBreakdown: {},
    timestamp: nowIso(),
  };
}

function buildSyntheticSpyProfile(spxProfile: OptionsGEXProfile, crossSymbol: string): OptionsGEXProfile {
  const estimatedSpySpot = round(spxProfile.spotPrice / 10, 2);
  const estimatedSpyFlip = spxProfile.flipPoint != null ? round(spxProfile.flipPoint / 10, 2) : estimatedSpySpot;
  const estimatedSpyMaxGex = spxProfile.maxGEXStrike != null ? round(spxProfile.maxGEXStrike / 10, 2) : estimatedSpySpot;

  return {
    symbol: crossSymbol,
    spotPrice: estimatedSpySpot,
    gexByStrike: [],
    flipPoint: estimatedSpyFlip,
    maxGEXStrike: estimatedSpyMaxGex,
    keyLevels: [],
    regime: spxProfile.regime,
    implication: `Synthetic ${crossSymbol} profile fallback (derived from SPX context).`,
    calculatedAt: nowIso(),
    expirationsAnalyzed: spxProfile.expirationsAnalyzed,
  };
}

function cacheKeyForSymbol(baseKey: string, symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  return normalized === 'SPX' ? baseKey : `${baseKey}:${normalized}`;
}

export async function computeUnifiedGEXLandscape(options?: {
  forceRefresh?: boolean;
  strikeRange?: number;
  maxExpirations?: number;
  symbol?: string;
  profile?: SymbolProfile | null;
}): Promise<UnifiedGEXLandscapePayload> {
  const profile = await resolveSymbolProfile({
    symbol: options?.symbol,
    profile: options?.profile ?? null,
  });
  const symbol = profile.symbol;
  const cacheKey = cacheKeyForSymbol(GEX_CACHE_KEY, symbol);
  const staleCacheKey = cacheKeyForSymbol(GEX_STALE_CACHE_KEY, symbol);

  const inFlight = gexInFlightBySymbol.get(symbol);
  if (inFlight) {
    return inFlight;
  }

  const forceRefresh = options?.forceRefresh === true;

  const run = async (): Promise<UnifiedGEXLandscapePayload> => {
    if (!forceRefresh) {
      const cached = await cacheGet<UnifiedGEXLandscapePayload>(cacheKey);
      if (cached) {
        return cached;
      }

      const staleCached = await cacheGet<UnifiedGEXLandscapePayload>(staleCacheKey);
      if (staleCached) {
        return staleCached;
      }
    }

    const crossSymbol = profile.gex.crossSymbol;
    const primaryStrikeRange = options?.strikeRange ?? DEFAULT_PRIMARY_STRIKE_RANGE;
    const crossStrikeRange = options?.strikeRange ?? DEFAULT_CROSS_STRIKE_RANGE;
    const maxExpirations = options?.maxExpirations ?? DEFAULT_MAX_EXPIRATIONS;
    const crossScale = profile.gex.scalingFactor;
    const strikeWindowPoints = profile.gex.strikeWindowPoints;

    const spxRaw = await withTimeout(calculateGEXProfile(symbol, {
      strikeRange: primaryStrikeRange,
      maxExpirations,
      forceRefresh,
    }), 22_000);

    let spyRaw: OptionsGEXProfile;
    try {
      spyRaw = await withTimeout(calculateGEXProfile(crossSymbol, {
        strikeRange: crossStrikeRange,
        maxExpirations,
        // Prefer cached SPY profile during force refresh to keep SPX snapshot latency bounded.
        forceRefresh: false,
      }), 8_000);
    } catch (error) {
      logger.warn('SPX unified GEX using synthetic cross-symbol fallback', {
        symbol,
        crossSymbol,
        error: error instanceof Error ? error.message : String(error),
      });
      spyRaw = buildSyntheticSpyProfile(spxRaw, crossSymbol);
    }

    const basis = spxRaw.spotPrice - spyRaw.spotPrice * 10;

    // Derive per-expiry breakdown from the aggregate profile data already fetched
    // instead of re-fetching each expiration individually (which doubles API calls).
    const spx = {
      ...toInternalProfile('SPX', spxRaw),
      expirationBreakdown: {} as Record<string, { netGex: number; callWall: number; putWall: number }>,
    };
    const spy = {
      ...toInternalProfile('SPY', spyRaw, (strike) => strike * 10 + basis),
      expirationBreakdown: {} as Record<string, { netGex: number; callWall: number; putWall: number }>,
    };
    const combined = {
      ...buildCombinedProfile(spxRaw, spyRaw, {
        strikeWindowPoints,
        spyToSpxScale: crossScale,
      }),
      expirationBreakdown: {} as Record<string, { netGex: number; callWall: number; putWall: number }>,
    };

    const payload = { spx, spy, combined };
    await Promise.all([
      cacheSet(cacheKey, payload, GEX_CACHE_TTL_SECONDS),
      cacheSet(staleCacheKey, payload, GEX_STALE_CACHE_TTL_SECONDS),
    ]);

    logger.info('SPX command center GEX landscape updated', {
      symbol,
      crossSymbol,
      spxNetGex: spx.netGex,
      spyNetGex: spy.netGex,
      combinedNetGex: combined.netGex,
      flipPoint: combined.flipPoint,
      combinedStrikes: combined.gexByStrike.length,
    });

    return payload;
  };

  const promise = run();
  gexInFlightBySymbol.set(symbol, promise);
  try {
    return await promise;
  } finally {
    gexInFlightBySymbol.delete(symbol);
  }
}

export async function getCachedUnifiedGEXLandscape(options?: {
  symbol?: string;
  profile?: SymbolProfile | null;
}): Promise<UnifiedGEXLandscapePayload | null> {
  const profile = await resolveSymbolProfile({
    symbol: options?.symbol,
    profile: options?.profile ?? null,
  });
  const symbol = profile.symbol;
  const cacheKey = cacheKeyForSymbol(GEX_CACHE_KEY, symbol);
  const staleCacheKey = cacheKeyForSymbol(GEX_STALE_CACHE_KEY, symbol);

  const cached = await cacheGet<UnifiedGEXLandscapePayload>(cacheKey);
  if (cached) {
    return cached;
  }
  const staleCached = await cacheGet<UnifiedGEXLandscapePayload>(staleCacheKey);
  return staleCached || null;
}
