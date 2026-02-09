import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { supabase } from '../config/database';
import { getEnv } from '../config/env';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ensuredE2EUsers = new Set<string>();

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

// Middleware to verify JWT token from Supabase
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const env = getEnv();

    const bypassEnabled = env.E2E_BYPASS_AUTH && env.NODE_ENV !== 'production';
    const bypassPrefix = env.E2E_BYPASS_TOKEN_PREFIX;
    if (bypassEnabled && token.startsWith(bypassPrefix)) {
      const userId = token.slice(bypassPrefix.length).trim();
      if (!UUID_REGEX.test(userId)) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid E2E bypass token format'
        });
        return;
      }

      try {
        await ensureE2EUserExists(userId);
      } catch (e) {
        logger.error('E2E user provisioning failed', {
          userId,
          error: e instanceof Error ? e.message : String(e),
        });
        res.status(500).json({
          error: 'Internal server error',
          message: 'E2E auth bootstrap failed'
        });
        return;
      }

      req.user = {
        id: userId,
        email: `e2e+${userId}@tradeitm.local`
      };
      next();
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
      return;
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email
    };

    next();
  } catch (error) {
    logger.error('Authentication error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

// Middleware to check and atomically increment query limits
export async function checkQueryLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
      return;
    }

    // Atomic increment: only increments if under limit
    // Uses RPC call to avoid race condition between read and write
    const { data, error } = await supabase.rpc('increment_query_count_if_allowed', {
      p_user_id: req.user.id
    });

    if (error) {
      // If RPC doesn't exist yet, fall back to basic check (log warning)
      logger.warn('increment_query_count_if_allowed RPC not found, using fallback', { error: error.message });

      // Fallback: SELECT ... FOR UPDATE pattern via raw query
      const { data: profile, error: profileError } = await supabase
        .from('ai_coach_users')
        .select('query_count, query_limit, billing_period_end')
        .eq('user_id', req.user.id)
        .single();

      if (profileError || !profile) {
        // No profile = no limit enforced
        next();
        return;
      }

      if (profile.query_count >= profile.query_limit) {
        res.status(429).json({
          error: 'Query limit exceeded',
          message: `You have reached your monthly limit of ${profile.query_limit} queries.`,
          queryCount: profile.query_count,
          queryLimit: profile.query_limit,
          resetDate: profile.billing_period_end,
        });
        return;
      }

      // Non-atomic fallback increment (still better than before)
      await supabase
        .from('ai_coach_users')
        .update({ query_count: profile.query_count + 1 })
        .eq('user_id', req.user.id)
        .eq('query_count', profile.query_count); // Optimistic lock

      next();
      return;
    }

    // RPC returns: { allowed: boolean, query_count, query_limit, billing_period_end }
    if (data && !data.allowed) {
      res.status(429).json({
        error: 'Query limit exceeded',
        message: `You have reached your monthly limit of ${data.query_limit} queries.`,
        queryCount: data.query_count,
        queryLimit: data.query_limit,
        resetDate: data.billing_period_end,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Query limit check error', { error: error instanceof Error ? error.message : String(error) });
    // Don't block request on error - but log for investigation
    next();
  }
}
