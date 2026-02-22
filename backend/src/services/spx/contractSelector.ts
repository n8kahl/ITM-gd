import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { fetchExpirationDates, fetchOptionsChain } from '../options/optionsChainFetcher';
import type { OptionContract } from '../options/types';
import { toEasternTime } from '../marketHours';
import { detectActiveSetups, getSetupById } from './setupDetector';
import type { ContractRecommendation, Setup } from './types';
import { round } from './utils';

const CONTRACT_CACHE_TTL_SECONDS = 10;
const ACTIONABLE_SETUP_STATUSES: ReadonlySet<Setup['status']> = new Set(['ready', 'triggered']);
const MIN_OPEN_INTEREST = 150;
const MIN_VOLUME = 20;
const MAX_SPREAD_PCT = 0.24;
const CONTRACT_MULTIPLIER = 100;
const MAX_CONTRACT_RISK_STRICT = 2_500;
const MAX_CONTRACT_RISK_RELAXED = 3_500;
const MAX_DELTA_STRICT = 0.65;
const MAX_DELTA_RELAXED = 0.80;
const ZERO_DTE_ROLLOVER_MINUTE_ET_DEFAULT = 13 * 60;
const ZERO_DTE_ROLLOVER_MINUTE_ET_TREND = (12 * 60) + 45;
const ZERO_DTE_ROLLOVER_MINUTE_ET_MEAN = (13 * 60) + 20;
const LATE_DAY_FILTER_MINUTE_ET = 14 * 60;
const LATE_DAY_MAX_SPREAD_PCT = 0.18;
const LATE_DAY_MAX_ABSOLUTE_SPREAD = 0.35;
const LATE_DAY_MIN_OPEN_INTEREST = 250;
const STRICT_ZERO_DTE_MAX_ABS_THETA = 1.95;
const RELAXED_ZERO_DTE_MAX_ABS_THETA = 2.35;
const MIN_DTBP_FOR_ZERO_DTE = 25_000;
const MAX_DTBP_USAGE_PCT = 0.90;
const CONTRACT_EXPIRY_LOOKAHEAD_DAYS = 7;
const CONTRACT_EXPIRY_LOOKAHEAD_MAX_PAGES = 2;
const TREND_FAMILY_SETUP_TYPES: ReadonlySet<Setup['type']> = new Set([
  'orb_breakout',
  'trend_pullback',
  'trend_continuation',
  'breakout_vacuum',
]);
interface RankedContract {
  contract: OptionContract;
  score: number;
}

interface ContractHealth {
  score: number;
  tier: 'green' | 'amber' | 'red';
  thetaRiskPer15m: number;
  ivVsRealized: number;
}

