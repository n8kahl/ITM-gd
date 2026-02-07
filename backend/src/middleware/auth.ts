import { Request, Response, NextFunction } from 'express';
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
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

// Middleware to check query limits
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

    // Get user's AI Coach profile
    const { data: profile, error } = await supabase
      .from('ai_coach_users')
      .select('query_count, query_limit, billing_period_end')
      .eq('user_id', req.user.id)
      .single();

    if (error || !profile) {
      // User doesn't have AI Coach profile yet - skip check
      next();
      return;
    }

    // Check if query limit exceeded
    if (profile.query_count >= profile.query_limit) {
      res.status(403).json({
        error: 'Query limit exceeded',
        message: `You have reached your monthly query limit of ${profile.query_limit}. Upgrade to Pro for 500 queries/month.`,
        queryCount: profile.query_count,
        queryLimit: profile.query_limit,
        resetDate: profile.billing_period_end
      });
      return;
    }

    // Increment query count
    await supabase
      .from('ai_coach_users')
      .update({ query_count: profile.query_count + 1 })
      .eq('user_id', req.user.id);

    next();
  } catch (error) {
    console.error('Query limit check error:', error);
    // Don't block request on error
    next();
  }
}
