import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

const mockAuthenticateToken = jest.fn();

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (...args: unknown[]) => mockAuthenticateToken(...args),
}));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../config/massive', () => ({
  getMinuteAggregates: jest.fn(),
  getOptionsSnapshotAtDate: jest.fn(),
}));

jest.mock('../../services/trade-day-replay/transcript-parser', () => {
  const actual = jest.requireActual('../../services/trade-day-replay/transcript-parser');
  return {
    ...actual,
    parseTranscriptToTrades: jest.fn(),
  };
});

jest.mock('../../services/trade-day-replay/trade-scorer', () => ({
  scoreTrade: jest.fn(() => null),
}));

import tradeDayReplayRouter from '../trade-day-replay';
import { supabase } from '../../config/database';
import {
  parseTranscriptToTrades,
  TranscriptParserError,
} from '../../services/trade-day-replay/transcript-parser';
import { getMinuteAggregates } from '../../config/massive';
import type { ParsedTrade } from '../../services/trade-day-replay/types';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockParseTranscriptToTrades = parseTranscriptToTrades as jest.MockedFunction<typeof parseTranscriptToTrades>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;

const app = express();
app.use(express.json());
app.use('/api/trade-day-replay', tradeDayReplayRouter);

function adminRoleChain() {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: { role: 'admin' },
    error: null,
  });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  return { select };
}

function profileRoleChain(role: string) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: { role },
    error: null,
  });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  return { select };
}

function makeParsedTrade(index: number): ParsedTrade {
  return {
    tradeIndex: index,
    contract: {
      symbol: 'SPX',
      strike: 5000,
      type: 'call',
      expiry: '2026-02-20',
    },
    direction: 'long',
    entryPrice: 1.25,
    entryTimestamp: '2026-02-20T09:35:00-05:00',
    exitEvents: [
      {
        type: 'full_exit',
        timestamp: '2026-02-20T09:45:00-05:00',
      },
    ],
    stopLevels: [],
    spxReferences: [5005],
    sizing: null,
    rawMessages: ['Filled call'],
  };
}

describeWithSockets('Trade Day Replay Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'admin-user-123' };
      next();
    });
    mockSupabase.from.mockReturnValue(adminRoleChain() as any);
  });

  it('GET /api/trade-day-replay/health returns limits contract for admin user', async () => {
    const res = await request(app).get('/api/trade-day-replay/health');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Number.isInteger(res.body?.limits?.maxTranscriptChars)).toBe(true);
    expect(res.body?.limits?.maxTranscriptChars).toBeGreaterThan(0);
    expect(Number.isInteger(res.body?.limits?.maxParsedTrades)).toBe(true);
    expect(res.body?.limits?.maxParsedTrades).toBeGreaterThan(0);
  });

  it('blocks unauthenticated requests with 401 on health and build', async () => {
    mockAuthenticateToken.mockImplementation((_req: any, _res: any, next: any) => {
      next();
    });

    const healthRes = await request(app).get('/api/trade-day-replay/health');
    expect(healthRes.status).toBe(401);
    expect(healthRes.body.code).toBe('UNAUTHORIZED');

    const buildRes = await request(app)
      .post('/api/trade-day-replay/build')
      .send({ transcript: 'Filled 1.25' });
    expect(buildRes.status).toBe(401);
    expect(buildRes.body.code).toBe('UNAUTHORIZED');
  });

  it('blocks non-admin users with 403 on health and build', async () => {
    mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'member-user-123' };
      next();
    });
    mockSupabase.from.mockReturnValue(profileRoleChain('member') as any);

    const healthRes = await request(app).get('/api/trade-day-replay/health');
    expect(healthRes.status).toBe(403);
    expect(healthRes.body.code).toBe('FORBIDDEN');

    const buildRes = await request(app)
      .post('/api/trade-day-replay/build')
      .send({ transcript: 'Filled 1.25' });
    expect(buildRes.status).toBe(403);
    expect(buildRes.body.code).toBe('FORBIDDEN');
  });

  it('returns 400 VALIDATION_ERROR for invalid inputTimezone and does not call parser', async () => {
    const res = await request(app)
      .post('/api/trade-day-replay/build')
      .send({
        transcript: 'Filled 1.25',
        inputTimezone: 'Mars/Phobos',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(mockParseTranscriptToTrades).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for invalid calendar date and does not call parser', async () => {
    const res = await request(app)
      .post('/api/trade-day-replay/build')
      .send({
        transcript: 'Filled 1.25',
        date: '2026-02-30',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(mockParseTranscriptToTrades).not.toHaveBeenCalled();
  });

  it('maps OPENAI_REQUEST_FAILED parser errors to 502 EXTERNAL_SERVICE_ERROR', async () => {
    mockParseTranscriptToTrades.mockRejectedValueOnce(
      new TranscriptParserError('OPENAI_REQUEST_FAILED', 'Trade transcript parsing request failed.')
    );

    const res = await request(app)
      .post('/api/trade-day-replay/build')
      .send({ transcript: 'Filled 1.25' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('EXTERNAL_SERVICE_ERROR');
  });

  it('maps TRADE_VALIDATION_FAILED parser errors to 422 VALIDATION_ERROR', async () => {
    mockParseTranscriptToTrades.mockRejectedValueOnce(
      new TranscriptParserError(
        'TRADE_VALIDATION_FAILED',
        'Parsed trades failed replay validation checks.',
        { issues: [{ path: 'trades[0].entryTimestamp', message: 'Entry timestamp invalid' }] },
      )
    );

    const res = await request(app)
      .post('/api/trade-day-replay/build')
      .send({ transcript: 'Filled 1.25' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 on parsed-trade count guardrail and skips market data fetch', async () => {
    mockParseTranscriptToTrades.mockResolvedValueOnce(
      Array.from({ length: 26 }, (_value, index) => makeParsedTrade(index + 1))
    );

    const res = await request(app)
      .post('/api/trade-day-replay/build')
      .send({ transcript: 'Filled call repeatedly' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(String(res.body.message)).toContain('max supported is 25');
    expect(mockGetMinuteAggregates).not.toHaveBeenCalled();
  });
});
