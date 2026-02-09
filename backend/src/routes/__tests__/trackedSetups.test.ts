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

import trackedSetupsRouter from '../trackedSetups';

const app = express();
app.use(express.json());
app.use('/api/tracked-setups', trackedSetupsRouter);

describe('Tracked Setups Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tracked-setups', () => {
    it('returns tracked setups for user', async () => {
      const setups = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          user_id: 'test-user-123',
          symbol: 'SPX',
          setup_type: 'breakout',
          direction: 'bullish',
          status: 'active',
        },
      ];

      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        data: setups,
        error: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      });

      const res = await request(app).get('/api/tracked-setups');

      expect(res.status).toBe(200);
      expect(res.body.trackedSetups).toHaveLength(1);
      expect(res.body.trackedSetups[0].symbol).toBe('SPX');
    });

    it('applies status filter when provided', async () => {
      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        data: [],
        error: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      });

      await request(app).get('/api/tracked-setups?status=active');

      expect(selectChain.eq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(selectChain.eq).toHaveBeenCalledWith('status', 'active');
    });
  });

  describe('POST /api/tracked-setups', () => {
    const validPayload = {
      source_opportunity_id: 'opp-123',
      symbol: 'spx',
      setup_type: 'breakout',
      direction: 'bullish',
      opportunity_data: { score: 82 },
    };

    it('creates a tracked setup', async () => {
      const insertChain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: '22222222-2222-2222-2222-222222222222',
            ...validPayload,
            symbol: 'SPX',
            status: 'active',
          },
          error: null,
        }),
      };

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue(insertChain),
      });

      const res = await request(app)
        .post('/api/tracked-setups')
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.trackedSetup.symbol).toBe('SPX');
      expect(res.body.trackedSetup.status).toBe('active');
    });

    it('returns duplicate=true on unique conflict for active source', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          const insertChain: any = {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value' },
            }),
          };
          return { insert: jest.fn().mockReturnValue(insertChain) };
        }

        const selectChain: any = {
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: '33333333-3333-3333-3333-333333333333',
              source_opportunity_id: 'opp-123',
              status: 'active',
            },
            error: null,
          }),
        };
        return { select: jest.fn().mockReturnValue(selectChain) };
      });

      const res = await request(app)
        .post('/api/tracked-setups')
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body.duplicate).toBe(true);
      expect(res.body.trackedSetup.id).toBe('33333333-3333-3333-3333-333333333333');
    });
  });

  describe('PATCH /api/tracked-setups/:id', () => {
    it('updates status and returns tracked setup', async () => {
      const updateSpy = jest.fn();
      const updateChain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: '44444444-4444-4444-4444-444444444444',
            status: 'triggered',
          },
          error: null,
        }),
      };

      updateSpy.mockReturnValue(updateChain);
      mockFrom.mockReturnValue({
        update: updateSpy,
      });

      const res = await request(app)
        .patch('/api/tracked-setups/44444444-4444-4444-4444-444444444444')
        .send({ status: 'triggered' });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'triggered',
        triggered_at: expect.any(String),
        invalidated_at: null,
      }));
    });

    it('returns 404 when tracked setup is not found', async () => {
      const updateChain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue(updateChain),
      });

      const res = await request(app)
        .patch('/api/tracked-setups/55555555-5555-5555-5555-555555555555')
        .send({ status: 'archived' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  describe('DELETE /api/tracked-setups/:id', () => {
    it('deletes tracked setup', async () => {
      const deleteChain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: '66666666-6666-6666-6666-666666666666' },
          error: null,
        }),
      };

      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue(deleteChain),
      });

      const res = await request(app).delete('/api/tracked-setups/66666666-6666-6666-6666-666666666666');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
