import { getDailyAggregates } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import { formatMassiveTicker } from '../../lib/symbols';
import { logger } from '../../lib/logger';
import { MARKET_HOLIDAYS, toEasternTime } from '../marketHours';
import { fetchExpirationDates, fetchOptionsChain } from './optionsChainFetcher';
import {
  IVAnalysisProfile,
  IVRankAnalysis,
  IVSkewAnalysis,
  IVForecastAnalysis,
  IVForecastFeatures,
  IVTermStructureAnalysis,
  IVTermStructurePoint,
  OptionContract,
} from './types';

interface AnalyzeIVOptions {
  expiry?: string;
  strikeRange?: number;
  maxExpirations?: number;
  forceRefresh?: boolean;
}

const IV_CACHE_TTL_SECONDS = 300;
const DEFAULT_STRIKE_RANGE = 20;
const DEFAULT_MAX_EXPIRATIONS = 6;
const MAX_EXPIRATIONS_ALLOWED = 12;

function round(value: number, digits: number = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function getNearestStrikeContracts(
  calls: OptionContract[],
  puts: OptionContract[],
  spotPrice: number,
): { call: OptionContract | null; put: OptionContract | null } {
  const nearestCall = calls.length === 0 ? null : calls.reduce((best, current) => (
    Math.abs(current.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? current : best
  ));
  const nearestPut = puts.length === 0 ? null : puts.reduce((best, current) => (
    Math.abs(current.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? current : best
  ));
  return { call: nearestCall, put: nearestPut };
}

function deriveCurrentIV(calls: OptionContract[], puts: OptionContract[], spotPrice: number): number | null {
  const { call, put } = getNearestStrikeContracts(calls, puts, spotPrice);
  const ivCandidates = [call?.impliedVolatility, put?.impliedVolatility]
    .filter((value): value is number => typeof value === 'number' && value > 0);

  if (ivCandidates.length === 0) return null;
  return average(ivCandidates);
}

function deriveHistoricalVolatilityProxies(closes: number[]): number[] {
  if (closes.length < 22) return [];

  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  const window = 20;
  const realizedVols: number[] = [];
  for (let end = window; end <= logReturns.length; end += 1) {
    const sample = logReturns.slice(end - window, end);
    const std = standardDeviation(sample);
    // Annualize and convert to percent.
    realizedVols.push(std * Math.sqrt(252) * 100);
  }

  return realizedVols;
}

function buildIVRankAnalysis(currentIVDecimal: number | null, closes: number[]): IVRankAnalysis {
  if (currentIVDecimal == null || !Number.isFinite(currentIVDecimal) || currentIVDecimal <= 0) {
    return {
      currentIV: null,
      ivRank: null,
      ivPercentile: null,
      iv52wkHigh: null,
      iv52wkLow: null,
      ivTrend: 'unknown',
    };
  }

  const currentIV = currentIVDecimal * 100;
  const proxySeries = deriveHistoricalVolatilityProxies(closes);

  if (proxySeries.length < 10) {
    return {
      currentIV: round(currentIV),
      ivRank: null,
      ivPercentile: null,
      iv52wkHigh: null,
      iv52wkLow: null,
      ivTrend: 'unknown',
    };
  }

  const iv52wkHigh = Math.max(...proxySeries);
  const iv52wkLow = Math.min(...proxySeries);
  const denominator = iv52wkHigh - iv52wkLow;
  const ivRank = denominator > 0
    ? Math.max(0, Math.min(100, ((currentIV - iv52wkLow) / denominator) * 100))
    : 50;

  const ivPercentile = (proxySeries.filter((value) => value <= currentIV).length / proxySeries.length) * 100;
  const trailing = proxySeries.slice(-20);
  const trailingMean = average(trailing);
  let ivTrend: IVRankAnalysis['ivTrend'] = 'stable';
  if (currentIV >= trailingMean * 1.1) ivTrend = 'rising';
  if (currentIV <= trailingMean * 0.9) ivTrend = 'falling';

  return {
    currentIV: round(currentIV),
    ivRank: round(ivRank),
    ivPercentile: round(ivPercentile),
    iv52wkHigh: round(iv52wkHigh),
    iv52wkLow: round(iv52wkLow),
    ivTrend,
  };
}

function pickClosestByDelta(contracts: OptionContract[], targetDelta: number): OptionContract | null {
  const candidates = contracts.filter((contract) => typeof contract.delta === 'number' && contract.impliedVolatility > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) => (
    Math.abs((current.delta as number) - targetDelta) < Math.abs((best.delta as number) - targetDelta)
      ? current
      : best
  ));
}

function pickOTMByMoneyness(contracts: OptionContract[], spotPrice: number, type: 'call' | 'put', pct: number): OptionContract | null {
  if (contracts.length === 0) return null;
  const targetStrike = type === 'call'
    ? spotPrice * (1 + pct)
    : spotPrice * (1 - pct);
  return contracts.reduce((best, current) => (
    Math.abs(current.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? current : best
  ));
}

function buildIVSkewAnalysis(calls: OptionContract[], puts: OptionContract[], spotPrice: number): IVSkewAnalysis {
  const call25 = pickClosestByDelta(calls, 0.25) || pickOTMByMoneyness(calls, spotPrice, 'call', 0.02);
  const put25 = pickClosestByDelta(puts, -0.25) || pickOTMByMoneyness(puts, spotPrice, 'put', 0.02);
  const call10 = pickClosestByDelta(calls, 0.1) || pickOTMByMoneyness(calls, spotPrice, 'call', 0.04);
  const put10 = pickClosestByDelta(puts, -0.1) || pickOTMByMoneyness(puts, spotPrice, 'put', 0.04);

  const skew25 = call25 && put25 ? (put25.impliedVolatility - call25.impliedVolatility) * 100 : null;
  const skew10 = call10 && put10 ? (put10.impliedVolatility - call10.impliedVolatility) * 100 : null;
  const referenceSkew = skew25 ?? skew10;

  if (referenceSkew == null) {
    return {
      skew25delta: null,
      skew10delta: null,
      skewDirection: 'unknown',
      interpretation: 'Insufficient options data to determine skew.',
    };
  }

  const skewDirection: IVSkewAnalysis['skewDirection'] = referenceSkew > 2
    ? 'put_heavy'
    : referenceSkew < -2
      ? 'call_heavy'
      : 'balanced';

  const interpretation = skewDirection === 'put_heavy'
    ? 'Put-side IV is elevated versus calls, suggesting downside hedge demand.'
    : skewDirection === 'call_heavy'
      ? 'Call-side IV is elevated versus puts, suggesting upside speculation demand.'
      : 'Skew is relatively balanced across calls and puts.';

  return {
    skew25delta: skew25 == null ? null : round(skew25),
    skew10delta: skew10 == null ? null : round(skew10),
    skewDirection,
    interpretation,
  };
}

function buildTermStructure(points: IVTermStructurePoint[]): IVTermStructureAnalysis {
  if (points.length < 2) {
    return {
      expirations: points,
      shape: 'flat',
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const slope = last.atmIV - first.atmIV;
  let shape: IVTermStructureAnalysis['shape'] = 'flat';
  if (slope > 2) shape = 'contango';
  if (slope < -2) shape = 'backwardation';

  const inversionPoint = shape === 'backwardation'
    ? points.find((point, idx) => idx > 0 && point.atmIV < points[idx - 1].atmIV)?.date
    : undefined;

  return {
    expirations: points,
    shape,
    ...(inversionPoint ? { inversionPoint } : {}),
  };
}

function safeRatio(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

function buildIVForecast(
  ivRank: IVRankAnalysis,
  skew: IVSkewAnalysis,
  termStructure: IVTermStructureAnalysis,
  realizedVolSeries: number[],
  nearestDte: number | null,
  minutesToClose: number,
): IVForecastAnalysis {
  const currentIV = ivRank.currentIV;
  if (currentIV == null || !Number.isFinite(currentIV)) {
    return {
      horizonMinutes: 60,
      predictedIV: null,
      currentIV: null,
      deltaIV: null,
      direction: 'unknown',
      confidence: 0,
      features: {
        realizedVolTrend: 0,
        ivMomentum: 0,
        meanReversionPressure: 0,
        termStructureSlope: 0,
        skewPressure: 0,
        volOfVol: 0,
        closeToExpiryPressure: 0,
      },
    };
  }

  const realizedRecent = average(realizedVolSeries.slice(-5));
  const realizedBaseline = average(realizedVolSeries.slice(-20));
  const realizedTrend = safeRatio(realizedRecent - realizedBaseline, Math.max(realizedBaseline, 1), 0);
  const previousRealized = realizedVolSeries.length >= 2 ? realizedVolSeries[realizedVolSeries.length - 2] : realizedRecent;
  const ivMomentum = safeRatio(realizedRecent - previousRealized, Math.max(previousRealized, 1), 0);
  const meanReversionPressure = safeRatio(currentIV - realizedBaseline, Math.max(realizedBaseline, 1), 0);

  const frontTerm = termStructure.expirations[0]?.atmIV ?? currentIV;
  const backTerm = termStructure.expirations[termStructure.expirations.length - 1]?.atmIV ?? currentIV;
  const termStructureSlope = safeRatio(backTerm - frontTerm, Math.max(frontTerm, 1), 0);
  const skewPressure = (skew.skew25delta ?? skew.skew10delta ?? 0) / 10;
  const volOfVol = safeRatio(standardDeviation(realizedVolSeries.slice(-20)), Math.max(realizedBaseline, 1), 0);
  const closeToExpiryPressure = nearestDte === 0
    ? Math.max(0, (60 - Math.max(minutesToClose, 0)) / 60)
    : nearestDte === 1
      ? 0.25
      : 0;

  const features: IVForecastFeatures = {
    realizedVolTrend: round(realizedTrend, 4),
    ivMomentum: round(ivMomentum, 4),
    meanReversionPressure: round(meanReversionPressure, 4),
    termStructureSlope: round(termStructureSlope, 4),
    skewPressure: round(skewPressure, 4),
    volOfVol: round(volOfVol, 4),
    closeToExpiryPressure: round(closeToExpiryPressure, 4),
  };

  const weightedDeltaPct = (
    (features.realizedVolTrend * 0.22)
    + (features.ivMomentum * 0.18)
    - (features.meanReversionPressure * 0.3)
    + (features.termStructureSlope * 0.14)
    + (features.skewPressure * 0.08)
    + (features.volOfVol * 0.12)
    - (features.closeToExpiryPressure * 0.1)
  );
  const boundedDeltaPct = Math.max(-0.2, Math.min(0.2, weightedDeltaPct));
  const predictedIV = Math.max(1, currentIV * (1 + boundedDeltaPct));
  const deltaIV = predictedIV - currentIV;

  const confidenceBase = Math.min(1, realizedVolSeries.length / 60);
  const confidence = clamp(
    confidenceBase * (1 - Math.min(Math.abs(features.volOfVol), 0.7))
      * (1 - Math.min(closeToExpiryPressure * 0.5, 0.4)),
    0.05,
    0.95,
  );

  return {
    horizonMinutes: 60,
    predictedIV: round(predictedIV),
    currentIV: round(currentIV),
    deltaIV: round(deltaIV, 3),
    direction: deltaIV > 0.15 ? 'up' : deltaIV < -0.15 ? 'down' : 'flat',
    confidence: round(confidence, 3),
    features,
  };
}

function buildCacheKey(symbol: string, options: { expiry?: string; strikeRange: number; maxExpirations: number }): string {
  return `options:iv:${symbol}:${options.expiry || 'multi'}:${options.strikeRange}:${options.maxExpirations}`;
}

function minutesUntilMarketClose(now: Date): number {
  const et = toEasternTime(now);
  const minuteOfDay = (et.hour * 60) + et.minute;
  const closeMinute = MARKET_HOLIDAYS[et.dateStr] === 'early' ? 13 * 60 : 16 * 60;
  return Math.max(0, closeMinute - minuteOfDay);
}

export function adjustIVRankFor0DTE(
  rawIVRank: number,
  minutesToClose: number,
  dte: number,
): number {
  if (!Number.isFinite(rawIVRank)) return rawIVRank;
  if (!Number.isFinite(minutesToClose) || !Number.isFinite(dte)) return rawIVRank;
  if (dte > 0 || minutesToClose >= 60) return rawIVRank;
  const gammaAdjustment = minutesToClose < 30 ? 0.8 : 0.9;
  return Math.min(100, rawIVRank * gammaAdjustment);
}

export async function analyzeIVProfile(
  symbolInput: string,
  options: AnalyzeIVOptions = {},
): Promise<IVAnalysisProfile> {
  const symbol = symbolInput.toUpperCase();
  const strikeRange = Math.max(5, Math.min(50, options.strikeRange ?? DEFAULT_STRIKE_RANGE));
  const maxExpirations = Math.max(1, Math.min(MAX_EXPIRATIONS_ALLOWED, options.maxExpirations ?? DEFAULT_MAX_EXPIRATIONS));
  const cacheKey = buildCacheKey(symbol, {
    expiry: options.expiry,
    strikeRange,
    maxExpirations,
  });

  if (!options.forceRefresh) {
    const cached = await cacheGet<IVAnalysisProfile>(cacheKey);
    if (cached) return cached;
  }

  const expirations = options.expiry
    ? [options.expiry]
    : (await fetchExpirationDates(symbol)).slice(0, maxExpirations);

  if (expirations.length === 0) {
    throw new Error(`No options expirations found for ${symbol}`);
  }

  const termStructurePoints: IVTermStructurePoint[] = [];
  let currentPrice = 0;
  let firstChainCalls: OptionContract[] = [];
  let firstChainPuts: OptionContract[] = [];
  let currentIVDecimal: number | null = null;
  let nearestDte: number | null = null;

  for (let idx = 0; idx < expirations.length; idx += 1) {
    const expiry = expirations[idx];
    const chain = await fetchOptionsChain(symbol, expiry, strikeRange);
    currentPrice = chain.currentPrice;

    const atmIV = deriveCurrentIV(chain.options.calls, chain.options.puts, chain.currentPrice);
    if (atmIV != null) {
      termStructurePoints.push({
        date: expiry,
        dte: chain.daysToExpiry,
        atmIV: round(atmIV * 100),
      });
      if (currentIVDecimal == null) currentIVDecimal = atmIV;
    }

    if (idx === 0) {
      firstChainCalls = chain.options.calls;
      firstChainPuts = chain.options.puts;
      nearestDte = chain.daysToExpiry;
    }
  }

  if (currentPrice <= 0) {
    throw new Error(`Insufficient options data to calculate IV profile for ${symbol}`);
  }

  const now = new Date();
  const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const dailyBars = await getDailyAggregates(formatMassiveTicker(symbol), from, to);
  const closes = dailyBars.map((bar) => bar.c).filter((value) => Number.isFinite(value) && value > 0);

  const ivRank = buildIVRankAnalysis(currentIVDecimal, closes);
  const minutesToClose = minutesUntilMarketClose(now);
  const calibratedIVRank = (
    ivRank.ivRank != null
    && nearestDte != null
  )
    ? round(adjustIVRankFor0DTE(ivRank.ivRank, minutesToClose, nearestDte))
    : ivRank.ivRank;
  const skew = buildIVSkewAnalysis(firstChainCalls, firstChainPuts, currentPrice);
  const termStructure = buildTermStructure(termStructurePoints.sort((a, b) => a.dte - b.dte));
  const realizedVolSeries = deriveHistoricalVolatilityProxies(closes);
  const ivForecast = buildIVForecast(
    ivRank,
    skew,
    termStructure,
    realizedVolSeries,
    nearestDte,
    minutesToClose,
  );

  const profile: IVAnalysisProfile = {
    symbol,
    currentPrice: round(currentPrice),
    asOf: now.toISOString(),
    ivRank: {
      ...ivRank,
      ivRank: calibratedIVRank,
    },
    skew,
    termStructure,
    ivForecast,
  };

  await cacheSet(cacheKey, profile, IV_CACHE_TTL_SECONDS);

  logger.info('Calculated IV profile', {
    symbol,
    expirationsAnalyzed: expirations.length,
    termStructureShape: profile.termStructure.shape,
    ivRank: profile.ivRank.ivRank,
    skewDirection: profile.skew.skewDirection,
  });

  return profile;
}