interface PortfolioRiskContext {
  dayTradeBuyingPower?: number | null;
  maxRiskDollars?: number | null;
  pdtQualified?: boolean | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sessionMinuteEt(now: Date): number {
  const et = toEasternTime(now);
  return et.hour * 60 + et.minute;
}

function isSameEtDate(expiry: string, now: Date): boolean {
  const todayEt = toEasternTime(now).dateStr;
  return expiry === todayEt;
}

function isTerminalZeroDte(expiry: string, now: Date): boolean {
  if (!isSameEtDate(expiry, now)) return false;
  return sessionMinuteEt(now) >= ZERO_DTE_ROLLOVER_MINUTE_ET_DEFAULT;
}

function zeroDteRolloverMinuteEtForSetup(setup: Pick<Setup, 'type'>): number {
  if (TREND_FAMILY_SETUP_TYPES.has(setup.type)) {
    return ZERO_DTE_ROLLOVER_MINUTE_ET_TREND;
  }
  if (setup.type === 'fade_at_wall' || setup.type === 'mean_reversion' || setup.type === 'flip_reclaim') {
    return ZERO_DTE_ROLLOVER_MINUTE_ET_MEAN;
  }
  return ZERO_DTE_ROLLOVER_MINUTE_ET_DEFAULT;
}

function isTerminalZeroDteForSetup(
  setup: Pick<Setup, 'type'>,
  expiry: string,
  now: Date,
): boolean {
  if (!isSameEtDate(expiry, now)) return false;
  return sessionMinuteEt(now) >= zeroDteRolloverMinuteEtForSetup(setup);
}

function deltaBandForSetup(
  setup: Pick<Setup, 'type' | 'regime'>,
  relaxed: boolean,
): { min: number; max: number } {
  const target = deltaTargetForSetup(setup);
  const tolerance = relaxed
    ? 0.22
    : (setup.regime === 'breakout' || setup.regime === 'trending' ? 0.12 : 0.14);
  const minFloor = relaxed ? 0.02 : 0.05;
  const maxCap = relaxed ? MAX_DELTA_RELAXED : MAX_DELTA_STRICT;
  const min = clamp(target - tolerance, minFloor, maxCap);
  const max = clamp(target + tolerance, Math.min(maxCap, min + 0.02), maxCap);
  return { min, max };
}

function applyRegimeDeltaAdjustment(setup: Pick<Setup, 'type' | 'regime'>, baseDelta: number): number {
  if (setup.regime === 'ranging' || setup.regime === 'compression') {
    return clamp(baseDelta + 0.06, 0.12, 0.55);
  }

  if (
    (setup.regime === 'breakout' || setup.regime === 'trending')
    && (setup.type === 'orb_breakout' || setup.type === 'breakout_vacuum' || setup.type === 'trend_continuation')
  ) {
    return clamp(baseDelta - 0.04, 0.12, 0.55);
  }

  if (setup.regime === 'trending' && setup.type === 'trend_pullback') {
    return clamp(baseDelta - 0.02, 0.12, 0.55);
  }

  return clamp(baseDelta, 0.12, 0.55);
}

export function deltaTargetForSetup(setup: Pick<Setup, 'type' | 'regime'>): number {
  const base = (() => {
    switch (setup.type) {
      case 'orb_breakout':
        return 0.32;
      case 'breakout_vacuum':
        return 0.28;
      case 'trend_continuation':
        return 0.3;
      case 'trend_pullback':
        return 0.26;
      case 'flip_reclaim':
        return 0.24;
      case 'mean_reversion':
        return 0.22;
      case 'fade_at_wall':
      default:
        return 0.18;
    }
  })();

  return applyRegimeDeltaAdjustment(setup, base);
}

function getMid(contract: OptionContract): number {
  return (contract.bid + contract.ask) / 2;
}

function getSpreadPct(contract: OptionContract): number {
  const mid = getMid(contract);
  if (!Number.isFinite(mid) || mid <= 0) return Number.POSITIVE_INFINITY;
  return (contract.ask - contract.bid) / mid;
}

function daysToExpiry(expiry: string, now: Date = new Date()): number {
  // SPX options effectively settle near end of regular session; keep DTE anchored to ET session close.
  const expiryMs = Date.parse(`${expiry}T21:00:00Z`);
  if (!Number.isFinite(expiryMs)) return 0;
  const msLeft = expiryMs - now.getTime();
  return Math.max(0, Math.ceil(msLeft / 86400000));
}

function getLiquidityScore(contract: OptionContract): number {
  const spreadPct = getSpreadPct(contract);
  const spreadScore = Number.isFinite(spreadPct)
    ? Math.max(0, Math.min(100, 100 - spreadPct * 180))
    : 0;
  const oiScore = Math.max(0, Math.min(100, Math.log10((contract.openInterest || 0) + 1) * 22));
  const volumeScore = Math.max(0, Math.min(100, Math.log10((contract.volume || 0) + 1) * 24));
  return round((spreadScore * 0.55) + (oiScore * 0.25) + (volumeScore * 0.20), 1);
}

function costBand(askPrice: number): 'discount' | 'balanced' | 'expensive' {
  const debit = askPrice * CONTRACT_MULTIPLIER;
  if (debit <= 1_200) return 'discount';
  if (debit <= 2_700) return 'balanced';
  return 'expensive';
}

function healthTier(score: number): 'green' | 'amber' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 55) return 'amber';
  return 'red';
}

