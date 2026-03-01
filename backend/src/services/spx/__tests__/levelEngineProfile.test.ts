import { cacheGet, cacheSet } from '../../../config/redis';
import { getMinuteAggregates } from '../../../config/massive';
import { calculateLevels } from '../../levels';
import { getBasisState } from '../crossReference';
import { getFibLevels } from '../fibEngine';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getMergedLevels } from '../levelEngine';

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

jest.mock('../../../config/massive', () => ({
  getMinuteAggregates: jest.fn(),
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

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;
const mockCalculateLevels = calculateLevels as jest.MockedFunction<typeof calculateLevels>;
const mockGetBasisState = getBasisState as jest.MockedFunction<typeof getBasisState>;
const mockGetFibLevels = getFibLevels as jest.MockedFunction<typeof getFibLevels>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;

function buildProfile(clusterRadiusPoints: number) {
  return {
    symbol: 'SPX',
    displayName: 'S&P 500 Index',
    level: {
      roundNumberInterval: 50,
      openingRangeMinutes: 30,
      clusterRadiusPoints,
    },
    gex: {
      scalingFactor: 0.1,
      crossSymbol: 'SPY',
      strikeWindowPoints: 220,
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
      massiveTicker: 'I:SPX',
      massiveOptionsTicker: 'O:SPX*',
    },
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

function buildZeroGexLandscape() {
  return {
    spx: {
      symbol: 'SPX',
      spotPrice: 0,
      netGex: 0,
      flipPoint: 0,
      callWall: 0,
      putWall: 0,
      zeroGamma: 0,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-03-01T15:00:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: 0,
      netGex: 0,
      flipPoint: 0,
      callWall: 0,
      putWall: 0,
      zeroGamma: 0,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-03-01T15:00:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice: 0,
      netGex: 0,
      flipPoint: 0,
      callWall: 0,
      putWall: 0,
      zeroGamma: 0,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-03-01T15:00:00.000Z',
    },
  } as any;
}

describe('spx/levelEngine profile overrides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
    mockGetMinuteAggregates.mockResolvedValue([] as never);
    mockGetBasisState.mockRejectedValue(new Error('basis unavailable'));
    mockGetFibLevels.mockResolvedValue([] as never);
    mockComputeUnifiedGEXLandscape.mockResolvedValue(buildZeroGexLandscape() as never);

    mockCalculateLevels.mockResolvedValue({
      symbol: 'SPX',
      currentPrice: 6000,
      levels: {
        resistance: [
          { type: 'PDH', price: 6001, strength: 'strong', description: 'pdh', testsToday: 0, lastTest: null, holdRate: null },
        ],
        support: [
          { type: 'PDL', price: 6000, strength: 'strong', description: 'pdl', testsToday: 0, lastTest: null, holdRate: null },
        ],
        indicators: {
          vwap: null,
          atr14: 25,
        },
      },
    } as never);
  });

  it('threads profile into GEX fetch when level engine resolves dependencies', async () => {
    const profile = buildProfile(3);

    await getMergedLevels({
      forceRefresh: true,
      profile: profile as any,
    });

    expect(mockComputeUnifiedGEXLandscape).toHaveBeenCalledWith(expect.objectContaining({
      forceRefresh: true,
      profile,
    }));
  });

  it('applies profile cluster-radius override when forming zones', async () => {
    const narrow = await getMergedLevels({
      forceRefresh: true,
      profile: buildProfile(0.1) as any,
      gexLandscape: buildZeroGexLandscape(),
      fibLevels: [],
    });

    const wide = await getMergedLevels({
      forceRefresh: true,
      profile: buildProfile(3.5) as any,
      gexLandscape: buildZeroGexLandscape(),
      fibLevels: [],
    });

    expect(narrow.clusters.length).toBeGreaterThan(wide.clusters.length);
  });
});
