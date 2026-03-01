import request from 'supertest';
import express from 'express';
import { describeWithSockets } from '../../testUtils/socketDescribe';

const mockAuthenticateToken = jest.fn();
const mockHasBackendAdminAccess = jest.fn();

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
  checkQueryLimit: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/requireTier', () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../lib/adminAccess', () => ({
  hasBackendAdminAccess: (...args: unknown[]) => mockHasBackendAdminAccess(...args),
}));

jest.mock('../../services/spx/levelEngine', () => ({ getMergedLevels: jest.fn() }));
jest.mock('../../services/spx/gexEngine', () => ({ computeUnifiedGEXLandscape: jest.fn() }));
jest.mock('../../services/spx/setupDetector', () => ({
  detectActiveSetups: jest.fn(),
  getLatestSetupEnvironmentState: jest.fn(),
  getSetupById: jest.fn(),
}));
jest.mock('../../services/spx/fibEngine', () => ({ getFibLevels: jest.fn() }));
jest.mock('../../services/spx/flowEngine', () => ({ getFlowEvents: jest.fn() }));
jest.mock('../../services/spx/regimeClassifier', () => ({ classifyCurrentRegime: jest.fn() }));
jest.mock('../../services/spx/aiPredictor', () => ({ getPredictionState: jest.fn() }));
jest.mock('../../services/spx/crossReference', () => ({ getBasisState: jest.fn() }));
jest.mock('../../services/spx/contractSelector', () => ({ getContractRecommendation: jest.fn() }));
jest.mock('../../services/spx/outcomeTracker', () => ({ getSPXWinRateAnalytics: jest.fn() }));
jest.mock('../../services/spx/winRateBacktest', () => ({ runSPXWinRateBacktest: jest.fn() }));
jest.mock('../../services/spx/optimizer', () => ({
  getActiveSPXOptimizationProfile: jest.fn(),
  getSPXOptimizerScorecard: jest.fn(),
  runSPXOptimizerScan: jest.fn(),
  revertSPXOptimizationProfile: jest.fn(),
}));
jest.mock('../../workers/spxOptimizerWorker', () => ({ getSPXOptimizerWorkerStatus: jest.fn() }));
jest.mock('../../services/spx/aiCoach', () => ({ getCoachState: jest.fn(), generateCoachStream: jest.fn() }));
jest.mock('../../services/spx/coachDecisionEngine', () => ({ generateCoachDecision: jest.fn() }));
jest.mock('../../services/spx', () => ({ getSPXSnapshot: jest.fn() }));

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import spxRouter from '../../routes/spx';
import { supabase } from '../../config/database';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const app = express();
app.use(express.json());
app.use('/api/spx', spxRouter);