function computeContractHealth(contract: OptionContract): ContractHealth {
  const spreadRatio = getSpreadPct(contract);
  const spreadPct = Number.isFinite(spreadRatio) ? spreadRatio * 100 : 100;
  const liquidity = getLiquidityScore(contract);
  const thetaPer15m = Math.abs(contract.theta || 0) * CONTRACT_MULTIPLIER / 26;
  const iv = Math.max(0, contract.impliedVolatility || 0);
  // Proxy: treat 25% IV as baseline realized expectation for intraday SPX options.
  const ivVsRealized = iv - 0.25;

  const spreadPenalty = Math.min(45, (spreadPct / 20) * 45);
  const liquidityPenalty = liquidity >= 70 ? 0 : Math.min(25, (70 - liquidity) * 0.45);
  const thetaPenalty = Math.min(20, (thetaPer15m / 20) * 20);
  const ivPenalty = iv <= 0.45 ? 0 : Math.min(10, (iv - 0.45) * 80);

  const score = Math.max(0, Math.min(100, 100 - spreadPenalty - liquidityPenalty - thetaPenalty - ivPenalty));
  return {
    score: round(score, 1),
    tier: healthTier(score),
    thetaRiskPer15m: round(thetaPer15m, 2),
    ivVsRealized: round(ivVsRealized, 3),
  };
}

function scoreContract(setup: Setup, contract: OptionContract, now: Date): number {
  const targetDelta = deltaTargetForSetup(setup);
  const absDelta = Math.abs(contract.delta || 0);
  const deltaPenalty = Math.min(1, Math.abs(absDelta - targetDelta) / 0.2) * 45;

  const spreadPct = getSpreadPct(contract);
  const spreadPenalty = Math.min(1, spreadPct / MAX_SPREAD_PCT) * 35;
  const spreadAbsolute = Math.max(0, contract.ask - contract.bid);
  const spreadAbsolutePenalty = Math.min(10, spreadAbsolute * 6);

  const oi = Math.max(0, contract.openInterest || 0);
  const volume = Math.max(0, contract.volume || 0);
  const liquidityBonus = Math.min(18, Math.log10(oi + 1) * 4 + Math.log10(volume + 1) * 3);

  const gamma = Math.max(0, contract.gamma || 0);
  const gammaBonus = Math.min(10, gamma * 250);

  const dte = daysToExpiry(contract.expiry, now);
  const theta = Math.abs(contract.theta || 0);
  const thetaTolerance = dte <= 1 ? 1.3 : dte <= 3 ? 1.0 : 0.8;
  const thetaPenalty = Math.max(0, theta - thetaTolerance) * 8;

  return 100 - deltaPenalty - spreadPenalty - spreadAbsolutePenalty - thetaPenalty + liquidityBonus + gammaBonus;
}

