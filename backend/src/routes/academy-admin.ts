/**
 * Academy Admin Routes
 * Protected endpoints for admin-level operations: aggregation triggers,
 * cohort analytics views, and content management.
 *
 * All routes require authentication and service-role / admin check.
 *
 * Endpoints:
 *   POST /api/academy/admin/aggregation/run
 *   GET  /api/academy/admin/analytics/cohort
 *   GET  /api/academy/admin/analytics/lessons
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { supabase } from '../config/database';
import { sendError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { hasBackendAdminAccess } from '../lib/adminAccess';
import { runDailyAggregation } from '../services/academy-aggregation';

const router = Router();

// Apply auth to all admin routes
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Middleware: admin check (service-role or flagged admin user)
// ---------------------------------------------------------------------------

async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    return;
  }

  const isAdmin = await hasBackendAdminAccess(userId);
  if (!isAdmin) {
    sendError(res, 403, ErrorCode.FORBIDDEN, 'Admin access required');
    return;
  }

  next();
}

router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const runAggregationBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
});

const dateRangeQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// POST /aggregation/run — Trigger daily aggregation
// ---------------------------------------------------------------------------

router.post(
  '/aggregation/run',
  validateBody(runAggregationBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const body = (req as Request & { validatedBody: z.infer<typeof runAggregationBodySchema> }).validatedBody;

    try {
      logger.info('Admin triggered daily aggregation', { date: body.date, userId: req.user?.id });

      const result = await runDailyAggregation(body.date);

      const allErrors = [
        ...result.lessons.errors,
        ...result.cohort.errors,
        ...result.mastery.errors,
      ];

      res.json({
        success: allErrors.length === 0,
        lessons: {
          rowsUpserted: result.lessons.rowsUpserted,
          errors: result.lessons.errors,
        },
        cohort: {
          success: result.cohort.success,
          errors: result.cohort.errors,
        },
        mastery: {
          rowsInserted: result.mastery.rowsInserted,
          errors: result.mastery.errors,
        },
        totalErrors: allErrors.length,
      });
    } catch (error) {
      logger.error('Error running aggregation', { error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to run aggregation');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /analytics/cohort — Cohort metrics time series
// ---------------------------------------------------------------------------

router.get(
  '/analytics/cohort',
  validateQuery(dateRangeQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const query = (req as Request & { validatedQuery: z.infer<typeof dateRangeQuerySchema> }).validatedQuery;
    const limit = query.limit ?? 30;

    try {
      let dbQuery = supabase
        .from('academy_cohort_metrics_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (query.startDate) {
        dbQuery = dbQuery.gte('date', query.startDate);
      }
      if (query.endDate) {
        dbQuery = dbQuery.lte('date', query.endDate);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to fetch cohort metrics', { error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch cohort metrics');
        return;
      }

      res.json({ metrics: data ?? [] });
    } catch (error) {
      logger.error('Error fetching cohort metrics', { error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch cohort metrics');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /analytics/lessons — Lesson-level analytics
// ---------------------------------------------------------------------------

router.get(
  '/analytics/lessons',
  validateQuery(dateRangeQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const query = (req as Request & { validatedQuery: z.infer<typeof dateRangeQuerySchema> }).validatedQuery;
    const limit = query.limit ?? 50;

    try {
      let dbQuery = supabase
        .from('academy_lesson_analytics_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (query.startDate) {
        dbQuery = dbQuery.gte('date', query.startDate);
      }
      if (query.endDate) {
        dbQuery = dbQuery.lte('date', query.endDate);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to fetch lesson analytics', { error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch lesson analytics');
        return;
      }

      res.json({ analytics: data ?? [] });
    } catch (error) {
      logger.error('Error fetching lesson analytics', { error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch lesson analytics');
    }
  }
);

export default router;
