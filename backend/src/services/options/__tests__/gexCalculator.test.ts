jest.mock('../optionsChainFetcher', () => ({
  fetchOptionsChain: jest.fn(),
  fetchExpirationDates: jest.fn(),
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { cacheGet, cacheSet } from '../../../config/redis';
import { fetchExpirationDates, fetchOptionsChain } from '../optionsChainFetcher';
import { calculateGEXProfile } from '../gexCalculator';

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockFetchExpirationDates = fetchExpirationDates as jest.MockedFunction<typeof fetchExpirationDates>;
const mockFetchOptionsChain = fetchOptionsChain as jest.MockedFunction<typeof fetchOptionsChain>;

describe('gexCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
  });

  it('calculates GEX profile across expirations and stores cache', async () => {
    mockFetchExpirationDates.mockResolvedValue(['2026-02-10', '2026-02-11']);

    mockFetchOptionsChain
      .mockResolvedValueOnce({
        symbol: 'SPX',
        currentPrice: 6000,
        expiry: '2026-02-10',
        daysToExpiry: 1,
        options: {
          calls: [
            { strike: 6000, openInterest: 10000, gamma: 0.005 },
            { strike: 6020, openInterest: 8000, gamma: 0.004 },
          ],
          puts: [
            { strike: 6000, openInterest: 9000, gamma: 0.0045 },
            { strike: 5980, openInterest: 7000, gamma: 0.0042 },
          ],
        },
      } as any)
      .mockResolvedValueOnce({
        symbol: 'SPX',
        currentPrice: 6002,
        expiry: '2026-02-11',
        daysToExpiry: 2,
        options: {
          calls: [
            { strike: 6000, openInterest: 11000, gamma: 0.0051 },
            { strike: 6040, openInterest: 7500, gamma: 0.0038 },
          ],
          puts: [
            { strike: 6000, openInterest: 9500, gamma: 0.0044 },
            { strike: 5960, openInterest: 6000, gamma: 0.004 },
          ],
        },
      } as any);

    const profile = await calculateGEXProfile('SPX', { strikeRange: 25, maxExpirations: 2 });

    expect(profile.symbol).toBe('SPX');
    expect(profile.expirationsAnalyzed).toEqual(['2026-02-10', '2026-02-11']);
    expect(profile.gexByStrike.length).toBeGreaterThan(0);
    expect(profile.maxGEXStrike).not.toBeNull();
    expect(profile.regime === 'positive_gamma' || profile.regime === 'negative_gamma').toBe(true);

    expect(mockFetchExpirationDates).toHaveBeenCalledWith('SPX');
    expect(mockFetchOptionsChain).toHaveBeenCalledTimes(2);
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });

  it('returns cached profile when available', async () => {
    const cachedProfile = {
      symbol: 'SPX',
      spotPrice: 6000,
      gexByStrike: [],
      flipPoint: null,
      maxGEXStrike: null,
      keyLevels: [],
      regime: 'positive_gamma' as const,
      implication: 'cached',
      calculatedAt: '2026-02-09T00:00:00.000Z',
      expirationsAnalyzed: ['2026-02-10'],
    };

    mockCacheGet.mockResolvedValue(cachedProfile);

    const result = await calculateGEXProfile('SPX');

    expect(result).toEqual(cachedProfile);
    expect(mockFetchExpirationDates).not.toHaveBeenCalled();
    expect(mockFetchOptionsChain).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('supports non-index symbols when options data is available', async () => {
    mockFetchExpirationDates.mockResolvedValue(['2026-02-10']);
    mockFetchOptionsChain.mockResolvedValue({
      symbol: 'AAPL',
      currentPrice: 220,
      expiry: '2026-02-10',
      daysToExpiry: 2,
      options: {
        calls: [{ strike: 220, openInterest: 1000, gamma: 0.02 }],
        puts: [{ strike: 220, openInterest: 900, gamma: 0.018 }],
      },
    } as any);

    const profile = await calculateGEXProfile('AAPL');
    expect(profile.symbol).toBe('AAPL');
    expect(mockFetchExpirationDates).toHaveBeenCalledWith('AAPL');
  });
});
