import {
  getAggregates,
  getMinuteAggregates,
  type MassiveAggregate,
  type MassiveAggregatesResponse,
} from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import { classifyCurrentRegime } from '../regimeClassifier';
import { computeUnifiedGEXLandscape } from '../gexEngine';
import { getMergedLevels } from '../levelEngine';
import type { ClusterZone, RegimeState, UnifiedGEXLandscape } from '../types';

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/massive', () => ({
  getAggregates: jest.fn(),
  getMinuteAggregates: jest.fn(),
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../gexEngine', () => ({
  computeUnifiedGEXLandscape: jest.fn(),
}));

jest.mock('../levelEngine', () => ({
  getMergedLevels: jest.fn(),
}));

interface MassiveBarValidationOptions {
  expectedCount?: number;
  timespan?: string;
}

interface MassiveBarValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  gapCount: number;
  duplicateCount: number;
}

const mockGetAggregates = getAggregates as jest.MockedFunction<typeof getAggregates>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockComputeUnifiedGEXLandscape = computeUnifiedGEXLandscape as jest.MockedFunction<typeof computeUnifiedGEXLandscape>;
const mockGetMergedLevels = getMergedLevels as jest.MockedFunction<typeof getMergedLevels>;

const REGULAR_SESSION_DATE = '2026-01-15';
const EARLY_CLOSE_DATE = '2025-11-28';

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function toEtTimestampMs(date: string, hour: number, minute: number, second = 0): number {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return Date.parse(`${date}T${hh}:${mm}:${ss}.000-05:00`);
}

function createMinuteBars(input?: {
  date?: string;
  count?: number;
  startHour?: number;
  startMinute?: number;
  basePrice?: number;
}): MassiveAggregate[] {
  const date = input?.date ?? REGULAR_SESSION_DATE;
  const count = input?.count ?? 390;
  const startHour = input?.startHour ?? 9;
  const startMinute = input?.startMinute ?? 30;
  const basePrice = input?.basePrice ?? 5988;

  let priorClose = basePrice;

  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = (startHour * 60) + startMinute + index;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const open = roundPrice(priorClose + (Math.sin(index / 19) * 0.35));
    const close = roundPrice(open + (Math.cos(index / 17) * 0.45));
    const high = roundPrice(Math.max(open, close) + 0.4 + (Math.abs(Math.sin(index / 7)) * 0.65));
    const low = roundPrice(Math.min(open, close) - 0.35 - (Math.abs(Math.cos(index / 9)) * 0.55));
    const volume = 1_200_000 + Math.round(Math.abs(Math.sin(index / 8)) * 900_000);

    priorClose = close;

    return {
      o: open,
      h: high,
      l: low,
      c: close,
      v: volume,
      t: toEtTimestampMs(date, hour, minute),
      vw: roundPrice((open + high + low + close) / 4),
      n: 1900 + ((index % 40) * 25),
    };
  });
}

function createSecondBars(input?: {
  date?: string;
  hour?: number;
  minute?: number;
  count?: number;
  lowBound?: number;
  highBound?: number;
}): MassiveAggregate[] {
  const date = input?.date ?? REGULAR_SESSION_DATE;
  const hour = input?.hour ?? 10;
  const minute = input?.minute ?? 15;
  const count = input?.count ?? 60;
  const lowBound = input?.lowBound ?? 5988.2;
  const highBound = input?.highBound ?? 5994.6;

  let priorClose = roundPrice((lowBound + highBound) / 2);

  return Array.from({ length: count }, (_, second) => {
    const open = priorClose;
    const drift = Math.sin(second / 6) * 0.08;
    const unclampedClose = roundPrice(open + drift);
    const close = Math.min(highBound - 0.05, Math.max(lowBound + 0.05, unclampedClose));

    let high = roundPrice(Math.min(
      highBound,
      Math.max(open, close) + 0.06 + (Math.abs(Math.sin(second / 8)) * 0.04),
    ));
    let low = roundPrice(Math.max(
      lowBound,
      Math.min(open, close) - 0.06 - (Math.abs(Math.cos(second / 10)) * 0.04),
    ));

    if (high < Math.max(open, close)) high = roundPrice(Math.max(open, close));
    if (low > Math.min(open, close)) low = roundPrice(Math.min(open, close));

    priorClose = roundPrice(close);

    return {
      o: roundPrice(open),
      h: high,
      l: low,
      c: roundPrice(close),
      v: 10_000 + ((second % 15) * 700),
      t: toEtTimestampMs(date, hour, minute, second),
      vw: roundPrice((open + high + low + close) / 4),
      n: 40 + ((second % 12) * 3),
    };
  });
}

