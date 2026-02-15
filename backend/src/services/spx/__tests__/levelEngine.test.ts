import { getMergedLevels } from '../levelEngine';
import { calculateLevels } from '../../levels';
import { getBasisState } from '../crossReference';
import { getFibLevels } from '../fibEngine';
import { computeUnifiedGEXLandscape } from '../gexEngine';
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

jest.mock('../../levels', () => ({
  calculateLevels: jest.fn(),
}));

jest.mock('../crossReference', () => ({
  getBasisState: jest.fn(),
}));

jest.mock('../fibEngine', () => ({
  getFibLevels: jest.fn(),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

const mockCalculateLevels = calculateLevels as jest.MockedFunction<typeof calculateLevels>;
const mockGetBasisState = getBasisState as jest.MockedFunction<typeof getBasisState>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

describe('spx/levelEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);

    mockCalculateLevels.mockResolvedValue({
      symbol: 'SPX',
      currentPrice: 6032.25,
      levels: {
        resistance: [
          { type: 'PDH', price: 6040, strength: 'strong', description: 'prior day high', testsToday: 1, lastTest: '2026-02-15T14:00:00.000Z', holdRate: 68 },
        ],
        support: [
          { type: 'PDL', price: 6008, strength: 'strong', description: 'prior day low', testsToday: 1, lastTest: '2026-02-15T13:20:00.000Z', holdRate: 64 },
        ],
        indicators: {
          vwap: 6028,
          atr14: 38,
        },
      },
    } as any);

    mockGetBasisState.mockResolvedValue({
      current: 1.7,
      trend: 'stable',
      leading: 'neutral',
      ema5: 1.6,
      ema20: 1.5,
      zscore: 0.3,
      spxPrice: 6032.25,
      spyPrice: 603.05,
      timestamp: '2026-02-15T14:40:00.000Z',
    });

    mockGetFibLevels.mockResolvedValue([
      {
        ratio: 0.618,
        price: 6022,
        timeframe: 'daily',
        direction: 'retracement',
        swingHigh: 6050,
        swingLow: 5980,
        crossValidated: true,
      },
    ]);

    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: {
        symbol: 'SPX',
        spotPrice: 6032.25,
        netGex: 2200,
        flipPoint: 6025,
        callWall: 6050,
        putWall: 6000,
        zeroGamma: 6025,
        gexByStrike: [],
        keyLevels: [{ strike: 6050, gex: 1900, type: 'call_wall' }],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:40:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 603.05,
        netGex: 1200,
        flipPoint: 6020,
        callWall: 6048,
        putWall: 5997,
        zeroGamma: 6020,
        gexByStrike: [],
        keyLevels: [{ strike: 6048, gex: 900, type: 'call_wall' }],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:40:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6032.25,
        netGex: 3400,
        flipPoint: 6024,
        callWall: 6050,
        putWall: 5998,
        zeroGamma: 6024,
        gexByStrike: [],
        keyLevels: [{ strike: 6050, gex: 2300, type: 'call_wall' }],
        expirationBreakdown: {},
        timestamp: '2026-02-15T14:40:00.000Z',
      },
    });
  });

  it('merges legacy, options, SPY-derived, and fibonacci levels and builds clusters', async () => {
    const data = await getMergedLevels({ forceRefresh: true });

    expect(data.levels.length).toBeGreaterThan(4);
    expect(data.levels.some((level) => level.category === 'options')).toBe(true);
    expect(data.levels.some((level) => level.category === 'spy_derived')).toBe(true);
    expect(data.levels.some((level) => level.category === 'fibonacci')).toBe(true);

    expect(data.clusters.length).toBeGreaterThan(0);
    expect(data.clusters.every((zone) => zone.clusterScore > 0)).toBe(true);

    expect(mockCalculateLevels).toHaveBeenCalledTimes(2);
    expect(mockCacheSet).toHaveBeenCalled();
  });
});
