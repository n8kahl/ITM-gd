import { buildSwingSniperStructureLab } from '../structureLab';
import type { OptionContract, OptionsChainResponse } from '../../options/types';

const mockFetchExpirationDates = jest.fn();
const mockFetchOptionsChain = jest.fn();

jest.mock('../../options/optionsChainFetcher', () => ({
  fetchExpirationDates: (...args: unknown[]) => mockFetchExpirationDates(...args),
  fetchOptionsChain: (...args: unknown[]) => mockFetchOptionsChain(...args),
}));

function makeContract(input: Partial<OptionContract> & Pick<OptionContract, 'strike' | 'expiry' | 'type'>): OptionContract {
  return {
    symbol: 'NVDA',
    strike: input.strike,
    expiry: input.expiry,
    type: input.type,
    last: input.last ?? 5,
    bid: input.bid ?? 4.9,
    ask: input.ask ?? 5.1,
    volume: input.volume ?? 2000,
    openInterest: input.openInterest ?? 5000,
    impliedVolatility: input.impliedVolatility ?? 0.35,
    delta: input.delta ?? (input.type === 'call' ? 0.5 : -0.5),
    gamma: input.gamma ?? 0.02,
    theta: input.theta ?? -0.12,
    vega: input.vega ?? 0.2,
    rho: input.rho ?? 0.01,
    inTheMoney: input.inTheMoney ?? false,
    intrinsicValue: input.intrinsicValue ?? 0,
    extrinsicValue: input.extrinsicValue ?? 5,
  };
}

function makeChain(expiry: string, spot: number): OptionsChainResponse {
  return {
    symbol: 'NVDA',
    currentPrice: spot,
    expiry,
    daysToExpiry: expiry === '2026-03-21' ? 12 : 40,
    ivRank: 39,
    options: {
      calls: [
        makeContract({ strike: 90, expiry, type: 'call', delta: 0.66 }),
        makeContract({ strike: 95, expiry, type: 'call', delta: 0.59 }),
        makeContract({ strike: 100, expiry, type: 'call', delta: 0.51 }),
        makeContract({ strike: 105, expiry, type: 'call', delta: 0.42 }),
        makeContract({ strike: 110, expiry, type: 'call', delta: 0.31 }),
      ],
      puts: [
        makeContract({ strike: 90, expiry, type: 'put', delta: -0.29 }),
        makeContract({ strike: 95, expiry, type: 'put', delta: -0.4 }),
        makeContract({ strike: 100, expiry, type: 'put', delta: -0.49 }),
        makeContract({ strike: 105, expiry, type: 'put', delta: -0.58 }),
        makeContract({ strike: 110, expiry, type: 'put', delta: -0.67 }),
      ],
    },
  };
}

describe('buildSwingSniperStructureLab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchExpirationDates.mockResolvedValue(['2026-03-21', '2026-04-18']);
    mockFetchOptionsChain.mockImplementation((symbol: string, expiry: string) => {
      if (symbol !== 'NVDA') throw new Error('Unexpected symbol');
      if (expiry === '2026-03-21') return Promise.resolve(makeChain(expiry, 100));
      if (expiry === '2026-04-18') return Promise.resolve(makeChain(expiry, 100));
      throw new Error(`Unexpected expiry ${expiry}`);
    });
  });

  it('returns ranked recommendations with exact contract legs', async () => {
    const result = await buildSwingSniperStructureLab({
      symbol: 'NVDA',
      direction: 'long_vol',
      currentPrice: 100,
      currentIV: 34,
      ivRank: 39,
      skewDirection: 'balanced',
      catalystDaysUntil: 8,
      termStructureShape: 'backwardation',
      maxRecommendations: 4,
    });

    expect(result.symbol).toBe('NVDA');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].contracts.length).toBeGreaterThan(0);
    expect(result.recommendations[0].payoffDistribution).toHaveLength(5);
    expect(result.notes[0]).toContain('Evaluated');
    expect(
      result.recommendations.every((recommendation) => (
        recommendation.strategy === 'call_debit_spread'
        || recommendation.strategy === 'put_debit_spread'
        || recommendation.strategy === 'call_calendar'
        || recommendation.strategy === 'put_calendar'
        || recommendation.strategy === 'call_diagonal'
        || recommendation.strategy === 'put_diagonal'
        || recommendation.strategy === 'call_butterfly'
        || recommendation.strategy === 'put_butterfly'
      )),
    ).toBe(true);
  });

  it('returns a graceful fallback when no expirations are available', async () => {
    mockFetchExpirationDates.mockResolvedValue([]);

    const result = await buildSwingSniperStructureLab({
      symbol: 'NVDA',
      direction: 'long_vol',
      currentPrice: 100,
      currentIV: 34,
      ivRank: 39,
      skewDirection: 'balanced',
      catalystDaysUntil: 8,
      termStructureShape: 'backwardation',
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.notes[0]).toContain('No viable expiration windows');
  });

  it('allows advanced swing styles when naked mode is enabled', async () => {
    const result = await buildSwingSniperStructureLab({
      symbol: 'NVDA',
      direction: 'long_vol',
      currentPrice: 100,
      currentIV: 34,
      ivRank: 39,
      skewDirection: 'balanced',
      catalystDaysUntil: 8,
      termStructureShape: 'backwardation',
      riskMode: 'naked_allowed',
      swingWindow: 'seven_to_fourteen',
      preferredSetups: ['long_call', 'long_put', 'long_straddle', 'long_strangle'],
      maxRecommendations: 4,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(
      result.recommendations.every((recommendation) => (
        recommendation.strategy === 'long_call'
        || recommendation.strategy === 'long_put'
        || recommendation.strategy === 'long_straddle'
        || recommendation.strategy === 'long_strangle'
      )),
    ).toBe(true);
  });
});
