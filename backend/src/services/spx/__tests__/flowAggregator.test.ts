import { cacheGet, cacheSet } from '../../../config/redis';
import { getFlowEvents } from '../flowEngine';
import {
  computeFlowWindowAggregation,
  createNeutralFlowWindowAggregation,
  deriveFlowWindowSignal,
  getFlowWindowAggregation,
} from '../flowAggregator';
import type { SPXFlowEvent } from '../types';

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

jest.mock('../flowEngine', () => ({
  getFlowEvents: jest.fn(),
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetFlowEvents = getFlowEvents as jest.MockedFunction<typeof getFlowEvents>;

const AS_OF = new Date('2026-02-23T15:30:00.000Z');

function buildFlowEvent(input: Partial<SPXFlowEvent>): SPXFlowEvent {
  return {
    id: input.id || `flow_${Math.random().toString(36).slice(2, 7)}`,
    type: input.type || 'block',
    symbol: input.symbol || 'SPX',
    strike: input.strike ?? 6000,
    expiry: input.expiry || '2026-02-23',
    size: input.size ?? 40,
    direction: input.direction || 'bullish',
    premium: input.premium ?? 100_000,
    timestamp: input.timestamp || AS_OF.toISOString(),
  };
}

describe('spx/flowAggregator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('computes 5m/15m/30m windows with directional scores', () => {
    const events: SPXFlowEvent[] = [
      buildFlowEvent({
        id: 'e1',
        direction: 'bullish',
        type: 'sweep',
        premium: 200_000,
        timestamp: new Date(AS_OF.getTime() - (1 * 60 * 1000)).toISOString(),
      }),
      buildFlowEvent({
        id: 'e2',
        direction: 'bearish',
        type: 'block',
        premium: 100_000,
        timestamp: new Date(AS_OF.getTime() - (3 * 60 * 1000)).toISOString(),
      }),
      buildFlowEvent({
        id: 'e3',
        direction: 'bullish',
        type: 'block',
        premium: 80_000,
        timestamp: new Date(AS_OF.getTime() - (12 * 60 * 1000)).toISOString(),
      }),
      buildFlowEvent({
        id: 'e4',
        direction: 'bearish',
        type: 'sweep',
        premium: 50_000,
        timestamp: new Date(AS_OF.getTime() - (22 * 60 * 1000)).toISOString(),
      }),
    ];

    const aggregation = computeFlowWindowAggregation({
      flowEvents: events,
      asOf: AS_OF,
    });

    expect(aggregation.primaryWindow).toBe('5m');
    expect(aggregation.directionalBias).toBe('bullish');
    expect(aggregation.windows['5m'].eventCount).toBe(2);
    expect(aggregation.windows['15m'].eventCount).toBe(3);
    expect(aggregation.windows['30m'].eventCount).toBe(4);
    expect(aggregation.windows['5m'].flowScore).toBeCloseTo(66.67, 2);
    expect(aggregation.windows['15m'].flowScore).toBeCloseTo(73.68, 2);
    expect(aggregation.windows['30m'].flowScore).toBeCloseTo(65.12, 2);
  });

  it('derives a confirmed directional signal from active windows', () => {
    const aggregation = computeFlowWindowAggregation({
      flowEvents: [
        buildFlowEvent({
          direction: 'bullish',
          type: 'sweep',
          premium: 180_000,
          timestamp: new Date(AS_OF.getTime() - (2 * 60 * 1000)).toISOString(),
        }),
        buildFlowEvent({
          direction: 'bullish',
          type: 'block',
          premium: 120_000,
          timestamp: new Date(AS_OF.getTime() - (4 * 60 * 1000)).toISOString(),
        }),
      ],
      asOf: AS_OF,
    });

    const bullishSignal = deriveFlowWindowSignal({
      aggregation,
      direction: 'bullish',
    });
    const bearishSignal = deriveFlowWindowSignal({
      aggregation,
      direction: 'bearish',
    });

    expect(bullishSignal.confirmed).toBe(true);
    expect(bullishSignal.window).toBe('5m');
    expect((bullishSignal.alignmentPct || 0)).toBeGreaterThanOrEqual(58);
    expect(bearishSignal.confirmed).toBe(false);
  });

  it('returns cached flow windows when present', async () => {
    mockCacheGet.mockResolvedValue(createNeutralFlowWindowAggregation(AS_OF) as never);

    const aggregation = await getFlowWindowAggregation();

    expect(aggregation.source).toBe('cached');
    expect(mockGetFlowEvents).not.toHaveBeenCalled();
  });

  it('computes and caches aggregation when cache is empty', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    mockGetFlowEvents.mockResolvedValue([
      buildFlowEvent({
        direction: 'bullish',
        type: 'sweep',
        premium: 200_000,
        timestamp: new Date(AS_OF.getTime() - (2 * 60 * 1000)).toISOString(),
      }),
    ] as never);

    const aggregation = await getFlowWindowAggregation({
      forceRefresh: true,
      asOf: AS_OF,
    });

    expect(aggregation.source).toBe('computed');
    expect(mockGetFlowEvents).toHaveBeenCalledTimes(1);
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });

  it('falls back to cached aggregation when flow fetch fails', async () => {
    const cached = createNeutralFlowWindowAggregation(AS_OF);
    mockCacheGet
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(cached as never);
    mockGetFlowEvents.mockRejectedValue(new Error('flow feed down'));

    const aggregation = await getFlowWindowAggregation({
      asOf: AS_OF,
    });

    expect(aggregation.source).toBe('cached');
    expect(aggregation.generatedAt).toBe(cached.generatedAt);
  });
});
