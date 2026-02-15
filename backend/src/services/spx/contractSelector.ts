import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { fetchOptionsChain } from '../options/optionsChainFetcher';
import type { OptionContract } from '../options/types';
import { detectActiveSetups, getSetupById } from './setupDetector';
import type { ContractRecommendation, Setup } from './types';
import { round } from './utils';

const CONTRACT_CACHE_TTL_SECONDS = 10;

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

function toContractRecommendation(setup: Setup, contract: OptionContract): ContractRecommendation {
  const mid = (contract.bid + contract.ask) / 2;
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
    maxLoss: round(mid * 100, 2),
    reasoning: `Selected for ${setup.type} with delta closest to target and tight spread.`,
  };
}

function pickBestContract(setup: Setup, contracts: OptionContract[]): OptionContract | null {
  const desiredType: OptionContract['type'] = setup.direction === 'bullish' ? 'call' : 'put';
  const targetDelta = deltaTargetForSetup(setup);

  const candidates = contracts.filter((contract) => contract.type === desiredType && contract.bid > 0 && contract.ask > contract.bid);
  if (candidates.length === 0) return null;

  return [...candidates]
    .sort((a, b) => {
      const aDelta = Math.abs(Math.abs(a.delta || 0) - targetDelta);
      const bDelta = Math.abs(Math.abs(b.delta || 0) - targetDelta);
      if (aDelta !== bDelta) return aDelta - bDelta;

      const aSpread = a.ask - a.bid;
      const bSpread = b.ask - b.bid;
      if (aSpread !== bSpread) return aSpread - bSpread;

      return (b.openInterest || 0) - (a.openInterest || 0);
    })
    .at(0) || null;
}

export async function getContractRecommendation(options?: {
  setupId?: string;
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

  const setup = setupId
    ? await getSetupById(setupId, { forceRefresh })
    : (await detectActiveSetups({ forceRefresh })).find((item) => item.status === 'ready') || null;

  if (!setup) {
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
