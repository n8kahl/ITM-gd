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
const mockGetEnv = jest.fn();
const mockPublishSetupDetected = jest.fn();
const mockPublishSetupStatusUpdate = jest.fn();

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../config/env', () => ({
  getEnv: (...args: any[]) => mockGetEnv(...args),
}));

jest.mock('../../services/setupPushChannel', () => ({
  publishSetupDetected: (...args: any[]) => mockPublishSetupDetected(...args),
  publishSetupStatusUpdate: (...args: any[]) => mockPublishSetupStatusUpdate(...args),
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
    mockGetEnv.mockReturnValue({ NODE_ENV: 'test', E2E_BYPASS_AUTH: true });
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
        neq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
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
      expect(selectChain.neq).toHaveBeenCalledWith('status', 'invalidated');
      expect(selectChain.in).not.toHaveBeenCalled();
    });

    it('applies status filter when provided', async () => {
      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
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
      expect(selectChain.neq).not.toHaveBeenCalled();
      expect(selectChain.in).not.toHaveBeenCalled();
    });

    it('applies view=active filter when status is omitted', async () => {
      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        data: [],
        error: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      });

      await request(app).get('/api/tracked-setups?view=active');

      expect(selectChain.in).toHaveBeenCalledWith('status', ['active', 'triggered']);
      expect(selectChain.neq).not.toHaveBeenCalled();
    });

    it('applies view=history filter when status is omitted', async () => {
      const selectChain: any = {
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        data: [],
        error: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      });

      await request(app).get('/api/tracked-setups?view=history');

      expect(selectChain.eq).toHaveBeenCalledWith('status', 'archived');
      expect(selectChain.in).not.toHaveBeenCalled();
      expect(selectChain.neq).not.toHaveBeenCalled();
    });

    it('rejects status=invalidated for listing', async () => {
      const res = await request(app).get('/api/tracked-setups?status=invalidated');

      expect(res.status).toBe(400);
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
      const existingSelectChain: any = {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: '44444444-4444-4444-4444-444444444444',
            symbol: 'SPX',
            setup_type: 'breakout',
            status: 'active',
          },
          error: null,
        }),
      };
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
      mockFrom
        .mockImplementationOnce(() => ({
          select: jest.fn().mockReturnValue(existingSelectChain),
        }))
        .mockImplementationOnce(() => ({
          update: updateSpy,
        }));

      const res = await request(app)
        .patch('/api/tracked-setups/44444444-4444-4444-4444-444444444444')
        .send({ status: 'triggered' });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'triggered',
        triggered_at: expect.any(String),
        invalidated_at: null,
      }));
      expect(mockPublishSetupStatusUpdate).toHaveBeenCalledWith(expect.objectContaining({
        setupId: '44444444-4444-4444-4444-444444444444',
        userId: 'test-user-123',
        symbol: 'SPX',
        setupType: 'breakout',
        previousStatus: 'active',
        status: 'triggered',
        reason: 'manual_update',
      }));
    });

    it('does not publish setup_update on notes-only edits', async () => {
      const existingSelectChain: any = {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: '77777777-7777-7777-7777-777777777777',
            symbol: 'SPX',
            setup_type: 'breakout',
            status: 'active',
          },
          error: null,
        }),
      };
      const updateChain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: '77777777-7777-7777-7777-777777777777',
            symbol: 'SPX',
            setup_type: 'breakout',
            status: 'active',
            notes: 'updated note',
          },
          error: null,
        }),
      };

      mockFrom
        .mockImplementationOnce(() => ({
          select: jest.fn().mockReturnValue(existingSelectChain),
        }))
        .mockImplementationOnce(() => ({
          update: jest.fn().mockReturnValue(updateChain),
        }));

      const res = await request(app)
        .patch('/api/tracked-setups/77777777-7777-7777-7777-777777777777')
        .send({ notes: 'updated note' });

      expect(res.status).toBe(200);
      expect(mockPublishSetupStatusUpdate).not.toHaveBeenCalled();
    });

    it('returns 404 when tracked setup is not found', async () => {
      const existingSelectChain: any = {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(existingSelectChain),
      });

      const res = await request(app)
        .patch('/api/tracked-setups/55555555-5555-5555-5555-555555555555')
        .send({ status: 'archived' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
      expect(mockPublishSetupStatusUpdate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/tracked-setups/e2e/simulate-detected', () => {
    it('returns 404 when bypass mode is disabled', async () => {
      mockGetEnv.mockReturnValue({ NODE_ENV: 'test', E2E_BYPASS_AUTH: false });

      const res = await request(app)
        .post('/api/tracked-setups/e2e/simulate-detected')
        .send({ symbol: 'SPX' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });

    it('creates detected + tracked setup and publishes setup_detected event', async () => {
      const detectedInsertChain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'det-sim-1',
            symbol: 'SPX',
            setup_type: 'gamma_squeeze',
            direction: 'long',
            confidence: 81,
            detected_at: '2026-02-09T15:00:00.000Z',
            signal_data: {},
            trade_suggestion: null,
          },
          error: null,
        }),
      };

      const trackedInsertChain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'tracked-sim-1',
            user_id: 'test-user-123',
            symbol: 'SPX',
            setup_type: 'gamma_squeeze',
            direction: 'bullish',
            status: 'active',
            notes: 'Auto-detected by AI Coach setup engine (E2E simulated event)',
          },
          error: null,
        }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'ai_coach_detected_setups') {
          return {
            insert: jest.fn().mockReturnValue(detectedInsertChain),
            delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }),
          };
        }

        if (table === 'ai_coach_tracked_setups') {
          return {
            insert: jest.fn().mockReturnValue(trackedInsertChain),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      const res = await request(app)
        .post('/api/tracked-setups/e2e/simulate-detected')
        .send({
          symbol: 'spx',
          setup_type: 'gamma_squeeze',
          direction: 'bullish',
          confidence: 81,
        });

      expect(res.status).toBe(201);
      expect(res.body.detectedSetup.id).toBe('det-sim-1');
      expect(res.body.trackedSetup.id).toBe('tracked-sim-1');
      expect(mockPublishSetupDetected).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'test-user-123',
        symbol: 'SPX',
        setupType: 'gamma_squeeze',
        direction: 'bullish',
      }));
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
