import request from 'supertest';
import express from 'express';

// Mock Supabase
const mockFrom = jest.fn() as jest.Mock<any, any>;

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
}));

// Import after mocks
import alertsRouter from '../alerts';

// Set up express app
const app = express();
app.use(express.json());
app.use('/api/alerts', alertsRouter);

describe('Alerts Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/alerts
  // ============================================
  describe('GET /api/alerts', () => {
    it('should return alerts for authenticated user', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          user_id: 'test-user-123',
          symbol: 'SPX',
          alert_type: 'price_above',
          target_value: 6000,
          status: 'active',
          created_at: '2026-02-01T10:00:00Z',
        },
      ];

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockAlerts, error: null, count: 1 }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/alerts');

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.alerts[0].symbol).toBe('SPX');
      expect(res.body.total).toBe(1);
    });

    it('should filter by status', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      await request(app).get('/api/alerts?status=triggered');

      expect(chain.eq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(chain.eq).toHaveBeenCalledWith('status', 'triggered');
    });

    it('should filter by symbol', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      await request(app).get('/api/alerts?symbol=ndx');

      expect(chain.eq).toHaveBeenCalledWith('symbol', 'NDX');
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' }, count: null }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/alerts');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
  });

  // ============================================
  // POST /api/alerts
  // ============================================
  describe('POST /api/alerts', () => {
    const validAlert = {
      symbol: 'SPX',
      alert_type: 'price_above',
      target_value: 6000,
    };

    it('should create an alert', async () => {
      // First call: count query (select -> eq -> eq -> resolves with count)
      // Second call: insert query
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Count query
          const chain: any = {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 2 }),
              }),
            }),
          };
          return chain;
        }
        // Insert query
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'alert-new',
                  user_id: 'test-user-123',
                  symbol: 'SPX',
                  alert_type: 'price_above',
                  target_value: 6000,
                  status: 'active',
                },
                error: null,
              }),
            }),
          }),
        };
      });

      const res = await request(app)
        .post('/api/alerts')
        .send(validAlert);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('alert-new');
      expect(res.body.symbol).toBe('SPX');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .send({ symbol: 'SPX' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing fields');
    });

    it('should reject invalid alert_type', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .send({ symbol: 'SPX', alert_type: 'invalid_type', target_value: 6000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid alert_type');
    });

    it('should reject when alert limit reached', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 20 }),
          }),
        }),
      });

      const res = await request(app)
        .post('/api/alerts')
        .send(validAlert);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Alert limit reached');
    });

    it('should return 500 on database error during insert', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 0 }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
              }),
            }),
          }),
        };
      });

      const res = await request(app)
        .post('/api/alerts')
        .send(validAlert);

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // PUT /api/alerts/:id
  // ============================================
  describe('PUT /api/alerts/:id', () => {
    it('should update an alert', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'alert-1',
            target_value: 6100,
            status: 'active',
          },
          error: null,
        }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .put('/api/alerts/alert-1')
        .send({ target_value: 6100 });

      expect(res.status).toBe(200);
      expect(res.body.target_value).toBe(6100);
    });

    it('should return 404 when alert not found', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .put('/api/alerts/nonexistent')
        .send({ target_value: 6100 });

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .put('/api/alerts/alert-1')
        .send({ target_value: 6100 });

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // DELETE /api/alerts/:id
  // ============================================
  describe('DELETE /api/alerts/:id', () => {
    it('should delete an alert', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
      };
      chain.eq
        .mockReturnValueOnce(chain) // .eq('id', id)
        .mockResolvedValueOnce({ error: null }); // .eq('user_id', userId)
      mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue(chain) });

      const res = await request(app).delete('/api/alerts/alert-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
      };
      chain.eq
        .mockReturnValueOnce(chain)
        .mockResolvedValueOnce({ error: { message: 'Delete failed' } });
      mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue(chain) });

      const res = await request(app).delete('/api/alerts/alert-1');

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // POST /api/alerts/:id/cancel
  // ============================================
  describe('POST /api/alerts/:id/cancel', () => {
    it('should cancel an active alert', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'alert-1',
            status: 'cancelled',
            symbol: 'SPX',
          },
          error: null,
        }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app).post('/api/alerts/alert-1/cancel');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('should return 404 when alert not found or already cancelled', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app).post('/api/alerts/nonexistent/cancel');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Cancel failed' },
        }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app).post('/api/alerts/alert-1/cancel');

      expect(res.status).toBe(500);
    });
  });
});
