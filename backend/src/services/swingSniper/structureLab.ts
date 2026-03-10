import { logger } from '../../lib/logger';
import { fetchExpirationDates, fetchOptionsChain } from '../options/optionsChainFetcher';
import type { OptionContract } from '../options/types';
import type {
  SwingSniperDirection,
  SwingSniperRiskMode,
  SwingSniperStructureLabResponse,
  SwingSniperStructureLeg,
  SwingSniperStructureRecommendation,
  SwingSniperStructureStrategy,
  SwingSniperSwingWindow,
} from './types';
import { clamp, daysUntil, round } from './utils';

const STRUCTURE_STRIKE_RANGE = 14;
const STRUCTURE_MAX_DAYS_AHEAD = 120;
const STRUCTURE_MAX_PAGES = 6;
const STRUCTURE_DISTRIBUTION_WEIGHTS = [0.1, 0.2, 0.4, 0.2, 0.1] as const;
const STRUCTURE_DISTRIBUTION_SIGMAS = [-1.5, -0.75, 0, 0.75, 1.5] as const;

interface BuildSwingSniperStructureLabInput {
  symbol: string;
  direction: SwingSniperDirection;
  currentPrice: number;
  currentIV: number | null;
  ivRank: number | null;
  skewDirection: 'put_heavy' | 'call_heavy' | 'balanced' | 'unknown';
  catalystDaysUntil: number | null;
  termStructureShape: 'contango' | 'backwardation' | 'flat';
  maxRecommendations?: number;
  riskMode?: SwingSniperRiskMode;
  swingWindow?: SwingSniperSwingWindow;
  preferredSetups?: SwingSniperStructureStrategy[];
}

const DEFAULT_DEFINED_RISK_STRATEGIES: SwingSniperStructureStrategy[] = [
  'call_debit_spread',
  'put_debit_spread',
  'call_calendar',
  'put_calendar',
  'call_diagonal',
  'put_diagonal',
  'call_butterfly',
  'put_butterfly',
];

const ADVANCED_NAKED_STRATEGIES = new Set<SwingSniperStructureStrategy>([
  'long_call',
  'long_put',
  'long_straddle',
  'long_strangle',
]);

interface OptionLegPlan {
  label: string;
  side: 'buy' | 'sell';
  quantity: number;
  contract: OptionContract;
}

interface StructurePlan {
  id: string;
  strategy: SwingSniperStructureStrategy;
  strategyLabel: string;
  rankingBoost: number;
  entryWindow: string;
  invalidation: string;
  whyThisStructure: string[];
  risks: string[];
  legs: OptionLegPlan[];
}

interface PriceScenario {
  label: string;
  price: number;
  pnl: number;
}

interface StrategyContext {
  spotPrice: number;
  direction: SwingSniperDirection;
  currentIV: number | null;
  ivRank: number | null;
  skewDirection: BuildSwingSniperStructureLabInput['skewDirection'];
  catalystDaysUntil: number | null;
  termStructureShape: BuildSwingSniperStructureLabInput['termStructureShape'];
  nearCalls: OptionContract[];
  nearPuts: OptionContract[];
  farCalls: OptionContract[];
  farPuts: OptionContract[];
  nearDte: number;
}

function getOptionMark(contract: OptionContract): number | null {
  const bid = Number.isFinite(contract.bid) ? contract.bid : 0;
  const ask = Number.isFinite(contract.ask) ? contract.ask : 0;

  if (bid > 0 && ask > 0) {
    return round((bid + ask) / 2, 3);
  }

  if (Number.isFinite(contract.last) && contract.last > 0) {
    return round(contract.last, 3);
  }

  if (bid > 0) return round(bid, 3);
  if (ask > 0) return round(ask, 3);
  return null;
}

function getSpreadPct(contract: OptionContract): number | null {
  const bid = Number.isFinite(contract.bid) ? contract.bid : 0;
  const ask = Number.isFinite(contract.ask) ? contract.ask : 0;
  const mid = getOptionMark(contract);

  if (mid == null || mid <= 0 || ask <= 0 || bid < 0 || ask < bid) {
    return null;
  }

  return round(((ask - bid) / mid) * 100, 2);
}

function getLiquidityScore(contract: OptionContract): number {
  const spreadPct = getSpreadPct(contract);
  const spreadScore = spreadPct == null
    ? 25
    : clamp(100 - spreadPct * 4.2, 0, 100);
  const openInterestScore = clamp(Math.log10(Math.max(contract.openInterest, 0) + 1) * 26, 0, 100);
  const volumeScore = clamp(Math.log10(Math.max(contract.volume, 0) + 1) * 30, 0, 100);

  return round((spreadScore * 0.55) + (openInterestScore * 0.25) + (volumeScore * 0.20), 1);
}

function summarizeSpreadQuality(spreadPct: number | null): 'tight' | 'fair' | 'wide' {
  if (spreadPct == null || !Number.isFinite(spreadPct)) return 'wide';
  if (spreadPct <= 10) return 'tight';
  if (spreadPct <= 18) return 'fair';
  return 'wide';
}

function legCost(leg: OptionLegPlan): number | null {
  const mark = getOptionMark(leg.contract);
  if (mark == null) return null;
  const sideSign = leg.side === 'buy' ? 1 : -1;
  return mark * leg.quantity * sideSign;
}

