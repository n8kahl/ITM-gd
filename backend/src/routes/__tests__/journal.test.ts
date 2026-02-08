import request from 'supertest';
import express from 'express';

// Mock Supabase - use 'any' to avoid strict type matching on partial mocks
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
import journalRouter from '../journal';

// Set up express app
const app = express();
app.use(express.json());
app.use('/api/journal', journalRouter);

describe('Journal Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/journal/trades
  // ============================================
  describe('GET /api/journal/trades', () => {
    it('should return trades for authenticated user', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          user_id: 'test-user-123',
          symbol: 'SPX',
          position_type: 'call',
          strategy: '0DTE Scalp',
          entry_date: '2026-02-01',
          entry_price: 5.50,
          exit_date: '2026-02-01',
          exit_price: 8.20,
          quantity: 2,
          pnl: 540,
          pnl_pct: 49.09,
          trade_outcome: 'win',
          hold_time_days: 0,
        },
      ];

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockTrades, error: null, count: 1 }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/journal/trades');

      expect(res.status).toBe(200);
      expect(res.body.trades).toHaveLength(1);
      expect(res.body.trades[0].symbol).toBe('SPX');
      expect(res.body.total).toBe(1);
      expect(res.body.hasMore).toBe(false);
    });

    it('should filter by symbol', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      await request(app).get('/api/journal/trades?symbol=NDX');

      expect(chain.eq).toHaveBeenCalledWith('symbol', 'NDX');
    });

    it('should filter by outcome', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      await request(app).get('/api/journal/trades?outcome=win');

      expect(chain.eq).toHaveBeenCalledWith('trade_outcome', 'win');
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' }, count: null }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/journal/trades');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
  });

  // ============================================
  // POST /api/journal/trades
  // ============================================
  describe('POST /api/journal/trades', () => {
    const validTrade = {
      symbol: 'SPX',
      position_type: 'call',
      strategy: '0DTE Scalp',
      entry_date: '2026-02-01',
      entry_price: 5.50,
      exit_date: '2026-02-01',
      exit_price: 8.20,
      quantity: 2,
    };

    it('should create a trade with P&L calculated', async () => {
      const createdTrade = {
        id: 'trade-new',
        user_id: 'test-user-123',
        ...validTrade,
        pnl: 540,
        pnl_pct: 49.09,
        trade_outcome: 'win',
        hold_time_days: 0,
      };

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdTrade, error: null }),
      };
      mockFrom.mockReturnValue({ insert: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .post('/api/journal/trades')
        .send(validTrade);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('trade-new');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/journal/trades')
        .send({ symbol: 'SPX' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing fields');
    });

    it('should create an open trade without exit data', async () => {
      const openTrade = {
        symbol: 'SPX',
        position_type: 'call',
        entry_date: '2026-02-01',
        entry_price: 5.50,
        quantity: 1,
      };

      const createdTrade = {
        id: 'trade-open',
        user_id: 'test-user-123',
        ...openTrade,
        pnl: null,
        trade_outcome: null,
      };

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdTrade, error: null }),
      };
      mockFrom.mockReturnValue({ insert: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .post('/api/journal/trades')
        .send(openTrade);

      expect(res.status).toBe(201);
      expect(res.body.pnl).toBeNull();
      expect(res.body.trade_outcome).toBeNull();
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };
      mockFrom.mockReturnValue({ insert: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .post('/api/journal/trades')
        .send(validTrade);

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // PUT /api/journal/trades/:id
  // ============================================
  describe('PUT /api/journal/trades/:id', () => {
    it('should update a trade', async () => {
      const updatedTrade = {
        id: 'trade-1',
        exit_price: 10.00,
        exit_date: '2026-02-02',
        pnl: 900,
        trade_outcome: 'win',
      };

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedTrade, error: null }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .put('/api/journal/trades/trade-1')
        .send({ exit_price: 10.00, exit_date: '2026-02-02' });

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      };
      mockFrom.mockReturnValue({ update: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .put('/api/journal/trades/trade-1')
        .send({ exit_price: 10.00 });

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // DELETE /api/journal/trades/:id
  // ============================================
  describe('DELETE /api/journal/trades/:id', () => {
    it('should delete a trade', async () => {
      // .delete().eq('id', id).eq('user_id', userId) - need 2 chained eq calls
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
      };
      // First eq returns chain, second eq resolves
      chain.eq
        .mockReturnValueOnce(chain) // .eq('id', id) returns chain
        .mockResolvedValueOnce({ error: null }); // .eq('user_id', userId) resolves
      mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue(chain) });

      const res = await request(app).delete('/api/journal/trades/trade-1');

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

      const res = await request(app).delete('/api/journal/trades/trade-1');

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // GET /api/journal/analytics
  // ============================================
  describe('GET /api/journal/analytics', () => {
    it('should return analytics for closed trades', async () => {
      const closedTrades = [
        { trade_outcome: 'win', pnl: 500, pnl_pct: 50, hold_time_days: 1, entry_date: '2026-01-01', exit_date: '2026-01-02', strategy: '0DTE Scalp' },
        { trade_outcome: 'win', pnl: 300, pnl_pct: 30, hold_time_days: 0, entry_date: '2026-01-03', exit_date: '2026-01-03', strategy: '0DTE Scalp' },
        { trade_outcome: 'loss', pnl: -200, pnl_pct: -20, hold_time_days: 1, entry_date: '2026-01-05', exit_date: '2026-01-06', strategy: 'Credit Spread' },
      ];

      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: closedTrades, error: null }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/journal/analytics');

      expect(res.status).toBe(200);
      expect(res.body.summary.totalTrades).toBe(3);
      expect(res.body.summary.wins).toBe(2);
      expect(res.body.summary.losses).toBe(1);
      expect(res.body.summary.totalPnl).toBe(600);
      expect(res.body.summary.winRate).toBeCloseTo(66.67, 0);
      expect(res.body.equityCurve).toHaveLength(3);
      expect(res.body.byStrategy).toHaveProperty('0DTE Scalp');
      expect(res.body.byStrategy['0DTE Scalp'].count).toBe(2);
    });

    it('should return empty analytics when no trades', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/journal/analytics');

      expect(res.status).toBe(200);
      expect(res.body.summary.totalTrades).toBe(0);
      expect(res.body.summary.winRate).toBe(0);
      expect(res.body.equityCurve).toHaveLength(0);
    });

    it('should return 500 on database error', async () => {
      const chain: any = {
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const res = await request(app).get('/api/journal/analytics');

      expect(res.status).toBe(500);
    });
  });

  // ============================================
  // POST /api/journal/import
  // ============================================
  describe('POST /api/journal/import', () => {
    it('should import an array of trades', async () => {
      const importedTrades = [
        { symbol: 'SPX', position_type: 'call', entry_date: '2026-01-01', entryPrice: 5.0, quantity: 1 },
        { symbol: 'NDX', position_type: 'put', entry_date: '2026-01-02', entryPrice: 3.0, quantity: 2 },
      ];

      const chain: any = {
        select: jest.fn().mockResolvedValue({ data: [{ id: '1' }, { id: '2' }], error: null }),
      };
      mockFrom.mockReturnValue({ insert: jest.fn().mockReturnValue(chain) });

      const res = await request(app)
        .post('/api/journal/import')
        .send({ trades: importedTrades, broker: 'TastyTrade' });

      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(2);
    });

    it('should reject empty trades array', async () => {
      const res = await request(app)
        .post('/api/journal/import')
        .send({ trades: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid data');
    });

    it('should reject missing trades', async () => {
      const res = await request(app)
        .post('/api/journal/import')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
