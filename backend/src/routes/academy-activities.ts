/**
 * Academy Activities Routes
 * Handles fetching activity block content, submitting answers, and retrieving results.
 *
 * All routes require authentication.
 *
 * Endpoints:
 *   GET  /api/academy/activities/:blockId/content
 *   POST /api/academy/activities/:blockId/submit
 *   GET  /api/academy/activities/:blockId/results
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { supabase } from '../config/database';
import { sendError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { scoreActivity } from '../services/academy-scoring';
import { awardXp, XP_REWARDS } from '../services/academy-xp';
import { buildRetrySchedule } from '../services/academy-spaced-repetition';
import type { AcademyLessonBlock } from '../types/academy';

const router = Router();

// Apply auth to all activity routes
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const blockIdParamSchema = z.object({
  blockId: z.string().uuid('blockId must be a valid UUID'),
});

const submitBodySchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  answer: z.unknown(),
  timeSpentMs: z.number().int().nonnegative('timeSpentMs must be a non-negative integer'),
});

// ---------------------------------------------------------------------------
// Helper — fetch a lesson block by ID
// ---------------------------------------------------------------------------

async function fetchLessonBlock(blockId: string): Promise<AcademyLessonBlock | null> {
  const { data, error } = await supabase
    .from('academy_lesson_blocks')
    .select('id, lesson_id, block_type, content_json, position, created_at, updated_at')
    .eq('id', blockId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch lesson block', { blockId, error: error.message });
    throw new Error(`DB error: ${error.message}`);
  }

  return data as AcademyLessonBlock | null;
}

// ---------------------------------------------------------------------------
// GET /:blockId/content — Fetch activity block content
// ---------------------------------------------------------------------------

router.get(
  '/:blockId/content',
  validateParams(blockIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { blockId } = req.params;

    try {
      const block = await fetchLessonBlock(blockId);

      if (!block) {
        sendError(res, 404, ErrorCode.NOT_FOUND, `Activity block ${blockId} not found`);
        return;
      }

      // Strip internal answer keys before sending to client
      const { answer_key: _omit, ...safeContent } = block.content_json as Record<string, unknown> & { answer_key?: unknown };

      res.json({
        id: block.id,
        lessonId: block.lesson_id,
        blockType: block.block_type,
        position: block.position,
        content: safeContent,
      });
    } catch (error) {
      logger.error('Error fetching block content', { blockId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch activity content');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:blockId/submit — Submit an answer and receive scoring feedback
// ---------------------------------------------------------------------------

router.post(
  '/:blockId/submit',
  validateParams(blockIdParamSchema),
  validateBody(submitBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { blockId } = req.params;
    const { userId, answer, timeSpentMs } = (req as Request & { validatedBody: z.infer<typeof submitBodySchema> }).validatedBody;

    try {
      const block = await fetchLessonBlock(blockId);

      if (!block) {
        sendError(res, 404, ErrorCode.NOT_FOUND, `Activity block ${blockId} not found`);
        return;
      }

      const contentJson = block.content_json as Record<string, unknown>;
      const answerKey = contentJson['answer_key'] ?? null;

      // Score the submitted answer
      const scoring = scoreActivity(block.block_type, answer, answerKey);

      // Determine XP award
      let xpEarned = 0;
      if (scoring.maxScore > 0) {
        const isPerfect = scoring.score === scoring.maxScore;
        const scoreRatio = scoring.score / scoring.maxScore;

        if (isPerfect) {
          xpEarned = XP_REWARDS.BLOCK_COMPLETION + XP_REWARDS.ACTIVITY_PERFECT_SCORE;
        } else if (scoreRatio >= 0.5) {
          xpEarned = XP_REWARDS.BLOCK_COMPLETION;
        }
      }

      // Record the submission as a learning event
      const now = new Date().toISOString();
      const { error: eventError } = await supabase.from('academy_learning_events').insert({
        user_id: userId,
        event_type: 'activity_submission',
        entity_id: blockId,
        entity_type: 'lesson_block',
        xp_earned: xpEarned,
        metadata: {
          blockType: block.block_type,
          score: scoring.score,
          maxScore: scoring.maxScore,
          timeSpentMs,
          isCorrect: scoring.isCorrect,
        },
        created_at: now,
      });

      if (eventError) {
        logger.warn('Failed to record activity submission event', {
          userId,
          blockId,
          error: eventError.message,
        });
      }

      // Award XP if earned
      let xpResult: { totalXp: number; currentLevel: number; leveledUp: boolean } | null = null;
      if (xpEarned > 0) {
        try {
          xpResult = await awardXp(userId, xpEarned, 'activity_submission', {
            blockId,
            blockType: block.block_type,
            score: scoring.score,
            maxScore: scoring.maxScore,
          });
        } catch (xpError) {
          logger.warn('Failed to award activity XP', {
            userId,
            blockId,
            xpEarned,
            error: xpError instanceof Error ? xpError.message : String(xpError),
          });
        }
      }

      // Calculate spaced repetition retry schedule for failed activities
      const previousAttempts = await supabase
        .from('academy_learning_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('entity_id', blockId)
        .eq('event_type', 'activity_submission');

      const attemptCount = (previousAttempts.count ?? 1);

      const retrySchedule = buildRetrySchedule({
        blockId,
        blockType: block.block_type,
        lessonId: block.lesson_id,
        userId,
        score: scoring.score,
        maxScore: scoring.maxScore,
        attemptCount,
      });

      // Persist retry queue entry if scheduled
      if (retrySchedule.scheduled && retrySchedule.nextRetryDate) {
        const { error: retryError } = await supabase.from('academy_activity_retry_queue').upsert(
          {
            user_id: userId,
            block_id: blockId,
            block_type: block.block_type,
            lesson_id: block.lesson_id,
            attempt_count: retrySchedule.attemptCount,
            last_score: scoring.score,
            max_score: scoring.maxScore,
            scheduled_for: retrySchedule.nextRetryDate,
            updated_at: now,
          },
          { onConflict: 'user_id,block_id' }
        );

        if (retryError) {
          logger.warn('Failed to upsert retry queue entry', {
            userId,
            blockId,
            error: retryError.message,
          });
        }
      }

      // Remove from retry queue if activity passed
      if (scoring.isCorrect || (scoring.maxScore > 0 && scoring.score / scoring.maxScore >= 0.7)) {
        await supabase
          .from('academy_activity_retry_queue')
          .delete()
          .eq('user_id', userId)
          .eq('block_id', blockId);
      }

      res.json({
        score: scoring.score,
        maxScore: scoring.maxScore,
        feedback: scoring.feedback,
        isCorrect: scoring.isCorrect,
        details: scoring.details ?? [],
        xpEarned,
        xp: xpResult
          ? { totalXp: xpResult.totalXp, currentLevel: xpResult.currentLevel, leveledUp: xpResult.leveledUp }
          : null,
        retry: retrySchedule.scheduled
          ? { nextRetryDate: retrySchedule.nextRetryDate, attemptCount: retrySchedule.attemptCount }
          : null,
      });
    } catch (error) {
      logger.error('Error processing activity submission', { blockId, userId: req.body?.userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to process activity submission');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:blockId/results — Fetch the latest scoring results for the authed user
// ---------------------------------------------------------------------------

router.get(
  '/:blockId/results',
  validateParams(blockIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { blockId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      sendError(res, 401, ErrorCode.UNAUTHORIZED, 'User not authenticated');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('academy_learning_events')
        .select('id, xp_earned, metadata, created_at')
        .eq('user_id', userId)
        .eq('entity_id', blockId)
        .eq('entity_type', 'lesson_block')
        .eq('event_type', 'activity_submission')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch activity results', { blockId, userId, error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch activity results');
        return;
      }

      res.json({ results: data ?? [] });
    } catch (error) {
      logger.error('Error fetching activity results', { blockId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch activity results');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /retry-queue — Fetch the authed user's pending retry activities
// ---------------------------------------------------------------------------

router.get(
  '/retry-queue',
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      sendError(res, 401, ErrorCode.UNAUTHORIZED, 'User not authenticated');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('academy_activity_retry_queue')
        .select('block_id, block_type, lesson_id, attempt_count, last_score, max_score, scheduled_for, updated_at')
        .eq('user_id', userId)
        .order('scheduled_for', { ascending: true });

      if (error) {
        logger.error('Failed to fetch retry queue', { userId, error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch retry queue');
        return;
      }

      const now = new Date();
      const items = (data ?? []).map((row) => ({
        blockId: row.block_id,
        blockType: row.block_type,
        lessonId: row.lesson_id,
        attemptCount: row.attempt_count,
        lastScore: row.last_score,
        maxScore: row.max_score,
        scheduledFor: row.scheduled_for,
        isDue: new Date(row.scheduled_for) <= now,
      }));

      res.json({ retryQueue: items });
    } catch (error) {
      logger.error('Error fetching retry queue', { error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch retry queue');
    }
  }
);

export default router;
