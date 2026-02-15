import request from 'supertest';
import express from 'express';
import http from 'http';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'stream-user-1' };
    next();
  },
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/spx/aiCoach', () => ({
  getCoachState: jest.fn(),
  generateCoachStream: jest.fn(),
}));

jest.mock('../../services/spx/aiPredictor', () => ({ getPredictionState: jest.fn() }));
jest.mock('../../services/spx/contractSelector', () => ({ getContractRecommendation: jest.fn() }));
jest.mock('../../services/spx/crossReference', () => ({ getBasisState: jest.fn() }));
jest.mock('../../services/spx/fibEngine', () => ({ getFibLevels: jest.fn() }));
jest.mock('../../services/spx/flowEngine', () => ({ getFlowEvents: jest.fn() }));
jest.mock('../../services/spx/gexEngine', () => ({ computeUnifiedGEXLandscape: jest.fn() }));
jest.mock('../../services/spx/levelEngine', () => ({ getMergedLevels: jest.fn() }));
jest.mock('../../services/spx/regimeClassifier', () => ({ classifyCurrentRegime: jest.fn() }));
jest.mock('../../services/spx/setupDetector', () => ({ detectActiveSetups: jest.fn(), getSetupById: jest.fn() }));
jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  },
}));

import spxRouter from '../../routes/spx';
import { generateCoachStream } from '../../services/spx/aiCoach';

const mockGenerateCoachStream = generateCoachStream as jest.MockedFunction<typeof generateCoachStream>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);
let server: http.Server;
let baseUrl = '';

describe('SPX coach SSE integration', () => {
  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind SPX coach integration test server');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateCoachStream.mockResolvedValue([
      {
        id: 'coach-1',
        type: 'pre_trade',
        priority: 'setup',
        setupId: 'setup-1',
        content: 'Primary setup message',
        structuredData: { setupId: 'setup-1' },
        timestamp: '2026-02-15T15:10:00.000Z',
      },
      {
        id: 'coach-2',
        type: 'in_trade',
        priority: 'guidance',
        setupId: 'setup-1',
        content: 'Manage risk while in trade',
        structuredData: { stop: 6008 },
        timestamp: '2026-02-15T15:10:01.000Z',
      },
    ] as any);
  });

  it('streams multiple coach_message events and a final done event', async () => {
    const res = await request(baseUrl)
      .post('/api/spx/coach/message')
      .send({ prompt: 'How should I manage this setup?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text.match(/event: coach_message/g)?.length).toBe(2);
    expect(res.text).toContain('Primary setup message');
    expect(res.text).toContain('Manage risk while in trade');
    expect(res.text).toContain('event: done');

    expect(mockGenerateCoachStream).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'stream-user-1',
    }));
  });
});
