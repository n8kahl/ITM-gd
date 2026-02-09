import request from 'supertest';
import express from 'express';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../config/massive', () => ({
  searchReferenceTickers: jest.fn(),
}));

import symbolsRouter from '../symbols';
import { cacheGet, cacheSet } from '../../config/redis';
import { searchReferenceTickers } from '../../config/massive';

const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockSearchReferenceTickers = searchReferenceTickers as jest.MockedFunction<typeof searchReferenceTickers>;

const app = express();
app.use(express.json());
app.use('/api/symbols', symbolsRouter);

describe('Symbols Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
  });

  it('returns popular defaults when q is empty', async () => {
    const res = await request(app).get('/api/symbols/search');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0]).toHaveProperty('symbol');
    expect(mockSearchReferenceTickers).not.toHaveBeenCalled();
  });

  it('returns cached results when cache hit exists', async () => {
    mockCacheGet.mockResolvedValue({
      results: [{ symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'XNAS' }],
    });

    const res = await request(app).get('/api/symbols/search?q=aapl');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'XNAS' }]);
    expect(mockSearchReferenceTickers).not.toHaveBeenCalled();
  });

  it('searches Massive and caches normalized response', async () => {
    mockSearchReferenceTickers.mockResolvedValue([
      { ticker: 'aapl', name: 'Apple Inc.', type: 'CS', primary_exchange: 'XNAS' },
      { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF', primary_exchange: 'ARCX' },
    ] as any);

    const res = await request(app).get('/api/symbols/search?q=aa&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: 'AAPL', type: 'stock' }),
      expect.objectContaining({ symbol: 'QQQ', type: 'etf' }),
    ]));
    expect(mockSearchReferenceTickers).toHaveBeenCalledWith('aa', 20);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('maps provider failure to 503', async () => {
    mockSearchReferenceTickers.mockRejectedValue(new Error('provider down'));

    const res = await request(app).get('/api/symbols/search?q=spy');

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Symbol search unavailable');
  });
});
