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
import { awardXp } from '../services/academy-xp';
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

export default router;
