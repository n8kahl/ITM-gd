import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../config/massive', () => ({
  getAggregates: jest.fn(),
  getEMAIndicator: jest.fn(),
  getRSIIndicator: jest.fn(),
  getMACDIndicator: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('../../services/charts/chartDataService', () => ({
  getChartData: jest.fn(),
}));

jest.mock('../../services/tickCache', () => ({
  getRecentTicks: jest.fn(),
}));

import chartRouter from '../chart';
import { getAggregates, getEMAIndicator, getRSIIndicator, getMACDIndicator } from '../../config/massive';
import { cacheGet, cacheSet } from '../../config/redis';
import { getChartData } from '../../services/charts/chartDataService';
import { getRecentTicks } from '../../services/tickCache';

const mockGetAggregates = getAggregates as jest.MockedFunction<typeof getAggregates>;
const mockGetEMAIndicator = getEMAIndicator as jest.MockedFunction<typeof getEMAIndicator>;
const mockGetRSIIndicator = getRSIIndicator as jest.MockedFunction<typeof getRSIIndicator>;
const mockGetMACDIndicator = getMACDIndicator as jest.MockedFunction<typeof getMACDIndicator>;
const mockCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockGetChartData = getChartData as jest.MockedFunction<typeof getChartData>;
const mockGetRecentTicks = getRecentTicks as jest.MockedFunction<typeof getRecentTicks>;

const app = express();
app.use(express.json());
app.use('/api/chart', chartRouter);

