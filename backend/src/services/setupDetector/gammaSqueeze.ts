import { OptionContract, OptionsChainResponse } from '../options/types';
import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupSignal, clampConfidence } from './types';

const GAMMA_SYMBOLS = new Set(['SPX', 'NDX']);

interface StrikeGammaProfile {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
  totalVolume: number;
  totalOpenInterest: number;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function calculateContractGex(contract: OptionContract, spotPrice: number): number {
  const gamma = typeof contract.gamma === 'number' ? contract.gamma : 0;
  const openInterest = Number.isFinite(contract.openInterest) ? contract.openInterest : 0;

  if (gamma <= 0 || openInterest <= 0) {
    return 0;
  }

  return gamma * openInterest * 100 * spotPrice * spotPrice * 0.01;
}

function buildStrikeProfiles(chain: OptionsChainResponse): StrikeGammaProfile[] {
  const strikeMap = new Map<number, StrikeGammaProfile>();

  for (const call of chain.options.calls) {
    const existing = strikeMap.get(call.strike) || {
      strike: call.strike,
      callGex: 0,
      putGex: 0,
      netGex: 0,
      totalVolume: 0,
      totalOpenInterest: 0,
    };

    existing.callGex += calculateContractGex(call, chain.currentPrice);
    existing.totalVolume += call.volume || 0;
    existing.totalOpenInterest += call.openInterest || 0;

    strikeMap.set(call.strike, existing);
  }

  for (const put of chain.options.puts) {
    const existing = strikeMap.get(put.strike) || {
      strike: put.strike,
      callGex: 0,
      putGex: 0,
      netGex: 0,
      totalVolume: 0,
      totalOpenInterest: 0,
    };

    existing.putGex += calculateContractGex(put, chain.currentPrice);
    existing.totalVolume += put.volume || 0;
    existing.totalOpenInterest += put.openInterest || 0;

    strikeMap.set(put.strike, existing);
  }

  const profiles = Array.from(strikeMap.values())
    .map((profile) => ({
      ...profile,
      netGex: profile.callGex - profile.putGex,
    }))
    .sort((a, b) => a.strike - b.strike);

  return profiles;
}

function findNearestStrikeProfile(profiles: StrikeGammaProfile[], price: number): StrikeGammaProfile | null {
  if (profiles.length === 0) {
    return null;
  }

  let nearest = profiles[0];
  let minDistance = Math.abs(nearest.strike - price);

  for (let i = 1; i < profiles.length; i += 1) {
    const distance = Math.abs(profiles[i].strike - price);
    if (distance < minDistance) {
      nearest = profiles[i];
      minDistance = distance;
    }
  }

  return nearest;
}

function findFlipPoint(profiles: StrikeGammaProfile[]): number | null {
  if (profiles.length < 2) return null;

  let cumulative = 0;
  let previousSign: number | null = null;

  for (const profile of profiles) {
    cumulative += profile.netGex;
    const sign = cumulative === 0 ? 0 : cumulative > 0 ? 1 : -1;

    if (previousSign !== null && sign !== 0 && previousSign !== 0 && sign !== previousSign) {
      return profile.strike;
    }

    if (sign !== 0) {
      previousSign = sign;
    }
  }

  return null;
}

interface MomentumContext {
  breakoutUp: boolean;
  breakdownDown: boolean;
  volumeRatio: number;
  trendMoveAtr: number;
}

function calculateMomentumContext(snapshot: DetectorSnapshot): MomentumContext {
  const bars = snapshot.intradayBars;
  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(snapshot.levels.currentPrice * 0.004, 1);

  if (bars.length < 8) {
    return {
      breakoutUp: false,
      breakdownDown: false,
      volumeRatio: 0,
      trendMoveAtr: 0,
    };
  }

  const lastBar = bars[bars.length - 1];
  const recentBars = bars.slice(-8, -1);
  const recentHigh = Math.max(...recentBars.map((bar) => bar.h));
  const recentLow = Math.min(...recentBars.map((bar) => bar.l));
  const avgVolume = recentBars.reduce((sum, bar) => sum + bar.v, 0) / recentBars.length;
  const firstBar = bars[Math.max(0, bars.length - 12)];

  return {
    breakoutUp: lastBar.c > recentHigh,
    breakdownDown: lastBar.c < recentLow,
    volumeRatio: avgVolume > 0 ? lastBar.v / avgVolume : 0,
    trendMoveAtr: (lastBar.c - firstBar.c) / Math.max(0.01, atr),
  };
}

export function detectGammaSqueeze(snapshot: DetectorSnapshot, chain: OptionsChainResponse): SetupSignal | null {
  const symbol = snapshot.symbol.toUpperCase();
  if (!GAMMA_SYMBOLS.has(symbol)) {
    return null;
  }

  if (chain.daysToExpiry > 7) {
    return null;
  }

  const profiles = buildStrikeProfiles(chain);
  if (profiles.length < 3) {
    return null;
  }

  const lastBar = snapshot.intradayBars[snapshot.intradayBars.length - 1];
  const currentPrice = lastBar?.c ?? chain.currentPrice;
  if (!Number.isFinite(currentPrice)) {
    return null;
  }

  const nearestProfile = findNearestStrikeProfile(profiles, currentPrice);
  if (!nearestProfile) {
    return null;
  }

  const maxPositive = profiles.reduce((best, profile) => (
    !best || profile.netGex > best.netGex ? profile : best
  ), null as StrikeGammaProfile | null);
  const maxNegative = profiles.reduce((best, profile) => (
    !best || profile.netGex < best.netGex ? profile : best
  ), null as StrikeGammaProfile | null);

  const totalNetGex = profiles.reduce((sum, profile) => sum + profile.netGex, 0);
  const regime = totalNetGex >= 0 ? 'positive_gamma' : 'negative_gamma';
  const flipPoint = findFlipPoint(profiles);

  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(currentPrice * 0.004, 1);
  const vwap = snapshot.levels.levels.indicators.vwap ?? snapshot.levels.currentPrice;

  const momentum = calculateMomentumContext(snapshot);

  const callPutRatio = nearestProfile.putGex > 0
    ? nearestProfile.callGex / nearestProfile.putGex
    : nearestProfile.callGex > 0
      ? 9
      : 0;
  const putCallRatio = nearestProfile.callGex > 0
    ? nearestProfile.putGex / nearestProfile.callGex
    : nearestProfile.putGex > 0
      ? 9
      : 0;

  const distanceToMaxPositive = maxPositive ? Math.abs(currentPrice - maxPositive.strike) : Infinity;
  const distanceToMaxNegative = maxNegative ? Math.abs(currentPrice - maxNegative.strike) : Infinity;

  const longCondition =
    (callPutRatio >= 1.35 || regime === 'negative_gamma') &&
    momentum.breakoutUp &&
    momentum.volumeRatio >= 1.1 &&
    currentPrice >= vwap &&
    distanceToMaxPositive <= Math.max(atr * 0.9, currentPrice * 0.0035);

  if (longCondition) {
    const confidence = clampConfidence(
      70
      + Math.min(10, (callPutRatio - 1.35) * 12)
      + Math.min(8, (momentum.volumeRatio - 1.1) * 14)
      + Math.min(8, Math.abs(momentum.trendMoveAtr) * 4),
    );

    return {
      type: 'gamma_squeeze',
      symbol,
      direction: 'long',
      confidence,
      currentPrice: roundPrice(currentPrice),
      description: `${symbol} gamma squeeze setup: call gamma concentration + upside momentum`,
      dedupeKey: `gamma_squeeze:long:${chain.expiry}:${roundPrice(nearestProfile.strike)}:${roundPrice(maxPositive?.strike ?? 0)}`,
      signalData: {
        gammaRegime: regime,
        flipPoint,
        maxPositiveGexStrike: maxPositive?.strike ?? null,
        maxNegativeGexStrike: maxNegative?.strike ?? null,
        nearestStrike: nearestProfile.strike,
        callPutGammaRatio: Number(callPutRatio.toFixed(2)),
        volumeRatio: Number(momentum.volumeRatio.toFixed(2)),
        daysToExpiry: chain.daysToExpiry,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'gamma_squeeze',
        direction: 'long',
        currentPrice,
        atr,
        referenceLevel: typeof flipPoint === 'number' ? flipPoint : vwap,
        range: Math.max(atr, distanceToMaxPositive),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  const shortCondition =
    (putCallRatio >= 1.35 || regime === 'negative_gamma') &&
    momentum.breakdownDown &&
    momentum.volumeRatio >= 1.1 &&
    currentPrice <= vwap &&
    distanceToMaxNegative <= Math.max(atr * 0.9, currentPrice * 0.0035);

  if (!shortCondition) {
    return null;
  }

  const confidence = clampConfidence(
    70
    + Math.min(10, (putCallRatio - 1.35) * 12)
    + Math.min(8, (momentum.volumeRatio - 1.1) * 14)
    + Math.min(8, Math.abs(momentum.trendMoveAtr) * 4),
  );

  return {
    type: 'gamma_squeeze',
    symbol,
    direction: 'short',
    confidence,
    currentPrice: roundPrice(currentPrice),
    description: `${symbol} downside gamma squeeze setup: put gamma concentration + breakdown`,
    dedupeKey: `gamma_squeeze:short:${chain.expiry}:${roundPrice(nearestProfile.strike)}:${roundPrice(maxNegative?.strike ?? 0)}`,
    signalData: {
      gammaRegime: regime,
      flipPoint,
      maxPositiveGexStrike: maxPositive?.strike ?? null,
      maxNegativeGexStrike: maxNegative?.strike ?? null,
      nearestStrike: nearestProfile.strike,
      putCallGammaRatio: Number(putCallRatio.toFixed(2)),
      volumeRatio: Number(momentum.volumeRatio.toFixed(2)),
      daysToExpiry: chain.daysToExpiry,
    },
    tradeSuggestion: buildTradeSuggestion({
      setupType: 'gamma_squeeze',
      direction: 'short',
      currentPrice,
      atr,
      referenceLevel: typeof flipPoint === 'number' ? flipPoint : vwap,
      range: Math.max(atr, distanceToMaxNegative),
    }),
    detectedAt: snapshot.detectedAt,
  };
}
