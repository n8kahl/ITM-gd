import { cacheGet, cacheSet } from '../../config/redis';
import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { fetchExpirationDates, fetchOptionsChain } from '../options/optionsChainFetcher';
import { analyzeIVProfile } from '../options/ivAnalysis';
import type { IVForecastAnalysis, OptionContract } from '../options/types';
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
const ZERO_DTE_ROLLOVER_MINUTE_ET = 13 * 60;
const LATE_DAY_FILTER_MINUTE_ET = 14 * 60;
const LATE_DAY_MAX_SPREAD_PCT = 0.18;
const LATE_DAY_MAX_ABSOLUTE_SPREAD = 0.35;
const LATE_DAY_MIN_OPEN_INTEREST = 250;
const DEFAULT_MAX_RISK_PCT = 0.02;
const DEFAULT_BUYING_POWER_UTILIZATION_PCT = 0.9;
const DEFAULT_IV_TIMING_ENABLED = true;
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

interface ContractSelectionRiskContext {
  totalEquity?: number;
  dayTradeBuyingPower?: number;
  maxRiskPct?: number;
  buyingPowerUtilizationPct?: number;
}

interface ContractSizingResult {
  recommendedContracts: number;
  maxRiskDollars: number;
  contractsByRisk: number;
  contractsByBuyingPower: number;
  perContractDebit: number;
  blockedReason?: 'margin_limit_blocked';
}