describeWithSockets('Chart Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue();
    mockGetEMAIndicator.mockResolvedValue([]);
    mockGetRSIIndicator.mockResolvedValue([]);
    mockGetMACDIndicator.mockResolvedValue([]);
    mockGetChartData.mockResolvedValue({
      symbol: 'SPX',
      timeframe: 'weekly',
      currentPrice: 6910.98,
      candles: [
        { time: 1770230400, open: 6800, high: 6920, low: 6780, close: 6910.98, volume: 0 },
      ],
      indicators: {
        ema50: 6820,
        ema200: 6500,
        pivots: {
          pp: 6870,
          r1: 6940,
          r2: 7010,
          s1: 6800,
          s2: 6730,
        },
      },
      count: 1,
      timestamp: new Date().toISOString(),
      cached: false,
    } as any);
    mockGetRecentTicks.mockReturnValue([]);
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

  it('expands intraday date range when 1m response is empty', async () => {
    mockGetAggregates
      .mockResolvedValueOnce({
        status: 'OK',
        ticker: 'I:SPX',
        queryCount: 1,
        resultsCount: 0,
        adjusted: true,
        request_id: 'test-empty',
        count: 0,
        results: [],
      } as any)
      .mockResolvedValueOnce({
        status: 'OK',
        ticker: 'I:SPX',
        queryCount: 1,
        resultsCount: 1,
        adjusted: true,
        request_id: 'test-fallback',
        count: 1,
        results: [
          {
            t: 1770647400000,
            o: 6917.26,
            h: 6919.4,
            l: 6906.01,
            c: 6910.98,
            v: 1234,
          } as any,
        ],
      } as any);

    const res = await request(app).get('/api/chart/spx?timeframe=1m');

    expect(res.status).toBe(200);
    expect(res.body.timeframe).toBe('1m');
    expect(res.body.bars).toHaveLength(1);
    expect(mockGetAggregates).toHaveBeenCalledTimes(2);
  });

  it('falls back to tick-cache derived 1m bars when provider bars remain empty', async () => {
    mockGetAggregates
      .mockResolvedValueOnce({
        status: 'OK',
        ticker: 'I:SPX',
        queryCount: 1,
        resultsCount: 0,
        adjusted: true,
        request_id: 'test-empty-primary',
        count: 0,
        results: [],
      } as any)
      .mockResolvedValueOnce({
        status: 'OK',
        ticker: 'I:SPX',
        queryCount: 1,
        resultsCount: 0,
        adjusted: true,
        request_id: 'test-empty-fallback',
        count: 0,
        results: [],
      } as any);

    mockGetRecentTicks.mockReturnValue([
      { symbol: 'SPX', rawSymbol: 'I:SPX', timestamp: 1770647401000, price: 6910.5, size: 2, sequence: 1 },
      { symbol: 'SPX', rawSymbol: 'I:SPX', timestamp: 1770647410000, price: 6911.25, size: 1, sequence: 2 },
      { symbol: 'SPX', rawSymbol: 'I:SPX', timestamp: 1770647462000, price: 6909.75, size: 3, sequence: 3 },
    ] as any);

    const res = await request(app).get('/api/chart/spx?timeframe=1m');

    expect(res.status).toBe(200);
    expect(res.body.timeframe).toBe('1m');
    expect(res.body.bars.length).toBeGreaterThan(0);
    expect(res.body.bars[0]).toEqual(expect.objectContaining({
      open: 6910.5,
      high: 6911.25,
      low: 6910.5,
      close: 6911.25,
    }));
    expect(mockGetRecentTicks).toHaveBeenCalledWith('SPX', 6000);
  });

  it('returns 400 for invalid timeframe query', async () => {
    const res = await request(app).get('/api/chart/SPX?timeframe=2m');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockGetAggregates).not.toHaveBeenCalled();
  });

  it('accepts symbols containing dot separators', async () => {
    mockGetAggregates.mockResolvedValue({
      status: 'OK',
      ticker: 'BRK.B',
      queryCount: 1,
      resultsCount: 1,
      adjusted: true,
      request_id: 'test',
      count: 1,
      results: [
        {
          t: 1770647400000,
          o: 450.12,
          h: 451.2,
          l: 449.85,
          c: 450.55,
          v: 1234,
        } as any,
      ],
    } as any);

    const res = await request(app).get('/api/chart/brk.b?timeframe=1D');

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('BRK.B');
    expect(mockGetAggregates).toHaveBeenCalledWith('BRK.B', 1, 'day', expect.any(String), expect.any(String));
  });

  it('returns Massive provider indicators when includeIndicators=true', async () => {
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
          v: 1234,
        } as any,
      ],
    } as any);
    mockGetEMAIndicator.mockResolvedValue([
      { timestamp: 1770647400000, value: 6908.12 },
    ] as any);
    mockGetRSIIndicator.mockResolvedValue([
      { timestamp: 1770647400000, value: 58.4 },
    ] as any);
    mockGetMACDIndicator.mockResolvedValue([
      { timestamp: 1770647400000, value: 12.4, signal: 10.7, histogram: 1.7 },
    ] as any);

    const res = await request(app).get('/api/chart/spx?timeframe=1m&includeIndicators=true');

    expect(res.status).toBe(200);
    expect(res.body.providerIndicators).toBeDefined();
    expect(res.body.providerIndicators.source).toBe('massive');
    expect(res.body.providerIndicators.timespan).toBe('minute');
    expect(res.body.providerIndicators.ema8[0].value).toBe(6908.12);
    expect(res.body.providerIndicators.rsi14[0].value).toBe(58.4);
    expect(res.body.providerIndicators.macd[0].signal).toBe(10.7);
    expect(mockGetEMAIndicator).toHaveBeenCalled();
    expect(mockGetRSIIndicator).toHaveBeenCalled();
    expect(mockGetMACDIndicator).toHaveBeenCalled();
    expect(mockGetEMAIndicator).toHaveBeenCalledWith('I:SPX', expect.objectContaining({
      timespan: 'minute',
      order: 'asc',
      timestampGte: expect.any(String),
      timestampLte: expect.any(String),
    }));
  });

  it('degrades gracefully when indicator requests fail', async () => {
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
          v: 1234,
        } as any,
      ],
    } as any);
    mockGetEMAIndicator.mockRejectedValue(new Error('indicator unavailable'));
    mockGetRSIIndicator.mockRejectedValue(new Error('indicator unavailable'));
    mockGetMACDIndicator.mockRejectedValue(new Error('indicator unavailable'));

    const res = await request(app).get('/api/chart/spx?timeframe=1m&includeIndicators=true');

    expect(res.status).toBe(200);
    expect(res.body.providerIndicators).toBeDefined();
    expect(res.body.providerIndicators.ema8).toEqual([]);
    expect(res.body.providerIndicators.rsi14).toEqual([]);
    expect(res.body.providerIndicators.macd).toEqual([]);
  });

  it.each(['1m', '5m', '15m', '1h', '4h', '1D'])(
    'returns bars for %s timeframe',
    async (timeframe) => {
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
            v: 1234,
          } as any,
        ],
      } as any);

      const res = await request(app).get(`/api/chart/spx?timeframe=${timeframe}`);

      expect(res.status).toBe(200);
      expect(res.body.timeframe).toBe(timeframe);
      expect(Array.isArray(res.body.bars)).toBe(true);
      expect(res.body.bars.length).toBeGreaterThan(0);
    },
  );

  it.each(['1W', '1M'])(
    'returns bars for %s timeframe via chart data service',
    async (timeframe) => {
      mockGetChartData.mockResolvedValue({
        symbol: 'SPX',
        timeframe: timeframe === '1W' ? 'weekly' : 'monthly',
        currentPrice: 6910.98,
        candles: [
          { time: 1770230400, open: 6800, high: 6920, low: 6780, close: 6910.98, volume: 0 },
        ],
        indicators: {
          ema50: 6820,
          ema200: 6500,
          pivots: {
            pp: 6870,
            r1: 6940,
            r2: 7010,
            s1: 6800,
            s2: 6730,
          },
        },
        count: 1,
        timestamp: new Date().toISOString(),
        cached: false,
      } as any);

      const res = await request(app).get(`/api/chart/spx?timeframe=${timeframe}`);

      expect(res.status).toBe(200);
      expect(res.body.timeframe).toBe(timeframe);
      expect(Array.isArray(res.body.bars)).toBe(true);
      expect(res.body.bars.length).toBeGreaterThan(0);
      expect(mockGetChartData).toHaveBeenCalled();
    },
  );
});
