import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/macro/macroContext', () => ({
  getMacroContext: jest.fn(),
  assessMacroImpact: jest.fn(),
}));

import macroRouter from '../macro';
import { getMacroContext, assessMacroImpact } from '../../services/macro/macroContext';

const mockGetMacroContext = getMacroContext as jest.MockedFunction<typeof getMacroContext>;
const mockAssessMacroImpact = assessMacroImpact as jest.MockedFunction<typeof assessMacroImpact>;

const app = express();
app.use(express.json());
app.use('/api/macro', macroRouter);

describeWithSockets('Macro Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns macro context', async () => {
    mockGetMacroContext.mockResolvedValue({
      economicCalendar: [],
      fedPolicy: {
        currentRate: '4.25-4.50%',
        nextMeetingDate: '2026-03-18',
        marketImpliedProbabilities: { hold: 0.6, cut25: 0.3, hike25: 0.1 },
        currentTone: 'neutral',
        expectedOutcome: 'Hold',
      },
      sectorRotation: {
        sectors: [],
        moneyFlowDirection: 'Neutral',
      },
      earningsSeason: {
        currentPhase: 'Q1 Earnings Season',
        beatRate: 0.78,
        upcomingEvents: [],
        implication: 'Mixed',
      },
      timestamp: '2026-02-09T00:00:00.000Z',
    });

    const res = await request(app).get('/api/macro');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fedPolicy');
    expect(mockGetMacroContext).toHaveBeenCalledTimes(1);
  });

  it('normalizes symbol and returns macro impact for any valid symbol', async () => {
    mockAssessMacroImpact.mockResolvedValue({
      upcomingCatalysts: [],
      bullishFactors: ['test'],
      bearishFactors: [],
      riskFactors: ['risk'],
      overallOutlook: 'neutral',
      adviceForLEAPS: 'test advice',
    });

    const res = await request(app).get('/api/macro/impact/aapl');

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('AAPL');
    expect(mockAssessMacroImpact).toHaveBeenCalledWith('AAPL');
  });

  it('rejects invalid symbol format', async () => {
    const res = await request(app).get('/api/macro/impact/aapl$');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockAssessMacroImpact).not.toHaveBeenCalled();
  });
});
