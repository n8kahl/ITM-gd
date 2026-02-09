import request from 'supertest';
import express from 'express';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../config/massive', () => ({
  getAggregates: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../services/charts/chartDataService', () => ({
  getChartData: jest.fn(),
}));

import chartRouter from '../chart';
import { getAggregates } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';

const mockGetAggregates = getAggregates as jest.MockedFunction<typeof getAggregates>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;

const app = express();
app.use(express.json());
app.use('/api/chart', chartRouter);

describe('Chart Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue();
  });

  it('normalizes missing index volume to zero for intraday bars', async () => {
    mockGetAggregates.mockResolvedValue({
      status: 'OK',
      ticker: 'I:SPX',
      queryCount: 1,
      resultsCount: 1,
      adjusted: true,
      request_id: 'test',
      count: 1,
      results: [
        {
          t: 1770647400000,
          o: 6917.26,
          h: 6919.4,
          l: 6906.01,
          c: 6910.98,
          // v intentionally omitted (index feeds often do this)
        } as any,
      ],
    } as any);

    const res = await request(app).get('/api/chart/spx?timeframe=1m');

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('SPX');
    expect(res.body.timeframe).toBe('1m');
    expect(res.body.bars).toHaveLength(1);
    expect(res.body.bars[0].volume).toBe(0);
  });

  it('passes through provided volume when available', async () => {
    mockGetAggregates.mockResolvedValue({
      status: 'OK',
      ticker: 'SPY',
      queryCount: 1,
      resultsCount: 1,
      adjusted: true,
      request_id: 'test',
      count: 1,
      results: [
        {
          t: 1770627600000,
          o: 690.89,
          h: 691.64,
          l: 690.89,
          c: 691.58,
          v: 2214,
        },
      ],
    } as any);

    const res = await request(app).get('/api/chart/spy?timeframe=1m');

    expect(res.status).toBe(200);
    expect(res.body.bars).toHaveLength(1);
    expect(res.body.bars[0].volume).toBe(2214);
  });

  it('returns 400 for invalid timeframe query', async () => {
    const res = await request(app).get('/api/chart/SPX?timeframe=2m');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockGetAggregates).not.toHaveBeenCalled();
  });
});
