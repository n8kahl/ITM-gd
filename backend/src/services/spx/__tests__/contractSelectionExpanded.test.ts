vi.mock('../../../config/redis', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock('../../options/optionsChainFetcher', () => ({
  fetchExpirationDates: vi.fn(),
  fetchOptionsChain: vi.fn(),
}));

vi.mock('../../options/ivAnalysis', () => ({
  analyzeIVProfile: vi.fn(),
}));

import { cacheGet, cacheSet } from '../../../config/redis';
import { fetchExpirationDates, fetchOptionsChain } from '../../options/optionsChainFetcher';
import type { OptionContract, OptionsChainResponse } from '../../options/types';
import { analyzeIVProfile } from '../../options/ivAnalysis';
import { getContractRecommendation } from '../contractSelector';
import type { Setup } from '../types';

const mockCacheGet = cacheGet as vi.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as vi.MockedFunction<typeof cacheSet>;
const mockFetchExpirationDates = fetchExpirationDates as vi.MockedFunction<typeof fetchExpirationDates>;
const mockFetchOptionsChain = fetchOptionsChain as vi.MockedFunction<typeof fetchOptionsChain>;
const mockAnalyzeIVProfile = analyzeIVProfile as vi.MockedFunction<typeof analyzeIVProfile>;

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: 'expanded-setup-1',
    type: 'orb_breakout',
    direction: 'bullish',
    entryZone: { low: 5995, high: 6005 },
    stop: 5980,
    target1: { price: 6020, label: 'T1' },
    target2: { price: 6040, label: 'T2' },
    confluenceScore: 4,
    confluenceSources: ['cluster', 'gex', 'vwap'],
    clusterZone: {
      id: 'cluster-1',
      priceLow: 5995,
      priceHigh: 6005,
      clusterScore: 4.2,
      type: 'defended',
      sources: [],
      testCount: 3,
      lastTestAt: null,
      held: true,
      holdRate: 0.8,
    },
    regime: 'trending',
    status: 'ready',
    probability: 0.65,
    recommendedContract: null,
    createdAt: new Date('2026-02-24T18:00:00.000Z').toISOString(),
    triggeredAt: null,
    ...overrides,
  };
}

function makeContract(overrides: Partial<OptionContract> = {}): OptionContract {
  return {
    symbol: 'SPX',
    strike: 6000,
    expiry: '2026-03-20',
    type: 'call',
    last: 1.3,
    bid: 1.2,
    ask: 1.4,
    volume: 800,
    openInterest: 1200,
    impliedVolatility: 0.18,
    delta: 0.3,
    gamma: 0.02,
    theta: -0.4,
    vega: 4.8,
    rho: 0.1,
    inTheMoney: false,
    intrinsicValue: 0,
    extrinsicValue: 1.3,
    ...overrides,
  };
}

function makeChain(contracts: OptionContract[]): OptionsChainResponse {
  return {
    symbol: 'SPX',
    currentPrice: 6000,
    expiry: '2026-03-20',
    daysToExpiry: 24,
    ivRank: 22,
    options: {
      calls: contracts.filter((contract) => contract.type === 'call'),
      puts: contracts.filter((contract) => contract.type === 'put'),
    },
  };
}

function parseModelScore(reasoning: string): number {
  const match = reasoning.match(/model score ([0-9.]+)/i);
  if (!match) {
    throw new Error(`Could not parse model score from reasoning: ${reasoning}`);
  }
  return Number(match[1]);
}

async function getSingleRecommendation(params: {
  setup?: Setup;
  contracts: OptionContract[];
  riskContext?: {
    totalEquity?: number;
    dayTradeBuyingPower?: number;
    maxRiskPct?: number;
    buyingPowerUtilizationPct?: number;
  };
}) {
  mockFetchOptionsChain.mockResolvedValueOnce(makeChain(params.contracts));

  const recommendation = await getContractRecommendation({
    setup: params.setup ?? makeSetup(),
    forceRefresh: true,
    riskContext: params.riskContext ?? null,
  });

  expect(recommendation).not.toBeNull();
  return recommendation as NonNullable<typeof recommendation>;
}

