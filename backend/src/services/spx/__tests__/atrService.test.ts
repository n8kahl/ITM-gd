import { cacheGet, cacheSet } from '../../../config/redis';
import { getMinuteAggregates } from '../../../config/massive';
import { calculateAtrFromBars, getIntradayAtr } from '../atrService';

jest.mock('../../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../../config/massive', () => ({
  getMinuteAggregates: jest.fn(),
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

function makeBars(count: number): Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> {
  return Array.from({ length: count }, (_, index) => ({
    t: 1_700_000_000_000 + index * 60_000,
    o: 100 + index * 0.1,
    h: 102 + index * 0.1,
    l: 100 + index * 0.1,
    c: 101 + index * 0.1,
    v: 1000 + index,
  }));
}

describe('spx/atrService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('calculates ATR from bars using true-range average', () => {
    const bars = makeBars(15);
    const atr = calculateAtrFromBars(bars, 14);
    expect(atr).toBe(2);
  });

  it('returns null when there are not enough bars', () => {
    const atr = calculateAtrFromBars(makeBars(8), 14);
    expect(atr).toBeNull();
  });

  it('uses cached ATR before fetching minute aggregates', async () => {
    mockCacheGet.mockResolvedValue(1.75 as never);

    const atr = await getIntradayAtr({
      ticker: 'I:SPX',
      date: '2026-02-23',
    });

    expect(atr).toBe(1.75);
    expect(mockGetMinuteAggregates).not.toHaveBeenCalled();
  });

  it('fetches minute bars and caches ATR on cache miss', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    mockGetMinuteAggregates.mockResolvedValue(makeBars(30) as never);

    const atr = await getIntradayAtr({
      ticker: 'I:SPX',
      date: '2026-02-23',
      period: 14,
      forceRefresh: true,
    });

    expect(atr).toBe(2);
    expect(mockGetMinuteAggregates).toHaveBeenCalledWith('I:SPX', '2026-02-23');
    expect(mockCacheSet).toHaveBeenCalled();
  });
});
