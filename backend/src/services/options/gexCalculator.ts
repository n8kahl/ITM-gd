import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { fetchExpirationDates, fetchOptionsChain } from './optionsChainFetcher';
import { GEXKeyLevel, GEXProfile, GEXStrikeData } from './types';

interface CalculateGEXOptions {
  expiry?: string;
  strikeRange?: number;
  maxExpirations?: number;
  forceRefresh?: boolean;
}

interface StrikeAccumulator {
  strike: number;
  callGex: number;
  putGex: number;
  callGammaOi: number;
  putGammaOi: number;
  callOI: number;
  putOI: number;
}

const GEX_CACHE_TTL_SECONDS = 300;
const DEFAULT_STRIKE_RANGE = 30;
const DEFAULT_MAX_EXPIRATIONS = 6;
const MAX_EXPIRATIONS_ALLOWED = 12;
const SUPPORTED_SYMBOLS = new Set(['SPX', 'NDX']);

function roundNumber(value: number, decimals: number = 2): number {
  return Number(value.toFixed(decimals));
}

function calculateContractGex(
  gamma: number | undefined,
  openInterest: number,
  spotPrice: number,
): number {
  if (!gamma || gamma <= 0 || !Number.isFinite(openInterest) || openInterest <= 0) {
    return 0;
  }

  return gamma * openInterest * 100 * spotPrice * spotPrice * 0.01;
}

function averageGamma(gammaOi: number, oi: number): number {
  if (!Number.isFinite(gammaOi) || !Number.isFinite(oi) || oi <= 0) {
    return 0;
  }
  return gammaOi / oi;
}

function buildImplication(
  regime: GEXProfile['regime'],
  flipPoint: number | null,
  maxGEXStrike: number | null,
): string {
  const base = regime === 'positive_gamma'
    ? 'Positive gamma regime: market makers are more likely to dampen moves (mean reversion bias).'
    : 'Negative gamma regime: market makers may amplify moves (trend/volatility bias).';

  const extras: string[] = [];
  if (flipPoint !== null) {
    extras.push(`Flip point near ${roundNumber(flipPoint)} marks potential regime transition.`);
  }
  if (maxGEXStrike !== null) {
    extras.push(`Max GEX strike near ${roundNumber(maxGEXStrike)} can act as a magnetic level.`);
  }

  return extras.length > 0 ? `${base} ${extras.join(' ')}` : base;
}

function findFlipPoint(points: GEXStrikeData[]): number | null {
  if (points.length < 2) return null;

  let cumulative = 0;
  let previousSign = 0;

  for (const point of points) {
    cumulative += point.gexValue;
    const sign = cumulative === 0 ? 0 : cumulative > 0 ? 1 : -1;

    if (previousSign !== 0 && sign !== 0 && sign !== previousSign) {
      return point.strike;
    }

    if (sign !== 0) {
      previousSign = sign;
    }
  }

  return null;
}

function buildKeyLevels(
  points: GEXStrikeData[],
  maxGEXStrike: number | null,
): GEXKeyLevel[] {
  if (points.length === 0) return [];

  const absValues = points.map((point) => Math.abs(point.gexValue));
  const meanAbs = absValues.reduce((sum, value) => sum + value, 0) / absValues.length;
  const variance = absValues.reduce((sum, value) => sum + (value - meanAbs) ** 2, 0) / absValues.length;
  const stdAbs = Math.sqrt(variance);
  const threshold = meanAbs + stdAbs;

  return points
    .filter((point) => Math.abs(point.gexValue) >= threshold)
    .map((point) => {
      let type: GEXKeyLevel['type'] = point.gexValue >= 0 ? 'support' : 'resistance';
      if (maxGEXStrike !== null && point.strike === maxGEXStrike) {
        type = 'magnet';
      }

      return {
        strike: roundNumber(point.strike),
        gexValue: roundNumber(point.gexValue, 0),
        type,
      };
    })
    .sort((a, b) => Math.abs(b.gexValue) - Math.abs(a.gexValue))
    .slice(0, 10);
}

function buildCacheKey(symbol: string, options: Required<Pick<CalculateGEXOptions, 'strikeRange' | 'maxExpirations'>> & { expiry?: string }): string {
  return `options:gex:${symbol}:${options.expiry || 'multi'}:${options.strikeRange}:${options.maxExpirations}`;
}