function netPremium(legs: OptionLegPlan[]): number | null {
  const costs = legs.map(legCost);
  if (costs.some((value) => value == null)) return null;
  return round(costs.reduce<number>((sum, value) => sum + (value ?? 0), 0), 3);
}

function optionIntrinsic(type: 'call' | 'put', strike: number, spot: number): number {
  if (type === 'call') return Math.max(0, spot - strike);
  return Math.max(0, strike - spot);
}

function payoutAtSpot(legs: OptionLegPlan[], spot: number): number {
  return legs.reduce((sum, leg) => {
    const intrinsic = optionIntrinsic(leg.contract.type, leg.contract.strike, spot);
    const sideSign = leg.side === 'buy' ? 1 : -1;
    return sum + (intrinsic * leg.quantity * sideSign);
  }, 0);
}

function pnlAtSpot(legs: OptionLegPlan[], spot: number): number | null {
  const premium = netPremium(legs);
  if (premium == null) return null;
  const payout = payoutAtSpot(legs, spot);
  return round((payout - premium) * 100, 2);
}

function findStrikeCrossings(points: Array<{ price: number; pnl: number }>): number[] {
  const crossings: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if ((previous.pnl <= 0 && current.pnl >= 0) || (previous.pnl >= 0 && current.pnl <= 0)) {
      const slope = current.pnl - previous.pnl;
      if (Math.abs(slope) < 1e-6) {
        crossings.push(round(current.price, 2));
        continue;
      }
      const weight = Math.abs(previous.pnl) / Math.abs(slope);
      const price = previous.price + (current.price - previous.price) * weight;
      crossings.push(round(price, 2));
    }
  }
  return crossings;
}

function formatMoney(value: number): string {
  const rounded = round(value, 0);
  if (rounded > 0) return `+$${Math.abs(rounded).toLocaleString('en-US')}`;
  if (rounded < 0) return `-$${Math.abs(rounded).toLocaleString('en-US')}`;
  return '$0';
}

