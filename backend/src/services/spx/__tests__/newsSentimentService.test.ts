import { getTickerNews } from '../../../config/massive';
import { cacheGet, cacheSet } from '../../../config/redis';
import { getSPXNewsSentiment } from '../newsSentimentService';

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
  getTickerNews: jest.fn(),
}));

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetTickerNews = getTickerNews as jest.MockedFunction<typeof getTickerNews>;

describe('spx/newsSentimentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined as never);
  });

  it('returns cached sentiment when available', async () => {
    mockCacheGet.mockResolvedValue({
      generatedAt: '2026-02-20T15:00:00.000Z',
      source: 'computed',
      bias: 'neutral',
      score: 0,
      marketMovingCount: 0,
      recentHighImpactCount: 0,
      latestPublishedAt: null,
      articles: [],
    } as never);

    const snapshot = await getSPXNewsSentiment();

    expect(snapshot.source).toBe('cached');
    expect(mockGetTickerNews).not.toHaveBeenCalled();
  });

  it('computes bullish sentiment from positive headlines', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    mockGetTickerNews
      .mockResolvedValueOnce([
        {
          id: 'n1',
          title: 'SPY rally after cooling inflation print',
          published_utc: '2026-02-20T14:50:00.000Z',
          article_url: 'https://example.com/n1',
          publisher: { name: 'Wire' },
          keywords: ['inflation', 'rally'],
          tickers: ['SPY'],
        } as never,
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const snapshot = await getSPXNewsSentiment({
      forceRefresh: true,
      asOf: new Date('2026-02-20T15:00:00.000Z'),
    });

    expect(snapshot.source).toBe('computed');
    expect(snapshot.bias).toBe('bullish');
    expect(snapshot.score).toBeGreaterThan(0);
    expect(snapshot.marketMovingCount).toBeGreaterThanOrEqual(1);
  });

  it('falls back to neutral snapshot when fetch fails and cache empty', async () => {
    mockCacheGet.mockResolvedValue(null as never);
    mockGetTickerNews.mockRejectedValue(new Error('news unavailable'));

    const snapshot = await getSPXNewsSentiment({
      forceRefresh: true,
      asOf: new Date('2026-02-20T15:00:00.000Z'),
    });

    expect(snapshot.source).toBe('fallback');
    expect(snapshot.bias).toBe('neutral');
    expect(snapshot.articles.length).toBe(0);
  });
});