function toContractRecommendation(
  setup: Setup,
  rankedContracts: RankedContract[],
  portfolioRisk?: {
    dayTradeBuyingPower: number | null;
    maxRiskDollars: number | null;
    zeroDteBlockedByPdt: boolean;
  },
): ContractRecommendation {
  const [{ contract, score }] = rankedContracts;
  const mid = getMid(contract);
  const entry = (setup.entryZone.low + setup.entryZone.high) / 2;
  const moveToTarget1 = Math.abs(setup.target1.price - entry);
  const moveToTarget2 = Math.abs(setup.target2.price - entry);
  const spreadPct = getSpreadPct(contract);
  const liquidityScore = getLiquidityScore(contract);
  const dte = daysToExpiry(contract.expiry);
  const health = computeContractHealth(contract);
  const sizing = computeSuggestedContracts({
    ask: contract.ask,
    dayTradeBuyingPower: portfolioRisk?.dayTradeBuyingPower ?? null,
    maxRiskDollars: portfolioRisk?.maxRiskDollars ?? null,
  });

  const projectedTarget1 = mid + (Math.abs(contract.delta || 0) * moveToTarget1 * 0.1) + ((contract.gamma || 0) * moveToTarget1 * 0.8);
  const projectedTarget2 = mid + (Math.abs(contract.delta || 0) * moveToTarget2 * 0.1) + ((contract.gamma || 0) * moveToTarget2 * 0.9);

  const risk = Math.max(0.01, Math.abs(entry - setup.stop));
  const reward = Math.abs(setup.target1.price - entry);
  const alternativeCandidates = rankedContracts.slice(1, 4).map((candidate) => {
    const candidateMid = getMid(candidate.contract);
    const candidateSpread = getSpreadPct(candidate.contract);
    const candidateHealth = computeContractHealth(candidate.contract);
    return {
      description: `${candidate.contract.strike}${candidate.contract.type === 'call' ? 'C' : 'P'} ${candidate.contract.expiry}`,
      strike: round(candidate.contract.strike, 2),
      expiry: candidate.contract.expiry,
      type: candidate.contract.type,
      delta: round(candidate.contract.delta || 0, 3),
      bid: round(candidate.contract.bid, 2),
      ask: round(candidate.contract.ask, 2),
      spreadPct: Number.isFinite(candidateSpread) ? round(candidateSpread * 100, 2) : 0,
      liquidityScore: getLiquidityScore(candidate.contract),
      maxLoss: round(Math.max(candidate.contract.ask, candidateMid) * CONTRACT_MULTIPLIER, 2),
      healthScore: candidateHealth.score,
      healthTier: candidateHealth.tier,
      score: round(candidate.score, 2),
    };
  });

  const taggedAlternativeIndex = new Map<number, 'tighter' | 'safer' | 'higher_conviction'>();
  if (alternativeCandidates.length > 0) {
    const tightestIndex = alternativeCandidates.reduce((best, candidate, idx) => (
      candidate.spreadPct < alternativeCandidates[best].spreadPct ? idx : best
    ), 0);
    taggedAlternativeIndex.set(tightestIndex, 'tighter');

    const safestIndex = alternativeCandidates.reduce((best, candidate, idx) => (
      candidate.maxLoss < alternativeCandidates[best].maxLoss ? idx : best
    ), 0);
    if (!taggedAlternativeIndex.has(safestIndex)) {
      taggedAlternativeIndex.set(safestIndex, 'safer');
    }

    const convictionIndex = alternativeCandidates.reduce((best, candidate, idx) => (
      candidate.score > alternativeCandidates[best].score ? idx : best
    ), 0);
    if (!taggedAlternativeIndex.has(convictionIndex)) {
      taggedAlternativeIndex.set(convictionIndex, 'higher_conviction');
    }
  }

  const alternatives = alternativeCandidates.map((candidate, index) => {
    const tag = taggedAlternativeIndex.get(index);
    const tradeoff = tag === 'tighter'
      ? 'Lower spread, better execution quality.'
      : tag === 'safer'
        ? 'Lower max loss per contract.'
        : tag === 'higher_conviction'
          ? 'Highest model score among alternatives.'
          : undefined;
    return {
      ...candidate,
      tag,
      tradeoff,
    };
  });

  return {
    description: `${contract.strike}${contract.type === 'call' ? 'C' : 'P'} ${contract.expiry}`,
    strike: round(contract.strike, 2),
    expiry: contract.expiry,
    type: contract.type,
    delta: round(contract.delta || 0, 3),
    gamma: round(contract.gamma || 0, 3),
    theta: round(contract.theta || 0, 3),
    vega: round(contract.vega || 0, 3),
    bid: round(contract.bid, 2),
    ask: round(contract.ask, 2),
    riskReward: round(reward / risk, 2),
    expectedPnlAtTarget1: round((projectedTarget1 - mid) * 100, 2),
    expectedPnlAtTarget2: round((projectedTarget2 - mid) * 100, 2),
    // Worst-case debit risk should use ask (entry at offer), not midpoint.
    maxLoss: round(Math.max(contract.ask, mid) * CONTRACT_MULTIPLIER, 2),
    spreadPct: Number.isFinite(spreadPct) ? round(spreadPct * 100, 2) : undefined,
    openInterest: contract.openInterest || 0,
    volume: contract.volume || 0,
    liquidityScore,
    daysToExpiry: dte,
    premiumMid: round(mid * CONTRACT_MULTIPLIER, 2),
    premiumAsk: round(contract.ask * CONTRACT_MULTIPLIER, 2),
    costBand: costBand(contract.ask),
    healthScore: health.score,
    healthTier: health.tier,
    thetaRiskPer15m: health.thetaRiskPer15m,
    ivVsRealized: health.ivVsRealized,
    suggestedContracts: sizing.suggestedContracts ?? undefined,
    suggestedPositionCost: sizing.suggestedPositionCost ?? undefined,
    dayTradeBuyingPowerUsed: portfolioRisk?.dayTradeBuyingPower ?? null,
    maxRiskDollarsUsed: portfolioRisk?.maxRiskDollars ?? null,
    sizingReason: sizing.sizingReason,
    zeroDteBlocked: portfolioRisk?.zeroDteBlockedByPdt === true,
    alternatives,
    reasoning: `Selected for ${setup.type} with model score ${round(score, 1)} and ${health.tier.toUpperCase()} contract health (${health.score}).`,
  };
}

