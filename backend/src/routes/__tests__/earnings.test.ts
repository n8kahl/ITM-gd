import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

const mockFrom = jest.fn() as jest.Mock<any, any>;
jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../services/earnings', () => ({
  getEarningsCalendar: jest.fn(),
  getEarningsAnalysis: jest.fn(),
}));

import earningsRouter from '../earnings';
import { getEarningsCalendar, getEarningsAnalysis } from '../../services/earnings';

const mockGetEarningsCalendar = getEarningsCalendar as jest.MockedFunction<typeof getEarningsCalendar>;
const mockGetEarningsAnalysis = getEarningsAnalysis as jest.MockedFunction<typeof getEarningsAnalysis>;

const app = express();
app.use(express.json());
app.use('/api/earnings', earningsRouter);

describeWithSockets('Earnings Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });
  });

  it('returns earnings calendar for supplied watchlist', async () => {
    mockGetEarningsCalendar.mockResolvedValue([
      { symbol: 'AAPL', date: '2026-02-12', time: 'AMC', confirmed: true },
      { symbol: 'NVDA', date: '2026-02-13', time: 'BMO', confirmed: true },
    ] as any);

    const res = await request(app)
      .get('/api/earnings/calendar?watchlist=aapl,nvda&days=10');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.events[0].symbol).toBe('AAPL');
    expect(mockGetEarningsCalendar).toHaveBeenCalledWith(['AAPL', 'NVDA'], 10);
  });

  it('returns validation error for invalid days query', async () => {
    const res = await request(app).get('/api/earnings/calendar?days=0');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockGetEarningsCalendar).not.toHaveBeenCalled();
  });

  it('returns earnings analysis for valid symbol', async () => {
    mockGetEarningsAnalysis.mockResolvedValue({
      symbol: 'AAPL',
      earningsDate: '2026-02-12',
      daysUntil: 3,
      expectedMove: { points: 8.3, pct: 4.2 },
      historicalMoves: [],
      avgHistoricalMove: 3.9,
      moveOverpricing: 7.7,
      currentIV: 32.5,
      preEarningsIVRank: 65.1,
      projectedIVCrushPct: 28,
      straddlePricing: {
        atmStraddle: 8.3,
        referenceExpiry: '2026-02-14',
        assessment: 'fair',
      },
      suggestedStrategies: [],
      asOf: '2026-02-09T00:00:00.000Z',
    } as any);

    const res = await request(app).get('/api/earnings/aapl/analysis');

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('AAPL');
    expect(mockGetEarningsAnalysis).toHaveBeenCalledWith('AAPL');
  });

  it('returns validation error for malformed symbol', async () => {
    const res = await request(app).get('/api/earnings/aapl$/analysis');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockGetEarningsAnalysis).not.toHaveBeenCalled();
  });
});
