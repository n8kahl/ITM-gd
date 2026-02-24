import { getMarketStatusLive } from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import { getSPXMarketSessionStatus } from '../marketSessionService';

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
  getMarketStatusLive: jest.fn(),
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetMarketStatusLive = getMarketStatusLive as jest.MockedFunction<typeof getMarketStatusLive>;

describe('spx/marketSessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('returns cached session status when available', async () => {
    mockCacheGet.mockResolvedValue({
      status: 'open',
      market: 'open',
      minuteEt: 610,
      minutesUntilClose: 350,
      sessionProgress: 12,
      source: 'local',
      asOf: '2026-02-20T15:10:00.000Z',
    } as never);

    const status = await getSPXMarketSessionStatus();

    expect(status.status).toBe('open');
    expect(status.source).toBe('cached');
    expect(mockGetMarketStatusLive).not.toHaveBeenCalled();
  });

  it('uses local market-hours state when live mode is disabled', async () => {
    mockCacheGet.mockResolvedValue(null as never);

    const status = await getSPXMarketSessionStatus({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      preferLive: false,
      forceRefresh: true,
    });

    expect(status.status).toBe('open');
    expect(status.source).toBe('local');
    expect(status.minutesUntilClose).toBe(360);
    expect(status.sessionProgress).toBeGreaterThan(0);
    expect(mockGetMarketStatusLive).not.toHaveBeenCalled();
  });

  it('overlays live market status when enabled', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    mockGetMarketStatusLive.mockResolvedValue({ market: 'open' } as never);

    const status = await getSPXMarketSessionStatus({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      preferLive: true,
      forceRefresh: true,
    });

    expect(status.status).toBe('open');
    expect(status.source).toBe('massive');
    expect(mockGetMarketStatusLive).toHaveBeenCalledTimes(1);
  });

  it('falls back to local status when live fetch fails', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    mockGetMarketStatusLive.mockRejectedValue(new Error('network down'));

    const status = await getSPXMarketSessionStatus({
      evaluationDate: new Date('2026-02-20T15:00:00.000Z'),
      preferLive: true,
      forceRefresh: true,
    });

    expect(status.status).toBe('open');
    expect(status.source).toBe('local');
  });
});
