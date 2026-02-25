import fs from 'node:fs';
import path from 'node:path';
import { cacheGet, cacheSet } from '../../../config/redis';
import { getMinuteAggregates } from '../../../config/massive';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getMergedLevels } from '../levelEngine';
import { classifyCurrentRegime } from '../regimeClassifier';
import { __testables as setupDetectorTestables } from '../setupDetector';
import type { RegimeState, UnifiedGEXLandscape } from '../types';
import * as regimeUtils from '../utils';

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../config/massive', () => ({
  getMinuteAggregates: jest.fn().mockResolvedValue([]),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;

const VALID_REGIMES = ['trending', 'ranging', 'compression', 'breakout'] as const;
const VALID_DIRECTIONS = ['bullish', 'bearish', 'neutral'] as const;
const VALID_MAGNITUDES = ['small', 'medium', 'large'] as const;

type MinuteBar = { c: number; v: number };

function resetClassifierMocks(): void {
  jest.clearAllMocks();
  mockCacheGet.mockResolvedValue(null as never);
  mockCacheSet.mockResolvedValue(undefined as never);
  mockGetMinuteAggregates.mockResolvedValue([] as never);
}

function buildGexLandscape(overrides?: {
  spotPrice?: number;
  netGex?: number;
  flipPoint?: number;
}): UnifiedGEXLandscape {
  const spotPrice = overrides?.spotPrice ?? 5500;
  const netGex = overrides?.netGex ?? 250_000;
  const flipPoint = overrides?.flipPoint ?? 5498;

  return {
    spx: {
      symbol: 'SPX',
      spotPrice,
      netGex,
      flipPoint,
      callWall: spotPrice + 30,
      putWall: spotPrice - 30,
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T14:30:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: roundTo2(spotPrice / 10),
      netGex: roundTo2(netGex / 2),
      flipPoint,
      callWall: spotPrice + 30,
      putWall: spotPrice - 30,
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T14:30:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice,
      netGex,
      flipPoint,
      callWall: spotPrice + 30,
      putWall: spotPrice - 30,
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T14:30:00.000Z',
    },
  };
}