function createAggregatesResponse(bars: MassiveAggregate[]): MassiveAggregatesResponse {
  return {
    ticker: 'I:SPX',
    queryCount: bars.length,
    resultsCount: bars.length,
    adjusted: true,
    results: bars,
    status: 'OK',
    request_id: 'test-request',
    count: bars.length,
  };
}

function toStepMs(timespan?: string): number | null {
  if (!timespan) return null;

  const normalized = timespan.toLowerCase();
  if (normalized === 'second') return 1_000;
  if (normalized === 'minute') return 60_000;
  if (normalized === 'hour') return 3_600_000;
  if (normalized === 'day') return 86_400_000;
  return null;
}

function validateMassiveBars(
  bars: MassiveAggregate[],
  options?: MassiveBarValidationOptions,
): MassiveBarValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stepMs = toStepMs(options?.timespan);

  let gapCount = 0;
  let duplicateCount = 0;
  let previousTimestamp: number | null = null;

  if (typeof options?.expectedCount === 'number' && bars.length !== options.expectedCount) {
    errors.push(`Expected ${options.expectedCount} bars, received ${bars.length}.`);
  }

  if (bars.length === 0) {
    warnings.push('No bars were provided for validation.');
  }

  bars.forEach((bar, index) => {
    const requiredFields: Array<keyof MassiveAggregate> = ['o', 'h', 'l', 'c', 'v', 't', 'vw', 'n'];

    requiredFields.forEach((fieldName) => {
      const value = bar[fieldName];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`Bar ${index} missing required numeric field: ${fieldName}.`);
      }
    });

    if (typeof bar.h === 'number' && typeof bar.o === 'number' && typeof bar.c === 'number') {
      if (bar.h < bar.o || bar.h < bar.c) {
        errors.push(`Bar ${index} high is not >= open/close.`);
      }
    }

    if (typeof bar.l === 'number' && typeof bar.o === 'number' && typeof bar.c === 'number') {
      if (bar.l > bar.o || bar.l > bar.c) {
        errors.push(`Bar ${index} low is not <= open/close.`);
      }
    }

    if (typeof bar.h === 'number' && typeof bar.l === 'number' && bar.h < bar.l) {
      errors.push(`Bar ${index} has negative spread (h < l).`);
    }

    if (typeof bar.v === 'number') {
      if (bar.v < 0) {
        errors.push(`Bar ${index} volume is negative.`);
      }
      if (bar.v === 0) {
        warnings.push(`Bar ${index} has zero volume.`);
      }
    }

    if (typeof bar.n === 'number' && bar.n < 0) {
      errors.push(`Bar ${index} trade count n is negative.`);
    }

    if (typeof bar.t === 'number' && Number.isFinite(bar.t)) {
      if (!Number.isInteger(bar.t)) {
        errors.push(`Bar ${index} timestamp is not a millisecond integer.`);
      }

      if (bar.t < 946684800000 || bar.t > 4102444800000) {
        errors.push(`Bar ${index} timestamp is outside valid Unix millisecond range.`);
      }

      if (previousTimestamp !== null) {
        if (bar.t < previousTimestamp) {
          errors.push(`Bar ${index} is not sorted by timestamp ascending.`);
        } else if (bar.t === previousTimestamp) {
          duplicateCount += 1;
          errors.push(`Duplicate timestamp detected at bar ${index}.`);
        } else if (stepMs != null) {
          const steps = Math.round((bar.t - previousTimestamp) / stepMs);
          if (steps > 1) {
            const missing = steps - 1;
            gapCount += missing;
            errors.push(`Gap detected before bar ${index}: ${missing} missing ${options?.timespan ?? 'interval'} bars.`);
          }
        }
      }

      previousTimestamp = bar.t;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    gapCount,
    duplicateCount,
  };
}

