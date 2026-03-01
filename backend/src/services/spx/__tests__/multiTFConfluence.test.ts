import { getAggregates, type MassiveAggregate } from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import {
  getMultiTFConfluenceContext,
  scoreMultiTFConfluence,
  type SPXMultiTFConfluenceContext,
} from '../multiTFConfluence';

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
}));

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

const mockGetAggregates = getAggregates as jest.MockedFunction<typeof getAggregates>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

function buildAggregateSeries(input: {
  startMs: number;
  count: number;
  stepMs: number;
  base: number;
}): MassiveAggregate[] {
  return Array.from({ length: input.count }, (_, index) => {
    const close = input.base + (index * 0.5);
    return {
      o: close - 0.2,
      h: close + 0.3,
      l: close - 0.4,
      c: close,
      v: 1000 + (index * 3),
      t: input.startMs + (index * input.stepMs),
    };
  });
}

function mockAggregatesResponse(results: MassiveAggregate[]): ReturnType<typeof getAggregates> {
  return Promise.resolve({
    ticker: 'I:SPX',
    queryCount: results.length,
    resultsCount: results.length,
    adjusted: true,
    results,
    status: 'OK',
    request_id: 'req_test_multi_tf',
    count: results.length,
  });
}

function buildContext(overrides?: Partial<SPXMultiTFConfluenceContext>): SPXMultiTFConfluenceContext {
  return {
    asOf: '2026-02-20T15:30:00.000Z',
    source: 'computed',
    tf1m: {
      timeframe: '1m',
      ema21: 6012,
      emaReliable: true,
      ema55: 6008,
      slope21: 1.2,
      latestClose: 6013,
      trend: 'up',
      swingHigh: 6016,
      swingLow: 6006,
      bars: [],
    },
    tf5m: {
      timeframe: '5m',
      ema21: 6015,
      emaReliable: true,
      ema55: 6007,
      slope21: 1.5,
      latestClose: 6018,
      trend: 'up',
      swingHigh: 6022,
      swingLow: 6001,
      bars: [],
    },
    tf15m: {
      timeframe: '15m',
      ema21: 6017,
      emaReliable: true,
      ema55: 6004,
      slope21: 1.1,
      latestClose: 6019,
      trend: 'up',
      swingHigh: 6024,
      swingLow: 5998,
      bars: [],
    },
    tf1h: {
      timeframe: '1h',
      ema21: 6020,
      emaReliable: true,
      ema55: 6002,
      slope21: 0.9,
      latestClose: 6022,
      trend: 'up',
      swingHigh: 6030,
      swingLow: 5985,
      bars: [],
    },
    ...overrides,
  };
}

describe('spx/multiTFConfluence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('loads 1h confluence bars from a multi-day lookback window', async () => {
    const evaluationDate = new Date('2026-03-02T16:00:00.000Z');
    const baseMs = Date.parse('2026-03-02T14:30:00.000Z');

    mockGetAggregates
      .mockImplementationOnce(() => mockAggregatesResponse(buildAggregateSeries({
        startMs: baseMs,
        count: 60,
        stepMs: 60_000,
        base: 6000,
      })))
      .mockImplementationOnce(() => mockAggregatesResponse(buildAggregateSeries({
        startMs: baseMs - (5 * 60_000 * 60),
        count: 30,
        stepMs: 5 * 60_000,
        base: 6002,
      })))
      .mockImplementationOnce(() => mockAggregatesResponse(buildAggregateSeries({
        startMs: baseMs - (15 * 60_000 * 30),
        count: 24,
        stepMs: 15 * 60_000,
        base: 6004,
      })))
      .mockImplementationOnce(() => mockAggregatesResponse(buildAggregateSeries({
        startMs: baseMs - (60 * 60_000 * 30),
        count: 30,
        stepMs: 60 * 60_000,
        base: 6010,
      })));

    const context = await getMultiTFConfluenceContext({
      forceRefresh: true,
      evaluationDate,
    });

    expect(mockGetAggregates).toHaveBeenCalledTimes(4);
    expect(mockGetAggregates).toHaveBeenNthCalledWith(1, 'I:SPX', 1, 'minute', '2026-03-02', '2026-03-02');
    expect(mockGetAggregates).toHaveBeenNthCalledWith(2, 'I:SPX', 5, 'minute', '2026-03-02', '2026-03-02');
    expect(mockGetAggregates).toHaveBeenNthCalledWith(3, 'I:SPX', 15, 'minute', '2026-03-02', '2026-03-02');
    expect(mockGetAggregates).toHaveBeenNthCalledWith(4, 'I:SPX', 60, 'minute', '2026-02-23', '2026-03-02');
    expect(context.source).toBe('computed');
    expect(context.tf1h.emaReliable).toBe(true);
    expect(context.tf1h.bars.length).toBeGreaterThanOrEqual(21);
  });

  it('scores aligned bullish context as high quality', () => {
    const context = buildContext();
    const score = scoreMultiTFConfluence({
      context,
      direction: 'bullish',
      currentPrice: 6021,
    });

    expect(score.aligned).toBe(true);
    expect(score.composite).toBeGreaterThanOrEqual(60);
    expect(score.tf1hStructureAligned).toBeGreaterThanOrEqual(20);
    expect(score.tf5mMomentumAlignment).toBeGreaterThanOrEqual(12);
  });

  it('scores misaligned bearish context as weak', () => {
    const context = buildContext();
    const score = scoreMultiTFConfluence({
      context,
      direction: 'bearish',
      currentPrice: 6021,
    });

    expect(score.aligned).toBe(false);
    expect(score.composite).toBeLessThan(60);
    expect(score.tf1hStructureAligned).toBeLessThanOrEqual(11);
  });

  it('returns neutral fallback score when context is unavailable', () => {
    const score = scoreMultiTFConfluence({
      context: null,
      direction: 'bullish',
      currentPrice: 6000,
    });

    expect(score.aligned).toBe(false);
    expect(score.composite).toBe(24);
    expect(score.tf1mMicrostructure).toBe(4);
  });
});