describe('contract selector expanded pipeline coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-25T15:00:00.000Z'));
    vi.clearAllMocks();

    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue();
    mockFetchExpirationDates.mockResolvedValue(['2026-03-20']);
    mockAnalyzeIVProfile.mockResolvedValue({
      ivForecast: null,
    } as unknown as Awaited<ReturnType<typeof analyzeIVProfile>>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('contract sizing', () => {
    it('computes max risk as $1,000 when totalEquity=50,000 and maxRiskPct=0.02', async () => {
      const recommendation = await getSingleRecommendation({
        contracts: [makeContract({ ask: 2.5, bid: 2.3, strike: 6000 })],
        riskContext: {
          totalEquity: 50_000,
          dayTradeBuyingPower: 100_000,
          maxRiskPct: 0.02,
        },
      });

      expect(recommendation.sizing?.maxRiskDollars).toBe(1000);
    });

    it('sets recommendedContracts to floor(maxRisk / (ask * 100))', async () => {
      const recommendation = await getSingleRecommendation({
        contracts: [makeContract({ ask: 2.5, bid: 2.3, strike: 6000 })],
        riskContext: {
          totalEquity: 50_000,
          dayTradeBuyingPower: 100_000,
          maxRiskPct: 0.02,
        },
      });

      expect(recommendation.sizing?.contractsByRisk).toBe(4);
      expect(recommendation.suggestedContracts).toBe(4);
    });

    it('returns one contract when risk allows at least one contract', async () => {
      const recommendation = await getSingleRecommendation({
        contracts: [makeContract({ ask: 9.8, bid: 9.5, strike: 6000 })],
        riskContext: {
          totalEquity: 50_000,
          dayTradeBuyingPower: 100_000,
          maxRiskPct: 0.02,
        },
      });

      expect(recommendation.sizing?.contractsByRisk).toBe(1);
      expect(recommendation.suggestedContracts).toBe(1);
    });

    it('blocks sizing when per-contract debit exceeds max risk', async () => {
      const recommendation = await getSingleRecommendation({
        contracts: [makeContract({ ask: 12.5, bid: 12.0, strike: 6000 })],
        riskContext: {
          totalEquity: 50_000,
          dayTradeBuyingPower: 100_000,
          maxRiskPct: 0.02,
        },
      });

      expect(recommendation.suggestedContracts).toBe(0);
      expect(recommendation.sizing?.contractsByRisk).toBe(0);
      expect(recommendation.sizing?.blockedReason).toBe('margin_limit_blocked');
    });
  });

  describe('EV and scoring outputs', () => {
    it('calculates expectedPnlAtTarget1 from delta and gamma move terms', async () => {
      const recommendation = await getSingleRecommendation({
        setup: makeSetup({
          entryZone: { low: 5995, high: 6005 },
          stop: 5980,
          target1: { price: 6020, label: 'T1' },
        }),
        contracts: [makeContract({ delta: 0.3, gamma: 0.05, bid: 1.2, ask: 1.4 })],
      });

      expect(recommendation.expectedPnlAtTarget1).toBe(140);
    });

    it('sets maxLoss to max(ask, mid) * 100', async () => {
      const recommendation = await getSingleRecommendation({
        contracts: [makeContract({ bid: 1.2, ask: 1.4 })],
      });

      expect(recommendation.maxLoss).toBe(140);
    });

    it('matches riskReward to expectedPnlAtTarget1 / maxLoss for this calibrated setup', async () => {
      const recommendation = await getSingleRecommendation({
        setup: makeSetup({
          entryZone: { low: 5995, high: 6005 },
          stop: 5980,
          target1: { price: 6020, label: 'T1' },
        }),
        contracts: [makeContract({ delta: 0.3, gamma: 0.05, bid: 1.2, ask: 1.4 })],
      });

      expect(recommendation.riskReward).toBeCloseTo(recommendation.expectedPnlAtTarget1 / recommendation.maxLoss, 6);
    });

    it('uses only delta contribution when gamma is zero', async () => {
      const recommendation = await getSingleRecommendation({
        setup: makeSetup({
          entryZone: { low: 5995, high: 6005 },
          stop: 5980,
          target1: { price: 6020, label: 'T1' },
        }),
        contracts: [makeContract({ delta: 0.3, gamma: 0, bid: 1.2, ask: 1.4 })],
      });

      expect(recommendation.expectedPnlAtTarget1).toBe(60);
    });

    it('penalizes high negative theta and ranks lower-theta contracts above them', async () => {
      const lowTheta = makeContract({ strike: 6000, theta: -0.2, delta: 0.3, gamma: 0.02, bid: 1.3, ask: 1.55 });
      const highTheta = makeContract({ strike: 6010, theta: -2.8, delta: 0.3, gamma: 0.02, bid: 1.3, ask: 1.55 });

      const recommendation = await getSingleRecommendation({
        contracts: [lowTheta, highTheta],
      });

      const selectedScore = parseModelScore(recommendation.reasoning);
      const alternativeScore = recommendation.alternatives?.[0]?.score;

      expect(recommendation.strike).toBe(6000);
      expect(typeof alternativeScore).toBe('number');
      expect(selectedScore).toBeGreaterThan(alternativeScore as number);
    });

    it('gives near-zero-greek profiles a lower model score than valid greek profiles', async () => {
      const validGreeks = makeContract({ strike: 6000, delta: 0.32, gamma: 0.02, theta: -0.4, vega: 4.8 });
      const nearZeroGreeks = makeContract({ strike: 6010, delta: 0.05, gamma: 0, theta: 0, vega: 0 });

      const recommendation = await getSingleRecommendation({
        contracts: [validGreeks, nearZeroGreeks],
      });

      const selectedScore = parseModelScore(recommendation.reasoning);
      const alternativeScore = recommendation.alternatives?.[0]?.score;

      expect(recommendation.strike).toBe(6000);
      expect(typeof alternativeScore).toBe('number');
      expect(selectedScore).toBeGreaterThan(alternativeScore as number);
    });
  });
});