function buildCluster(spot: number): ClusterZone {
  return {
    id: `cluster-${spot}`,
    priceLow: roundPrice(spot - 1.8),
    priceHigh: roundPrice(spot + 1.8),
    clusterScore: 4,
    type: 'defended',
    sources: [{ source: 'vwap', category: 'intraday', price: spot, instrument: 'SPX' }],
    testCount: 3,
    lastTestAt: '2026-01-15T15:20:00.000Z',
    held: true,
    holdRate: 70,
  };
}

function buildGexLandscape(input?: {
  spotPrice?: number;
  netGex?: number;
  flipPoint?: number;
}): UnifiedGEXLandscape {
  const spotPrice = input?.spotPrice ?? 5990;
  const netGex = input?.netGex ?? 45_000;
  const flipPoint = input?.flipPoint ?? 5988;

  return {
    spx: {
      symbol: 'SPX',
      spotPrice,
      netGex,
      flipPoint,
      callWall: roundPrice(spotPrice + 14),
      putWall: roundPrice(spotPrice - 14),
      zeroGamma: flipPoint,
      gexByStrike: [
        { strike: roundPrice(spotPrice - 10), gex: roundPrice(netGex * 0.4) },
        { strike: roundPrice(spotPrice), gex: roundPrice(netGex * 0.2) },
        { strike: roundPrice(spotPrice + 10), gex: roundPrice(netGex * 0.4) },
      ],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-01-15T15:30:00.000Z',
    },
    spy: {
      symbol: 'SPY',
      spotPrice: roundPrice(spotPrice / 10),
      netGex: roundPrice(netGex * 0.25),
      flipPoint: roundPrice(flipPoint / 10),
      callWall: roundPrice((spotPrice / 10) + 1.4),
      putWall: roundPrice((spotPrice / 10) - 1.4),
      zeroGamma: roundPrice(flipPoint / 10),
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-01-15T15:30:00.000Z',
    },
    combined: {
      symbol: 'COMBINED',
      spotPrice,
      netGex: roundPrice(netGex * 1.2),
      flipPoint,
      callWall: roundPrice(spotPrice + 13),
      putWall: roundPrice(spotPrice - 13),
      zeroGamma: flipPoint,
      gexByStrike: [],
      keyLevels: [],
      expirationBreakdown: {},
      timestamp: '2026-01-15T15:30:00.000Z',
    },
  };
}

function buildLevelData(spot: number): {
  levels: [];
  clusters: ClusterZone[];
  generatedAt: string;
} {
  return {
    levels: [],
    clusters: [buildCluster(spot)],
    generatedAt: '2026-01-15T15:30:00.000Z',
  };
}

function assertValidRegimeState(state: RegimeState): void {
  expect(['trending', 'ranging', 'compression', 'breakout']).toContain(state.regime);
  expect(['bullish', 'bearish', 'neutral']).toContain(state.direction);
  expect(Number.isFinite(state.probability)).toBe(true);
  expect(Number.isFinite(state.confidence)).toBe(true);
  expect(['small', 'medium', 'large']).toContain(state.magnitude);
  expect(typeof state.timestamp).toBe('string');
}

