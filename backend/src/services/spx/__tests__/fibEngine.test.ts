import { getFibLevels } from '../fibEngine';
import { getDailyAggregates, getMinuteAggregates } from '../../../config/massive';
import { getBasisState } from '../crossReference';
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

jest.mock('../../../config/massive', () => ({
  getDailyAggregates: jest.fn(),
  getMinuteAggregates: jest.fn(),
}));

jest.mock('../crossReference', () => ({
  getBasisState: jest.fn(),
}));

const mockGetDailyAggregates = getDailyAggregates as jest.MockedFunction<typeof getDailyAggregates>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;
const mockGetBasisState = getBasisState as jest.MockedFunction<typeof getBasisState>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

function bars(startPrice: number): Array<{ o: number; h: number; l: number; c: number; t: number }> {
  const out: Array<{ o: number; h: number; l: number; c: number; t: number }> = [];
  for (let i = 0; i < 60; i += 1) {
    const o = startPrice + i * 0.6;
    out.push({
      o,
      h: o + 2,
      l: o - 2,
      c: o + 0.9,
      t: 1767000000000 + i * 60000,
    });
  }
  return out;
}

describe('spx/fibEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null as never);
    mockCacheSet.mockResolvedValue(undefined as never);

    mockGetDailyAggregates.mockImplementation(async (ticker) => {
      if (ticker === 'SPY') {
        return bars(600.2) as never;
      }
      return bars(6020) as never;
    });

    mockGetMinuteAggregates.mockImplementation(async (ticker) => {
      if (ticker === 'SPY') {
        return bars(600.5) as never;
      }
      return bars(6021) as never;
    });

    mockGetBasisState.mockResolvedValue({
      current: 20,
      trend: 'stable',
      leading: 'neutral',
      ema5: 19.8,
      ema20: 19.4,
      zscore: 0.3,
      spxPrice: 6020,
      spyPrice: 603,
      timestamp: '2026-02-15T14:45:00.000Z',
    });
  });

  it('builds retracement/extension levels and marks cross-validated levels', async () => {
    const levels = await getFibLevels({ forceRefresh: true });

    expect(levels.length).toBeGreaterThan(0);
    expect(levels.some((level) => level.direction === 'retracement')).toBe(true);
    expect(levels.some((level) => level.direction === 'extension')).toBe(true);
    expect(levels.every((level) => typeof level.crossValidated === 'boolean')).toBe(true);

    expect(mockGetBasisState).toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalled();
  });
});
