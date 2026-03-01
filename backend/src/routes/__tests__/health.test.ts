import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';

const mockAuthenticateToken = jest.fn();
const mockGetWebSocketHealth = jest.fn();
const mockTradierGetBalances = jest.fn();
const mockGetTradierExecutionRuntimeStatus = jest.fn();

const ORIGINAL_TRADIER_ENV = {
  TRADIER_HEALTHCHECK_ACCOUNT_ID: process.env.TRADIER_HEALTHCHECK_ACCOUNT_ID,
  TRADIER_HEALTHCHECK_ACCESS_TOKEN: process.env.TRADIER_HEALTHCHECK_ACCESS_TOKEN,
  TRADIER_HEALTHCHECK_SANDBOX: process.env.TRADIER_HEALTHCHECK_SANDBOX,
  TRADIER_ACCOUNT_ID: process.env.TRADIER_ACCOUNT_ID,
  TRADIER_ACCESS_TOKEN: process.env.TRADIER_ACCESS_TOKEN,
  TRADIER_SANDBOX: process.env.TRADIER_SANDBOX,
  TRADIER_EXECUTION_SANDBOX: process.env.TRADIER_EXECUTION_SANDBOX,
};

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (...args: unknown[]) => mockAuthenticateToken(...args),
}));

jest.mock('../../config/database', () => ({
  testDatabaseConnection: jest.fn(),
  supabase: {},
}));

jest.mock('../../config/redis', () => ({
  testRedisConnection: jest.fn(),
}));

jest.mock('../../config/massive', () => ({
  testMassiveConnection: jest.fn(),
  getDailyAggregates: jest.fn(),
  getMinuteAggregates: jest.fn(),
  getOptionsContracts: jest.fn(),
  getOptionsExpirations: jest.fn(),
}));

jest.mock('../../config/openai', () => ({
  testOpenAIConnection: jest.fn(),
  openaiClient: {
    chat: { completions: { create: jest.fn() } },
  },
  CHAT_MODEL: 'gpt-4o',
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/workerHealth', () => ({
  getWorkerHealthSnapshot: jest.fn(() => []),
}));

jest.mock('../../services/websocket', () => ({
  getWebSocketHealth: (...args: unknown[]) => mockGetWebSocketHealth(...args),
}));

jest.mock('../../services/broker/tradier/client', () => ({
  TradierClient: jest.fn().mockImplementation(() => ({
    getBalances: (...args: unknown[]) => mockTradierGetBalances(...args),
  })),
}));

jest.mock('../../services/broker/tradier/executionEngine', () => ({
  getTradierExecutionRuntimeStatus: (...args: unknown[]) => mockGetTradierExecutionRuntimeStatus(...args),
}));

import healthRouter from '../health';
import { testDatabaseConnection } from '../../config/database';
import { testRedisConnection } from '../../config/redis';
import { testMassiveConnection } from '../../config/massive';
import { testOpenAIConnection } from '../../config/openai';

const mockTestDatabaseConnection = testDatabaseConnection as jest.MockedFunction<typeof testDatabaseConnection>;
const mockTestRedisConnection = testRedisConnection as jest.MockedFunction<typeof testRedisConnection>;
const mockTestMassiveConnection = testMassiveConnection as jest.MockedFunction<typeof testMassiveConnection>;
const mockTestOpenAIConnection = testOpenAIConnection as jest.MockedFunction<typeof testOpenAIConnection>;

const app = express();
app.use('/health', healthRouter);

