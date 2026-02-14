import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

jest.mock('../../services/marketIndices', () => ({
  getMarketIndicesSnapshot: jest.fn(),
}));

jest.mock('../../services/marketHours', () => ({
  getMarketStatus: jest.fn(),
}));

jest.mock('../../services/marketHolidays', () => ({
  getUpcomingHolidays: jest.fn(),
}));

jest.mock('../../services/marketMovers', () => ({
  getMarketMovers: jest.fn(),
}));

jest.mock('../../services/stockSplits', () => {
  const actual = jest.requireActual('../../services/stockSplits');
  return {
    ...actual,
    getUpcomingSplits: jest.fn(),
  };
});

jest.mock('../../services/marketAnalytics', () => ({
  getMarketHealthSnapshot: jest.fn(),
}));

import marketRouter from '../market';
import { getMarketIndicesSnapshot } from '../../services/marketIndices';
import { getMarketStatus } from '../../services/marketHours';
import { getUpcomingSplits } from '../../services/stockSplits';

const mockGetMarketIndicesSnapshot = getMarketIndicesSnapshot as jest.MockedFunction<typeof getMarketIndicesSnapshot>;
const mockGetMarketStatus = getMarketStatus as jest.MockedFunction<typeof getMarketStatus>;
const mockGetUpcomingSplits = getUpcomingSplits as jest.MockedFunction<typeof getUpcomingSplits>;

const app = express();
app.use(express.json());
app.use('/api/market', marketRouter);

describeWithSockets('Market Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns live index snapshot', async () => {
    mockGetMarketIndicesSnapshot.mockResolvedValue({
      quotes: [
        {
          symbol: 'SPX',
          price: 6000,
          change: 12,
          changePercent: 0.2,
        },
      ],
      metrics: { vwap: 5991 },
      source: 'massive',
    });

    const res = await request(app).get('/api/market/indices');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('massive');
    expect(res.body.quotes[0].symbol).toBe('SPX');
  });

  it('returns market status payload', async () => {
    mockGetMarketStatus.mockReturnValue({
      status: 'pre-market',
      session: 'extended',
      message: 'Pre-market session is active',
      timeUntilOpen: '1h 5m',
    });

    const res = await request(app).get('/api/market/status');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pre-market');
    expect(res.body.session).toBe('extended');
  });

  it('returns 500 when splits upstream fails', async () => {
    mockGetUpcomingSplits.mockRejectedValue(
      new Error('Massive splits unavailable'),
    );

    const res = await request(app).get('/api/market/splits');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch stock splits');
  });
});
