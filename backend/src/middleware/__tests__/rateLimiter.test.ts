import request from 'supertest';
import express from 'express';
import { chatLimiter } from '../rateLimiter';

// Mock logger
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Rate Limiter Middleware', () => {
  it('should allow requests within the limit', async () => {
    const app = express();
    app.use(chatLimiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('20');
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('should include rate limit headers', async () => {
    const app = express();
    app.use(chatLimiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });
});
