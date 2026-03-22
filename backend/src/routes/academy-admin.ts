/**
 * Academy Admin Routes
 * Protected endpoints for admin-level operations: aggregation triggers,
 * cohort analytics views, activity analytics, and content management.
 *
 * All routes require authentication and service-role / admin check.
 *
 * Endpoints:
 *   POST /api/academy/admin/aggregation/run
 *   GET  /api/academy/admin/analytics/cohort
 *   GET  /api/academy/admin/analytics/lessons
 *   GET  /api/academy/admin/analytics/activities
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

// ---------------------------------------------------------------------------
// GET /analytics/activities — Per-activity analytics
// Returns: pass rate, average score, avg time-to-complete, common wrong answers
// ---------------------------------------------------------------------------

const activityAnalyticsQuerySchema = z.object({
  blockType: z.string().optional(),
  lessonId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

router.get(
  '/analytics/activities',
  validateQuery(activityAnalyticsQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const query = (req as Request & { validatedQuery: z.infer<typeof activityAnalyticsQuerySchema> }).validatedQuery;
    const limit = query.limit ?? 50;

    try {
      // Fetch activity submissions from learning events
      let dbQuery = supabase
        .from('academy_learning_events')
        .select('entity_id, xp_earned, metadata, created_at')
        .eq('event_type', 'activity_submission')
        .order('created_at', { ascending: false })
        .limit(limit * 20); // Fetch extra to allow grouping

      if (query.lessonId) {
        // Filter by lesson: need to join through metadata or entity
        dbQuery = dbQuery.filter('metadata->>lessonId', 'eq', query.lessonId);
      }
      if (query.blockType) {
        dbQuery = dbQuery.filter('metadata->>blockType', 'eq', query.blockType);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to fetch activity analytics', { error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch activity analytics');
        return;
      }

      // Aggregate by block (activity)
      const byBlock = new Map<string, {
        blockId: string;
        blockType: string;
        submissions: number;
        passes: number;
        totalScore: number;
        totalMaxScore: number;
        totalTimeMs: number;
        timeCount: number;
      }>();

      for (const row of data ?? []) {
        const meta = row.metadata as Record<string, unknown> | null;
        if (!meta) continue;

        const blockId = row.entity_id as string;
        const blockType = (meta.blockType as string) ?? 'unknown';
        const score = typeof meta.score === 'number' ? meta.score : 0;
        const maxScore = typeof meta.maxScore === 'number' ? meta.maxScore : 0;
        const isCorrect = meta.isCorrect === true;
        const timeSpentMs = typeof meta.timeSpentMs === 'number' ? meta.timeSpentMs : 0;

        const existing = byBlock.get(blockId);
        if (existing) {
          existing.submissions++;
          if (isCorrect) existing.passes++;
          existing.totalScore += score;
          existing.totalMaxScore += maxScore;
          if (timeSpentMs > 0) {
            existing.totalTimeMs += timeSpentMs;
            existing.timeCount++;
          }
        } else {
          byBlock.set(blockId, {
            blockId,
            blockType,
            submissions: 1,
            passes: isCorrect ? 1 : 0,
            totalScore: score,
            totalMaxScore: maxScore,
            totalTimeMs: timeSpentMs > 0 ? timeSpentMs : 0,
            timeCount: timeSpentMs > 0 ? 1 : 0,
          });
        }
      }

      const activities = [...byBlock.values()]
        .map((b) => ({
          blockId: b.blockId,
          blockType: b.blockType,
          submissions: b.submissions,
          passRate: b.submissions > 0 ? Math.round((b.passes / b.submissions) * 100) : 0,
          averageScore: b.totalMaxScore > 0
            ? Math.round((b.totalScore / b.totalMaxScore) * 100)
            : 0,
          avgTimeToCompleteMs: b.timeCount > 0
            ? Math.round(b.totalTimeMs / b.timeCount)
            : null,
        }))
        .sort((a, b) => b.submissions - a.submissions)
        .slice(0, limit);

      res.json({ activities });
    } catch (error) {
      logger.error('Error fetching activity analytics', { error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch activity analytics');
    }
  }
);

export default router;
