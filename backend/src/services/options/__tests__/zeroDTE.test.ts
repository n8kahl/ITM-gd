jest.mock('../optionsChainFetcher', () => ({
  fetchExpirationDates: jest.fn(),
  fetchOptionsChain: jest.fn(),
}));

jest.mock('../../../config/massive', () => ({
  getDailyAggregates: jest.fn(),
}));

import { getDailyAggregates } from '../../../config/massive';
import { fetchExpirationDates, fetchOptionsChain } from '../optionsChainFetcher';
import { analyzeZeroDTE } from '../zeroDTE';

const mockGetDailyAggregates = getDailyAggregates as jest.MockedFunction<typeof getDailyAggregates>;
const mockFetchExpirationDates = fetchExpirationDates as jest.MockedFunction<typeof fetchExpirationDates>;
const mockFetchOptionsChain = fetchOptionsChain as jest.MockedFunction<typeof fetchOptionsChain>;

describe('zeroDTE service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds expected move, theta clock, and gamma profile when same-day expiry exists', async () => {
    mockFetchExpirationDates.mockResolvedValue(['2026-02-09', '2026-02-10']);
    mockFetchOptionsChain.mockResolvedValue({
      symbol: 'SPX',
      currentPrice: 6012,
      expiry: '2026-02-09',
      daysToExpiry: 0,
      options: {
        calls: [
          {
            symbol: 'SPX',
            strike: 6010,
            expiry: '2026-02-09',
            type: 'call',
            last: 18,
            bid: 17.9,
            ask: 18.1,
            volume: 12000,
            openInterest: 25000,
            impliedVolatility: 0.22,
            delta: 0.52,
            gamma: 0.031,
            theta: -6.8,
            vega: 0.4,
            inTheMoney: true,
            intrinsicValue: 2,
            extrinsicValue: 16,
          },
        ],
        puts: [
          {
            symbol: 'SPX',
            strike: 6010,
            expiry: '2026-02-09',
            type: 'put',
            last: 16.5,
            bid: 16.4,
            ask: 16.6,
            volume: 11000,
            openInterest: 24000,
            impliedVolatility: 0.24,
            delta: -0.48,
            gamma: 0.028,
            theta: -6.1,
            vega: 0.35,
            inTheMoney: false,
            intrinsicValue: 0,
            extrinsicValue: 16.5,
          },
        ],
      },
    } as any);
    mockGetDailyAggregates.mockResolvedValue([
      {
        o: 6001,
        h: 6020,
        l: 5988,
        c: 6012,
        v: 1000000,
        t: Date.parse('2026-02-09T14:30:00.000Z'),
      },
    ] as any);

    const result = await analyzeZeroDTE('spx', {
      strike: 6010,
      type: 'call',
      now: new Date('2026-02-09T15:00:00.000Z'),
    });

    expect(result.symbol).toBe('SPX');
    expect(result.hasZeroDTE).toBe(true);
    expect(result.expectedMove?.totalExpectedMove).toBeCloseTo(34.5, 2);
    expect(result.expectedMove?.usedMove).toBeCloseTo(11, 2);
    expect(result.thetaClock).not.toBeNull();
    expect(result.thetaClock?.projections.length).toBeGreaterThan(1);
    expect(result.gammaProfile?.riskLevel).toBe('high');
    expect(result.topContracts.length).toBe(2);
  });

  it('returns hasZeroDTE=false when today expiry is unavailable', async () => {
    mockFetchExpirationDates.mockResolvedValue(['2026-02-10']);

    const result = await analyzeZeroDTE('AAPL', {
      now: new Date('2026-02-09T15:00:00.000Z'),
    });

    expect(result.hasZeroDTE).toBe(false);
    expect(result.expectedMove).toBeNull();
    expect(result.thetaClock).toBeNull();
    expect(mockFetchOptionsChain).not.toHaveBeenCalled();
    expect(mockGetDailyAggregates).not.toHaveBeenCalled();
  });
});