function pickClosestContract(
  contracts: OptionContract[],
  targetStrike: number,
  constraints?: {
    minStrike?: number;
    maxStrike?: number;
  },
): OptionContract | null {
  const filtered = contracts.filter((contract) => {
    if (constraints?.minStrike != null && contract.strike < constraints.minStrike) return false;
    if (constraints?.maxStrike != null && contract.strike > constraints.maxStrike) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const sorted = filtered
    .map((contract) => ({
      contract,
      strikeGap: Math.abs(contract.strike - targetStrike),
      spreadPenalty: getSpreadPct(contract) ?? 99,
      liquidityPenalty: 100 - getLiquidityScore(contract),
    }))
    .sort((left, right) => (
      (left.strikeGap + left.spreadPenalty * 0.45 + left.liquidityPenalty * 0.15)
      - (right.strikeGap + right.spreadPenalty * 0.45 + right.liquidityPenalty * 0.15)
    ));

  return sorted[0]?.contract ?? null;
}

function chooseNearExpiry(
  expirations: string[],
  catalystDaysUntil: number | null,
  swingWindow: SwingSniperSwingWindow,
): string | null {
  const dteBounds = swingWindow === 'seven_to_fourteen'
    ? { min: 7, max: 14, target: 10 }
    : swingWindow === 'fourteen_to_thirty'
      ? { min: 14, max: 30, target: 21 }
      : null;

  const rows = expirations
    .map((expiry) => ({ expiry, dte: daysUntil(expiry) }))
    .filter((row) => {
      if (dteBounds) {
        return row.dte >= dteBounds.min && row.dte <= dteBounds.max;
      }
      return row.dte >= 7 && row.dte <= STRUCTURE_MAX_DAYS_AHEAD;
    });

  if (rows.length === 0) return null;

  const targetDte = dteBounds
    ? dteBounds.target
    : catalystDaysUntil == null
      ? 28
      : clamp(catalystDaysUntil + 7, 14, 42);

  rows.sort((left, right) => {
    const leftGap = Math.abs(left.dte - targetDte);
    const rightGap = Math.abs(right.dte - targetDte);
    if (leftGap !== rightGap) return leftGap - rightGap;
    return left.dte - right.dte;
  });

  return rows[0]?.expiry ?? null;
}

function chooseFarExpiry(expirations: string[], nearDte: number): string | null {
  const candidates = expirations
    .map((expiry) => ({ expiry, dte: daysUntil(expiry) }))
    .filter((row) => row.dte >= nearDte + 14 && row.dte <= STRUCTURE_MAX_DAYS_AHEAD)
    .sort((left, right) => left.dte - right.dte);

  if (candidates.length === 0) return null;

  const targetDte = clamp(nearDte + 28, nearDte + 14, STRUCTURE_MAX_DAYS_AHEAD);
  candidates.sort((left, right) => {
    const leftGap = Math.abs(left.dte - targetDte);
    const rightGap = Math.abs(right.dte - targetDte);
    if (leftGap !== rightGap) return leftGap - rightGap;
    return left.dte - right.dte;
  });

  return candidates[0]?.expiry ?? null;
}

function buildPayoffDiagram(
  legs: OptionLegPlan[],
  spotPrice: number,
  currentIV: number | null,
  horizonDte: number,
): SwingSniperStructureRecommendation['payoffDiagram'] {
  const iv = clamp((currentIV ?? 32) / 100, 0.08, 1.2);
  const sigma = iv * Math.sqrt(Math.max(horizonDte, 1) / 365);
  const rangePct = clamp(sigma * 2.2, 0.14, 0.35);
  const points: SwingSniperStructureRecommendation['payoffDiagram'] = [];

  for (let index = 0; index <= 10; index += 1) {
    const ratio = -rangePct + (rangePct * 2 * index / 10);
    const price = round(spotPrice * (1 + ratio), 2);
    const pnl = pnlAtSpot(legs, price) ?? 0;
    points.push({
      price,
      pnl,
      returnPct: spotPrice > 0 ? round(((price - spotPrice) / spotPrice) * 100, 2) : null,
    });
  }

  return points;
}

function buildDistribution(
  legs: OptionLegPlan[],
  spotPrice: number,
  currentIV: number | null,
  horizonDte: number,
): SwingSniperStructureRecommendation['payoffDistribution'] {
  const iv = clamp((currentIV ?? 32) / 100, 0.08, 1.2);
  const sigma = iv * Math.sqrt(Math.max(horizonDte, 1) / 365);

  return STRUCTURE_DISTRIBUTION_SIGMAS.map((sigmaMove, index) => {
    const price = round(spotPrice * (1 + (sigma * sigmaMove)), 2);
    const pnl = pnlAtSpot(legs, price) ?? 0;
    const probability = STRUCTURE_DISTRIBUTION_WEIGHTS[index] * 100;

    return {
      label: sigmaMove === 0
        ? 'At spot'
        : `${sigmaMove > 0 ? '+' : ''}${sigmaMove.toFixed(2)}σ`,
      probability: round(probability, 2),
      expectedPnl: round((pnl * probability) / 100, 2),
      expectedReturnPct: spotPrice > 0 ? round(((price - spotPrice) / spotPrice) * 100, 2) : null,
    };
  });
}

function buildScenarioSummary(
  legs: OptionLegPlan[],
  spotPrice: number,
  currentIV: number | null,
  horizonDte: number,
): SwingSniperStructureRecommendation['scenarioSummary'] {
  const iv = clamp((currentIV ?? 32) / 100, 0.08, 1.2);
  const sigma = clamp(iv * Math.sqrt(Math.max(horizonDte, 1) / 365), 0.04, 0.3);

  const scenarios: PriceScenario[] = [
    {
      label: 'Bear',
      price: round(spotPrice * (1 - sigma), 2),
      pnl: pnlAtSpot(legs, spotPrice * (1 - sigma)) ?? 0,
    },
    {
      label: 'Base',
      price: round(spotPrice, 2),
      pnl: pnlAtSpot(legs, spotPrice) ?? 0,
    },
    {
      label: 'Bull',
      price: round(spotPrice * (1 + sigma), 2),
      pnl: pnlAtSpot(legs, spotPrice * (1 + sigma)) ?? 0,
    },
  ];

  return {
    bearCase: `${scenarios[0].label} (${scenarios[0].price}): ${formatMoney(scenarios[0].pnl)}`,
    baseCase: `${scenarios[1].label} (${scenarios[1].price}): ${formatMoney(scenarios[1].pnl)}`,
    bullCase: `${scenarios[2].label} (${scenarios[2].price}): ${formatMoney(scenarios[2].pnl)}`,
  };
}

function buildContractSummary(legs: OptionLegPlan[]): string {
  return legs
    .map((leg) => `${leg.side === 'buy' ? 'Buy' : 'Sell'} ${leg.quantity} ${leg.contract.expiry} ${leg.contract.strike}${leg.contract.type === 'call' ? 'C' : 'P'}`)
    .join(' / ');
}

function normalizeLegs(legs: OptionLegPlan[]): SwingSniperStructureLeg[] {
  return legs.map((leg) => ({
    leg: leg.label,
    side: leg.side,
    optionType: leg.contract.type,
    expiry: leg.contract.expiry,
    strike: leg.contract.strike,
    quantity: leg.quantity,
    mark: getOptionMark(leg.contract),
    bid: Number.isFinite(leg.contract.bid) ? round(leg.contract.bid, 3) : null,
    ask: Number.isFinite(leg.contract.ask) ? round(leg.contract.ask, 3) : null,
    spreadPct: getSpreadPct(leg.contract),
    delta: Number.isFinite(leg.contract.delta ?? NaN) ? round(leg.contract.delta ?? 0, 3) : null,
    openInterest: Number.isFinite(leg.contract.openInterest) ? leg.contract.openInterest : null,
    volume: Number.isFinite(leg.contract.volume) ? leg.contract.volume : null,
  }));
}

function classifyDirectionFit(direction: SwingSniperDirection, strategy: SwingSniperStructureStrategy): number {
  const longVolStrategies = new Set<SwingSniperStructureStrategy>([
    'long_call',
    'long_put',
    'long_straddle',
    'long_strangle',
    'call_debit_spread',
    'put_debit_spread',
    'call_calendar',
    'put_calendar',
    'call_diagonal',
    'put_diagonal',
    'call_butterfly',
    'put_butterfly',
  ]);

  const shortVolStrategies = new Set<SwingSniperStructureStrategy>([
    'call_butterfly',
    'put_butterfly',
    'call_debit_spread',
    'put_debit_spread',
  ]);

  if (direction === 'long_vol') {
    return longVolStrategies.has(strategy) ? 34 : 16;
  }

  if (direction === 'short_vol') {
    return shortVolStrategies.has(strategy) ? 34 : 14;
  }

  return 22;
}

function computeThesisFit(
  plan: StructurePlan,
  direction: SwingSniperDirection,
  averageLiquidity: number,
  probabilityOfProfit: number,
  ivRank: number | null,
): number {
  const directionFit = classifyDirectionFit(direction, plan.strategy);
  const popScore = clamp(probabilityOfProfit, 0, 100) * 0.22;
  const liquidityScore = averageLiquidity * 0.30;
  const rankAdjustment = ivRank == null
    ? 8
    : direction === 'long_vol'
      ? clamp((50 - ivRank) * 0.5, -12, 16)
      : direction === 'short_vol'
        ? clamp((ivRank - 50) * 0.5, -12, 16)
        : clamp(Math.abs(ivRank - 50) * 0.18, 0, 8);

  return round(clamp(directionFit + popScore + liquidityScore + rankAdjustment + plan.rankingBoost, 5, 98), 1);
}

function finalizePlan(
  plan: StructurePlan,
  context: StrategyContext,
): SwingSniperStructureRecommendation | null {
  const premium = netPremium(plan.legs);
  if (premium == null) return null;

  const horizonDte = Math.max(1, Math.min(...plan.legs.map((leg) => daysUntil(leg.contract.expiry))));
  const payoffDiagram = buildPayoffDiagram(plan.legs, context.spotPrice, context.currentIV, horizonDte);
  const payoffDistribution = buildDistribution(plan.legs, context.spotPrice, context.currentIV, horizonDte);

  const minPnl = payoffDiagram.reduce((min, point) => Math.min(min, point.pnl), Number.POSITIVE_INFINITY);
  const maxPnl = payoffDiagram.reduce((max, point) => Math.max(max, point.pnl), Number.NEGATIVE_INFINITY);

  const crossings = findStrikeCrossings(payoffDiagram.map((point) => ({ price: point.price, pnl: point.pnl })));
  const distributionPop = payoffDistribution.reduce((sum, bucket) => {
    const price = context.spotPrice * (1 + ((bucket.expectedReturnPct ?? 0) / 100));
    const pnl = pnlAtSpot(plan.legs, price) ?? 0;
    return pnl > 0 ? sum + bucket.probability : sum;
  }, 0);

  const legSpreads = plan.legs
    .map((leg) => getSpreadPct(leg.contract))
    .filter((value): value is number => value != null && Number.isFinite(value));
  const spreadAverage = legSpreads.length > 0
    ? round(legSpreads.reduce((sum, value) => sum + value, 0) / legSpreads.length, 2)
    : null;

  const liquidityScores = plan.legs.map((leg) => getLiquidityScore(leg.contract));
  const liquidityAverage = round(
    liquidityScores.reduce((sum, score) => sum + score, 0) / Math.max(liquidityScores.length, 1),
    1,
  );

  const scenarioSummary = buildScenarioSummary(plan.legs, context.spotPrice, context.currentIV, horizonDte);
  const recommendation: SwingSniperStructureRecommendation = {
    id: plan.id,
    strategy: plan.strategy,
    strategyLabel: plan.strategyLabel,
    thesisFit: computeThesisFit(plan, context.direction, liquidityAverage, distributionPop, context.ivRank),
    debitOrCredit: premium >= 0 ? 'debit' : 'credit',
    netPremium: round(Math.abs(premium), 3),
    maxLoss: minPnl >= 0 ? 0 : round(Math.abs(minPnl), 2),
    maxProfit: Number.isFinite(maxPnl) && maxPnl > 0 ? round(maxPnl, 2) : null,
    breakevenLow: crossings[0] ?? null,
    breakevenHigh: crossings.length > 1 ? crossings[crossings.length - 1] : crossings[0] ?? null,
    probabilityOfProfit: round(distributionPop, 2),
    entryWindow: plan.entryWindow,
    invalidation: plan.invalidation,
    contractSummary: buildContractSummary(plan.legs),
    spreadQuality: summarizeSpreadQuality(spreadAverage),
    liquidityScore: liquidityAverage,
    contracts: normalizeLegs(plan.legs),
    whyThisStructure: plan.whyThisStructure,
    risks: plan.risks,
    scenarioSummary,
    payoffDiagram,
    payoffDistribution,
  };

  return recommendation;
}

function buildLongCallPlan(context: StrategyContext): StructurePlan | null {
  const call = pickClosestContract(context.nearCalls, context.spotPrice * 1.0);
  if (!call) return null;

  return {
    id: `long-call-${call.expiry}-${call.strike}`,
    strategy: 'long_call',
    strategyLabel: 'Long Call',
    rankingBoost: context.direction === 'long_vol' ? 11 : 5,
    entryWindow: 'Use for directional upside when you want a simple 7-14 day swing expression.',
    invalidation: 'Close if spot loses momentum and IV expansion no longer supports premium decay offset.',
    whyThisStructure: [
      'Single-leg upside convexity with clean directional expression.',
      'Avoids spread caps when your thesis needs open-ended upside.',
    ],
    risks: [
      'Premium can decay quickly when spot stalls.',
      'Higher vega exposure can hurt if IV compresses before the move.',
    ],
    legs: [
      { label: 'Buy call', side: 'buy', quantity: 1, contract: call },
    ],
  };
}

function buildLongPutPlan(context: StrategyContext): StructurePlan | null {
  const put = pickClosestContract(context.nearPuts, context.spotPrice * 1.0);
  if (!put) return null;

  return {
    id: `long-put-${put.expiry}-${put.strike}`,
    strategy: 'long_put',
    strategyLabel: 'Long Put',
    rankingBoost: context.direction === 'long_vol' ? 11 : 5,
    entryWindow: 'Use for directional downside when you want a simple 7-14 day swing expression.',
    invalidation: 'Close if downside follow-through fails and IV repricing stalls.',
    whyThisStructure: [
      'Direct downside convexity without spread complexity.',
      'Keeps max risk limited to premium paid.',
    ],
    risks: [
      'Theta drag can be steep if downside timing slips.',
      'Fast vol compression can reduce option value despite minor downside.',
    ],
    legs: [
      { label: 'Buy put', side: 'buy', quantity: 1, contract: put },
    ],
  };
}

function buildLongStraddlePlan(context: StrategyContext): StructurePlan | null {
  const call = pickClosestContract(context.nearCalls, context.spotPrice);
  if (!call) return null;

  const put = pickClosestContract(context.nearPuts, call.strike);
  if (!put) return null;

  return {
    id: `long-straddle-${call.expiry}-${call.strike}`,
    strategy: 'long_straddle',
    strategyLabel: 'Long Straddle',
    rankingBoost: context.direction === 'long_vol' ? 12 : 4,
    entryWindow: 'Deploy when you expect a sizable move but direction is uncertain.',
    invalidation: 'Exit if realized move fails to develop while theta burn accelerates into expiry.',
    whyThisStructure: [
      'Pure long-vol expression with symmetric upside/downside convexity.',
      'Fits event windows where move magnitude matters more than direction.',
    ],
    risks: [
      'Requires a sufficiently large move to overcome two premiums.',
      'Time decay is high if spot remains range-bound.',
    ],
    legs: [
      { label: 'Buy call', side: 'buy', quantity: 1, contract: call },
      { label: 'Buy put', side: 'buy', quantity: 1, contract: put },
    ],
  };
}

function buildLongStranglePlan(context: StrategyContext): StructurePlan | null {
  const call = pickClosestContract(context.nearCalls, context.spotPrice * 1.04, {
    minStrike: context.spotPrice * 1.01,
  });
  if (!call) return null;

  const put = pickClosestContract(context.nearPuts, context.spotPrice * 0.96, {
    maxStrike: context.spotPrice * 0.99,
  });
  if (!put) return null;

  return {
    id: `long-strangle-${call.expiry}-${put.strike}-${call.strike}`,
    strategy: 'long_strangle',
    strategyLabel: 'Long Strangle',
    rankingBoost: context.direction === 'long_vol' ? 10 : 4,
    entryWindow: 'Use when you expect expansion but want lower debit than an at-the-money straddle.',
    invalidation: 'Close if expected move compresses and spot stays pinned near strike midpoint.',
    whyThisStructure: [
      'Cheaper long-vol alternative with wider breakeven wings than a straddle.',
      'Useful for 7-14 day windows with catalyst uncertainty and non-directional conviction.',
    ],
    risks: [
      'Needs a larger move than a straddle to pay out.',
      'Can decay quickly when realized volatility underperforms.',
    ],
    legs: [
      { label: 'Buy call', side: 'buy', quantity: 1, contract: call },
      { label: 'Buy put', side: 'buy', quantity: 1, contract: put },
    ],
  };
}

function buildCallDebitSpreadPlan(context: StrategyContext): StructurePlan | null {
  const buyCall = pickClosestContract(context.nearCalls, context.spotPrice * 1.0);
  if (!buyCall) return null;

  const sellCall = pickClosestContract(context.nearCalls, context.spotPrice * 1.06, {
    minStrike: buyCall.strike + Math.max(1, context.spotPrice * 0.01),
  });
  if (!sellCall) return null;

  return {
    id: `call-debit-${buyCall.expiry}-${buyCall.strike}-${sellCall.strike}`,
    strategy: 'call_debit_spread',
    strategyLabel: 'Call Debit Spread',
    rankingBoost: context.direction === 'long_vol' ? 10 : 4,
    entryWindow: 'Enter when the board setup is constructive but you want lower premium outlay than a naked long call.',
    invalidation: 'If upside momentum fails to follow through before mid-cycle, reduce exposure before theta accelerates.',
    whyThisStructure: [
      'Reduces premium spend while preserving upside toward the target strike band.',
      'Helps control implied-volatility crush risk relative to a single-leg call.',
    ],
    risks: [
      'Upside is capped at the short strike.',
      'Can stall near break-even if the move is too small.',
    ],
    legs: [
      { label: 'Buy call', side: 'buy', quantity: 1, contract: buyCall },
      { label: 'Sell call', side: 'sell', quantity: 1, contract: sellCall },
    ],
  };
}

function buildPutDebitSpreadPlan(context: StrategyContext): StructurePlan | null {
  const buyPut = pickClosestContract(context.nearPuts, context.spotPrice * 1.0);
  if (!buyPut) return null;

  const sellPut = pickClosestContract(context.nearPuts, context.spotPrice * 0.94, {
    maxStrike: buyPut.strike - Math.max(1, context.spotPrice * 0.01),
  });
  if (!sellPut) return null;

  return {
    id: `put-debit-${buyPut.expiry}-${buyPut.strike}-${sellPut.strike}`,
    strategy: 'put_debit_spread',
    strategyLabel: 'Put Debit Spread',
    rankingBoost: context.skewDirection === 'put_heavy' ? 7 : 4,
    entryWindow: 'Deploy when downside catalysts cluster and realized downside potential is underpriced.',
    invalidation: 'Trim if downside momentum fades while the implied-volatility floor remains elevated.',
    whyThisStructure: [
      'Directional downside structure with defined risk and lower debit than a naked put.',
      'Balances convexity and cost in defensive tape conditions.',
    ],
    risks: [
      'Gain is capped once price trades through the short strike.',
      'Can fail if price drifts sideways and premium decays.',
    ],
    legs: [
      { label: 'Buy put', side: 'buy', quantity: 1, contract: buyPut },
      { label: 'Sell put', side: 'sell', quantity: 1, contract: sellPut },
    ],
  };
}

function buildCallCalendarPlan(context: StrategyContext): StructurePlan | null {
  if (context.farCalls.length === 0) return null;

  const shortCall = pickClosestContract(context.nearCalls, context.spotPrice);
  if (!shortCall) return null;

  const longCall = pickClosestContract(context.farCalls, shortCall.strike);
  if (!longCall) return null;

  return {
    id: `call-calendar-${shortCall.expiry}-${longCall.expiry}-${shortCall.strike}`,
    strategy: 'call_calendar',
    strategyLabel: 'Call Calendar',
    rankingBoost: context.direction === 'long_vol' ? 8 : 4,
    entryWindow: 'Best deployed ahead of catalyst windows when front IV is expected to reprice faster than deferred expiry IV.',
    invalidation: 'Close if front expiry vol expansion fails while underlying drifts away from the center strike.',
    whyThisStructure: [
      'Targets term-structure inefficiency by owning back-month optionality and financing with front-month premium.',
      'Can soften theta pressure versus a pure long premium trade.',
    ],
    risks: [
      'Path-dependent: large early move away from strike can undercut payoff.',
      'Modeling assumes limited carry value for the long far-month leg at front expiry.',
    ],
    legs: [
      { label: 'Buy far call', side: 'buy', quantity: 1, contract: longCall },
      { label: 'Sell near call', side: 'sell', quantity: 1, contract: shortCall },
    ],
  };
}

function buildPutCalendarPlan(context: StrategyContext): StructurePlan | null {
  if (context.farPuts.length === 0) return null;

  const shortPut = pickClosestContract(context.nearPuts, context.spotPrice);
  if (!shortPut) return null;

  const longPut = pickClosestContract(context.farPuts, shortPut.strike);
  if (!longPut) return null;

  return {
    id: `put-calendar-${shortPut.expiry}-${longPut.expiry}-${shortPut.strike}`,
    strategy: 'put_calendar',
    strategyLabel: 'Put Calendar',
    rankingBoost: context.direction === 'long_vol' ? 6 : 3,
    entryWindow: 'Use when downside catalyst timing is near-term but medium-horizon uncertainty remains elevated.',
    invalidation: 'Exit if downside catalyst passes with muted vol response and skew remains expensive.',
    whyThisStructure: [
      'Expresses term-structure edge on the put wing without paying full short-dated premium.',
      'Keeps downside optionality in deferred expiry.',
    ],
    risks: [
      'Price drifting far from strike can reduce calendar value quickly.',
      'Skew shifts can hurt put calendar assumptions.',
    ],
    legs: [
      { label: 'Buy far put', side: 'buy', quantity: 1, contract: longPut },
      { label: 'Sell near put', side: 'sell', quantity: 1, contract: shortPut },
    ],
  };
}

function buildCallDiagonalPlan(context: StrategyContext): StructurePlan | null {
  if (context.farCalls.length === 0) return null;

  const longCall = pickClosestContract(context.farCalls, context.spotPrice * 0.99);
  if (!longCall) return null;

  const shortCall = pickClosestContract(context.nearCalls, context.spotPrice * 1.03, {
    minStrike: longCall.strike,
  });
  if (!shortCall) return null;

  return {
    id: `call-diagonal-${shortCall.expiry}-${longCall.expiry}-${longCall.strike}-${shortCall.strike}`,
    strategy: 'call_diagonal',
    strategyLabel: 'Call Diagonal',
    rankingBoost: context.termStructureShape === 'contango' ? 7 : 4,
    entryWindow: 'Deploy when front-month upside premium is rich versus deferred volatility and trend bias stays constructive.',
    invalidation: 'Close if spot fails to hold momentum and front-month premium no longer offsets carry cost.',
    whyThisStructure: [
      'Blends directional and term-structure edge using different strikes across expiries.',
      'Can improve cost efficiency versus straight long calls in rich front-premium regimes.',
    ],
    risks: [
      'Complex Greeks path can shift quickly around the short strike.',
      'Upside caps and assignment risk increase near short expiry.',
    ],
    legs: [
      { label: 'Buy far call', side: 'buy', quantity: 1, contract: longCall },
      { label: 'Sell near call', side: 'sell', quantity: 1, contract: shortCall },
    ],
  };
}

function buildPutDiagonalPlan(context: StrategyContext): StructurePlan | null {
  if (context.farPuts.length === 0) return null;

  const longPut = pickClosestContract(context.farPuts, context.spotPrice * 1.01);
  if (!longPut) return null;

  const shortPut = pickClosestContract(context.nearPuts, context.spotPrice * 0.97, {
    maxStrike: longPut.strike,
  });
  if (!shortPut) return null;

  return {
    id: `put-diagonal-${shortPut.expiry}-${longPut.expiry}-${longPut.strike}-${shortPut.strike}`,
    strategy: 'put_diagonal',
    strategyLabel: 'Put Diagonal',
    rankingBoost: context.skewDirection === 'put_heavy' ? 7 : 3,
    entryWindow: 'Use when downside fear is elevated short-term but you still want deferred downside optionality.',
    invalidation: 'Cut if downside regime softens and short put premium no longer offsets long-leg carry.',
    whyThisStructure: [
      'Combines downside directional bias with term-structure carry.',
      'Can lower debit while keeping tail convexity through deferred expiry.',
    ],
    risks: [
      'Short put assignment and gamma spikes around front expiry.',
      'Performance depends on spot path and skew dynamics.',
    ],
    legs: [
      { label: 'Buy far put', side: 'buy', quantity: 1, contract: longPut },
      { label: 'Sell near put', side: 'sell', quantity: 1, contract: shortPut },
    ],
  };
}

function buildCallButterflyPlan(context: StrategyContext): StructurePlan | null {
  const lower = pickClosestContract(context.nearCalls, context.spotPrice * 0.97);
  const middle = pickClosestContract(context.nearCalls, context.spotPrice);
  if (!lower || !middle) return null;

  const upperTarget = middle.strike + Math.max(1, middle.strike - lower.strike);
  const upper = pickClosestContract(context.nearCalls, upperTarget, {
    minStrike: middle.strike + Math.max(1, context.spotPrice * 0.005),
  });
  if (!upper) return null;

  return {
    id: `call-bfly-${middle.expiry}-${lower.strike}-${middle.strike}-${upper.strike}`,
    strategy: 'call_butterfly',
    strategyLabel: 'Call Butterfly',
    rankingBoost: context.direction === 'short_vol' ? 9 : 4,
    entryWindow: 'Deploy when implied range looks too wide and you expect pinning behavior into expiry.',
    invalidation: 'Exit if realized move starts breaking beyond the outer wings before theta capture develops.',
    whyThisStructure: [
      'Defined-risk structure for mean-reverting or range-bound outcomes.',
      'Capital-efficient alternative to naked premium selling.',
    ],
    risks: [
      'Low tolerance for large directional moves.',
      'Profit zone can be narrow near expiry.',
    ],
    legs: [
      { label: 'Buy lower call', side: 'buy', quantity: 1, contract: lower },
      { label: 'Sell middle call', side: 'sell', quantity: 2, contract: middle },
      { label: 'Buy upper call', side: 'buy', quantity: 1, contract: upper },
    ],
  };
}

function buildPutButterflyPlan(context: StrategyContext): StructurePlan | null {
  const upper = pickClosestContract(context.nearPuts, context.spotPrice * 1.03);
  const middle = pickClosestContract(context.nearPuts, context.spotPrice);
  if (!upper || !middle) return null;

  const lowerTarget = middle.strike - Math.max(1, upper.strike - middle.strike);
  const lower = pickClosestContract(context.nearPuts, lowerTarget, {
    maxStrike: middle.strike - Math.max(1, context.spotPrice * 0.005),
  });
  if (!lower) return null;

  return {
    id: `put-bfly-${middle.expiry}-${upper.strike}-${middle.strike}-${lower.strike}`,
    strategy: 'put_butterfly',
    strategyLabel: 'Put Butterfly',
    rankingBoost: context.direction === 'short_vol' ? 9 : 4,
    entryWindow: 'Use when downside premium looks overstated but you still want bounded downside expression.',
    invalidation: 'Exit if downside breaks persist and the lower wing is threatened early.',
    whyThisStructure: [
      'Targets over-priced downside range with clearly defined risk.',
      'Keeps premium-selling logic bounded by long protective wings.',
    ],
    risks: [
      'Narrow payoff peak around the body strike.',
      'Fast downside trend can overwhelm the structure quickly.',
    ],
    legs: [
      { label: 'Buy upper put', side: 'buy', quantity: 1, contract: upper },
      { label: 'Sell middle put', side: 'sell', quantity: 2, contract: middle },
      { label: 'Buy lower put', side: 'buy', quantity: 1, contract: lower },
    ],
  };
}

function resolveAllowedStrategies(input: BuildSwingSniperStructureLabInput): Set<SwingSniperStructureStrategy> {
  const requested = Array.isArray(input.preferredSetups)
    ? input.preferredSetups
    : [];
  const base = requested.length > 0
    ? requested
    : [...DEFAULT_DEFINED_RISK_STRATEGIES];
  const riskMode = input.riskMode ?? 'defined_risk_only';
  const filtered = riskMode === 'defined_risk_only'
    ? base.filter((strategy) => !ADVANCED_NAKED_STRATEGIES.has(strategy))
    : base;
  const fallback = filtered.length > 0
    ? filtered
    : [...DEFAULT_DEFINED_RISK_STRATEGIES];
  return new Set(fallback);
}

function buildStructurePlans(
  context: StrategyContext,
  allowedStrategies: Set<SwingSniperStructureStrategy>,
): StructurePlan[] {
  const planners: Array<{
    strategy: SwingSniperStructureStrategy;
    build: (ctx: StrategyContext) => StructurePlan | null;
  }> = [
    { strategy: 'long_call', build: buildLongCallPlan },
    { strategy: 'long_put', build: buildLongPutPlan },
    { strategy: 'long_straddle', build: buildLongStraddlePlan },
    { strategy: 'long_strangle', build: buildLongStranglePlan },
    { strategy: 'call_debit_spread', build: buildCallDebitSpreadPlan },
    { strategy: 'put_debit_spread', build: buildPutDebitSpreadPlan },
    { strategy: 'call_calendar', build: buildCallCalendarPlan },
    { strategy: 'put_calendar', build: buildPutCalendarPlan },
    { strategy: 'call_diagonal', build: buildCallDiagonalPlan },
    { strategy: 'put_diagonal', build: buildPutDiagonalPlan },
    { strategy: 'call_butterfly', build: buildCallButterflyPlan },
    { strategy: 'put_butterfly', build: buildPutButterflyPlan },
  ];

  return planners
    .filter((planner) => allowedStrategies.has(planner.strategy))
    .map((planner) => planner.build(context))
    .filter((plan): plan is StructurePlan => plan != null);
}

export async function buildSwingSniperStructureLab(
  input: BuildSwingSniperStructureLabInput,
): Promise<SwingSniperStructureLabResponse> {
  const symbol = input.symbol.trim().toUpperCase();
  const allowedStrategies = resolveAllowedStrategies(input);
  const swingWindow = input.swingWindow ?? 'seven_to_fourteen';

  try {
    const expirations = await fetchExpirationDates(symbol, {
      maxDaysAhead: STRUCTURE_MAX_DAYS_AHEAD,
      maxPages: STRUCTURE_MAX_PAGES,
    });

    const nearExpiry = chooseNearExpiry(expirations, input.catalystDaysUntil, swingWindow);
    if (!nearExpiry) {
      return {
        generatedAt: new Date().toISOString(),
        symbol,
        direction: input.direction,
        recommendations: [],
        notes: ['No viable expiration windows were found for Structure Lab candidate generation.'],
      };
    }

    const nearChain = await fetchOptionsChain(symbol, nearExpiry, STRUCTURE_STRIKE_RANGE);
    const farExpiry = chooseFarExpiry(expirations, nearChain.daysToExpiry);
    const farChain = farExpiry
      ? await fetchOptionsChain(symbol, farExpiry, STRUCTURE_STRIKE_RANGE).catch(() => null)
      : null;

    const spotPrice = Number.isFinite(input.currentPrice) && input.currentPrice > 0
      ? input.currentPrice
      : nearChain.currentPrice;

    const context: StrategyContext = {
      spotPrice,
      direction: input.direction,
      currentIV: input.currentIV,
      ivRank: input.ivRank,
      skewDirection: input.skewDirection,
      catalystDaysUntil: input.catalystDaysUntil,
      termStructureShape: input.termStructureShape,
      nearCalls: nearChain.options.calls,
      nearPuts: nearChain.options.puts,
      farCalls: farChain?.options.calls ?? [],
      farPuts: farChain?.options.puts ?? [],
      nearDte: nearChain.daysToExpiry,
    };

    const plans = buildStructurePlans(context, allowedStrategies);
    const recommendations = plans
      .map((plan) => finalizePlan(plan, context))
      .filter((recommendation): recommendation is SwingSniperStructureRecommendation => recommendation != null)
      .sort((left, right) => right.thesisFit - left.thesisFit)
      .slice(0, clamp(input.maxRecommendations ?? 4, 2, 8));

    const strategyList = Array.from(allowedStrategies).join(', ');
    const notes: string[] = [
      `Evaluated ${plans.length} candidate structures from selected setup families (${strategyList}).`,
      `Swing window preference is ${swingWindow === 'seven_to_fourteen' ? '7-14D' : swingWindow === 'fourteen_to_thirty' ? '14-30D' : 'All expiries'}.`,
      'Contract picks are filtered by strike fit, spread quality, and open-interest/volume liquidity scoring.',
      'Scenario and payoff outputs are deterministic approximations for decision support, not execution guarantees.',
    ];

    if (farChain == null) {
      notes.push('Far-expiration chain was unavailable, so calendar/diagonal coverage may be reduced.');
    }

    if (recommendations.length === 0) {
      notes.push('No contract set passed minimum quote quality checks for this symbol snapshot.');
    }

    return {
      generatedAt: new Date().toISOString(),
      symbol,
      direction: input.direction,
      recommendations,
      notes,
    };
  } catch (error) {
    logger.error('Failed to build Swing Sniper structure lab recommendations', {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      generatedAt: new Date().toISOString(),
      symbol,
      direction: input.direction,
      recommendations: [],
      notes: ['Structure Lab could not resolve contract data for this symbol snapshot.'],
    };
  }
}
