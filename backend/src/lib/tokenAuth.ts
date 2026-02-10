import { timingSafeEqual } from 'crypto';
import { supabase } from '../config/database';
import { getEnv } from '../config/env';
import { logger } from './logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ensuredE2EUsers = new Set<string>();

export interface VerifiedTokenUser {
  id: string;
  email?: string;
  source: 'supabase' | 'e2e';
}

export class AuthTokenError extends Error {
  readonly statusCode: number;
  readonly clientMessage: string;

  constructor(statusCode: number, clientMessage: string, internalMessage?: string) {
    super(internalMessage || clientMessage);
    this.name = 'AuthTokenError';
    this.statusCode = statusCode;
    this.clientMessage = clientMessage;
  }
}

function isValidSharedSecret(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

async function ensureE2EUserExists(userId: string): Promise<void> {
  if (ensuredE2EUsers.has(userId)) return;

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (data?.user) {
    ensuredE2EUsers.add(userId);
    return;
  }

  if (error && !/user.*not.*found/i.test(error.message)) {
    throw new Error(`Failed to verify E2E user: ${error.message}`);
  }

  const email = `e2e+${userId}@tradeitm.local`;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    id: userId,
    email,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Member' },
    app_metadata: { provider: 'e2e', providers: ['e2e'] },
  });

  if (createError && !/already|exists|registered/i.test(createError.message)) {
    throw new Error(`Failed to create E2E user: ${createError.message}`);
  }

  if (created?.user || !createError) {
    ensuredE2EUsers.add(userId);
  }
}

function parseE2EBypassToken(token: string): { userId: string } {
  const env = getEnv();
  const bypassPrefix = env.E2E_BYPASS_TOKEN_PREFIX;
  const bypassPayload = token.slice(bypassPrefix.length).trim();
  let userId = bypassPayload;

  if (env.E2E_BYPASS_SHARED_SECRET) {
    const separatorIndex = bypassPayload.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex >= bypassPayload.length - 1) {
      throw new AuthTokenError(401, 'Invalid E2E bypass token format');
    }

    const providedSecret = bypassPayload.slice(0, separatorIndex);
    userId = bypassPayload.slice(separatorIndex + 1);
    if (!isValidSharedSecret(env.E2E_BYPASS_SHARED_SECRET, providedSecret)) {
      throw new AuthTokenError(401, 'Invalid E2E bypass token format');
    }
  }

  if (!UUID_REGEX.test(userId)) {
    throw new AuthTokenError(401, 'Invalid E2E bypass token format');
  }

  return { userId };
}

export function extractBearerToken(headerValue?: string | string[] | null): string | null {
  const authHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function verifyAuthToken(token: string): Promise<VerifiedTokenUser> {
  const env = getEnv();
  const bypassEnabled = env.E2E_BYPASS_AUTH
    && (env.NODE_ENV !== 'production' || env.E2E_BYPASS_ALLOW_IN_PRODUCTION);

  if (bypassEnabled && token.startsWith(env.E2E_BYPASS_TOKEN_PREFIX)) {
    const { userId } = parseE2EBypassToken(token);

    try {
      await ensureE2EUserExists(userId);
    } catch (error) {
      logger.error('E2E user provisioning failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AuthTokenError(500, 'E2E auth bootstrap failed');
    }

    return {
      id: userId,
      email: `e2e+${userId}@tradeitm.local`,
      source: 'e2e',
    };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new AuthTokenError(401, 'Invalid or expired token');
  }

  return {
    id: user.id,
    email: user.email,
    source: 'supabase',
  };
}
