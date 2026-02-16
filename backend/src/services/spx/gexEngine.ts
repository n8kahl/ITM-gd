import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { calculateGEXProfile } from '../options/gexCalculator';
import type { GEXProfile as OptionsGEXProfile, GEXStrikeData } from '../options/types';
import type { GEXProfile } from './types';
import { nowIso, round } from './utils';

const GEX_CACHE_KEY = 'spx_command_center:gex:unified';
const GEX_CACHE_TTL_SECONDS = 15;
let gexInFlight: Promise<{
  spx: GEXProfile;
  spy: GEXProfile;
  combined: GEXProfile;
}> | null = null;

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
    addValue(convertedStrike, level.gexValue);
  }

  return Array.from(merged.entries())
    .map(([strike, gex]) => ({ strike, gex: round(gex, 2) }))
    .sort((a, b) => a.strike - b.strike);
}

function buildCombinedProfile(
  spxProfile: OptionsGEXProfile,
  spyProfile: OptionsGEXProfile,
): GEXProfile {
  const basis = spxProfile.spotPrice - spyProfile.spotPrice * 10;
  const strikePairs = mergeStrikeMaps(spxProfile.gexByStrike, spyProfile.gexByStrike, basis);

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

async function buildProfileExpirationBreakdown(input: {
  symbol: 'SPX' | 'SPY';
  expirations: string[];
  strikeRange: number;
  forceRefresh: boolean;
  strikeTransform?: (value: number) => number;
}): Promise<Record<string, { netGex: number; callWall: number; putWall: number }>> {
  if (input.expirations.length === 0) {
    return {};
  }

  const perExpiry = await Promise.all(
    input.expirations.map(async (expiry) => {
      const profile = await calculateGEXProfile(input.symbol, {
        expiry,
        strikeRange: input.strikeRange,
        maxExpirations: 1,
        forceRefresh: input.forceRefresh,
      });

      const transformed = toInternalProfile(
        input.symbol,
        profile,
        input.strikeTransform || ((value) => value),
      );

      return [
        expiry,
        {
          netGex: transformed.netGex,
          callWall: transformed.callWall,
          putWall: transformed.putWall,
        },
      ] as const;
    }),
  );

  return Object.fromEntries(perExpiry);
}

function combineExpirationBreakdowns(
  spx: Record<string, { netGex: number; callWall: number; putWall: number }>,
  spy: Record<string, { netGex: number; callWall: number; putWall: number }>,
): Record<string, { netGex: number; callWall: number; putWall: number }> {
  const expirations = new Set<string>([
    ...Object.keys(spx),
    ...Object.keys(spy),
  ]);

  const merged: Record<string, { netGex: number; callWall: number; putWall: number }> = {};
  for (const expiry of expirations) {
    const spxPoint = spx[expiry];
    const spyPoint = spy[expiry];
    merged[expiry] = {
      netGex: round((spxPoint?.netGex || 0) + (spyPoint?.netGex || 0), 2),
      callWall: round(spxPoint?.callWall ?? spyPoint?.callWall ?? 0, 2),
      putWall: round(spxPoint?.putWall ?? spyPoint?.putWall ?? 0, 2),
    };
  }

  return merged;
}

export async function computeUnifiedGEXLandscape(options?: {
  forceRefresh?: boolean;
  strikeRange?: number;
  maxExpirations?: number;
}): Promise<{
  spx: GEXProfile;
  spy: GEXProfile;
  combined: GEXProfile;
}> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && gexInFlight) {
    return gexInFlight;
  }

  const run = async (): Promise<{
    spx: GEXProfile;
    spy: GEXProfile;
    combined: GEXProfile;
  }> => {
  if (!forceRefresh) {
    const cached = await cacheGet<{
      spx: GEXProfile;
      spy: GEXProfile;
      combined: GEXProfile;
    }>(GEX_CACHE_KEY);

    if (cached) {
      return cached;
    }
  }

  const spxStrikeRange = options?.strikeRange ?? 30;
  const spyStrikeRange = options?.strikeRange ?? 40;
  const maxExpirations = options?.maxExpirations ?? 6;

  const [spxRaw, spyRaw] = await Promise.all([
    calculateGEXProfile('SPX', {
      strikeRange: spxStrikeRange,
      maxExpirations,
      forceRefresh,
    }),
    calculateGEXProfile('SPY', {
      strikeRange: spyStrikeRange,
      maxExpirations,
      forceRefresh,
    }),
  ]);

  const basis = spxRaw.spotPrice - spyRaw.spotPrice * 10;
  const [spxBreakdown, spyBreakdown] = await Promise.all([
    buildProfileExpirationBreakdown({
      symbol: 'SPX',
      expirations: spxRaw.expirationsAnalyzed,
      strikeRange: spxStrikeRange,
      forceRefresh,
    }),
    buildProfileExpirationBreakdown({
      symbol: 'SPY',
      expirations: spyRaw.expirationsAnalyzed,
      strikeRange: spyStrikeRange,
      forceRefresh,
      strikeTransform: (strike) => strike * 10 + basis,
    }),
  ]);

  const spx = {
    ...toInternalProfile('SPX', spxRaw),
    expirationBreakdown: spxBreakdown,
  };
  const spy = {
    ...toInternalProfile('SPY', spyRaw, (strike) => strike * 10 + basis),
    expirationBreakdown: spyBreakdown,
  };
  const combined = {
    ...buildCombinedProfile(spxRaw, spyRaw),
    expirationBreakdown: combineExpirationBreakdowns(spxBreakdown, spyBreakdown),
  };

  const payload = { spx, spy, combined };
  await cacheSet(GEX_CACHE_KEY, payload, GEX_CACHE_TTL_SECONDS);

  logger.info('SPX command center GEX landscape updated', {
    spxNetGex: spx.netGex,
    spyNetGex: spy.netGex,
    combinedNetGex: combined.netGex,
    flipPoint: combined.flipPoint,
  });

  return payload;
  };

  if (forceRefresh) {
    return run();
  }

  gexInFlight = run();
  try {
    return await gexInFlight;
  } finally {
    gexInFlight = null;
  }
}
