import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { supabase } from '../config/database';
import { extractBearerToken, AuthTokenError, verifyAuthToken } from '../lib/tokenAuth';

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

interface QueryLimitRpcResult {
  allowed: boolean;
  query_count: number;
  query_limit: number;
  billing_period_end: string | null;
}

// Middleware to verify JWT token from Supabase
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
      return;
    }

    const user = await verifyAuthToken(token);

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    if (error instanceof AuthTokenError) {
      const errorLabel = error.statusCode === 401 ? 'Unauthorized' : 'Internal server error';
      res.status(error.statusCode).json({
        error: errorLabel,
        message: error.clientMessage,
      });
      return;
    }

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

    // Atomic increment: only increments if under limit.
    // The RPC is required to prevent race conditions under concurrency.
    const { data, error } = await supabase.rpc('increment_query_count_if_allowed', {
      p_user_id: req.user.id
    });

    if (error) {
      logger.error('increment_query_count_if_allowed RPC failed', {
        userId: req.user.id,
        error: error.message,
      });

      res.status(503).json({
        error: 'Rate limiting temporarily unavailable',
        message: 'Please try again shortly.',
      });
      return;
    }

    const rpcResult = data as QueryLimitRpcResult | null;
    if (!rpcResult || typeof rpcResult.allowed !== 'boolean') {
      logger.error('increment_query_count_if_allowed returned invalid payload', {
        userId: req.user.id,
        payload: data,
      });
      res.status(503).json({
        error: 'Rate limiting temporarily unavailable',
        message: 'Please try again shortly.',
      });
      return;
    }

    if (!rpcResult.allowed) {
      res.status(429).json({
        error: 'Query limit exceeded',
        message: `You have reached your monthly limit of ${rpcResult.query_limit} queries.`,
        queryCount: rpcResult.query_count,
        queryLimit: rpcResult.query_limit,
        resetDate: rpcResult.billing_period_end,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Query limit check error', { error: error instanceof Error ? error.message : String(error) });
    res.status(503).json({
      error: 'Rate limiting temporarily unavailable',
      message: 'Please try again shortly.',
    });
  }
}
