import { requireTier, hasRequiredTierForUser, clearTierCacheForTests } from '../requireTier';

const mockFrom = jest.fn() as jest.Mock<any, any>;

jest.mock('../../config/database', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function permissionsChain(result: { data: any; error: any }) {
  const chain: any = {
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
  };

  return {
    select: jest.fn().mockReturnValue(chain),
  };
}

function aiCoachChain(result: { data: any; error: any }) {
  const chain: any = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };

  return {
    select: jest.fn().mockReturnValue(chain),
  };
}

describe('requireTier middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearTierCacheForTests();
  });

  it('returns 401 when user is missing on request', async () => {
    const middleware = requireTier('pro');
    const req: any = {};
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access when user has pro permission', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_permissions') {
        return permissionsChain({
          data: [{ expires_at: null, app_permissions: { name: 'access_pro_content' } }],
          error: null,
        });
      }

      if (table === 'ai_coach_users') {
        return aiCoachChain({ data: null, error: null });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const middleware = requireTier('pro');
    const req: any = { user: { id: 'user-1' } };
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for insufficient tier', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_permissions') {
        return permissionsChain({
          data: [{ expires_at: null, app_permissions: { name: 'access_core_content' } }],
          error: null,
        });
      }

      if (table === 'ai_coach_users') {
        return aiCoachChain({ data: null, error: null });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const middleware = requireTier('pro');
    const req: any = { user: { id: 'user-1' } };
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This feature requires a Pro subscription',
      requiredTier: 'pro',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to ai_coach_users tier when user permissions are missing', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_permissions') {
        return permissionsChain({ data: [], error: null });
      }

      if (table === 'ai_coach_users') {
        return aiCoachChain({
          data: { subscription_tier: 'pro' },
          error: null,
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const middleware = requireTier('pro');
    const req: any = { user: { id: 'user-2' } };
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('caches tier lookups for repeated checks', async () => {
    let userPermissionLookups = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_permissions') {
        userPermissionLookups += 1;
        return permissionsChain({
          data: [{ expires_at: null, app_permissions: { name: 'access_pro_content' } }],
          error: null,
        });
      }

      if (table === 'ai_coach_users') {
        return aiCoachChain({ data: null, error: null });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const first = await hasRequiredTierForUser('user-cache', ['pro']);
    const second = await hasRequiredTierForUser('user-cache', ['pro']);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(userPermissionLookups).toBe(1);
  });
});