describe('spx/massive data validation - Group 1: bar structure validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
    mockComputeUnifiedGEXLandscape.mockResolvedValue(buildGexLandscape() as never);
    mockGetMergedLevels.mockResolvedValue(buildLevelData(5990) as never);
  });

  it('validates required fields and OHLC/volume/timestamp invariants from mocked aggregates', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 30 });
    mockGetAggregates.mockResolvedValueOnce(createAggregatesResponse(bars) as never);

    const response = await getAggregates('I:SPX', 1, 'minute', REGULAR_SESSION_DATE, REGULAR_SESSION_DATE);

    const requestedStart = toEtTimestampMs(REGULAR_SESSION_DATE, 9, 30, 0);
    const requestedEnd = toEtTimestampMs(REGULAR_SESSION_DATE, 16, 0, 0);

    expect(response.results).toHaveLength(30);

    response.results.forEach((bar) => {
      expect(typeof bar.o).toBe('number');
      expect(typeof bar.h).toBe('number');
      expect(typeof bar.l).toBe('number');
      expect(typeof bar.c).toBe('number');
      expect(typeof bar.v).toBe('number');
      expect(typeof bar.t).toBe('number');
      expect(typeof bar.vw).toBe('number');
      expect(typeof bar.n).toBe('number');

      expect(bar.h).toBeGreaterThanOrEqual(bar.o);
      expect(bar.h).toBeGreaterThanOrEqual(bar.c);
      expect(bar.l).toBeLessThanOrEqual(bar.o);
      expect(bar.l).toBeLessThanOrEqual(bar.c);
      expect(bar.h).toBeGreaterThanOrEqual(bar.l);
      expect(bar.v).toBeGreaterThanOrEqual(0);
      expect(bar.t).toBeGreaterThanOrEqual(requestedStart);
      expect(bar.t).toBeLessThanOrEqual(requestedEnd);
    });
  });

  it('flags zero-volume bars during regular market hours', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 20 });
    bars[10] = {
      ...bars[10],
      v: 0,
    };

    mockGetAggregates.mockResolvedValueOnce(createAggregatesResponse(bars) as never);

    const response = await getAggregates('I:SPX', 1, 'minute', REGULAR_SESSION_DATE, REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(response.results, { expectedCount: 20, timespan: 'minute' });

    expect(response.results.filter((bar) => bar.v === 0)).toHaveLength(1);
    expect(validation.warnings.some((warning) => warning.includes('zero volume'))).toBe(true);
  });
});

describe('spx/massive data validation - Group 2: minute bar completeness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('confirms a regular session contains exactly 390 minute bars', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 });
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(result, { expectedCount: 390, timespan: 'minute' });

    expect(result).toHaveLength(390);
    expect(validation.valid).toBe(true);
    expect(validation.gapCount).toBe(0);
    expect(validation.duplicateCount).toBe(0);
  });

  it('detects timestamp gaps when minutes are missing', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 }).filter((_, index) => index !== 46 && index !== 47);
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(result, { expectedCount: 390, timespan: 'minute' });

    expect(validation.valid).toBe(false);
    expect(validation.gapCount).toBeGreaterThanOrEqual(2);
    expect(validation.errors.some((error) => error.includes('Gap detected'))).toBe(true);
  });

  it('detects duplicate minute-bar timestamps', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 });
    bars.splice(120, 0, { ...bars[120] });
    bars.pop();
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(result, { expectedCount: 390, timespan: 'minute' });

    expect(validation.valid).toBe(false);
    expect(validation.duplicateCount).toBe(1);
    expect(validation.errors.some((error) => error.includes('Duplicate timestamp'))).toBe(true);
  });

  it('flags unsorted minute bars when timestamps are out of order', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 });
    [bars[100], bars[101]] = [bars[101], bars[100]];
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(result, { expectedCount: 390, timespan: 'minute' });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes('not sorted by timestamp'))).toBe(true);
  });

  it('verifies first minute bar starts within 60 seconds of 09:30 ET', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 });
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', REGULAR_SESSION_DATE);
    const expectedOpenTs = toEtTimestampMs(REGULAR_SESSION_DATE, 9, 30, 0);

    expect(Math.abs(result[0].t - expectedOpenTs)).toBeLessThanOrEqual(60_000);
  });

  it('verifies last minute bar is within 60 seconds of 15:59 ET', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 });
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', REGULAR_SESSION_DATE);
    const expectedLastBarTs = toEtTimestampMs(REGULAR_SESSION_DATE, 15, 59, 0);
    const lastBar = result[result.length - 1];

    expect(Math.abs(lastBar.t - expectedLastBarTs)).toBeLessThanOrEqual(60_000);
  });

  it('handles early-close sessions with ~210 bars ending near 13:00 ET', async () => {
    const bars = createMinuteBars({ date: EARLY_CLOSE_DATE, count: 210 });
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const result = await getMinuteAggregates('I:SPX', EARLY_CLOSE_DATE);
    const validation = validateMassiveBars(result, { expectedCount: 210, timespan: 'minute' });
    const expectedCloseTs = toEtTimestampMs(EARLY_CLOSE_DATE, 13, 0, 0);
    const lastBar = result[result.length - 1];

    expect(result.length).toBeGreaterThanOrEqual(205);
    expect(result.length).toBeLessThanOrEqual(215);
    expect(validation.valid).toBe(true);
    expect(Math.abs(lastBar.t - expectedCloseTs)).toBeLessThanOrEqual(60_000);
  });
});

