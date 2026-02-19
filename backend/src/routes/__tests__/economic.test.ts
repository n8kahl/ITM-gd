import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/economic', () => ({
  getEconomicCalendar: jest.fn(),
}));

import economicRouter from '../economic';
import { getEconomicCalendar } from '../../services/economic';

const mockGetEconomicCalendar = getEconomicCalendar as jest.MockedFunction<typeof getEconomicCalendar>;

const app = express();
app.use(express.json());
app.use('/api/economic', economicRouter);

describeWithSockets('Economic Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns economic calendar for custom query', async () => {
    mockGetEconomicCalendar.mockResolvedValue([
      {
        date: '2026-02-20',
        event: 'Consumer Price Index (CPI)',
        expected: null,
        previous: '3.2',
        actual: null,
        impact: 'HIGH',
        relevance: 'Inflation print can reprice rates',
      },
    ] as any);

    const res = await request(app).get('/api/economic/calendar?days=10&impact=HIGH');

    expect(res.status).toBe(200);
    expect(res.body.daysAhead).toBe(10);
    expect(res.body.impactFilter).toBe('HIGH');
    expect(res.body.count).toBe(1);
    expect(mockGetEconomicCalendar).toHaveBeenCalledWith(10, 'HIGH');
  });

  it('returns upcoming endpoint defaults', async () => {
    mockGetEconomicCalendar.mockResolvedValue([] as any);

    const res = await request(app).get('/api/economic/calendar/upcoming');

    expect(res.status).toBe(200);
    expect(res.body.daysAhead).toBe(7);
    expect(res.body.impactFilter).toBe('HIGH');
    expect(mockGetEconomicCalendar).toHaveBeenCalledWith(7, 'HIGH');
  });

  it('validates days range on calendar endpoint', async () => {
    const res = await request(app).get('/api/economic/calendar?days=0');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockGetEconomicCalendar).not.toHaveBeenCalled();
  });
});
