import { getDailyAggregates } from '../../config/massive';
import { formatMassiveTicker } from '../../lib/symbols';
import { toEasternTime } from '../marketHours';
import { fetchExpirationDates, fetchOptionsChain } from './optionsChainFetcher';
import {
  OptionContract,
  ZeroDTEAnalysis,
  ZeroDTEAnalysisRequest,
  ZeroDTEThetaProjection,
} from './types';

const REGULAR_SESSION_OPEN_MINUTES = 9 * 60 + 30; // 9:30 AM ET
const REGULAR_SESSION_CLOSE_MINUTES = 16 * 60; // 4:00 PM ET
const REGULAR_SESSION_TOTAL_MINUTES = REGULAR_SESSION_CLOSE_MINUTES - REGULAR_SESSION_OPEN_MINUTES; // 390

function round(value: number, digits: number = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getOptionMark(contract: OptionContract): number {
  if (contract.last > 0) return contract.last;
  const midpoint = (contract.bid + contract.ask) / 2;
  return Number.isFinite(midpoint) && midpoint > 0 ? midpoint : 0;
}

function findNearestByStrike(contracts: OptionContract[], strike: number): OptionContract | null {
  if (contracts.length === 0) return null;
  return contracts.reduce((best, current) => {
    const bestDistance = Math.abs(best.strike - strike);
    const currentDistance = Math.abs(current.strike - strike);
    return currentDistance < bestDistance ? current : best;
  });
}

function getMinutesLeftInRegularSession(now: Date): number {
  const et = toEasternTime(now);
  const currentMinutes = et.hour * 60 + et.minute;

  if (currentMinutes < REGULAR_SESSION_OPEN_MINUTES) return REGULAR_SESSION_TOTAL_MINUTES;
  if (currentMinutes >= REGULAR_SESSION_CLOSE_MINUTES) return 0;

  return REGULAR_SESSION_CLOSE_MINUTES - currentMinutes;
}

function formatETTime(date: Date): string {
  const et = toEasternTime(date);
  return `${String(et.hour).padStart(2, '0')}:${String(et.minute).padStart(2, '0')} ET`;
}

function classifyGammaRisk(absGammaPerDollar: number): 'low' | 'moderate' | 'high' | 'extreme' {
  if (absGammaPerDollar >= 0.06) return 'extreme';
  if (absGammaPerDollar >= 0.03) return 'high';
  if (absGammaPerDollar >= 0.015) return 'moderate';
  return 'low';
}

function buildThetaClock(
  contract: OptionContract,
  minutesLeft: number,
  now: Date,
): { currentValue: number; thetaPerDay: number; projections: ZeroDTEThetaProjection[] } {
  const currentValue = round(getOptionMark(contract), 4);
  const thetaPerDay = Math.abs(contract.theta ?? 0);
  const thetaPerMinute = thetaPerDay / REGULAR_SESSION_TOTAL_MINUTES;
  const projectionSteps = Math.max(1, Math.floor(minutesLeft / 15) + 1);
  const projections: ZeroDTEThetaProjection[] = [];

  for (let step = 0; step < projectionSteps; step += 1) {
    const elapsedMinutes = step * 15;
    const clampedElapsed = Math.min(elapsedMinutes, minutesLeft);
    const remaining = Math.max(minutesLeft - clampedElapsed, 0);
    const inAccelerationZone = remaining <= 120;
    const accelerationFactor = inAccelerationZone ? 1.7 : 1;
    const estimatedDecay = thetaPerMinute * clampedElapsed * accelerationFactor;
    const estimatedValue = Math.max(0, currentValue - estimatedDecay);
    const pctRemaining = currentValue > 0 ? (estimatedValue / currentValue) * 100 : 0;

    projections.push({
      time: formatETTime(new Date(now.getTime() + clampedElapsed * 60_000)),
      estimatedValue: round(estimatedValue, 4),
      thetaDecay: round(currentValue - estimatedValue, 4),
      pctRemaining: round(pctRemaining, 2),
    });
  }

  return {
    currentValue,
    thetaPerDay: round(thetaPerDay, 4),
    projections,
  };
}

export async function analyzeZeroDTE(
  symbol: string,
  request: ZeroDTEAnalysisRequest = {},
): Promise<ZeroDTEAnalysis> {
  const normalizedSymbol = symbol.toUpperCase();
  const now = request.now ?? new Date();
  const marketDate = toEasternTime(now).dateStr;

  const expirations = await fetchExpirationDates(normalizedSymbol);
  if (!expirations.includes(marketDate)) {
    return {
      symbol: normalizedSymbol,
      marketDate,
      hasZeroDTE: false,
      message: `No 0DTE expiration found for ${normalizedSymbol} on ${marketDate}.`,
      expectedMove: null,
      thetaClock: null,
      gammaProfile: null,
      topContracts: [],
    };
  }

  const chain = await fetchOptionsChain(normalizedSymbol, marketDate, 20);
  const currentPrice = chain.currentPrice;
  const allContracts = [...chain.options.calls, ...chain.options.puts];
  const minutesLeft = getMinutesLeftInRegularSession(now);

  let openPrice = currentPrice;
  const dailyBars = await getDailyAggregates(formatMassiveTicker(normalizedSymbol), marketDate, marketDate);
  if (dailyBars.length > 0 && Number.isFinite(dailyBars[0].o)) {
    openPrice = dailyBars[0].o;
  }

  const uniqueStrikes = Array.from(new Set(allContracts.map((contract) => contract.strike)));
  const atmStrike = uniqueStrikes.length > 0
    ? uniqueStrikes.reduce((best, strike) => (
      Math.abs(strike - currentPrice) < Math.abs(best - currentPrice) ? strike : best
    ))
    : null;

  const atmCall = atmStrike == null ? null : findNearestByStrike(chain.options.calls, atmStrike);
  const atmPut = atmStrike == null ? null : findNearestByStrike(chain.options.puts, atmStrike);
  const atmCallMark = atmCall ? getOptionMark(atmCall) : 0;
  const atmPutMark = atmPut ? getOptionMark(atmPut) : 0;
  const totalExpectedMove = round(atmCallMark + atmPutMark, 4);
  const usedMove = round(Math.abs(currentPrice - openPrice), 4);
  const usedPct = totalExpectedMove > 0 ? round((usedMove / totalExpectedMove) * 100, 2) : 0;
  const remainingMove = totalExpectedMove > 0
    ? round(Math.sqrt(minutesLeft / REGULAR_SESSION_TOTAL_MINUTES) * totalExpectedMove, 4)
    : 0;
  const remainingPct = totalExpectedMove > 0 ? round((remainingMove / totalExpectedMove) * 100, 2) : 0;

  const requestedType = request.type ?? 'call';
  const selectedStrike = request.strike ?? atmStrike ?? currentPrice;
  const selectedPool = requestedType === 'put' ? chain.options.puts : chain.options.calls;
  const selectedContract = findNearestByStrike(selectedPool, selectedStrike);

  const thetaClock = selectedContract ? (() => {
    const clock = buildThetaClock(selectedContract, minutesLeft, now);
    return {
      strike: selectedContract.strike,
      type: selectedContract.type,
      currentValue: clock.currentValue,
      thetaPerDay: clock.thetaPerDay,
      projections: clock.projections,
    };
  })() : null;

  const gammaProfile = selectedContract ? (() => {
    const currentDelta = selectedContract.delta ?? 0;
    const gammaPerDollar = selectedContract.gamma ?? 0;
    const dollarDeltaChangePerPoint = gammaPerDollar * 100;
    const optionPrice = Math.max(getOptionMark(selectedContract), 0.01);
    const leverageMultiplier = Math.abs((currentDelta * currentPrice) / optionPrice);
    const riskLevel = classifyGammaRisk(Math.abs(gammaPerDollar));

    return {
      strike: selectedContract.strike,
      type: selectedContract.type,
      currentDelta: round(currentDelta, 4),
      gammaPerDollar: round(gammaPerDollar, 6),
      dollarDeltaChangePerPoint: round(dollarDeltaChangePerPoint, 4),
      leverageMultiplier: round(leverageMultiplier, 2),
      riskLevel,
    };
  })() : null;

  const topContracts = allContracts
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8)
    .map((contract) => ({
      strike: contract.strike,
      type: contract.type,
      last: round(getOptionMark(contract), 4),
      volume: contract.volume,
      openInterest: contract.openInterest,
      gamma: contract.gamma ?? null,
      theta: contract.theta ?? null,
    }));

  return {
    symbol: normalizedSymbol,
    marketDate,
    hasZeroDTE: true,
    message: `0DTE toolkit generated for ${normalizedSymbol} (${marketDate}).`,
    expectedMove: {
      totalExpectedMove,
      usedMove,
      usedPct,
      remainingMove,
      remainingPct,
      minutesLeft,
      openPrice: round(openPrice, 4),
      currentPrice: round(currentPrice, 4),
      atmStrike,
    },
    thetaClock,
    gammaProfile,
    topContracts,
  };
}
