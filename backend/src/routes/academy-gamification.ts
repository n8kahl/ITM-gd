/**
 * Academy Gamification Routes
 * Handles XP awards, streak management, and achievement lookups.
 *
 * All routes require authentication.
 *
 * Endpoints:
 *   POST  /api/academy/gamification/xp
 *   GET   /api/academy/gamification/user/:userId/stats
 *   POST  /api/academy/gamification/streak-freeze
 *   GET   /api/academy/gamification/achievements
 *   GET   /api/academy/gamification/user/:userId/achievements
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { supabase } from '../config/database';
import { sendError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import {
  awardXp,
  awardTradeJournaledXp,
  awardProfitableTradeXp,
  awardDisciplineScoreXp,
  awardTradeSharedXp,
  awardHelpfulCommentXp,
} from '../services/academy-xp';
import {
  getActiveChallenges,
  getUserChallengeProgress,
  incrementChallengeProgress,
} from '../services/academy-challenges';
import type { AcademyGamificationStats } from '../types/academy';

const router = Router();

// Apply auth to all gamification routes
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const awardXpBodySchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  amount: z.number().int().positive('amount must be a positive integer'),
  source: z.string().min(1, 'source is required').max(128),
  metadata: z.record(z.unknown()).optional(),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

const streakFreezeBodySchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// POST /xp — Award XP to a user
// ---------------------------------------------------------------------------

router.post(
  '/xp',
  validateBody(awardXpBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, amount, source, metadata } = (req as Request & { validatedBody: z.infer<typeof awardXpBodySchema> }).validatedBody;

    try {
      const result = await awardXp(userId, amount, source, metadata);
      res.json({
        success: true,
        totalXp: result.totalXp,
        currentLevel: result.currentLevel,
        leveledUp: result.leveledUp,
      });
    } catch (error) {
      logger.error('Failed to award XP', { userId, source, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to award XP');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /user/:userId/stats — Fetch gamification stats for a user
// ---------------------------------------------------------------------------

router.get(
  '/user/:userId/stats',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const [xpResult, streakResult] = await Promise.all([
        supabase
          .from('academy_user_xp')
          .select('total_xp, current_level')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('academy_user_streaks')
          .select('current_streak_days, longest_streak_days, last_activity_date, streak_freeze_available')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (xpResult.error) {
        logger.error('Failed to fetch user XP', { userId, error: xpResult.error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch XP data');
        return;
      }

      if (streakResult.error) {
        logger.error('Failed to fetch user streak', { userId, error: streakResult.error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch streak data');
        return;
      }

      const stats: AcademyGamificationStats = {
        totalXp: xpResult.data?.total_xp ?? 0,
        currentLevel: xpResult.data?.current_level ?? 1,
        currentStreak: streakResult.data?.current_streak_days ?? 0,
        longestStreak: streakResult.data?.longest_streak_days ?? 0,
        lastActivityDate: streakResult.data?.last_activity_date ?? null,
        streakFreezeAvailable: streakResult.data?.streak_freeze_available ?? false,
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching gamification stats', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch gamification stats');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /streak-freeze — Consume a streak freeze for a user
// ---------------------------------------------------------------------------

router.post(
  '/streak-freeze',
  validateBody(streakFreezeBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as Request & { validatedBody: z.infer<typeof streakFreezeBodySchema> }).validatedBody;

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('academy_user_streaks')
        .select('streak_freeze_available')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        logger.error('Failed to fetch streak record for freeze', { userId, error: fetchError.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch streak data');
        return;
      }

      if (!existing) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'No streak record found for this user');
        return;
      }

      if (!existing.streak_freeze_available) {
        res.json({ success: false, message: 'No streak freeze available for this user.' });
        return;
      }

      const { error: updateError } = await supabase
        .from('academy_user_streaks')
        .update({ streak_freeze_available: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Failed to consume streak freeze', { userId, error: updateError.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to consume streak freeze');
        return;
      }

      logger.info('Streak freeze consumed via API', { userId });
      res.json({ success: true, message: 'Streak freeze applied — your streak is protected.' });
    } catch (error) {
      logger.error('Error applying streak freeze', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to apply streak freeze');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /achievements — List all active achievements
// ---------------------------------------------------------------------------

router.get('/achievements', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('academy_achievements')
      .select('id, key, title, description, icon_url, category, unlock_criteria, xp_reward, is_active, created_at')
      .eq('is_active', true)
      .order('category')
      .order('xp_reward');

    if (error) {
      logger.error('Failed to fetch achievements', { error: error.message });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch achievements');
      return;
    }

    res.json({ achievements: data ?? [] });
  } catch (error) {
    logger.error('Error fetching achievements', { error });
    sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch achievements');
  }
});

// ---------------------------------------------------------------------------
// GET /user/:userId/achievements — User's unlocked achievements
// ---------------------------------------------------------------------------

router.get(
  '/user/:userId/achievements',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const { data, error } = await supabase
        .from('academy_user_achievements')
        .select(`
          id,
          unlocked_at,
          academy_achievements (
            id,
            key,
            title,
            description,
            icon_url,
            category,
            xp_reward
          )
        `)
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch user achievements', { userId, error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch user achievements');
        return;
      }

      res.json({ achievements: data ?? [] });
    } catch (error) {
      logger.error('Error fetching user achievements', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch user achievements');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /challenges — List active challenges
// ---------------------------------------------------------------------------

router.get('/challenges', async (_req: Request, res: Response): Promise<void> => {
  try {
    const challenges = await getActiveChallenges();
    res.json({ challenges });
  } catch (error) {
    logger.error('Failed to fetch challenges', { error });
    sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch challenges');
  }
});

// ---------------------------------------------------------------------------
// GET /challenges/user/:userId — User's challenge progress
// ---------------------------------------------------------------------------

router.get(
  '/challenges/user/:userId',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    try {
      const progress = await getUserChallengeProgress(userId);
      res.json({ progress });
    } catch (error) {
      logger.error('Failed to fetch user challenge progress', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch challenge progress');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /challenges/:challengeId/increment — Increment challenge progress
// ---------------------------------------------------------------------------

const incrementChallengeBodySchema = z.object({
  userId: z.string().uuid(),
  incrementBy: z.number().int().positive().optional(),
});

router.post(
  '/challenges/:challengeId/increment',
  validateBody(incrementChallengeBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { challengeId } = req.params;
    const { userId, incrementBy } = (req as Request & { validatedBody: z.infer<typeof incrementChallengeBodySchema> }).validatedBody;

    try {
      const result = await incrementChallengeProgress(userId, challengeId, incrementBy);
      res.json({ success: true, ...result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to increment challenge';
      logger.error('Failed to increment challenge progress', { userId, challengeId, error });
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, msg);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /xp/trade-journaled — Award XP for journaling a trade
// ---------------------------------------------------------------------------

const tradeXpBodySchema = z.object({
  userId: z.string().uuid(),
  tradeId: z.string().min(1),
});

router.post(
  '/xp/trade-journaled',
  validateBody(tradeXpBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, tradeId } = (req as Request & { validatedBody: z.infer<typeof tradeXpBodySchema> }).validatedBody;
    try {
      const result = await awardTradeJournaledXp(userId, tradeId);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Failed to award trade journaled XP', { userId, tradeId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to award XP');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /xp/trade-profitable — Award XP for a profitable trade
// ---------------------------------------------------------------------------

const profitableTradeBodySchema = z.object({
  userId: z.string().uuid(),
  tradeId: z.string().min(1),
  pnl: z.number().positive('pnl must be positive'),
});

router.post(
  '/xp/trade-profitable',
  validateBody(profitableTradeBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, tradeId, pnl } = (req as Request & { validatedBody: z.infer<typeof profitableTradeBodySchema> }).validatedBody;
    try {
      const result = await awardProfitableTradeXp(userId, tradeId, pnl);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Failed to award profitable trade XP', { userId, tradeId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to award XP');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /xp/discipline-score — Award XP for high discipline score
// ---------------------------------------------------------------------------

const disciplineScoreBodySchema = z.object({
  userId: z.string().uuid(),
  disciplineScore: z.number().min(80, 'disciplineScore must be >= 80').max(100),
});

router.post(
  '/xp/discipline-score',
  validateBody(disciplineScoreBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, disciplineScore } = (req as Request & { validatedBody: z.infer<typeof disciplineScoreBodySchema> }).validatedBody;
    try {
      const result = await awardDisciplineScoreXp(userId, disciplineScore);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Failed to award discipline score XP', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to award XP');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /xp/trade-shared — Award XP for sharing a trade
// ---------------------------------------------------------------------------

router.post(
  '/xp/trade-shared',
  validateBody(tradeXpBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, tradeId } = (req as Request & { validatedBody: z.infer<typeof tradeXpBodySchema> }).validatedBody;
    try {
      const result = await awardTradeSharedXp(userId, tradeId);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Failed to award trade shared XP', { userId, tradeId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to award XP');
    }
  }
);

// ---------------------------------------------------------------------------
// POST /xp/helpful-comment — Award XP for a helpful comment
// ---------------------------------------------------------------------------

const helpfulCommentBodySchema = z.object({
  userId: z.string().uuid(),
  commentId: z.string().min(1),
});

router.post(
  '/xp/helpful-comment',
  validateBody(helpfulCommentBodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, commentId } = (req as Request & { validatedBody: z.infer<typeof helpfulCommentBodySchema> }).validatedBody;
    try {
      const result = await awardHelpfulCommentXp(userId, commentId);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Failed to award helpful comment XP', { userId, commentId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to award XP');
    }
  }
);

export default router;
