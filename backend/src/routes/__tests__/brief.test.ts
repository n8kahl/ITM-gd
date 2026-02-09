import request from 'supertest';
import express from 'express';

// Mock logger
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFrom = jest.fn() as jest.Mock<any, any>;
const mockGenerateBrief = jest.fn() as jest.Mock<any, any>;

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../services/morningBrief', () => ({
  morningBriefService: {
    generateBrief: (...args: any[]) => mockGenerateBrief(...args),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
}));

import briefRouter from '../brief';

const app = express();
app.use(express.json());
app.use('/api/brief', briefRouter);

describe('Brief Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/brief/today', () => {
    it('returns cached brief when existing brief is fresh', async () => {
      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            brief_data: { aiSummary: 'Cached brief' },
            viewed: true,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      });

      const res = await request(app).get('/api/brief/today');

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
      expect(res.body.viewed).toBe(true);
      expect(res.body.brief.aiSummary).toBe('Cached brief');
      expect(mockGenerateBrief).not.toHaveBeenCalled();
    });

    it('regenerates brief when cached brief is stale', async () => {
      const staleTimestamp = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            brief_data: { aiSummary: 'Old brief' },
            viewed: false,
            created_at: staleTimestamp,
          },
          error: null,
        }),
      };

      const upsertChain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            brief_data: { aiSummary: 'Fresh brief' },
            viewed: false,
          },
          error: null,
        }),
      };

      mockFrom
        .mockImplementationOnce(() => ({ select: jest.fn().mockReturnValue(selectChain) }))
        .mockImplementationOnce(() => ({ upsert: jest.fn().mockReturnValue(upsertChain) }));

      mockGenerateBrief.mockResolvedValue({
        aiSummary: 'Fresh brief',
        watchlist: ['SPX', 'NDX'],
      });

      const res = await request(app).get('/api/brief/today');

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(false);
      expect(res.body.brief.aiSummary).toBe('Fresh brief');
      expect(mockGenerateBrief).toHaveBeenCalledWith('test-user-123');
    });

    it('supports watchlist override and skips persisted cache', async () => {
      mockGenerateBrief.mockResolvedValue({
        aiSummary: 'On-demand brief',
        watchlist: ['AAPL', 'NVDA'],
      });

      const res = await request(app).get('/api/brief/today?watchlist=AAPL,nvda,***');

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(false);
      expect(res.body.viewed).toBe(false);
      expect(res.body.brief.aiSummary).toBe('On-demand brief');
      expect(mockGenerateBrief).toHaveBeenCalledWith('test-user-123', ['AAPL', 'NVDA']);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/brief/today', () => {
    it('rejects invalid payload', async () => {
      const res = await request(app)
        .patch('/api/brief/today')
        .send({ viewed: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid payload');
    });

    it('updates viewed flag for today brief', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { viewed: true },
          error: null,
        }),
      };

      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue(chain),
      });

      const res = await request(app)
        .patch('/api/brief/today')
        .send({ viewed: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.viewed).toBe(true);
    });
  });
});