describe('spx/massive data validation - Group 3: second-level bars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expects ~60 second bars per minute window (allow 50-70)', async () => {
    const bars = createSecondBars({ date: REGULAR_SESSION_DATE, count: 60 });
    mockGetAggregates.mockResolvedValueOnce(createAggregatesResponse(bars) as never);

    const response = await getAggregates('I:SPX', 1, 'second', REGULAR_SESSION_DATE, REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(response.results, { timespan: 'second' });

    expect(response.results.length).toBeGreaterThanOrEqual(50);
    expect(response.results.length).toBeLessThanOrEqual(70);
    expect(validation.valid).toBe(true);
  });

  it('ensures second-level bar timestamps are monotonically increasing', async () => {
    const bars = createSecondBars({ date: REGULAR_SESSION_DATE, count: 60 });
    mockGetAggregates.mockResolvedValueOnce(createAggregatesResponse(bars) as never);

    const response = await getAggregates('I:SPX', 1, 'second', REGULAR_SESSION_DATE, REGULAR_SESSION_DATE);
    const secondBars = response.results;

    for (let index = 1; index < secondBars.length; index += 1) {
      expect(secondBars[index].t).toBeGreaterThan(secondBars[index - 1].t);
    }
  });

  it('validates second-level bars stay within an enclosing minute high/low range', async () => {
    const minuteLow = 5988.2;
    const minuteHigh = 5994.6;
    const bars = createSecondBars({
      date: REGULAR_SESSION_DATE,
      count: 60,
      lowBound: minuteLow,
      highBound: minuteHigh,
    });
    mockGetAggregates.mockResolvedValueOnce(createAggregatesResponse(bars) as never);

    const response = await getAggregates('I:SPX', 1, 'second', REGULAR_SESSION_DATE, REGULAR_SESSION_DATE);
    const secondBars = response.results;

    secondBars.forEach((bar) => {
      expect(bar.h).toBeLessThanOrEqual(minuteHigh);
      expect(bar.l).toBeGreaterThanOrEqual(minuteLow);
      expect(bar.o).toBeGreaterThanOrEqual(minuteLow);
      expect(bar.c).toBeLessThanOrEqual(minuteHigh);
    });
  });

  it('flags no negative spreads in second-level bars', async () => {
    const bars = createSecondBars({ date: REGULAR_SESSION_DATE, count: 60 });
    mockGetAggregates.mockResolvedValueOnce(createAggregatesResponse(bars) as never);

    const response = await getAggregates('I:SPX', 1, 'second', REGULAR_SESSION_DATE, REGULAR_SESSION_DATE);
    const validation = validateMassiveBars(response.results, { timespan: 'second' });

    expect(response.results.some((bar) => bar.h < bar.l)).toBe(false);
    expect(validation.errors.some((error) => error.includes('negative spread'))).toBe(false);
  });
});

