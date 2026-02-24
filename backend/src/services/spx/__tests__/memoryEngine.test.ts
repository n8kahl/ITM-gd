const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockLt = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

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

jest.mock('../../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { cacheGet, cacheSet } from '../../../config/redis';
import { getLevelMemoryContext } from '../memoryEngine';

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

function wireSupabaseResponse(response: { data: unknown; error: { message: string } | null }) {
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq
    .mockReturnValueOnce({ eq: mockEq })
    .mockReturnValueOnce({ lt: mockLt });
  mockLt.mockReturnValue({ order: mockOrder });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue(response);
}

describe('spx/memoryEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('returns cached memory context when available', async () => {
    mockCacheGet.mockResolvedValue({
      tests: 4,
      resolved: 3,
      wins: 2,
      losses: 1,
      winRatePct: 66.67,
      confidence: 0.5,
      score: 58.3,
      lookbackSessions: 5,
      tolerancePoints: 2.5,
    } as never);

    const result = await getLevelMemoryContext({
      sessionDate: '2026-02-23',
      setupType: 'mean_reversion',
      direction: 'bullish',
      entryMid: 6001,
    });

    expect(result.score).toBe(58.3);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('computes memory stats from setup-instance history', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    wireSupabaseResponse({
      data: [
        {
          session_date: '2026-02-22',
          entry_zone_low: 6000,
          entry_zone_high: 6002,
          final_outcome: 't1_before_stop',
          triggered_at: '2026-02-22T14:00:00.000Z',
        },
        {
          session_date: '2026-02-21',
          entry_zone_low: 6001,
          entry_zone_high: 6003,
          final_outcome: 't2_before_stop',
          triggered_at: '2026-02-21T14:10:00.000Z',
        },
        {
          session_date: '2026-02-20',
          entry_zone_low: 5999,
          entry_zone_high: 6001,
          final_outcome: 'stop_before_t1',
          triggered_at: '2026-02-20T13:40:00.000Z',
        },
        {
          session_date: '2026-02-20',
          entry_zone_low: 5988,
          entry_zone_high: 5990,
          final_outcome: 'stop_before_t1',
          triggered_at: '2026-02-20T13:40:00.000Z',
        },
      ],
      error: null,
    });

    const result = await getLevelMemoryContext({
      sessionDate: '2026-02-23',
      setupType: 'mean_reversion',
      direction: 'bullish',
      entryMid: 6001,
      lookbackSessions: 5,
      tolerancePoints: 2.5,
    });

    expect(result.tests).toBe(3);
    expect(result.resolved).toBe(3);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.winRatePct).toBeCloseTo(66.67, 2);
    expect(result.score).toBeGreaterThan(50);
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });

  it('returns neutral context when query fails', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    wireSupabaseResponse({
      data: null,
      error: { message: 'table missing' },
    });

    const result = await getLevelMemoryContext({
      sessionDate: '2026-02-23',
      setupType: 'trend_pullback',
      direction: 'bearish',
      entryMid: 6010,
    });

    expect(result.score).toBe(50);
    expect(result.tests).toBe(0);
    expect(result.winRatePct).toBeNull();
  });
});
