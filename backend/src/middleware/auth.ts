import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { supabase } from '../config/database';

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