function buildLevelData(clusters?: Array<{
  type: 'fortress' | 'defended' | 'moderate' | 'minor';
  priceLow: number;
  priceHigh: number;
}>): any {
  return {
    levels: [],
    clusters: (clusters || []).map((cluster, index) => ({
      id: `cluster-${index + 1}`,
      priceLow: cluster.priceLow,
      priceHigh: cluster.priceHigh,
      clusterScore: 4.2,
      type: cluster.type,
      sources: [],
      testCount: 0,
      lastTestAt: null,
      held: null,
      holdRate: null,
    })),
    generatedAt: '2026-02-24T14:30:00.000Z',
  };
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function buildLinearBars(input: {
  startClose: number;
  closeStep: number;
  startVolume: number;
  volumeStep: number;
  count: number;
}): MinuteBar[] {
  return Array.from({ length: input.count }, (_, index) => ({
    c: roundTo2(input.startClose + (index * input.closeStep)),
    v: Math.max(0, Math.round(input.startVolume + (index * input.volumeStep))),
  }));
}

function buildAlternatingBars(input: {
  baselineClose: number;
  amplitude: number;
  startVolume: number;
  count: number;
}): MinuteBar[] {
  return Array.from({ length: input.count }, (_, index) => ({
    c: roundTo2(input.baselineClose + ((index % 2 === 0 ? 1 : -1) * input.amplitude)),
    v: Math.round(input.startVolume + ((index % 3) - 1) * 40_000),
  }));
}

function buildConstantBars(input: {
  close: number;
  volume: number;
  count: number;
}): MinuteBar[] {
  return Array.from({ length: input.count }, () => ({
    c: input.close,
    v: input.volume,
  }));
}

async function classifyFromBars(input: {
  bars: MinuteBar[];
  gexLandscape?: UnifiedGEXLandscape;
  levelData?: any;
}): Promise<RegimeState> {
  mockGetMinuteAggregates.mockResolvedValueOnce(input.bars as never);
  return classifyCurrentRegime({
    forceRefresh: true,
    gexLandscape: input.gexLandscape ?? buildGexLandscape(),
    levelData: input.levelData ?? buildLevelData(),
  });
}

async function captureDerivedSignals(input: {
  bars: MinuteBar[];
  gexLandscape?: UnifiedGEXLandscape;
  levelData?: any;
}): Promise<{
  signals: Parameters<typeof regimeUtils.classifyRegimeFromSignals>[0];
  state: RegimeState;
}> {
  const spy = jest.spyOn(regimeUtils, 'classifyRegimeFromSignals');
  try {
    const state = await classifyFromBars(input);
    expect(spy).toHaveBeenCalledTimes(1);
    return {
      signals: spy.mock.calls[0][0],
      state,
    };
  } finally {
    spy.mockRestore();
  }
}

function buildSetupDetectorGex(overrides?: {
  spotPrice?: number;
  netGex?: number;
  flipPoint?: number;
}): UnifiedGEXLandscape {
  const spotPrice = overrides?.spotPrice ?? 5500;
  const netGex = overrides?.netGex ?? 1200;
  const flipPoint = overrides?.flipPoint ?? 5480;
  return {
    spx: {
      symbol: 'SPX',
      spotPrice,
      netGex,
      flipPoint,
      callWall: spotPrice + 45,
      putWall: spotPrice - 45,
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T16:00:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: roundTo2(spotPrice / 10),
      netGex: roundTo2(netGex / 2),
      flipPoint,
      callWall: spotPrice + 45,
      putWall: spotPrice - 45,
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T16:00:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice,
      netGex,
      flipPoint,
      callWall: spotPrice + 45,
      putWall: spotPrice - 45,
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-02-24T16:00:00.000Z',
    },
  };
}

describe('spx/regimeClassifier', () => {
  it('does not fetch current-session minute bars when trend inputs are provided', async () => {
    const { getMinuteAggregates } = await import('../../../config/massive');

    const gexLandscape = {
      spx: {
        spotPrice: 6100,
      },
      combined: {
        netGex: 125000,
        flipPoint: 6095,
      },
    } as any;
    const levelData = {
      levels: [],
      clusters: [],
      generatedAt: '2026-02-20T20:00:00.000Z',
    } as any;

    const state = await classifyCurrentRegime({
      forceRefresh: true,
      gexLandscape,
      levelData,
      volumeTrend: 'rising',
      trendStrength: 0.55,
    });

    expect(getMinuteAggregates).not.toHaveBeenCalled();
    expect(state.regime).toBeTruthy();
    expect(state.timestamp).toBeTruthy();
  });

  describe('classifyRegimeFromSignals core logic', () => {
    beforeEach(() => {
      resetClassifierMocks();
    });

    it('classifies trending for positive tape momentum and high trend strength', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: 180_000,
        volumeTrend: 'rising',
        rangeCompression: 0.28,
        breakoutStrength: 0.36,
        zoneContainment: 0.3,
        trendStrength: 0.81,
      });
      expect(regime).toBe('trending');
    });

    it('classifies ranging for near-zero net GEX, flat volume, and weak trend strength', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: 0,
        volumeTrend: 'flat',
        rangeCompression: 0.22,
        breakoutStrength: 0.1,
        zoneContainment: 0.86,
        trendStrength: 0.12,
      });
      expect(regime).toBe('ranging');
    });

    it('classifies compression for tight range, non-rising volume, and low trend strength', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: 55_000,
        volumeTrend: 'falling',
        rangeCompression: 0.92,
        breakoutStrength: 0.08,
        zoneContainment: 0.91,
        trendStrength: 0.21,
      });
      expect(regime).toBe('compression');
    });

    it('classifies breakout for high breakout strength with rising volume', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: -120_000,
        volumeTrend: 'rising',
        rangeCompression: 0.2,
        breakoutStrength: 0.84,
        zoneContainment: 0.3,
        trendStrength: 0.73,
      });
      expect(regime).toBe('breakout');
    });

    it('returns a valid regime for ambiguous moderate inputs', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: 15_000,
        volumeTrend: 'flat',
        rangeCompression: 0.45,
        breakoutStrength: 0.31,
        zoneContainment: 0.48,
        trendStrength: 0.46,
      });
      expect(VALID_REGIMES).toContain(regime);
    });

    it('handles all-zero inputs and still returns a valid regime', async () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: 0,
        volumeTrend: 'flat',
        rangeCompression: 0,
        breakoutStrength: 0,
        zoneContainment: 0,
        trendStrength: 0,
      });
      expect(VALID_REGIMES).toContain(regime);

      const state = await classifyCurrentRegime({
        forceRefresh: true,
        gexLandscape: buildGexLandscape({
          spotPrice: 5500,
          flipPoint: 5500,
          netGex: 0,
        }),
        levelData: buildLevelData(),
        volumeTrend: 'flat',
        trendStrength: 0,
      });
      expect(state.confidence).toBeLessThanOrEqual(35);
      expect(state.confidence).toBeGreaterThanOrEqual(0);
    });

    it('handles extreme positive inputs without crashing', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: 1_000_000_000,
        volumeTrend: 'rising',
        rangeCompression: 1,
        breakoutStrength: 1,
        zoneContainment: 1,
        trendStrength: 1,
      });
      expect(VALID_REGIMES).toContain(regime);
    });

    it('handles extreme negative net GEX inputs without crashing', () => {
      const regime = regimeUtils.classifyRegimeFromSignals({
        netGex: -1_000_000_000,
        volumeTrend: 'falling',
        rangeCompression: 0,
        breakoutStrength: 0.45,
        zoneContainment: 0.1,
        trendStrength: 0.5,
      });
      expect(VALID_REGIMES).toContain(regime);
    });
  });

  describe('volumeTrendFromBars behavior via classifyCurrentRegime', () => {
    beforeEach(() => {
      resetClassifierMocks();
    });

    it('classifies strictly increasing volume as rising', async () => {
      const bars = buildLinearBars({
        startClose: 5520,
        closeStep: 0.4,
        startVolume: 1_000_000,
        volumeStep: 120_000,
        count: 20,
      });
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.volumeTrend).toBe('rising');
    });

    it('classifies strictly decreasing volume as falling', async () => {
      const bars = buildLinearBars({
        startClose: 5520,
        closeStep: -0.3,
        startVolume: 2_400_000,
        volumeStep: -130_000,
        count: 20,
      });
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.volumeTrend).toBe('falling');
    });

    it('classifies roughly constant volume as flat', async () => {
      const bars = [
        1_980_000, 2_040_000, 2_010_000, 2_020_000, 1_990_000,
        2_030_000, 2_000_000, 2_010_000, 1_995_000, 2_015_000,
        2_005_000, 2_025_000, 1_985_000, 2_000_000, 2_010_000,
        2_015_000, 1_995_000, 2_005_000, 2_000_000, 2_010_000,
      ].map((volume, index) => ({
        c: roundTo2(5510 + (index * 0.2)),
        v: volume,
      }));
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.volumeTrend).toBe('flat');
    });

    it('defaults to flat volume trend for empty bars', async () => {
      const { signals } = await captureDerivedSignals({ bars: [] });
      expect(signals.volumeTrend).toBe('flat');
    });

    it('defaults to flat volume trend for a single bar', async () => {
      const { signals } = await captureDerivedSignals({
        bars: [{ c: 5501, v: 1_500_000 }],
      });
      expect(signals.volumeTrend).toBe('flat');
    });

    it('handles zero-volume bars without crashing', async () => {
      const bars = [
        { c: 5498, v: 1_600_000 },
        { c: 5499, v: 0 },
        { c: 5500, v: 1_550_000 },
        { c: 5501, v: 0 },
        { c: 5502, v: 1_520_000 },
        { c: 5503, v: 1_510_000 },
        { c: 5504, v: 0 },
        { c: 5503, v: 1_495_000 },
        { c: 5502, v: 1_470_000 },
        { c: 5501, v: 1_460_000 },
        { c: 5500, v: 0 },
        { c: 5499, v: 1_430_000 },
        { c: 5498, v: 1_420_000 },
        { c: 5499, v: 1_410_000 },
        { c: 5500, v: 1_405_000 },
        { c: 5501, v: 0 },
      ];
      const { signals, state } = await captureDerivedSignals({ bars });
      expect(['rising', 'flat', 'falling']).toContain(signals.volumeTrend);
      expect(VALID_REGIMES).toContain(state.regime);
    });
  });

  describe('trendStrengthFromBars behavior via classifyCurrentRegime', () => {
    beforeEach(() => {
      resetClassifierMocks();
    });

    it('returns high strength for strongly up-trending bars', async () => {
      const bars = buildLinearBars({
        startClose: 5400,
        closeStep: 3.2,
        startVolume: 1_400_000,
        volumeStep: 45_000,
        count: 30,
      });
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.trendStrength).toBeGreaterThan(0.7);
    });

    it('returns high strength for strongly down-trending bars', async () => {
      const bars = buildLinearBars({
        startClose: 5600,
        closeStep: -3.3,
        startVolume: 1_900_000,
        volumeStep: -30_000,
        count: 30,
      });
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.trendStrength).toBeGreaterThan(0.7);
    });

    it('returns low strength for flat bars', async () => {
      const bars = buildConstantBars({
        close: 5525,
        volume: 1_700_000,
        count: 24,
      });
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.trendStrength).toBeLessThan(0.3);
    });

    it('returns sub-0.5 strength for alternating choppy bars', async () => {
      const bars = buildAlternatingBars({
        baselineClose: 5515,
        amplitude: 2.4,
        startVolume: 1_650_000,
        count: 28,
      });
      const { signals } = await captureDerivedSignals({ bars });
      expect(signals.trendStrength).toBeLessThan(0.5);
    });

    it('returns 0 for empty bars', async () => {
      const { signals } = await captureDerivedSignals({ bars: [] });
      expect(signals.trendStrength).toBe(0);
    });

    it('always returns a trend strength between 0 and 1', async () => {
      const scenarios: MinuteBar[][] = [
        buildLinearBars({
          startClose: 5450,
          closeStep: 2.5,
          startVolume: 1_200_000,
          volumeStep: 60_000,
          count: 20,
        }),
        buildLinearBars({
          startClose: 5575,
          closeStep: -2.5,
          startVolume: 1_900_000,
          volumeStep: -40_000,
          count: 20,
        }),
        buildAlternatingBars({
          baselineClose: 5510,
          amplitude: 1.8,
          startVolume: 1_450_000,
          count: 20,
        }),
        [],
      ];

      for (const bars of scenarios) {
        const { signals } = await captureDerivedSignals({ bars });
        expect(signals.trendStrength).toBeGreaterThanOrEqual(0);
        expect(signals.trendStrength).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('regime transition scenarios', () => {
    beforeEach(() => {
      resetClassifierMocks();
    });

    it('classifies morning tight-range tape as compression', async () => {
      const bars = [
        5500.2, 5500.1, 5499.9, 5500.0, 5500.1,
        5500.0, 5499.8, 5499.9, 5500.0, 5499.9,
        5499.8, 5499.9, 5500.0, 5499.9, 5499.8,
        5499.9, 5500.0, 5499.9, 5499.8, 5499.9,
      ].map((close, index) => ({
        c: close,
        v: 2_300_000 - (index * 55_000),
      }));
      const state = await classifyFromBars({
        bars,
        gexLandscape: buildGexLandscape({
          spotPrice: 5500.2,
          flipPoint: 5500.0,
          netGex: 310_000,
        }),
        levelData: buildLevelData([
          { type: 'defended', priceLow: 5499.4, priceHigh: 5500.6 },
        ]),
      });
      expect(state.regime).toBe('compression');
    });

    it('classifies post-breakout tape as breakout or trending', async () => {
      const bars = buildLinearBars({
        startClose: 5512,
        closeStep: 2.9,
        startVolume: 1_100_000,
        volumeStep: 180_000,
        count: 24,
      });
      const state = await classifyFromBars({
        bars,
        gexLandscape: buildGexLandscape({
          spotPrice: 5570,
          flipPoint: 5548,
          netGex: -180_000,
        }),
        levelData: buildLevelData([
          { type: 'fortress', priceLow: 5490, priceHigh: 5505 },
        ]),
      });
      expect(['breakout', 'trending']).toContain(state.regime);
    });

    it('classifies afternoon sideways tape as ranging', async () => {
      const bars = buildAlternatingBars({
        baselineClose: 5530,
        amplitude: 3.5,
        startVolume: 1_850_000,
        count: 26,
      });
      const state = await classifyFromBars({
        bars,
        gexLandscape: buildGexLandscape({
          spotPrice: 5530,
          flipPoint: 5528.5,
          netGex: 240_000,
        }),
        levelData: buildLevelData([
          { type: 'fortress', priceLow: 5455, priceHigh: 5465 },
          { type: 'defended', priceLow: 5590, priceHigh: 5600 },
        ]),
      });
      expect(state.regime).toBe('ranging');
    });

    it('classifies end-of-day tightening tape as compression or ranging', async () => {
      const bars = [
        5532, 5531.5, 5531.3, 5531.1, 5530.9,
        5530.8, 5530.7, 5530.6, 5530.5, 5530.5,
        5530.4, 5530.3, 5530.3, 5530.2, 5530.2,
        5530.1, 5530.1, 5530.1, 5530.0, 5530.0,
      ].map((close, index) => ({
        c: close,
        v: 1_900_000 - (index * 65_000),
      }));

      const state = await classifyFromBars({
        bars,
        gexLandscape: buildGexLandscape({
          spotPrice: 5530.1,
          flipPoint: 5529.7,
          netGex: 95_000,
        }),
        levelData: buildLevelData([
          { type: 'defended', priceLow: 5529.5, priceHigh: 5530.5 },
          { type: 'fortress', priceLow: 5533.5, priceHigh: 5534.5 },
        ]),
      });

      expect(['compression', 'ranging']).toContain(state.regime);
    });
  });

  describe('RegimeState output shape', () => {
    beforeEach(() => {
      resetClassifierMocks();
    });

    it('returns all required RegimeState fields with valid ranges', async () => {
      mockComputeUnifiedGEXLandscape.mockResolvedValueOnce(buildGexLandscape({
        spotPrice: 5542,
        flipPoint: 5538,
        netGex: -120_000,
      }) as never);
      mockGetMergedLevels.mockResolvedValueOnce(buildLevelData([
        { type: 'defended', priceLow: 5535, priceHigh: 5541 },
        { type: 'fortress', priceLow: 5550, priceHigh: 5558 },
      ]) as never);
      mockGetMinuteAggregates.mockResolvedValueOnce(buildLinearBars({
        startClose: 5528,
        closeStep: 1.6,
        startVolume: 1_200_000,
        volumeStep: 110_000,
        count: 20,
      }) as never);

      const state = await classifyCurrentRegime({ forceRefresh: true });
      expect(VALID_REGIMES).toContain(state.regime);
      expect(VALID_DIRECTIONS).toContain(state.direction);
      expect(VALID_MAGNITUDES).toContain(state.magnitude);
      expect(typeof state.probability).toBe('number');
      expect(state.probability).toBeGreaterThanOrEqual(0);
      expect(state.probability).toBeLessThanOrEqual(100);
      expect(typeof state.confidence).toBe('number');
      expect(state.confidence).toBeGreaterThanOrEqual(0);
      expect(state.confidence).toBeLessThanOrEqual(100);
      expect(typeof state.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(state.timestamp))).toBe(false);
    });

    it('never returns nullish regime on successful classification', async () => {
      const state = await classifyCurrentRegime({
        forceRefresh: true,
        gexLandscape: buildGexLandscape({
          spotPrice: 5500,
          flipPoint: 5500,
          netGex: 0,
        }),
        levelData: buildLevelData(),
        volumeTrend: 'flat',
        trendStrength: 0,
      });

      expect(state.regime).toBeDefined();
      expect(state.regime).not.toBeNull();
      expect(VALID_REGIMES).toContain(state.regime);
    });

    it('returns non-NaN probability and confidence values', async () => {
      const state = await classifyCurrentRegime({
        forceRefresh: true,
        gexLandscape: buildGexLandscape({
          spotPrice: 5560,
          flipPoint: 5559,
          netGex: 180_000,
        }),
        levelData: buildLevelData([
          { type: 'fortress', priceLow: 5530, priceHigh: 5535 },
        ]),
        volumeTrend: 'rising',
        trendStrength: 0.69,
      });

      expect(Number.isNaN(state.probability)).toBe(false);
      expect(Number.isNaN(state.confidence)).toBe(false);
    });
  });

  describe('setup-type regime consumer integration', () => {
    beforeEach(() => {
      resetClassifierMocks();
    });

    it('maps identical neutral context to different setup families by regime', () => {
      const common = {
        direction: 'bullish' as const,
        currentPrice: 5500,
        zoneCenter: 5490,
        gexLandscape: buildSetupDetectorGex({
          spotPrice: 5500,
          netGex: 2200,
          flipPoint: 5605,
        }),
        indicatorContext: {
          emaFast: 5498,
          emaSlow: 5496,
          emaFastSlope: 0.01,
          emaSlowSlope: 0.01,
          atr14: 7,
          volumeTrend: 'flat' as const,
          sessionOpenPrice: 5488,
          orbHigh: 5510,
          orbLow: 5480,
          minutesSinceOpen: 220,
          sessionOpenTimestamp: '2026-02-24T14:30:00.000Z',
          asOfTimestamp: '2026-02-24T17:30:00.000Z',
          vwapPrice: 5499,
          vwapDeviation: 0.02,
          vwapBand1SD: null,
          vwapBand15SD: null,
          vwapBand2SD: null,
          latestBar: { t: Date.parse('2026-02-24T17:30:00.000Z'), o: 5499, h: 5501, l: 5498, c: 5500, v: 900_000 },
          priorBar: { t: Date.parse('2026-02-24T17:29:00.000Z'), o: 5498.8, h: 5500.2, l: 5498.5, c: 5499.2, v: 850_000 },
          avgRecentVolume: 900_000,
        },
        emaAligned: false,
        volumeRegimeAligned: true,
      };

      const compressionSetup = setupDetectorTestables.inferSetupTypeForZone({
        ...common,
        regime: 'compression',
      });
      const trendingSetup = setupDetectorTestables.inferSetupTypeForZone({
        ...common,
        regime: 'trending',
      });

      expect(compressionSetup).toBe('mean_reversion');
      expect(trendingSetup).toBe('trend_continuation');
    });

    it('documents current behavior: no hard regime type block, alignment is downstream scoring/gating signal', () => {
      const setupDetectorPathCandidates = [
        path.resolve(process.cwd(), 'backend/src/services/spx/setupDetector.ts'),
        path.resolve(process.cwd(), 'src/services/spx/setupDetector.ts'),
      ];
      const setupDetectorPath = setupDetectorPathCandidates.find((candidate) => fs.existsSync(candidate));

      expect(setupDetectorPath).toBeTruthy();
      if (!setupDetectorPath) {
        throw new Error('setupDetector.ts not found');
      }

      const source = fs.readFileSync(setupDetectorPath, 'utf8');
      expect(source.includes('const regimeAligned = isRegimeAligned(setupType, regimeState.regime);')).toBe(true);
      expect(source.includes('regime_gate_blocked')).toBe(false);
      expect(source.includes('if (!regimeAligned) continue;')).toBe(false);
      expect(source.includes('if (!regimeAligned) return')).toBe(false);
    });
  });
});