function quoteQualityCaps(mid: number, relaxed: boolean): { spreadCap: number; quoteBalanceFloor: number } {
  if (mid < 5) {
    return {
      spreadCap: relaxed ? 0.5 : 0.35,
      quoteBalanceFloor: relaxed ? 0.5 : 0.6,
    };
  }

  if (mid < 15) {
    return {
      spreadCap: relaxed ? 0.9 : 0.65,
      quoteBalanceFloor: relaxed ? 0.52 : 0.62,
    };
  }

  return {
    spreadCap: relaxed ? 1.4 : 1.05,
    quoteBalanceFloor: relaxed ? 0.55 : 0.65,
  };
}

function hasReliableQuote(contract: OptionContract, relaxed: boolean): boolean {
  const mid = getMid(contract);
  const spread = contract.ask - contract.bid;
  if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(spread) || spread <= 0) return false;
  const spreadPct = getSpreadPct(contract);
  if (!Number.isFinite(spreadPct)) return false;

  const caps = quoteQualityCaps(mid, relaxed);
  const quoteBalance = contract.bid / contract.ask;
  return spread <= caps.spreadCap && quoteBalance >= caps.quoteBalanceFloor;
}

export function filterCandidates(
  setup: Setup,
  contracts: OptionContract[],
  relaxed: boolean,
  now: Date,
): OptionContract[] {
  const nowMinuteEt = sessionMinuteEt(now);
  const lateDay = nowMinuteEt >= LATE_DAY_FILTER_MINUTE_ET;
  const desiredType: OptionContract['type'] = setup.direction === 'bullish' ? 'call' : 'put';
  const minOI = relaxed ? 10 : MIN_OPEN_INTEREST;
  const minVol = relaxed ? 1 : MIN_VOLUME;
  const maxSpread = relaxed ? 0.42 : MAX_SPREAD_PCT;
  const deltaBand = deltaBandForSetup(setup, relaxed);
  const maxRisk = relaxed ? MAX_CONTRACT_RISK_RELAXED : MAX_CONTRACT_RISK_STRICT;

  return contracts.filter((contract) => {
    if (contract.type !== desiredType) return false;
    if (!(contract.bid > 0 && contract.ask > contract.bid)) return false;
    if (isTerminalZeroDteForSetup(setup, contract.expiry, now)) return false;
    const absDelta = Math.abs(contract.delta || 0);
    if (!Number.isFinite(absDelta) || absDelta < deltaBand.min || absDelta > deltaBand.max) return false;
    const dte = daysToExpiry(contract.expiry, now);
    const absTheta = Math.abs(contract.theta || 0);
    if (dte === 0 && absTheta > (relaxed ? RELAXED_ZERO_DTE_MAX_ABS_THETA : STRICT_ZERO_DTE_MAX_ABS_THETA)) {
      return false;
    }
    if ((contract.openInterest || 0) < minOI && (contract.volume || 0) < minVol) return false;
    const spreadPct = getSpreadPct(contract);
    if (!Number.isFinite(spreadPct) || spreadPct > maxSpread) return false;
    if (lateDay) {
      const absoluteSpread = contract.ask - contract.bid;
      if (spreadPct > LATE_DAY_MAX_SPREAD_PCT) return false;
      if (!Number.isFinite(absoluteSpread) || absoluteSpread > LATE_DAY_MAX_ABSOLUTE_SPREAD) return false;
      if ((contract.openInterest || 0) < LATE_DAY_MIN_OPEN_INTEREST) return false;
    }
    if (!hasReliableQuote(contract, relaxed)) return false;

    const perContractRisk = contract.ask * CONTRACT_MULTIPLIER;
    if (!Number.isFinite(perContractRisk) || perContractRisk <= 0) return false;
    return perContractRisk <= maxRisk;
  });
}