interface IVTimingSignal {
  signal: 'tailwind' | 'headwind' | 'neutral';
  scoreBias: number;
  confidence: number;
  deltaIV: number | null;
  recommendation: 'enter_now' | 'wait_for_better_iv' | 'neutral';
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

function resolveIVTimingEnabled(): boolean {
  return parseBooleanFlag(process.env.SPX_CONTRACT_SELECTOR_IV_TIMING_ENABLED) ?? DEFAULT_IV_TIMING_ENABLED;
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
  return sessionMinuteEt(now) >= ZERO_DTE_ROLLOVER_MINUTE_ET;
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
      case 'vwap_reclaim':
        return 0.28;
      case 'vwap_fade_at_band':
        return 0.2;
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

function clampPercent(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function computeSizingResult(
  ask: number,
  riskContext: ContractSelectionRiskContext | null,
): ContractSizingResult | null {
  if (!riskContext) return null;
  const totalEquity = Math.max(0, riskContext.totalEquity || 0);
  const dayTradeBuyingPower = Math.max(0, riskContext.dayTradeBuyingPower || 0);
  if (!Number.isFinite(totalEquity) || totalEquity <= 0) return null;

  const maxRiskPct = clampPercent(
    riskContext.maxRiskPct ?? DEFAULT_MAX_RISK_PCT,
    DEFAULT_MAX_RISK_PCT,
    0.0025,
    0.05,
  );
  const buyingPowerUtilizationPct = clampPercent(
    riskContext.buyingPowerUtilizationPct ?? DEFAULT_BUYING_POWER_UTILIZATION_PCT,
    DEFAULT_BUYING_POWER_UTILIZATION_PCT,
    0.25,
    0.98,
  );
  const perContractDebit = Math.max(0, ask) * CONTRACT_MULTIPLIER;
  const maxRiskDollars = totalEquity * maxRiskPct;
  const contractsByRisk = perContractDebit > 0 ? Math.floor(maxRiskDollars / perContractDebit) : 0;
  const contractsByBuyingPower = perContractDebit > 0
    ? Math.floor((dayTradeBuyingPower * buyingPowerUtilizationPct) / perContractDebit)
    : 0;
  const recommendedContracts = Math.max(0, Math.min(contractsByRisk, contractsByBuyingPower));

  return {
    recommendedContracts,
    maxRiskDollars: round(maxRiskDollars, 2),
    contractsByRisk,
    contractsByBuyingPower,
    perContractDebit: round(perContractDebit, 2),
    blockedReason: recommendedContracts < 1 ? 'margin_limit_blocked' : undefined,
  };
}

function riskContextFingerprint(
  userId: string | undefined,
  riskContext: ContractSelectionRiskContext | null,
): string {
  if (!riskContext) return userId ? `u:${userId}` : 'risk:none';
  const equity = round(riskContext.totalEquity || 0, 2);
  const dtbp = round(riskContext.dayTradeBuyingPower || 0, 2);
  const maxRiskPct = round(riskContext.maxRiskPct ?? DEFAULT_MAX_RISK_PCT, 4);
  const bpPct = round(riskContext.buyingPowerUtilizationPct ?? DEFAULT_BUYING_POWER_UTILIZATION_PCT, 4);
  return `u:${userId || 'none'}|eq:${equity}|dtbp:${dtbp}|rp:${maxRiskPct}|bp:${bpPct}`;
}

async function loadLatestRiskContextForUser(userId: string): Promise<ContractSelectionRiskContext | null> {
  const normalized = userId.trim();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('total_equity,day_trade_buying_power')
    .eq('user_id', normalized)
    .order('snapshot_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes('relation') && normalizedMessage.includes('does not exist') && normalizedMessage.includes('portfolio_snapshots')) {
      return null;
    }
    logger.warn('Contract selector failed to load user risk context', {
      userId: normalized,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;
  return {
    totalEquity: Number((data as { total_equity?: unknown }).total_equity) || 0,
    dayTradeBuyingPower: Number((data as { day_trade_buying_power?: unknown }).day_trade_buying_power) || 0,
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

export function buildIVTimingSignal(ivForecast: IVForecastAnalysis | null | undefined): IVTimingSignal | null {
  if (!ivForecast) return null;
  if (ivForecast.deltaIV == null || !Number.isFinite(ivForecast.deltaIV)) return null;
  if (!Number.isFinite(ivForecast.confidence) || ivForecast.confidence < 0.3) {
    return {
      signal: 'neutral',
      scoreBias: 0,
      confidence: 0,
      deltaIV: ivForecast.deltaIV,
      recommendation: 'neutral',
      summary: 'IV forecast confidence too low to influence timing.',
    };
  }

  if (ivForecast.direction === 'up') {
    const scoreBias = clamp((ivForecast.confidence * 8) + Math.min(ivForecast.deltaIV, 2.5), 0, 10);
    return {
      signal: 'tailwind',
      scoreBias: round(scoreBias, 3),
      confidence: round(ivForecast.confidence, 3),
      deltaIV: round(ivForecast.deltaIV, 3),
      recommendation: 'enter_now',
      summary: '1h IV forecast rising; timing favors immediate entries.',
    };
  }

  if (ivForecast.direction === 'down') {
    const scoreBias = clamp((ivForecast.confidence * 8) + Math.min(Math.abs(ivForecast.deltaIV), 2.5), 0, 10);
    return {
      signal: 'headwind',
      scoreBias: round(-scoreBias, 3),
      confidence: round(ivForecast.confidence, 3),
      deltaIV: round(ivForecast.deltaIV, 3),
      recommendation: ivForecast.confidence >= 0.7 && Math.abs(ivForecast.deltaIV) >= 1 ? 'wait_for_better_iv' : 'neutral',
      summary: '1h IV forecast falling; better premium may be available on patience.',
    };
  }

  return {
    signal: 'neutral',
    scoreBias: 0,
    confidence: round(ivForecast.confidence, 3),
    deltaIV: round(ivForecast.deltaIV, 3),
    recommendation: 'neutral',
    summary: '1h IV forecast flat; no timing edge from volatility.',
  };
}

function scoreContractWithIVTiming(
  baseScore: number,
  contract: OptionContract,
  ivTimingSignal: IVTimingSignal | null,
): number {
  if (!ivTimingSignal || ivTimingSignal.signal === 'neutral') return baseScore;

  const vega = Math.max(0, Math.abs(contract.vega || 0));
  const iv = Math.max(0, contract.impliedVolatility || 0);
  if (ivTimingSignal.signal === 'tailwind') {
    const vegaBoost = Math.min(6, vega * 0.35);
    return baseScore + ivTimingSignal.scoreBias + vegaBoost;
  }

  const expensiveIVPenalty = Math.max(0, iv - 0.2) * 14;
  return baseScore + ivTimingSignal.scoreBias - Math.min(8, expensiveIVPenalty);
}

function toContractRecommendation(
  setup: Setup,
  rankedContracts: RankedContract[],
  sizing: ContractSizingResult | null,
  ivTimingSignal: IVTimingSignal | null,
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
    alternatives,
    suggestedContracts: sizing?.recommendedContracts,
    sizing: sizing
      ? {
        maxRiskDollars: sizing.maxRiskDollars,
        contractsByRisk: sizing.contractsByRisk,
        contractsByBuyingPower: sizing.contractsByBuyingPower,
        perContractDebit: sizing.perContractDebit,
        blockedReason: sizing.blockedReason,
      }
      : undefined,
    ivTiming: ivTimingSignal
      ? {
        signal: ivTimingSignal.signal,
        confidence: ivTimingSignal.confidence,
        deltaIV: ivTimingSignal.deltaIV,
        recommendation: ivTimingSignal.recommendation,
        summary: ivTimingSignal.summary,
      }
      : undefined,
    reasoning: ivTimingSignal
      ? `Selected for ${setup.type} with model score ${round(score, 1)} and ${health.tier.toUpperCase()} contract health (${health.score}). ${ivTimingSignal.summary}`
      : `Selected for ${setup.type} with model score ${round(score, 1)} and ${health.tier.toUpperCase()} contract health (${health.score}).`,
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
  const minDelta = relaxed ? 0.02 : 0.05;
  const maxDelta = relaxed ? MAX_DELTA_RELAXED : MAX_DELTA_STRICT;
  const maxRisk = relaxed ? MAX_CONTRACT_RISK_RELAXED : MAX_CONTRACT_RISK_STRICT;

  return contracts.filter((contract) => {
    if (contract.type !== desiredType) return false;
    if (!(contract.bid > 0 && contract.ask > contract.bid)) return false;
    if (isTerminalZeroDte(contract.expiry, now)) return false;
    const absDelta = Math.abs(contract.delta || 0);
    if (!Number.isFinite(absDelta) || absDelta < minDelta || absDelta > maxDelta) return false;
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

function rankContracts(
  setup: Setup,
  contracts: OptionContract[],
  now: Date,
  ivTimingSignal: IVTimingSignal | null,
): RankedContract[] {
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
      score: scoreContractWithIVTiming(scoreContract(setup, contract, now), contract, ivTimingSignal),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const aOI = a.contract.openInterest || 0;
      const bOI = b.contract.openInterest || 0;
      if (aOI !== bOI) return bOI - aOI;
      return (b.contract.volume || 0) - (a.contract.volume || 0);
    });
}

function topRankedContracts(
  setup: Setup,
  contracts: OptionContract[],
  now: Date,
  ivTimingSignal: IVTimingSignal | null,
): RankedContract[] {
  const ranked = rankContracts(setup, contracts, now, ivTimingSignal);
  return ranked.slice(0, 4);
}

async function resolveTargetExpiry(symbol: string, now: Date): Promise<string | undefined> {
  const expirations = await fetchExpirationDates(symbol);
  if (!Array.isArray(expirations) || expirations.length === 0) {
    return undefined;
  }

  const todayEt = toEasternTime(now).dateStr;
  const futureExpirations = expirations.filter((expiry) => expiry >= todayEt);
  if (futureExpirations.length === 0) {
    return undefined;
  }

  const nearestExpiry = futureExpirations[0];
  if (!isTerminalZeroDte(nearestExpiry, now)) {
    return nearestExpiry;
  }

  return futureExpirations[1] || nearestExpiry;
}

export async function getContractRecommendation(options?: {
  setupId?: string;
  setup?: Setup | null;
  forceRefresh?: boolean;
  userId?: string;
  riskContext?: ContractSelectionRiskContext | null;
}): Promise<ContractRecommendation | null> {
  const setupId = options?.setupId || null;
  const adHocSetup = options?.setup ? true : false;
  const forceRefresh = options?.forceRefresh === true;
  const loadedRiskContext = options?.riskContext === undefined
    ? (options?.userId ? await loadLatestRiskContextForUser(options.userId) : null)
    : options.riskContext;
  const riskFingerprint = riskContextFingerprint(options?.userId, loadedRiskContext);
  const cacheKey = `spx_command_center:contract:${setupId || 'default'}:${riskFingerprint}`;

  if (!forceRefresh && !adHocSetup) {
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
  const targetExpiry = await resolveTargetExpiry('SPX', now);
  const chain = await fetchOptionsChain('SPX', targetExpiry, 20);
  let ivTimingSignal: IVTimingSignal | null = null;
  if (resolveIVTimingEnabled()) {
    try {
      const ivProfile = await analyzeIVProfile('SPX', { maxExpirations: 2 });
      ivTimingSignal = buildIVTimingSignal(ivProfile.ivForecast ?? null);
    } catch (error) {
      logger.warn('Contract selector IV timing analysis unavailable', {
        setupId: setup.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const contracts = [...chain.options.calls, ...chain.options.puts];
  const rankedContracts = topRankedContracts(setup, contracts, now, ivTimingSignal);

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

  const sizing = computeSizingResult(rankedContracts[0].contract.ask, loadedRiskContext);
  const recommendation = toContractRecommendation(setup, rankedContracts, sizing, ivTimingSignal);
  await cacheSet(cacheKey, recommendation, CONTRACT_CACHE_TTL_SECONDS);

  return recommendation;
}
