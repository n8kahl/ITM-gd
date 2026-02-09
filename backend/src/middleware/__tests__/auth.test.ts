import { authenticateToken } from '../auth';

const mockGetUser = jest.fn();
const mockGetUserById = jest.fn();
const mockCreateUser = jest.fn();
const mockGetEnv = jest.fn();

jest.mock('../../config/database', () => ({
  supabase: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
      admin: {
        getUserById: (...args: any[]) => mockGetUserById(...args),
        createUser: (...args: any[]) => mockCreateUser(...args),
      },
    },
  },
}));

jest.mock('../../config/env', () => ({
  getEnv: () => mockGetEnv(),
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateToken middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnv.mockReturnValue({
      NODE_ENV: 'development',
      E2E_BYPASS_AUTH: false,
      E2E_BYPASS_ALLOW_IN_PRODUCTION: false,
      E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
      E2E_BYPASS_SHARED_SECRET: undefined,
    });
  });

  it('returns 401 when authorization header is missing', async () => {
    const req: any = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates valid Supabase JWT token', async () => {
    const req: any = { headers: { authorization: 'Bearer valid-jwt' } };
    const res = createRes();
    const next = jest.fn();

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'member@example.com',
        },
      },
      error: null,
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'member@example.com',
    });
    expect(next).toHaveBeenCalled();
  });

  it('rejects malformed E2E bypass token', async () => {
    const req: any = { headers: { authorization: 'Bearer e2e:not-a-uuid' } };
    const res = createRes();
    const next = jest.fn();

    mockGetEnv.mockReturnValue({
      NODE_ENV: 'development',
      E2E_BYPASS_AUTH: true,
      E2E_BYPASS_ALLOW_IN_PRODUCTION: false,
      E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
      E2E_BYPASS_SHARED_SECRET: undefined,
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts E2E bypass token and provisions missing user', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const req: any = { headers: { authorization: `Bearer e2e:${userId}` } };
    const res = createRes();
    const next = jest.fn();

    mockGetEnv.mockReturnValue({
      NODE_ENV: 'development',
      E2E_BYPASS_AUTH: true,
      E2E_BYPASS_ALLOW_IN_PRODUCTION: false,
      E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
      E2E_BYPASS_SHARED_SECRET: undefined,
    });

    mockGetUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'User not found' },
    });
    mockCreateUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: userId,
      email: `e2e+${userId}@tradeitm.local`,
    });
    expect(next).toHaveBeenCalled();
  });

  it('requires matching E2E shared secret when configured', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const req: any = { headers: { authorization: `Bearer e2e:wrong-secret:${userId}` } };
    const res = createRes();
    const next = jest.fn();

    mockGetEnv.mockReturnValue({
      NODE_ENV: 'development',
      E2E_BYPASS_AUTH: true,
      E2E_BYPASS_ALLOW_IN_PRODUCTION: false,
      E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
      E2E_BYPASS_SHARED_SECRET: 'expected-secret',
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not allow E2E bypass in production by default', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const req: any = { headers: { authorization: `Bearer e2e:${userId}` } };
    const res = createRes();
    const next = jest.fn();

    mockGetEnv.mockReturnValue({
      NODE_ENV: 'production',
      E2E_BYPASS_AUTH: true,
      E2E_BYPASS_ALLOW_IN_PRODUCTION: false,
      E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
      E2E_BYPASS_SHARED_SECRET: undefined,
    });

    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows E2E bypass in production only when explicitly enabled', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const req: any = { headers: { authorization: `Bearer e2e:${userId}` } };
    const res = createRes();
    const next = jest.fn();

    mockGetEnv.mockReturnValue({
      NODE_ENV: 'production',
      E2E_BYPASS_AUTH: true,
      E2E_BYPASS_ALLOW_IN_PRODUCTION: true,
      E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
      E2E_BYPASS_SHARED_SECRET: undefined,
    });

    mockGetUserById.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: userId,
      email: `e2e+${userId}@tradeitm.local`,
    });
    expect(next).toHaveBeenCalled();
  });
});