export async function calculateGEXProfile(
  symbolInput: string,
  options?: CalculateGEXOptions,
): Promise<GEXProfile> {
  const symbol = symbolInput.toUpperCase();
  if (!SUPPORTED_SYMBOLS.has(symbol)) {
    throw new Error(`Symbol '${symbol}' is not supported for GEX analysis. Supported symbols: SPX, NDX`);
  }

  const strikeRange = Math.max(5, Math.min(50, options?.strikeRange ?? DEFAULT_STRIKE_RANGE));
  const maxExpirations = Math.max(1, Math.min(MAX_EXPIRATIONS_ALLOWED, options?.maxExpirations ?? DEFAULT_MAX_EXPIRATIONS));
  const cacheKey = buildCacheKey(symbol, {
    expiry: options?.expiry,
    strikeRange,
    maxExpirations,
  });

  if (!options?.forceRefresh) {
    const cached = await cacheGet<GEXProfile>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const expirations = options?.expiry
    ? [options.expiry]
    : (await fetchExpirationDates(symbol)).slice(0, maxExpirations);

  if (expirations.length === 0) {
    throw new Error(`No options expirations found for ${symbol}`);
  }

  const strikeMap = new Map<number, StrikeAccumulator>();
  let spotPrice = 0;

  for (const expiry of expirations) {
    const chain = await fetchOptionsChain(symbol, expiry, strikeRange);
    spotPrice = chain.currentPrice;

    for (const call of chain.options.calls) {
      const existing = strikeMap.get(call.strike) || {
        strike: call.strike,
        callGex: 0,
        putGex: 0,
        callGammaOi: 0,
        putGammaOi: 0,
        callOI: 0,
        putOI: 0,
      };

      const oi = Number(call.openInterest || 0);
      const gamma = Number(call.gamma || 0);
      const gex = calculateContractGex(gamma, oi, chain.currentPrice);

      existing.callGex += gex;
      existing.callGammaOi += gamma * oi;
      existing.callOI += oi;

      strikeMap.set(call.strike, existing);
    }

    for (const put of chain.options.puts) {
      const existing = strikeMap.get(put.strike) || {
        strike: put.strike,
        callGex: 0,
        putGex: 0,
        callGammaOi: 0,
        putGammaOi: 0,
        callOI: 0,
        putOI: 0,
      };

      const oi = Number(put.openInterest || 0);
      const gamma = Number(put.gamma || 0);
      const gex = calculateContractGex(gamma, oi, chain.currentPrice);

      existing.putGex += gex;
      existing.putGammaOi += gamma * oi;
      existing.putOI += oi;

      strikeMap.set(put.strike, existing);
    }
  }

  if (strikeMap.size === 0 || spotPrice <= 0) {
    throw new Error(`Insufficient options data to calculate GEX for ${symbol}`);
  }

  const gexByStrike: GEXStrikeData[] = Array.from(strikeMap.values())
    .map((strike) => ({
      strike: roundNumber(strike.strike),
      gexValue: roundNumber(strike.callGex - strike.putGex, 0),
      callGamma: roundNumber(averageGamma(strike.callGammaOi, strike.callOI), 6),
      putGamma: roundNumber(averageGamma(strike.putGammaOi, strike.putOI), 6),
      callOI: Math.round(strike.callOI),
      putOI: Math.round(strike.putOI),
    }))
    .sort((a, b) => a.strike - b.strike);

  const maxGEXPoint = gexByStrike.reduce((best, point) => (
    Math.abs(point.gexValue) > Math.abs(best.gexValue) ? point : best
  ));
  const maxGEXStrike = maxGEXPoint ? roundNumber(maxGEXPoint.strike) : null;

  const flipPoint = findFlipPoint(gexByStrike);
  const totalGex = gexByStrike.reduce((sum, point) => sum + point.gexValue, 0);
  const regime: GEXProfile['regime'] = totalGex >= 0 ? 'positive_gamma' : 'negative_gamma';

  const profile: GEXProfile = {
    symbol,
    spotPrice: roundNumber(spotPrice),
    gexByStrike,
    flipPoint: flipPoint !== null ? roundNumber(flipPoint) : null,
    maxGEXStrike,
    keyLevels: buildKeyLevels(gexByStrike, maxGEXStrike),
    regime,
    implication: buildImplication(regime, flipPoint, maxGEXStrike),
    calculatedAt: new Date().toISOString(),
    expirationsAnalyzed: expirations,
  };

  await cacheSet(cacheKey, profile, GEX_CACHE_TTL_SECONDS);

  logger.info('Calculated GEX profile', {
    symbol,
    expirationsAnalyzed: expirations.length,
    strikes: gexByStrike.length,
    regime,
    flipPoint: profile.flipPoint,
    maxGEXStrike: profile.maxGEXStrike,
  });

  return profile;
}
