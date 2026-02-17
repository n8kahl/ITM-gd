import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { fetchOptionsChain } from '../options/optionsChainFetcher';
import type { OptionContract } from '../options/types';
import { detectActiveSetups, getSetupById } from './setupDetector';
import type { ContractRecommendation, Setup } from './types';
import { round } from './utils';

const CONTRACT_CACHE_TTL_SECONDS = 10;
const ACTIONABLE_SETUP_STATUSES: ReadonlySet<Setup['status']> = new Set(['ready', 'triggered']);
const MIN_OPEN_INTEREST = 100;
const MIN_VOLUME = 10;
const MAX_SPREAD_PCT = 0.35;
const CONTRACT_MULTIPLIER = 100;
const MAX_CONTRACT_RISK_STRICT = 2_500;
const MAX_CONTRACT_RISK_RELAXED = 3_500;
const MAX_DELTA_STRICT = 0.65;
const MAX_DELTA_RELAXED = 0.80;

function deltaTargetForSetup(setup: Setup): number {
  switch (setup.type) {
    case 'breakout_vacuum':
      return 0.28;
    case 'trend_continuation':
      return 0.3;
    case 'mean_reversion':
      return 0.22;
    case 'fade_at_wall':
    default:
      return 0.18;
  }
}

function getMid(contract: OptionContract): number {
  return (contract.bid + contract.ask) / 2;
}

function getSpreadPct(contract: OptionContract): number {
  const mid = getMid(contract);
  if (!Number.isFinite(mid) || mid <= 0) return Number.POSITIVE_INFINITY;
  return (contract.ask - contract.bid) / mid;
}

function daysToExpiry(expiry: string): number {
  const expiryMs = Date.parse(`${expiry}T16:00:00Z`);
  if (!Number.isFinite(expiryMs)) return 0;
  const msLeft = expiryMs - Date.now();
  return Math.max(0, Math.ceil(msLeft / 86400000));
}

function scoreContract(setup: Setup, contract: OptionContract): number {
  const targetDelta = deltaTargetForSetup(setup);
  const absDelta = Math.abs(contract.delta || 0);
  const deltaPenalty = Math.min(1, Math.abs(absDelta - targetDelta) / 0.2) * 45;

  const spreadPct = getSpreadPct(contract);
  const spreadPenalty = Math.min(1, spreadPct / MAX_SPREAD_PCT) * 35;

  const oi = Math.max(0, contract.openInterest || 0);
  const volume = Math.max(0, contract.volume || 0);
  const liquidityBonus = Math.min(18, Math.log10(oi + 1) * 4 + Math.log10(volume + 1) * 3);

  const gamma = Math.max(0, contract.gamma || 0);
  const gammaBonus = Math.min(10, gamma * 250);

  const dte = daysToExpiry(contract.expiry);
  const theta = Math.abs(contract.theta || 0);
  const thetaTolerance = dte <= 1 ? 1.3 : dte <= 3 ? 1.0 : 0.8;
  const thetaPenalty = Math.max(0, theta - thetaTolerance) * 8;

  return 100 - deltaPenalty - spreadPenalty - thetaPenalty + liquidityBonus + gammaBonus;
}

function toContractRecommendation(setup: Setup, contract: OptionContract): ContractRecommendation {
  const mid = getMid(contract);
  const entry = (setup.entryZone.low + setup.entryZone.high) / 2;
  const moveToTarget1 = Math.abs(setup.target1.price - entry);
  const moveToTarget2 = Math.abs(setup.target2.price - entry);

  const projectedTarget1 = mid + (Math.abs(contract.delta || 0) * moveToTarget1 * 0.1) + ((contract.gamma || 0) * moveToTarget1 * 0.8);
  const projectedTarget2 = mid + (Math.abs(contract.delta || 0) * moveToTarget2 * 0.1) + ((contract.gamma || 0) * moveToTarget2 * 0.9);

  const risk = Math.max(0.01, Math.abs(entry - setup.stop));
  const reward = Math.abs(setup.target1.price - entry);

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
    reasoning: `Selected for ${setup.type} with calibrated delta fit, executable spread, strong liquidity, and controlled per-contract risk.`,
  };
}

function filterCandidates(
  setup: Setup,
  contracts: OptionContract[],
  relaxed: boolean,
): OptionContract[] {
  const desiredType: OptionContract['type'] = setup.direction === 'bullish' ? 'call' : 'put';
  const minOI = relaxed ? 10 : MIN_OPEN_INTEREST;
  const minVol = relaxed ? 1 : MIN_VOLUME;
  const maxSpread = relaxed ? 0.50 : MAX_SPREAD_PCT;
  const minDelta = relaxed ? 0.02 : 0.05;
  const maxDelta = relaxed ? MAX_DELTA_RELAXED : MAX_DELTA_STRICT;
  const maxRisk = relaxed ? MAX_CONTRACT_RISK_RELAXED : MAX_CONTRACT_RISK_STRICT;

  return contracts.filter((contract) => {
    if (contract.type !== desiredType) return false;
    if (!(contract.bid > 0 && contract.ask > contract.bid)) return false;
    const absDelta = Math.abs(contract.delta || 0);
    if (!Number.isFinite(absDelta) || absDelta < minDelta || absDelta > maxDelta) return false;
    if ((contract.openInterest || 0) < minOI && (contract.volume || 0) < minVol) return false;
    const spreadPct = getSpreadPct(contract);
    if (!Number.isFinite(spreadPct) || spreadPct > maxSpread) return false;

    const perContractRisk = getMid(contract) * CONTRACT_MULTIPLIER;
    if (!Number.isFinite(perContractRisk) || perContractRisk <= 0) return false;
    return perContractRisk <= maxRisk;
  });
}

function pickBestContract(setup: Setup, contracts: OptionContract[]): OptionContract | null {
  let candidates = filterCandidates(setup, contracts, false);

  if (candidates.length === 0) {
    candidates = filterCandidates(setup, contracts, true);
    if (candidates.length > 0) {
      logger.info('Contract selector using relaxed filters', {
        setupId: setup.id,
        relaxedCandidates: candidates.length,
      });
    }
  }

  if (candidates.length === 0) return null;

  return [...candidates]
    .sort((a, b) => {
      const aScore = scoreContract(setup, a);
      const bScore = scoreContract(setup, b);
      if (aScore !== bScore) return bScore - aScore;
      return (b.openInterest || 0) - (a.openInterest || 0);
    })
    .at(0) || null;
}

export async function getContractRecommendation(options?: {
  setupId?: string;
  setup?: Setup | null;
  forceRefresh?: boolean;
}): Promise<ContractRecommendation | null> {
  const setupId = options?.setupId || null;
  const cacheKey = `spx_command_center:contract:${setupId || 'default'}`;
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
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

  const chain = await fetchOptionsChain('SPX', undefined, 20);
  const contracts = [...chain.options.calls, ...chain.options.puts];
  const contract = pickBestContract(setup, contracts);

  if (!contract) {
    logger.warn('SPX contract selector could not find suitable contract', {
      setupId: setup.id,
      direction: setup.direction,
      type: setup.type,
    });
    return null;
  }

  const recommendation = toContractRecommendation(setup, contract);
  await cacheSet(cacheKey, recommendation, CONTRACT_CACHE_TTL_SECONDS);

  return recommendation;
}
