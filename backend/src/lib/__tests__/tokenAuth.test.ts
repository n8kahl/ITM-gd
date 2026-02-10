import { extractBearerToken, verifyAuthToken } from '../tokenAuth';

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

jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('tokenAuth', () => {
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

  describe('extractBearerToken', () => {
    it('extracts token from a valid bearer header', () => {
      expect(extractBearerToken('Bearer test-token')).toBe('test-token');
    });

    it('returns null for missing or malformed headers', () => {
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken('test-token')).toBeNull();
      expect(extractBearerToken('Bearer   ')).toBeNull();
    });

    it('supports array-style header values', () => {
      expect(extractBearerToken(['Bearer abc', 'Bearer def'])).toBe('abc');
    });
  });

  describe('verifyAuthToken', () => {
    it('verifies a standard Supabase JWT token', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'member@example.com',
          },
        },
        error: null,
      });

      const user = await verifyAuthToken('valid-jwt');

      expect(user).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'member@example.com',
        source: 'supabase',
      });
    });

    it('throws unauthorized for invalid Supabase token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid token' },
      });

      await expect(verifyAuthToken('bad-jwt')).rejects.toMatchObject({
        statusCode: 401,
        clientMessage: 'Invalid or expired token',
      });
    });

    it('supports E2E bypass token and provisions missing user', async () => {
      const userId = '00000000-0000-4000-8000-000000000111';
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

      const user = await verifyAuthToken(`e2e:${userId}`);

      expect(user).toEqual({
        id: userId,
        email: `e2e+${userId}@tradeitm.local`,
        source: 'e2e',
      });
      expect(mockCreateUser).toHaveBeenCalled();
    });

    it('rejects E2E bypass with invalid shared secret', async () => {
      const userId = '00000000-0000-4000-8000-000000000222';
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'development',
        E2E_BYPASS_AUTH: true,
        E2E_BYPASS_ALLOW_IN_PRODUCTION: false,
        E2E_BYPASS_TOKEN_PREFIX: 'e2e:',
        E2E_BYPASS_SHARED_SECRET: 'expected-secret',
      });

      await expect(verifyAuthToken(`e2e:wrong-secret:${userId}`)).rejects.toMatchObject({
        statusCode: 401,
        clientMessage: 'Invalid E2E bypass token format',
      });
    });
  });
});
