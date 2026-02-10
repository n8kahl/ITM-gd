import type { MassiveAggregate } from '../../../config/massive';

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { cacheGet, cacheSet } from '../../../config/redis';
import { analyzeLevelTests, formatLevelTestSummary } from '../levelTestTracker';
import type { LevelItem } from '../index';
import { logger } from '../../../lib/logger';

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockLoggerWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;

function createBar(
  high: number,
  low: number,
  close: number,
  timestamp: number,
  volume: number = 1_000_000,
): MassiveAggregate {
  return {
    o: Number(((high + low) / 2).toFixed(2)),
    h: high,
    l: low,
    c: close,
    v: volume,
    t: timestamp,
    n: 100,
    vw: close,
  };
}

function createLevel(type: string, price: number): LevelItem {
  return {
    type,
    price,
    distance: 0,
    distancePct: 0,
    distanceATR: 0,
    strength: 'moderate',
    description: `${type} level`,
    side: price >= 100 ? 'resistance' : 'support',
  };
}

describe('Level Test Tracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  describe('analyzeLevelTests', () => {
    it('detects held resistance tests', async () => {
      const level = createLevel('R1', 105);
      const start = Date.now();
      const bars = [
        createBar(103, 100, 102, start + 0),
        createBar(105.1, 101.5, 104.2, start + 60_000),
        createBar(104, 101, 103, start + 120_000),
      ];

      const history = await analyzeLevelTests('TEST', [level], bars, 102, 'key-1');
      const r1 = history.get('R1_105.00');

      expect(r1).toBeDefined();
      expect(r1?.testsToday).toBe(1);
      expect(r1?.tests[0].result).toBe('held');
      expect(r1?.holdRate).toBe(1);
      expect(mockCacheSet).toHaveBeenCalled();
    });

    it('detects broken resistance tests', async () => {
      const level = createLevel('R1', 105);
      const start = Date.now();
      const bars = [
        createBar(104, 100, 103, start + 0),
        createBar(106, 102, 105.5, start + 60_000),
      ];

      const history = await analyzeLevelTests('TEST', [level], bars, 103, 'key-2');
      const r1 = history.get('R1_105.00');

      expect(r1).toBeDefined();
      expect(r1?.testsToday).toBe(1);
      expect(r1?.tests[0].result).toBe('broken');
      expect(r1?.holdRate).toBe(0);
    });

    it('detects held support tests', async () => {
      const level = createLevel('S1', 95);
      const start = Date.now();
      const bars = [
        createBar(100, 97, 99, start + 0),
        createBar(98, 94.9, 95.8, start + 60_000),
      ];

      const history = await analyzeLevelTests('TEST', [level], bars, 99, 'key-3');
      const s1 = history.get('S1_95.00');

      expect(s1).toBeDefined();
      expect(s1?.testsToday).toBe(1);
      expect(s1?.tests[0].result).toBe('held');
      expect(s1?.holdRate).toBe(1);
    });

    it('tracks multiple mixed tests and hold rate', async () => {
      const level = createLevel('PDH', 110);
      const start = Date.now();
      const bars = [
        createBar(110.1, 108, 109, start + 0, 1_100_000),      // held
        createBar(109, 107, 108, start + 60_000, 900_000),
        createBar(110.05, 108.5, 109.2, start + 120_000, 980_000), // held
        createBar(109.4, 108.4, 109, start + 180_000, 920_000),
        createBar(111.4, 109.3, 110.6, start + 300_000, 1_400_000), // broken
      ];

      const history = await analyzeLevelTests('TEST', [level], bars, 109.5, 'key-4');
      const pdh = history.get('PDH_110.00');

      expect(pdh).toBeDefined();
      expect(pdh?.testsToday).toBe(3);
      expect(pdh?.holdRate).toBeCloseTo(2 / 3, 2);
      expect(pdh?.avgVolumeAtTest).toBeGreaterThan(0);
    });

    it('returns cached map when available', async () => {
      const cachedEntries: Array<[string, any]> = [[
        'R2_120.00',
        {
          level: 'R2_120.00',
          levelType: 'R2',
          levelPrice: 120,
          side: 'resistance',
          testsToday: 2,
          tests: [],
          holdRate: 0.5,
          lastTest: '2026-02-10T15:30:00.000Z',
          avgVolumeAtTest: 900000,
        },
      ]];
      mockCacheGet.mockResolvedValue(cachedEntries);

      const history = await analyzeLevelTests(
        'TEST',
        [createLevel('R2', 120)],
        [createBar(120.1, 118, 119, Date.now())],
        119,
        'cache-hit',
      );

      expect(history.get('R2_120.00')?.testsToday).toBe(2);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('derives side from current price when side is not provided', async () => {
      const level: LevelItem = {
        ...createLevel('Derived', 101),
        side: undefined,
      };
      const bars = [createBar(101.05, 100.5, 100.7, Date.now())];

      const history = await analyzeLevelTests('TEST', [level], bars, 100, 'derived-side');

      expect(history.get('Derived_101.00')?.side).toBe('resistance');
    });

    it('debounces adjacent touches into one test event', async () => {
      const level = createLevel('R3', 112);
      const start = Date.now();
      const bars = [
        createBar(112.05, 110, 111.8, start + 0),
        createBar(112.1, 110.5, 111.7, start + 60_000),
        createBar(111.7, 109.5, 110.8, start + 120_000),
      ];

      const history = await analyzeLevelTests('TEST', [level], bars, 111, 'debounce');
      expect(history.get('R3_112.00')?.testsToday).toBe(1);
    });

    it('returns an empty map for untouched levels', async () => {
      const level = createLevel('FarLevel', 150);
      const bars = [
        createBar(110, 108, 109, Date.now()),
        createBar(111, 109, 110, Date.now() + 60_000),
      ];

      const history = await analyzeLevelTests('TEST', [level], bars, 109.5, 'untouched');
      expect(history.size).toBe(0);
    });

    it('handles cache read errors gracefully', async () => {
      mockCacheGet.mockRejectedValueOnce(new Error('redis unavailable'));

      const history = await analyzeLevelTests(
        'TEST',
        [createLevel('R1', 105)],
        [createBar(105.1, 102, 104.6, Date.now())],
        104,
        'cache-read-error',
      );

      expect(history.get('R1_105.00')?.testsToday).toBe(1);
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('falls back to empty map if level serialization fails', async () => {
      const invalidLevel = {
        ...createLevel('Bad', 110),
        type: {
          toString() {
            throw new Error('serialization failed');
          },
        } as unknown as string,
      } as LevelItem;

      const history = await analyzeLevelTests(
        'TEST',
        [invalidLevel],
        [createBar(120, 100, 110, Date.now())],
        110,
        'serialization-error',
      );

      expect(history.size).toBe(0);
      expect(mockLoggerWarn).toHaveBeenCalled();
    });
  });

  describe('formatLevelTestSummary', () => {
    it('formats tested level summary', () => {
      const summary = formatLevelTestSummary({
        level: 'PDH_5950.00',
        levelType: 'PDH',
        levelPrice: 5950,
        side: 'resistance',
        testsToday: 3,
        tests: [],
        holdRate: 1,
        lastTest: '2026-02-10T14:30:00.000Z',
        avgVolumeAtTest: 500000,
      });

      expect(summary).toContain('PDH at $5950.00');
      expect(summary).toContain('tested 3x today');
      expect(summary).toContain('Held 100% of tests');
      expect(summary).toContain('strong level');
    });

    it('formats untested level summary', () => {
      const summary = formatLevelTestSummary({
        level: 'R2_6000.00',
        levelType: 'R2',
        levelPrice: 6000,
        side: 'resistance',
        testsToday: 0,
        tests: [],
        holdRate: 0,
        lastTest: null,
        avgVolumeAtTest: null,
      });

      expect(summary).toContain('has not been tested today');
    });
  });
});