describe('spx/massive data validation - Group 4: pipeline integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
    mockComputeUnifiedGEXLandscape.mockResolvedValue(buildGexLandscape() as never);
    mockGetMergedLevels.mockResolvedValue(buildLevelData(5990) as never);
  });

  it('classifyCurrentRegime consumes well-formed mocked minute bars end-to-end', async () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 });
    const validation = validateMassiveBars(bars, { expectedCount: 390, timespan: 'minute' });
    mockGetMinuteAggregates.mockResolvedValueOnce(bars as never);

    const state = await classifyCurrentRegime({
      forceRefresh: true,
      gexLandscape: buildGexLandscape({
        spotPrice: 5994,
        netGex: -120_000,
        flipPoint: 5991,
      }),
      levelData: buildLevelData(5994),
    });

    expect(validation.valid).toBe(true);
    expect(mockGetMinuteAggregates).toHaveBeenCalledWith('I:SPX', expect.any(String));
    assertValidRegimeState(state);
  });

  it('falls back gracefully with empty minute bars and returns low-confidence regime', async () => {
    mockGetMinuteAggregates.mockResolvedValueOnce([] as never);

    const emptyValidation = validateMassiveBars([], { expectedCount: 390, timespan: 'minute' });
    const state = await classifyCurrentRegime({
      forceRefresh: true,
      gexLandscape: buildGexLandscape({
        spotPrice: 6000,
        netGex: 95_000,
        flipPoint: 6000,
      }),
      levelData: buildLevelData(6000),
    });

    expect(emptyValidation.valid).toBe(false);
    expect(state.regime).toBe('compression');
    expect(state.confidence).toBeLessThanOrEqual(35);
    assertValidRegimeState(state);
  });

  it('keeps outputs finite when upstream minute bars contain gaps', async () => {
    const gappedBars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 390 })
      .filter((_, index) => index !== 46 && index !== 47);
    const validation = validateMassiveBars(gappedBars, { expectedCount: 390, timespan: 'minute' });
    mockGetMinuteAggregates.mockResolvedValueOnce(gappedBars as never);

    const state = await classifyCurrentRegime({
      forceRefresh: true,
      gexLandscape: buildGexLandscape({
        spotPrice: 5993,
        netGex: -80_000,
        flipPoint: 5989,
      }),
      levelData: buildLevelData(5993),
    });

    expect(validation.valid).toBe(false);
    expect(validation.gapCount).toBeGreaterThanOrEqual(2);
    expect(Number.isNaN(state.probability)).toBe(false);
    expect(Number.isNaN(state.confidence)).toBe(false);
    expect(state.probability).not.toBeNull();
    expect(state.confidence).not.toBeNull();
    assertValidRegimeState(state);
  });
});

describe('spx/massive data validation - Group 5: validateMassiveBars utility', () => {
  it('returns a valid result for complete, continuous bars', () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 12 });
    const result = validateMassiveBars(bars, { expectedCount: 12, timespan: 'minute' });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.gapCount).toBe(0);
    expect(result.duplicateCount).toBe(0);
  });

  it('captures completeness, structure, gap, and duplicate failures', () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 6 });

    const malformedBar = {
      ...bars[2],
      h: roundPrice(bars[2].l - 0.5),
      v: -10,
      vw: undefined,
      n: undefined,
    } as MassiveAggregate;

    const broken = [
      bars[0],
      bars[1],
      bars[1],
      malformedBar,
      bars[5],
    ];

    const result = validateMassiveBars(broken, { expectedCount: 6, timespan: 'minute' });

    expect(result.valid).toBe(false);
    expect(result.duplicateCount).toBe(1);
    expect(result.gapCount).toBeGreaterThanOrEqual(2);
    expect(result.errors.some((error) => error.includes('Expected 6 bars'))).toBe(true);
    expect(result.errors.some((error) => error.includes('missing required numeric field: vw'))).toBe(true);
    expect(result.errors.some((error) => error.includes('missing required numeric field: n'))).toBe(true);
    expect(result.errors.some((error) => error.includes('volume is negative'))).toBe(true);
    expect(result.errors.some((error) => error.includes('negative spread'))).toBe(true);
  });

  it('emits warnings for zero-volume bars while preserving structural validity', () => {
    const bars = createMinuteBars({ date: REGULAR_SESSION_DATE, count: 8 });
    bars[3] = {
      ...bars[3],
      v: 0,
    };

    const result = validateMassiveBars(bars, { expectedCount: 8, timespan: 'minute' });

    expect(result.valid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('zero volume'))).toBe(true);
  });
});