const VALID_SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_TRADE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createSessionLookupBuilder(result: { data: Record<string, unknown> | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createTradeLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createMessageLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createSnapshotLookupBuilder(result: { data: Record<string, unknown>[] | null; error: unknown | null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

describeWithSockets('SPX replay journal create API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'integration-user-1' };
      next();
    });
    mockHasBackendAdminAccess.mockResolvedValue(true);
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected supabase.from call');
    });
  });

  it('returns 400 when sessionId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/spx/replay-sessions/not-a-uuid/journal')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin users', async () => {
    mockHasBackendAdminAccess.mockResolvedValue(false);

    const res = await request(app)
      .post(`/api/spx/replay-sessions/${VALID_SESSION_ID}/journal`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 400 when parsedTradeId does not map to the provided session', async () => {
    const sessionBuilder = createSessionLookupBuilder({
      data: {
        id: VALID_SESSION_ID,
        session_date: '2026-03-01',
      },
      error: null,
    });
    const tradeBuilder = createTradeLookupBuilder({
      data: [],
      error: null,
    });
    const messageBuilder = createMessageLookupBuilder({ data: [], error: null });
    const snapshotBuilder = createSnapshotLookupBuilder({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradeBuilder;
      if (table === 'discord_messages') return messageBuilder;
      if (table === 'replay_snapshots') return snapshotBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .post(`/api/spx/replay-sessions/${VALID_SESSION_ID}/journal`)
      .send({ parsedTradeId: VALID_TRADE_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(tradeBuilder.eq).toHaveBeenCalledWith('id', VALID_TRADE_ID);
  });

  it('returns 201 with deterministic created/existing counts and replay backlink metadata', async () => {
    const sessionBuilder = createSessionLookupBuilder({
      data: {
        id: VALID_SESSION_ID,
        session_date: '2026-03-01',
        channel_id: 'channel-123',
        channel_name: 'SPX Premium',
        caller_name: 'Nate',
        session_start: '2026-03-01T14:30:00.000Z',
        session_end: '2026-03-01T15:05:00.000Z',
        session_summary: 'Trend continuation.',
      },
      error: null,
    });
    const tradeBuilder = createTradeLookupBuilder({
      data: [
        {
          id: VALID_TRADE_ID,
          trade_index: 1,
          symbol: 'SPX',
          strike: 6030,
          contract_type: 'call',
          expiry: '2026-03-01',
          direction: 'long',
          entry_price: 1.2,
          entry_timestamp: '2026-03-01T14:35:00.000Z',
          sizing: 'starter',
          initial_stop: 0.9,
          target_1: 1.8,
          target_2: 2.4,
          thesis_text: 'Breakout',
          entry_condition: 'Hold above ORH',
          lifecycle_events: [{ type: 'trim', at: '2026-03-01T14:42:00.000Z' }],
          final_pnl_pct: 12.5,
          is_winner: true,
          fully_exited: true,
          exit_timestamp: '2026-03-01T14:58:00.000Z',
          entry_snapshot_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
      ],
      error: null,
    });
    const messageBuilder = createMessageLookupBuilder({
      data: [
        {
          id: 'msg-1',
          discord_msg_id: '111',
          author_name: 'Nate',
          author_id: 'nate-1',
          content: 'Thesis: hold ORH then press',
          sent_at: '2026-03-01T14:31:00.000Z',
          is_signal: true,
          signal_type: 'thesis',
          parsed_trade_id: VALID_TRADE_ID,
          created_at: '2026-03-01T14:31:01.000Z',
        },
      ],
      error: null,
    });
    const snapshotBuilder = createSnapshotLookupBuilder({
      data: [
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          symbol: 'SPX',
          captured_at: '2026-03-01T14:34:00.000Z',
          rr_ratio: 1.4,
          ev_r: 0.5,
          mtf_composite: 0.9,
          mtf_aligned: true,
          regime: 'trending',
          regime_direction: 'bullish',
          env_gate_passed: true,
          vix_value: 18.2,
          memory_setup_type: 'orb_breakout',
          spx_price: 6031.5,
        },
      ],
      error: null,
    });

    let upsertPayload: Record<string, unknown>[] = [];
    const journalBuilder: any = {
      upsert: jest.fn((payload: Record<string, unknown>[]) => {
        upsertPayload = payload;
        return journalBuilder;
      }),
      select: jest.fn().mockImplementation(async () => ({
        data: [{ id: (upsertPayload[0] as { id?: string })?.id ?? null }],
        error: null,
      })),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradeBuilder;
      if (table === 'discord_messages') return messageBuilder;
      if (table === 'replay_snapshots') return snapshotBuilder;
      if (table === 'journal_entries') return journalBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .post(`/api/spx/replay-sessions/${VALID_SESSION_ID}/journal`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe(VALID_SESSION_ID);
    expect(res.body.count).toBe(1);
    expect(res.body.createdCount).toBe(1);
    expect(res.body.existingCount).toBe(0);
    expect(res.body.results[0]).toEqual(expect.objectContaining({
      parsedTradeId: VALID_TRADE_ID,
      status: 'created',
    }));
    expect(String(res.body.results[0].replayBacklink)).toContain(`sessionId=${VALID_SESSION_ID}`);
    expect(String(res.body.results[0].replayBacklink)).toContain(`parsedTradeId=${VALID_TRADE_ID}`);
    expect(journalBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'SPX',
          direction: 'long',
          contract_type: 'call',
          strategy: 'same_day_replay',
          tags: expect.arrayContaining(['replay', 'spx-replay']),
        }),
      ]),
      expect.objectContaining({
        onConflict: 'id',
        ignoreDuplicates: true,
      }),
    );
  });

  it('returns 503 when journal upsert fails', async () => {
    const sessionBuilder = createSessionLookupBuilder({
      data: { id: VALID_SESSION_ID, session_date: '2026-03-01' },
      error: null,
    });
    const tradeBuilder = createTradeLookupBuilder({
      data: [
        {
          id: VALID_TRADE_ID,
          trade_index: 1,
          symbol: 'SPX',
          strike: 6030,
          contract_type: 'call',
          direction: 'long',
          entry_price: 1.2,
          entry_timestamp: '2026-03-01T14:35:00.000Z',
          lifecycle_events: [],
          final_pnl_pct: 12.5,
          fully_exited: true,
          exit_timestamp: '2026-03-01T14:58:00.000Z',
          entry_snapshot_id: null,
        },
      ],
      error: null,
    });
    const messageBuilder = createMessageLookupBuilder({ data: [], error: null });
    const snapshotBuilder = createSnapshotLookupBuilder({ data: [], error: null });
    const journalBuilder: any = {
      upsert: jest.fn(() => journalBuilder),
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'journal insert failed' },
      }),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'discord_trade_sessions') return sessionBuilder;
      if (table === 'discord_parsed_trades') return tradeBuilder;
      if (table === 'discord_messages') return messageBuilder;
      if (table === 'replay_snapshots') return snapshotBuilder;
      if (table === 'journal_entries') return journalBuilder;
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const res = await request(app)
      .post(`/api/spx/replay-sessions/${VALID_SESSION_ID}/journal`)
      .send({});

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Data unavailable');
    expect(String(res.body.message)).toContain('Unable to save replay session to journal');
  });
});
