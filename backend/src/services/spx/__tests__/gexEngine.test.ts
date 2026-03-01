import { computeUnifiedGEXLandscape, getCachedUnifiedGEXLandscape } from '../gexEngine';
import { calculateGEXProfile } from '../../options/gexCalculator';
import { cacheGet, cacheSet } from '../../../config/redis';

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../options/gexCalculator', () => ({
  calculateGEXProfile: jest.fn(),
}));

const mockCalculateGEXProfile = calculateGEXProfile as jest.MockedFunction<typeof calculateGEXProfile>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

describe('spx/gexEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('computes unified SPX/SPY landscape with expiration breakdown', async () => {
    mockCalculateGEXProfile.mockImplementation(async (symbolInput, options) => {
      const symbol = symbolInput.toUpperCase();
      const expiry = options?.expiry;

      if (symbol === 'SPX' && !expiry) {
        return {
          symbol,
          spotPrice: 6030,
          gexByStrike: [
            { strike: 6000, gexValue: -1200, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
            { strike: 6050, gexValue: 1900, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
          ],
          flipPoint: 6025,
          maxGEXStrike: 6050,
          keyLevels: [],
          regime: 'positive_gamma' as const,
          implication: 'test',
          calculatedAt: '2026-02-15T10:00:00.000Z',
          expirationsAnalyzed: ['2026-03-20', '2026-03-27'],
        };
      }

      if (symbol === 'SPY' && !expiry) {
        return {
          symbol,
          spotPrice: 603,
          gexByStrike: [
            { strike: 600, gexValue: -900, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
            { strike: 605, gexValue: 1400, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
          ],
          flipPoint: 602,
          maxGEXStrike: 605,
          keyLevels: [],
          regime: 'positive_gamma' as const,
          implication: 'test',
          calculatedAt: '2026-02-15T10:00:00.000Z',
          expirationsAnalyzed: ['2026-03-20', '2026-03-27'],
        };
      }

      return {
        symbol,
        spotPrice: symbol === 'SPX' ? 6030 : 603,
        gexByStrike: [
          {
            strike: symbol === 'SPX' ? 6025 : 602,
            gexValue: expiry === '2026-03-20' ? 900 : 700,
            callGamma: 0.01,
            putGamma: 0.01,
            callOI: 1000,
            putOI: 1000,
          },
        ],
        flipPoint: symbol === 'SPX' ? 6025 : 602,
        maxGEXStrike: symbol === 'SPX' ? 6025 : 602,
        keyLevels: [],
        regime: 'positive_gamma' as const,
        implication: 'test',
        calculatedAt: '2026-02-15T10:00:00.000Z',
        expirationsAnalyzed: [expiry || '2026-03-20'],
      };
    });

    const result = await computeUnifiedGEXLandscape({
      forceRefresh: true,
      strikeRange: 20,
      maxExpirations: 2,
    });

    // Per-expiry breakdown removed to cut redundant API calls; verify it defaults to empty.
    expect(result.spx.expirationBreakdown).toEqual({});
    expect(result.spy.expirationBreakdown).toEqual({});
    expect(result.combined.expirationBreakdown).toEqual({});
    expect(result.combined.keyLevels.length).toBeGreaterThan(0);

    expect(mockCalculateGEXProfile).toHaveBeenCalledWith('SPX', expect.objectContaining({
      maxExpirations: 2,
    }));
    expect(mockCalculateGEXProfile).toHaveBeenCalledWith('SPY', expect.objectContaining({
      maxExpirations: 2,
    }));
    // Only 2 calls (SPX aggregate + SPY aggregate), no per-expiry breakdown calls.
    expect(mockCalculateGEXProfile).toHaveBeenCalledTimes(2);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns cached unified landscape when available', async () => {
    const cachedPayload = {
      spx: {
        symbol: 'SPX' as const,
        spotPrice: 6000,
        netGex: 1000,
        flipPoint: 6005,
        callWall: 6010,
        putWall: 5990,
        zeroGamma: 6005,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-20T15:30:00.000Z',
      },
      spy: {
        symbol: 'SPY' as const,
        spotPrice: 600,
        netGex: 100,
        flipPoint: 600,
        callWall: 601,
        putWall: 599,
        zeroGamma: 600,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-20T15:30:00.000Z',
      },
      combined: {
        symbol: 'COMBINED' as const,
        spotPrice: 6000,
        netGex: 1100,
        flipPoint: 6005,
        callWall: 6010,
        putWall: 5990,
        zeroGamma: 6005,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-02-20T15:30:00.000Z',
      },
    };
    mockCacheGet.mockResolvedValue(cachedPayload as never);

    const result = await getCachedUnifiedGEXLandscape();
    expect(result).toEqual(cachedPayload);
    expect(mockCacheGet).toHaveBeenCalled();
  });

  it('reuses in-flight force refresh for non-force callers', async () => {
    mockCalculateGEXProfile.mockImplementation(async (symbolInput) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const symbol = symbolInput.toUpperCase();
      return {
        symbol,
        spotPrice: symbol === 'SPX' ? 6030 : 603,
        gexByStrike: [
          {
            strike: symbol === 'SPX' ? 6025 : 602,
            gexValue: symbol === 'SPX' ? 1000 : 100,
            callGamma: 0.01,
            putGamma: 0.01,
            callOI: 1000,
            putOI: 1000,
          },
        ],
        flipPoint: symbol === 'SPX' ? 6025 : 602,
        maxGEXStrike: symbol === 'SPX' ? 6025 : 602,
        keyLevels: [],
        regime: 'positive_gamma' as const,
        implication: 'test',
        calculatedAt: '2026-02-22T15:30:00.000Z',
        expirationsAnalyzed: ['2026-02-22'],
      };
    });

    const forceRefreshPromise = computeUnifiedGEXLandscape({ forceRefresh: true });
    const passivePromise = computeUnifiedGEXLandscape({ forceRefresh: false });
    const [forceResult, passiveResult] = await Promise.all([forceRefreshPromise, passivePromise]);

    expect(forceResult.combined.netGex).toBe(passiveResult.combined.netGex);
    expect(mockCalculateGEXProfile).toHaveBeenCalledTimes(2);
  });

  it('applies symbol profile overrides for cross symbol, scaling factor, and strike window', async () => {
    const rutStrikes = Array.from({ length: 35 }, (_, index) => 2066 + (index * 2));

    mockCalculateGEXProfile.mockImplementation(async (symbolInput) => {
      const symbol = symbolInput.toUpperCase();
      if (symbol === 'RUT') {
        return {
          symbol: 'RUT',
          spotPrice: 2100,
          gexByStrike: [
            ...rutStrikes.map((strike) => ({
              strike,
              gexValue: strike === 2090 ? 3000 : 240,
              callGamma: 0.01,
              putGamma: 0.01,
              callOI: 1000,
              putOI: 1000,
            })),
            { strike: 2200, gexValue: 2500, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
          ],
          flipPoint: 2095,
          maxGEXStrike: 2090,
          keyLevels: [],
          regime: 'positive_gamma' as const,
          implication: 'test',
          calculatedAt: '2026-02-15T10:00:00.000Z',
          expirationsAnalyzed: ['2026-03-20'],
        };
      }

      return {
        symbol: 'IWM',
        spotPrice: 210,
        gexByStrike: [
          { strike: 209, gexValue: 1000, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
          { strike: 235, gexValue: 4000, callGamma: 0.01, putGamma: 0.01, callOI: 1000, putOI: 1000 },
        ],
        flipPoint: 209.5,
        maxGEXStrike: 209,
        keyLevels: [],
        regime: 'positive_gamma' as const,
        implication: 'test',
        calculatedAt: '2026-02-15T10:00:00.000Z',
        expirationsAnalyzed: ['2026-03-20'],
      };
    });

    const profile = {
      symbol: 'RUT',
      displayName: 'Russell 2000',
      level: {
        roundNumberInterval: 50,
        openingRangeMinutes: 30,
        clusterRadiusPoints: 3,
      },
      gex: {
        scalingFactor: 0.2,
        crossSymbol: 'IWM',
        strikeWindowPoints: 35,
      },
      flow: {
        minPremium: 10_000,
        minVolume: 10,
        directionalMinPremium: 50_000,
      },
      multiTF: {
        emaFast: 21,
        emaSlow: 55,
        weight1h: 0.55,
        weight15m: 0.2,
        weight5m: 0.15,
        weight1m: 0.1,
      },
      regime: {
        breakoutThreshold: 0.7,
        compressionThreshold: 0.65,
      },
      tickers: {
        massiveTicker: 'I:RUT',
        massiveOptionsTicker: 'O:RUT*',
      },
      isActive: true,
      createdAt: null,
      updatedAt: null,
    };

    const result = await computeUnifiedGEXLandscape({
      forceRefresh: true,
      profile,
    });

    expect(mockCalculateGEXProfile).toHaveBeenCalledWith('RUT', expect.objectContaining({
      strikeRange: 10,
      maxExpirations: 1,
      forceRefresh: true,
    }));
    expect(mockCalculateGEXProfile).toHaveBeenCalledWith('IWM', expect.objectContaining({
      strikeRange: 12,
      maxExpirations: 1,
      forceRefresh: false,
    }));

    // Strike 2200 and converted 2350 sit outside the +/-35 point profile window
    // and should be excluded from the contextual combined set.
    expect(result.combined.gexByStrike.every((row) => Math.abs(row.strike - 2100) <= 35)).toBe(true);

    const strike2090 = result.combined.gexByStrike.find((row) => row.strike === 2090);
    expect(strike2090?.gex).toBeCloseTo(3200, 2); // 3000 + (1000 * 0.2)
  });
});
