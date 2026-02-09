import request from 'supertest';
import express from 'express';

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

describe('Health Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTestDatabaseConnection.mockResolvedValue(true);
    mockTestRedisConnection.mockResolvedValue(true);
    mockTestMassiveConnection.mockResolvedValue(true);
    mockTestOpenAIConnection.mockResolvedValue(true);
  });

  it('returns detailed health payload with service booleans', async () => {
    const res = await request(app).get('/health/detailed');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services).toEqual({
      database: true,
      redis: true,
      massive: true,
      openai: true,
    });
    expect(res.body.checks.database.status).toBe('pass');
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
});