describeWithSockets('Health Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TRADIER_HEALTHCHECK_ACCOUNT_ID;
    delete process.env.TRADIER_HEALTHCHECK_ACCESS_TOKEN;
    delete process.env.TRADIER_HEALTHCHECK_SANDBOX;
    delete process.env.TRADIER_ACCOUNT_ID;
    delete process.env.TRADIER_ACCESS_TOKEN;
    delete process.env.TRADIER_SANDBOX;
    delete process.env.TRADIER_EXECUTION_SANDBOX;
    mockTestDatabaseConnection.mockResolvedValue(true);
    mockTestRedisConnection.mockResolvedValue(true);
    mockTestMassiveConnection.mockResolvedValue(true);
    mockTestOpenAIConnection.mockResolvedValue(true);
    mockTradierGetBalances.mockResolvedValue({
      totalEquity: 50_000,
      dayTradeBuyingPower: 100_000,
      realizedPnlDaily: 0,
      raw: {},
    });
    mockGetTradierExecutionRuntimeStatus.mockReturnValue({
      enabled: false,
      reason: 'disabled_via_base_flag',
      sandboxDefault: true,
      metadataRequired: true,
      trackedTrades: 0,
    });
    mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
        return;
      }

      req.user = { id: 'test-user' };
      next();
    });
    mockGetWebSocketHealth.mockReturnValue({
      server: {
        clientCount: 2,
        maxClients: 200,
        utilizationPct: 1,
        subscriptionsBySymbol: {
          SPX: 2,
        },
      },
      broadcast: {
        lastTickBroadcast: {
          SPX: { ageMs: 123 },
        },
        lastMicrobarBroadcast: {},
        feedHealthBroadcastAgeMs: null,
      },
      upstream: {
        connectionState: 'active',
      },
      timestamp: new Date().toISOString(),
    });
  });

  afterAll(() => {
    process.env.TRADIER_HEALTHCHECK_ACCOUNT_ID = ORIGINAL_TRADIER_ENV.TRADIER_HEALTHCHECK_ACCOUNT_ID;
    process.env.TRADIER_HEALTHCHECK_ACCESS_TOKEN = ORIGINAL_TRADIER_ENV.TRADIER_HEALTHCHECK_ACCESS_TOKEN;
    process.env.TRADIER_HEALTHCHECK_SANDBOX = ORIGINAL_TRADIER_ENV.TRADIER_HEALTHCHECK_SANDBOX;
    process.env.TRADIER_ACCOUNT_ID = ORIGINAL_TRADIER_ENV.TRADIER_ACCOUNT_ID;
    process.env.TRADIER_ACCESS_TOKEN = ORIGINAL_TRADIER_ENV.TRADIER_ACCESS_TOKEN;
    process.env.TRADIER_SANDBOX = ORIGINAL_TRADIER_ENV.TRADIER_SANDBOX;
    process.env.TRADIER_EXECUTION_SANDBOX = ORIGINAL_TRADIER_ENV.TRADIER_EXECUTION_SANDBOX;
  });

  it('returns detailed health payload with service booleans', async () => {
    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services).toMatchObject({
      database: true,
      redis: true,
      massive: true,
      openai: true,
      tradier: true,
    });
    expect(typeof res.body.services.massiveTick).toBe('boolean');
    expect(res.body.checks.database.status).toBe('pass');
    expect(res.body.checks.tradier.status).toBe('pass');
  });

  it('returns 503 and unhealthy when required dependencies fail', async () => {
    mockTestDatabaseConnection.mockResolvedValue(false);
    mockTestMassiveConnection.mockResolvedValue(false);

    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services.database).toBe(false);
    expect(res.body.services.massive).toBe(false);
  });

  it('returns unhealthy when tradier runtime is enabled but healthcheck credentials are missing', async () => {
    mockGetTradierExecutionRuntimeStatus.mockReturnValue({
      enabled: true,
      reason: null,
      sandboxDefault: true,
      metadataRequired: true,
      trackedTrades: 0,
    });

    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services.tradier).toBe(false);
    expect(res.body.checks.tradier.status).toBe('fail');
  });

  it('returns unhealthy when tradier connectivity probe fails', async () => {
    process.env.TRADIER_HEALTHCHECK_ACCOUNT_ID = 'ABC123';
    process.env.TRADIER_HEALTHCHECK_ACCESS_TOKEN = 'test-token';
    mockTradierGetBalances.mockRejectedValueOnce(new Error('tradier unavailable'));

    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services.tradier).toBe(false);
    expect(res.body.checks.tradier.status).toBe('fail');
  });

  it('GET /health/ws requires auth', async () => {
    const res = await request(app).get('/health/ws');

    expect(res.status).toBe(401);
    expect(mockGetWebSocketHealth).not.toHaveBeenCalled();
  });

  it('GET /health/ws returns websocket health snapshot when authenticated', async () => {
    const res = await request(app)
      .get('/health/ws')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.server.clientCount).toEqual(expect.any(Number));
    expect(res.body.server.maxClients).toEqual(expect.any(Number));
    expect(res.body.upstream.connectionState).toEqual(expect.any(String));
    expect(res.body.broadcast.lastTickBroadcast).toEqual(expect.any(Object));
  });
});