function rankContracts(setup: Setup, contracts: OptionContract[], now: Date): RankedContract[] {
  let candidates = filterCandidates(setup, contracts, false, now);

  if (candidates.length === 0) {
    candidates = filterCandidates(setup, contracts, true, now);
    if (candidates.length > 0) {
      logger.info('Contract selector using relaxed filters', {
        setupId: setup.id,
        relaxedCandidates: candidates.length,
      });
    }
  }

  if (candidates.length === 0) return [];

  return candidates
    .map((contract) => ({
      contract,
      score: scoreContract(setup, contract, now),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const aOI = a.contract.openInterest || 0;
      const bOI = b.contract.openInterest || 0;
      if (aOI !== bOI) return bOI - aOI;
      return (b.contract.volume || 0) - (a.contract.volume || 0);
    });
}

function topRankedContracts(setup: Setup, contracts: OptionContract[], now: Date): RankedContract[] {
  const ranked = rankContracts(setup, contracts, now);
  return ranked.slice(0, 4);
}

async function resolveTargetExpiryWithPolicy(input: {
  symbol: string;
  now: Date;
  allowZeroDte: boolean;
}): Promise<string | undefined> {
  let expirations = await fetchExpirationDates(input.symbol, {
    maxDaysAhead: CONTRACT_EXPIRY_LOOKAHEAD_DAYS,
    maxPages: CONTRACT_EXPIRY_LOOKAHEAD_MAX_PAGES,
  });
  if (expirations.length === 0) {
    expirations = await fetchExpirationDates(input.symbol);
  }
  if (!Array.isArray(expirations) || expirations.length === 0) {
    return undefined;
  }

  const todayEt = toEasternTime(input.now).dateStr;
  const futureExpirations = expirations.filter((expiry) => expiry >= todayEt);
  if (futureExpirations.length === 0) {
    return undefined;
  }

  const nearestExpiry = futureExpirations[0];
  if (!input.allowZeroDte && nearestExpiry === todayEt) {
    return futureExpirations[1];
  }

  if (!isTerminalZeroDte(nearestExpiry, input.now)) {
    return nearestExpiry;
  }

  return futureExpirations[1] || nearestExpiry;
}

function resolvePortfolioRiskContext(input?: PortfolioRiskContext): {
  dayTradeBuyingPower: number | null;
  maxRiskDollars: number | null;
  zeroDteBlockedByPdt: boolean;
} {
  const dtbp = typeof input?.dayTradeBuyingPower === 'number' && Number.isFinite(input.dayTradeBuyingPower)
    ? Math.max(0, input.dayTradeBuyingPower)
    : null;
  const maxRisk = typeof input?.maxRiskDollars === 'number' && Number.isFinite(input.maxRiskDollars)
    ? Math.max(0, input.maxRiskDollars)
    : null;
  const pdtQualified = input?.pdtQualified;
  const zeroDteBlockedByPdt = pdtQualified === false || (dtbp != null && dtbp < MIN_DTBP_FOR_ZERO_DTE);

  return {
    dayTradeBuyingPower: dtbp,
    maxRiskDollars: maxRisk,
    zeroDteBlockedByPdt,
  };
}

function computeSuggestedContracts(input: {
  ask: number;
  dayTradeBuyingPower: number | null;
  maxRiskDollars: number | null;
}): {
  suggestedContracts: number | null;
  suggestedPositionCost: number | null;
  sizingReason: string;
} {
  const perContractCost = Math.max(0, input.ask) * CONTRACT_MULTIPLIER;
  if (!Number.isFinite(perContractCost) || perContractCost <= 0) {
    return {
      suggestedContracts: null,
      suggestedPositionCost: null,
      sizingReason: 'No sizing available: invalid option ask price.',
    };
  }

  const budgets: number[] = [];
  const reasons: string[] = [];
  if (input.maxRiskDollars != null && input.maxRiskDollars > 0) {
    budgets.push(input.maxRiskDollars);
    reasons.push(`risk cap $${round(input.maxRiskDollars, 2)}`);
  }
  if (input.dayTradeBuyingPower != null && input.dayTradeBuyingPower > 0) {
    budgets.push(input.dayTradeBuyingPower * MAX_DTBP_USAGE_PCT);
    reasons.push(`DTBP cap ${(MAX_DTBP_USAGE_PCT * 100).toFixed(0)}% of $${round(input.dayTradeBuyingPower, 2)}`);
  }

  if (budgets.length === 0) {
    return {
      suggestedContracts: null,
      suggestedPositionCost: null,
      sizingReason: 'No sizing context provided (maxRiskDollars/dayTradeBuyingPower missing).',
    };
  }

  const budget = Math.min(...budgets);
  const suggestedContracts = Math.max(0, Math.floor(budget / perContractCost));
  return {
    suggestedContracts,
    suggestedPositionCost: round(suggestedContracts * perContractCost, 2),
    sizingReason: `Sized from ${reasons.join(' + ')}.`,
  };
}

export async function getContractRecommendation(options?: {
  setupId?: string;
  setup?: Setup | null;
  forceRefresh?: boolean;
  portfolioRisk?: PortfolioRiskContext;
}): Promise<ContractRecommendation | null> {
  const setupId = options?.setupId || null;
  const portfolioRisk = resolvePortfolioRiskContext(options?.portfolioRisk);
  const riskFingerprint = [
    portfolioRisk.dayTradeBuyingPower != null ? round(portfolioRisk.dayTradeBuyingPower, 2) : 'na',
    portfolioRisk.maxRiskDollars != null ? round(portfolioRisk.maxRiskDollars, 2) : 'na',
    portfolioRisk.zeroDteBlockedByPdt ? 'pdt_blocked' : 'pdt_ok',
  ].join(':');
  const cacheKey = `spx_command_center:contract:${setupId || 'active'}:${riskFingerprint}`;
  const forceRefresh = options?.forceRefresh === true;
  const cacheEligible = !forceRefresh && !options?.setup;

  if (cacheEligible) {
    const cached = await cacheGet<ContractRecommendation>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const setup = options?.setup
    || (setupId
      ? await getSetupById(setupId, { forceRefresh })
      : (await detectActiveSetups({ forceRefresh })).find((item) => item.status === 'ready') || null);

  if (!setup) {
    return null;
  }
  if (!ACTIONABLE_SETUP_STATUSES.has(setup.status)) {
    logger.info('Skipping contract recommendation for non-actionable setup', {
      setupId: setup.id,
      status: setup.status,
    });
    return null;
  }

  const now = new Date();
  const targetExpiry = await resolveTargetExpiryWithPolicy({
    symbol: 'SPX',
    now,
    allowZeroDte: !portfolioRisk.zeroDteBlockedByPdt,
  });
  if (!targetExpiry) {
    logger.warn('SPX contract selector could not resolve target expiry', {
      setupId: setup.id,
      zeroDteBlockedByPdt: portfolioRisk.zeroDteBlockedByPdt,
    });
    return null;
  }
  const chain = await fetchOptionsChain('SPX', targetExpiry, 20);
  const contracts = [...chain.options.calls, ...chain.options.puts];
  const rankedContracts = topRankedContracts(setup, contracts, now);

  if (rankedContracts.length === 0) {
    logger.warn('SPX contract selector could not find suitable contract', {
      setupId: setup.id,
      direction: setup.direction,
      type: setup.type,
      requestedExpiry: targetExpiry || 'nearest',
      chainExpiry: chain.expiry,
    });
    return null;
  }

  const recommendation = toContractRecommendation(setup, rankedContracts, portfolioRisk);
  if (cacheEligible) {
    await cacheSet(cacheKey, recommendation, CONTRACT_CACHE_TTL_SECONDS);
  }

  return recommendation;
}
