jest.mock('../optionsChainFetcher', () => ({
  fetchExpirationDates: jest.fn(),
  fetchOptionsChain: jest.fn(),
}));

jest.mock('../../../config/massive', () => ({
  getDailyAggregates: jest.fn(),
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

import { getDailyAggregates } from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import { fetchExpirationDates, fetchOptionsChain } from '../optionsChainFetcher';
import { adjustIVRankFor0DTE, analyzeIVProfile } from '../ivAnalysis';

const mockGetDailyAggregates = getDailyAggregates as jest.MockedFunction<typeof getDailyAggregates>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockFetchExpirationDates = fetchExpirationDates as jest.MockedFunction<typeof fetchExpirationDates>;
const mockFetchOptionsChain = fetchOptionsChain as jest.MockedFunction<typeof fetchOptionsChain>;

describe('ivAnalysis service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
  });

  it('calculates IV profile with rank, skew, and term structure', async () => {
    mockFetchExpirationDates.mockResolvedValue(['2026-02-10', '2026-02-17']);

    mockFetchOptionsChain
      .mockResolvedValueOnce({
        symbol: 'SPX',
        currentPrice: 6000,
        expiry: '2026-02-10',
        daysToExpiry: 1,
        options: {
          calls: [
            { strike: 6000, impliedVolatility: 0.2, delta: 0.5 },
            { strike: 6100, impliedVolatility: 0.18, delta: 0.25 },
            { strike: 6200, impliedVolatility: 0.17, delta: 0.1 },
          ],
          puts: [
            { strike: 6000, impliedVolatility: 0.22, delta: -0.5 },
            { strike: 5900, impliedVolatility: 0.21, delta: -0.25 },
            { strike: 5800, impliedVolatility: 0.22, delta: -0.1 },
          ],
        },
      } as any)
      .mockResolvedValueOnce({
        symbol: 'SPX',
        currentPrice: 6002,
        expiry: '2026-02-17',
        daysToExpiry: 8,
        options: {
          calls: [
            { strike: 6000, impliedVolatility: 0.24, delta: 0.5 },
            { strike: 6100, impliedVolatility: 0.23, delta: 0.25 },
          ],
          puts: [
            { strike: 6000, impliedVolatility: 0.25, delta: -0.5 },
            { strike: 5900, impliedVolatility: 0.24, delta: -0.25 },
          ],
        },
      } as any);

    const dailyBars = Array.from({ length: 300 }, (_, idx) => {
      const base = 5000 + idx * 3;
      const noise = (idx % 3 === 0 ? 80 : idx % 3 === 1 ? -45 : 20);
      return {
        c: base + noise,
        o: base,
        h: base + 10,
        l: base - 10,
        v: 1000000,
        t: Date.now() + idx * 86_400_000,
      };
    });
    mockGetDailyAggregates.mockResolvedValue(dailyBars as any);

    const result = await analyzeIVProfile('spx', { strikeRange: 20, maxExpirations: 2 });

    expect(result.symbol).toBe('SPX');
    expect(result.ivRank.currentIV).not.toBeNull();
    expect(result.ivRank.ivRank).not.toBeNull();
    expect(result.skew.skewDirection).toBe('put_heavy');
    expect(result.termStructure.expirations.length).toBe(2);
    expect(result.termStructure.shape).toBe('contango');
    expect(result.ivForecast).toBeDefined();
    expect(result.ivForecast?.horizonMinutes).toBe(60);
    expect(result.ivForecast?.predictedIV).not.toBeNull();
    expect(result.ivForecast?.features).toBeDefined();
    expect(result.ivForecast?.confidence).toBeGreaterThan(0);
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });

  it('returns cached profile when available', async () => {
    const cached = {
      symbol: 'AAPL',
      currentPrice: 220,
      asOf: '2026-02-09T00:00:00.000Z',
      ivRank: {
        currentIV: 31,
        ivRank: 45,
        ivPercentile: 44,
        iv52wkHigh: 60,
        iv52wkLow: 15,
        ivTrend: 'stable' as const,
      },
      skew: {
        skew25delta: 1.5,
        skew10delta: 2.2,
        skewDirection: 'balanced' as const,
        interpretation: 'cached',
      },
      termStructure: {
        expirations: [{ date: '2026-02-10', dte: 1, atmIV: 30 }],
        shape: 'flat' as const,
      },
    };

    mockCacheGet.mockResolvedValue(cached);

    const result = await analyzeIVProfile('aapl');
    expect(result).toEqual(cached);
    expect(mockFetchExpirationDates).not.toHaveBeenCalled();
    expect(mockFetchOptionsChain).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('throws when no expirations are available', async () => {
    mockFetchExpirationDates.mockResolvedValue([]);

    await expect(analyzeIVProfile('SPX')).rejects.toThrow('No options expirations found for SPX');
  });

  it('leaves 0DTE IV rank unchanged at or above 60 minutes to close', () => {
    expect(adjustIVRankFor0DTE(80, 60, 0)).toBe(80);
    expect(adjustIVRankFor0DTE(80, 75, 0)).toBe(80);
  });

  it('discounts 0DTE IV rank by 10% at 30 minutes to close', () => {
    expect(adjustIVRankFor0DTE(80, 30, 0)).toBe(72);
  });

  it('discounts 0DTE IV rank by 20% inside final 30 minutes', () => {
    expect(adjustIVRankFor0DTE(80, 15, 0)).toBe(64);
  });

  it('does not alter IV rank for non-0DTE contracts', () => {
    expect(adjustIVRankFor0DTE(80, 15, 3)).toBe(80);
  });
});
