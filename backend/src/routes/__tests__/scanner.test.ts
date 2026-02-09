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

const mockFrom = jest.fn() as jest.Mock<any, any>;
const mockScanOpportunities = jest.fn() as jest.Mock<any, any>;

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../services/scanner', () => ({
  scanOpportunities: (...args: any[]) => mockScanOpportunities(...args),
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

import scannerRouter from '../scanner';

const app = express();
app.use(express.json());
app.use('/api/scanner', scannerRouter);

describe('Scanner Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses user default watchlist when symbols are not provided', async () => {
    const selectChain: any = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };
    selectChain.order
      .mockReturnValueOnce(selectChain)
      .mockResolvedValueOnce({
        data: [{ symbols: ['aapl', 'nvda'], is_default: true }],
        error: null,
      });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue(selectChain),
    });

    mockScanOpportunities.mockResolvedValue({
      opportunities: [],
      symbols: ['AAPL', 'NVDA'],
      scanDurationMs: 123,
      scannedAt: new Date().toISOString(),
    });

    const res = await request(app).get('/api/scanner/scan');

    expect(res.status).toBe(200);
    expect(mockScanOpportunities).toHaveBeenCalledWith(['AAPL', 'NVDA'], true);
  });

  it('sanitizes explicit symbol query and respects include_options', async () => {
    mockScanOpportunities.mockResolvedValue({
      opportunities: [],
      symbols: ['SPY', 'QQQ'],
      scanDurationMs: 50,
      scannedAt: new Date().toISOString(),
    });

    const res = await request(app).get('/api/scanner/scan?symbols=spy,qqq,***&include_options=false');

    expect(res.status).toBe(200);
    expect(mockScanOpportunities).toHaveBeenCalledWith(['SPY', 'QQQ'], false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('falls back to default symbols when watchlist is empty', async () => {
    const selectChain: any = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };
    selectChain.order
      .mockReturnValueOnce(selectChain)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue(selectChain),
    });

    mockScanOpportunities.mockResolvedValue({
      opportunities: [],
      symbols: ['SPX', 'NDX'],
      scanDurationMs: 70,
      scannedAt: new Date().toISOString(),
    });

    const res = await request(app).get('/api/scanner/scan');

    expect(res.status).toBe(200);
    expect(mockScanOpportunities).toHaveBeenCalledWith(['SPX', 'NDX'], true);
  });
});
