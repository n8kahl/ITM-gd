import { cacheGet, cacheSet } from '../../../config/redis';
import { getMinuteAggregates } from '../../../config/massive';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getMergedLevels } from '../levelEngine';
import { classifyCurrentRegime } from '../regimeClassifier';
import * as utils from '../utils';

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

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;

function buildProfile(overrides?: { breakout?: number; compression?: number; ticker?: string }) {
  return {
    symbol: 'SPX',
    displayName: 'S&P 500 Index',
    level: {
      roundNumberInterval: 50,
      openingRangeMinutes: 30,
      clusterRadiusPoints: 3,
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
      breakoutThreshold: overrides?.breakout ?? 0.7,
      compressionThreshold: overrides?.compression ?? 0.65,
    },
    tickers: {
      massiveTicker: overrides?.ticker ?? 'I:SPX',
      massiveOptionsTicker: 'O:SPX*',
    },
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

describe('spx/regimeClassifier profile overrides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
    mockGetMinuteAggregates.mockResolvedValue([
      { c: 6000, v: 100 },
      { c: 6001, v: 110 },
      { c: 6002, v: 120 },
      { c: 6003, v: 130 },
      { c: 6004, v: 140 },
      { c: 6005, v: 150 },
      { c: 6006, v: 160 },
      { c: 6007, v: 170 },
      { c: 6008, v: 180 },
      { c: 6009, v: 190 },
      { c: 6010, v: 200 },
      { c: 6011, v: 210 },
      { c: 6012, v: 220 },
      { c: 6013, v: 230 },
      { c: 6014, v: 240 },
    ] as never);
    mockComputeUnifiedGEXLandscape.mockResolvedValue({
      spx: {
        symbol: 'SPX',
        spotPrice: 6014,
        netGex: 150_000,
        flipPoint: 6009,
        callWall: 6030,
        putWall: 5990,
        zeroGamma: 6009,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-03-01T15:00:00.000Z',
      },
      spy: {
        symbol: 'SPY',
        spotPrice: 601,
        netGex: 80_000,
        flipPoint: 600.9,
        callWall: 603,
        putWall: 599,
        zeroGamma: 600.9,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-03-01T15:00:00.000Z',
      },
      combined: {
        symbol: 'COMBINED',
        spotPrice: 6014,
        netGex: 230_000,
        flipPoint: 6009,
        callWall: 6030,
        putWall: 5990,
        zeroGamma: 6009,
        gexByStrike: [],
        keyLevels: [],
        expirationBreakdown: {},
        timestamp: '2026-03-01T15:00:00.000Z',
      },
    } as never);
    mockGetMergedLevels.mockResolvedValue({
      levels: [],
      clusters: [
        {
          id: 'cluster-1',
          priceLow: 6008,
          priceHigh: 6012,
          clusterScore: 4.5,
          type: 'defended',
          sources: [],
          testCount: 0,
          lastTestAt: null,
          held: null,
          holdRate: null,
        },
      ],
      generatedAt: '2026-03-01T15:00:00.000Z',
    } as never);
  });

  it('uses profile ticker and seeded threshold mapping with no drift', async () => {
    const spy = jest.spyOn(utils, 'classifyRegimeFromSignals');

    await classifyCurrentRegime({
      forceRefresh: true,
      profile: buildProfile({ ticker: 'I:NDX' }) as any,
    });

    expect(mockGetMinuteAggregates).toHaveBeenCalledWith('I:NDX', expect.any(String));
    const calledWith = spy.mock.calls.at(-1)?.[0];
    expect(calledWith?.thresholds).toBeDefined();
    const thresholds = calledWith?.thresholds as { breakout: number; compression: number };
    expect(thresholds.breakout).toBeCloseTo(0.62, 6);
    expect(thresholds.compression).toBeCloseTo(0.7, 6);
    spy.mockRestore();
  });

  it('applies profile threshold deltas to regime signal thresholds', async () => {
    const spy = jest.spyOn(utils, 'classifyRegimeFromSignals');

    await classifyCurrentRegime({
      forceRefresh: true,
      profile: buildProfile({ breakout: 0.8, compression: 0.5 }) as any,
    });

    const calledWith = spy.mock.calls.at(-1)?.[0];
    expect(calledWith?.thresholds).toBeDefined();
    const thresholds = calledWith?.thresholds as { breakout: number; compression: number };
    expect(thresholds.breakout).toBeCloseTo(0.72, 6);
    expect(thresholds.compression).toBeCloseTo(0.55, 6);
    spy.mockRestore();
  });
});
