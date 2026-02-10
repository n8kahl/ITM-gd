import { checkQueryLimit } from '../auth';

const mockRpc = jest.fn();

jest.mock('../../config/database', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../lib/tokenAuth', () => ({
  extractBearerToken: jest.fn(),
  verifyAuthToken: jest.fn(),
  AuthTokenError: class AuthTokenError extends Error {
    statusCode = 401;
    clientMessage = 'Unauthorized';
  },
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('checkQueryLimit middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 503 when rate-limit RPC fails', async () => {
    const req: any = { user: { id: '00000000-0000-4000-8000-000000000001' } };
    const res = createRes();
    const next = jest.fn();

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc missing' },
    });

    await checkQueryLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Rate limiting temporarily unavailable',
      message: 'Please try again shortly.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 429 when query limit is exceeded', async () => {
    const req: any = { user: { id: '00000000-0000-4000-8000-000000000001' } };
    const res = createRes();
    const next = jest.fn();

    mockRpc.mockResolvedValue({
      data: {
        allowed: false,
        query_count: 50,
        query_limit: 50,
        billing_period_end: '2026-03-01T00:00:00.000Z',
      },
      error: null,
    });

    await checkQueryLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows only the configured quota under 10 concurrent requests', async () => {
    const limit = 3;
    let count = 0;

    mockRpc.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 5)));

      if (count < limit) {
        count += 1;
        return {
          data: {
            allowed: true,
            query_count: count,
            query_limit: limit,
            billing_period_end: '2026-03-01T00:00:00.000Z',
          },
          error: null,
        };
      }

      return {
        data: {
          allowed: false,
          query_count: count,
          query_limit: limit,
          billing_period_end: '2026-03-01T00:00:00.000Z',
        },
        error: null,
      };
    });

    const requests = Array.from({ length: 10 }, () => {
      const req: any = { user: { id: '00000000-0000-4000-8000-000000000001' } };
      const res = createRes();
      const next = jest.fn();
      return { req, res, next };
    });

    await Promise.all(requests.map(({ req, res, next }) => checkQueryLimit(req, res, next)));

    const allowedCount = requests.filter(({ next }) => next.mock.calls.length > 0).length;
    const blockedCount = requests.filter(({ res }) =>
      res.status.mock.calls.some((call: [number]) => call[0] === 429),
    ).length;

    expect(allowedCount).toBe(limit);
    expect(blockedCount).toBe(10 - limit);
  });
});
