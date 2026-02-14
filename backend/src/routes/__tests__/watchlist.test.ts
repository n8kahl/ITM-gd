import { describeWithSockets } from '../../testUtils/socketDescribe';
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

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
}));

import watchlistRouter from '../watchlist';

const app = express();
app.use(express.json());
app.use('/api/watchlist', watchlistRouter);

describeWithSockets('Watchlist Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/watchlist', () => {
    it('returns existing watchlists with default', async () => {
      const watchlists = [
        { id: 'wl-1', user_id: 'test-user-123', name: 'Default', symbols: ['SPX', 'NDX'], is_default: true },
      ];

      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      selectChain.order
        .mockReturnValueOnce(selectChain)
        .mockResolvedValueOnce({ data: watchlists, error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      });

      const res = await request(app).get('/api/watchlist');

      expect(res.status).toBe(200);
      expect(res.body.watchlists).toHaveLength(1);
      expect(res.body.defaultWatchlist.id).toBe('wl-1');
    });

    it('auto-creates a default watchlist when user has none', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          const selectChain: any = {
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
          };
          selectChain.order
            .mockReturnValueOnce(selectChain)
            .mockResolvedValueOnce({ data: [], error: null });

          return { select: jest.fn().mockReturnValue(selectChain) };
        }

        const insertChain: any = {
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'wl-new',
              user_id: 'test-user-123',
              name: 'Default',
              symbols: ['SPX', 'NDX', 'SPY', 'QQQ'],
              is_default: true,
            },
            error: null,
          }),
        };
        return { insert: jest.fn().mockReturnValue(insertChain) };
      });

      const res = await request(app).get('/api/watchlist');

      expect(res.status).toBe(200);
      expect(res.body.watchlists).toHaveLength(1);
      expect(res.body.defaultWatchlist.id).toBe('wl-new');
      expect(res.body.defaultWatchlist.is_default).toBe(true);
    });
  });

  describe('POST /api/watchlist', () => {
    it('creates a new watchlist and normalizes symbols', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          const insertChain: any = {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'wl-created',
                user_id: 'test-user-123',
                name: 'Growth',
                symbols: ['AAPL', 'NVDA'],
                is_default: false,
              },
              error: null,
            }),
          };
          return { insert: jest.fn().mockReturnValue(insertChain) };
        }

        const selectChain: any = {
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
        };
        selectChain.order
          .mockReturnValueOnce(selectChain)
          .mockResolvedValueOnce({
            data: [
              { id: 'wl-default', user_id: 'test-user-123', name: 'Default', symbols: ['SPX'], is_default: true },
              { id: 'wl-created', user_id: 'test-user-123', name: 'Growth', symbols: ['AAPL', 'NVDA'], is_default: false },
            ],
            error: null,
          });
        return { select: jest.fn().mockReturnValue(selectChain) };
      });

      const res = await request(app)
        .post('/api/watchlist')
        .send({
          name: 'Growth',
          symbols: ['aapl', 'nvda', 'NVDA'],
        });

      expect(res.status).toBe(201);
      expect(res.body.watchlist.symbols).toEqual(['AAPL', 'NVDA']);
    });

    it('rejects invalid symbol payloads via validation', async () => {
      const res = await request(app)
        .post('/api/watchlist')
        .send({
          name: 'Invalid',
          symbols: ['***'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/watchlist/:id', () => {
    it('returns 404 when watchlist does not exist', async () => {
      const updateChain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue(updateChain),
      });

      const res = await request(app)
        .put('/api/watchlist/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  describe('DELETE /api/watchlist/:id', () => {
    it('deletes watchlist and returns remaining default', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          const deleteChain: any = {
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'wl-delete' }, error: null }),
          };
          return { delete: jest.fn().mockReturnValue(deleteChain) };
        }

        const selectChain: any = {
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
        };
        selectChain.order
          .mockReturnValueOnce(selectChain)
          .mockResolvedValueOnce({
            data: [
              { id: 'wl-default', user_id: 'test-user-123', name: 'Default', symbols: ['SPX'], is_default: true },
            ],
            error: null,
          });
        return { select: jest.fn().mockReturnValue(selectChain) };
      });

      const res = await request(app).delete('/api/watchlist/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.defaultWatchlist.id).toBe('wl-default');
    });
  });
});
