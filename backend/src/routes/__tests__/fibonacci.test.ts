import request from 'supertest';
import express from 'express';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/levels/fetcher', () => ({
  fetchDailyData: jest.fn(),
  fetchIntradayData: jest.fn(),
}));

jest.mock('../../services/levels/calculators/fibonacciRetracement', () => ({
  calculateFibonacciRetracement: jest.fn(),
  findClosestFibLevel: jest.fn(),
}));

import fibonacciRouter from '../fibonacci';
import { fetchDailyData, fetchIntradayData } from '../../services/levels/fetcher';
import {
  calculateFibonacciRetracement,
  findClosestFibLevel,
} from '../../services/levels/calculators/fibonacciRetracement';

const mockFetchDailyData = fetchDailyData as jest.MockedFunction<typeof fetchDailyData>;
const mockFetchIntradayData = fetchIntradayData as jest.MockedFunction<typeof fetchIntradayData>;
const mockCalculateFibonacciRetracement =
  calculateFibonacciRetracement as jest.MockedFunction<typeof calculateFibonacciRetracement>;
const mockFindClosestFibLevel = findClosestFibLevel as jest.MockedFunction<typeof findClosestFibLevel>;

const app = express();
app.use(express.json());
app.use('/api/fibonacci', fibonacciRouter);

describe('Fibonacci Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns Fibonacci levels for valid daily request', async () => {
    mockFetchDailyData.mockResolvedValue([
      { o: 100, h: 110, l: 95, c: 108, v: 100, t: Date.now() - 60_000 } as any,
      { o: 108, h: 112, l: 102, c: 111, v: 120, t: Date.now() } as any,
    ]);
    mockCalculateFibonacciRetracement.mockReturnValue({
      symbol: 'SPX',
      swingHigh: 112,
      swingHighIndex: 1,
      swingLow: 95,
      swingLowIndex: 0,
      timeframe: 'daily',
      lookbackBars: 20,
      direction: 'retracement',
      levels: {
        level_0: 112,
        level_236: 108,
        level_382: 105,
        level_500: 103.5,
        level_618: 102,
        level_786: 99,
        level_100: 95,
      },
      calculatedAt: '2026-02-10T18:00:00.000Z',
    });
    mockFindClosestFibLevel.mockReturnValue({
      level: 'level_618',
      price: 102,
      distance: 9,
    });

    const response = await request(app)
      .post('/api/fibonacci')
      .send({ symbol: 'spx', timeframe: 'daily', lookback: 20 });

    expect(response.status).toBe(200);
    expect(response.body.symbol).toBe('SPX');
    expect(response.body.levels).toBeDefined();
    expect(response.body.levels.level_618).toBe(102);
    expect(response.body.direction).toBe('retracement');
    expect(response.body).toHaveProperty('performance.calculationMs');
    expect(mockFetchDailyData).toHaveBeenCalledWith('SPX', 30);
  });

  it('returns Fibonacci levels for intraday timeframe labels', async () => {
    mockFetchIntradayData.mockResolvedValue([
      { o: 100, h: 101, l: 99, c: 100.5, v: 100, t: Date.now() - 60_000 } as any,
      { o: 100.5, h: 103, l: 100, c: 102.5, v: 140, t: Date.now() } as any,
    ]);
    mockCalculateFibonacciRetracement.mockReturnValue({
      symbol: 'QQQ',
      swingHigh: 103,
      swingHighIndex: 1,
      swingLow: 99,
      swingLowIndex: 0,
      timeframe: '5m',
      lookbackBars: 12,
      direction: 'retracement',
      levels: {
        level_0: 103,
        level_236: 102.06,
        level_382: 101.47,
        level_500: 101,
        level_618: 100.53,
        level_786: 99.86,
        level_100: 99,
      },
      calculatedAt: '2026-02-10T18:01:00.000Z',
    });
    mockFindClosestFibLevel.mockReturnValue({
      level: 'level_500',
      price: 101,
      distance: 1.5,
    });

    const response = await request(app)
      .post('/api/fibonacci')
      .send({ symbol: 'qqq', timeframe: '5m', lookback: 12 });

    expect(response.status).toBe(200);
    expect(response.body.symbol).toBe('QQQ');
    expect(response.body.timeframe).toBe('5m');
    expect(mockFetchIntradayData).toHaveBeenCalledWith('QQQ');
  });

  it('returns 400 for invalid symbol format', async () => {
    const response = await request(app)
      .post('/api/fibonacci')
      .send({ symbol: 'INVALID!!!', timeframe: 'daily', lookback: 20 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid symbol format');
  });

  it('returns 400 when request body fails schema validation', async () => {
    const response = await request(app)
      .post('/api/fibonacci')
      .send({ symbol: 'SPX', timeframe: 'daily', lookback: 999 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(mockFetchDailyData).not.toHaveBeenCalled();
  });

  it('returns 404 when there is not enough data', async () => {
    mockFetchDailyData.mockResolvedValue([{ o: 100, h: 101, l: 99, c: 100, v: 100, t: Date.now() } as any]);

    const response = await request(app)
      .post('/api/fibonacci')
      .send({ symbol: 'SPX', timeframe: 'daily', lookback: 20 });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Insufficient data');
  });
});

