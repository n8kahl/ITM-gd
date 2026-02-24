/**
 * Academy Analytics Routes
 * Provides student dashboard aggregates, competency deep-dives, and performance trends.
 *
 * All routes require authentication.
 *
 * Endpoints:
 *   GET /api/academy/analytics/student/:userId/dashboard
 *   GET /api/academy/analytics/student/:userId/competency/:competencyKey
 *   GET /api/academy/analytics/student/:userId/performance
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateParams } from '../middleware/validate';
import { supabase } from '../config/database';
import { sendError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { calculateLevelFromXp, nextLevelThreshold } from '../services/academy-xp';
import type { AcademyStudentDashboard } from '../types/academy';

const router = Router();

// Apply auth to all analytics routes
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const userIdParamSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

const competencyParamSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  competencyKey: z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// GET /student/:userId/dashboard — Aggregate student dashboard data
// ---------------------------------------------------------------------------

router.get(
  '/student/:userId/dashboard',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      // Parallel fetch: XP, streak, competency mastery, recent events, lesson counts
      const [xpResult, streakResult, competencyResult, recentEventsResult, lessonCountResult, completedLessonsResult] =
        await Promise.all([
          supabase
            .from('academy_user_xp')
            .select('total_xp, current_level')
            .eq('user_id', userId)
            .maybeSingle(),

          supabase
            .from('academy_user_streaks')
            .select('current_streak_days, longest_streak_days, streak_freeze_available')
            .eq('user_id', userId)
            .maybeSingle(),

          supabase
            .from('academy_competency_mastery')
            .select('competency_key, score')
            .eq('user_id', userId)
            .order('competency_key'),

          supabase
            .from('academy_learning_events')
            .select('event_type, xp_earned, metadata, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20),

          supabase
            .from('academy_lessons')
            .select('id', { count: 'exact', head: true })
            .eq('is_published', true),

          supabase
            .from('academy_lesson_progress')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('completed', true),
        ]);

      // Surface any DB errors
      const dbErrors = [
        { label: 'XP', error: xpResult.error },
        { label: 'streak', error: streakResult.error },
        { label: 'competency', error: competencyResult.error },
        { label: 'events', error: recentEventsResult.error },
        { label: 'lesson count', error: lessonCountResult.error },
        { label: 'completed lessons', error: completedLessonsResult.error },
      ].filter(e => e.error !== null);

      if (dbErrors.length > 0) {
        const errorMsg = dbErrors.map(e => `${e.label}: ${e.error?.message}`).join('; ');
        logger.error('Dashboard DB errors', { userId, errors: errorMsg });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to load dashboard data');
        return;
      }

      const totalXp = xpResult.data?.total_xp ?? 0;
      const currentLevel = xpResult.data?.current_level ?? calculateLevelFromXp(totalXp);
      const nextThreshold = nextLevelThreshold(currentLevel);

      // Build competency scores array
      const competencyScores = (competencyResult.data ?? []).map(c => ({
        key: c.competency_key as string,
        title: formatCompetencyTitle(c.competency_key as string),
        score: c.score as number,
      }));

      // Build recent activity feed
      const recentActivity = (recentEventsResult.data ?? []).map(event => ({
        type: event.event_type as string,
        description: describeEvent(event.event_type as string, event.metadata as Record<string, unknown> | null),
        timestamp: event.created_at as string,
        xpEarned: (event.xp_earned as number) ?? 0,
      }));

      const dashboard: AcademyStudentDashboard = {
        xp: {
          total: totalXp,
          level: currentLevel,
          nextLevelThreshold: nextThreshold,
        },
        streak: {
          current: streakResult.data?.current_streak_days ?? 0,
          longest: streakResult.data?.longest_streak_days ?? 0,
          freezeAvailable: streakResult.data?.streak_freeze_available ?? false,
        },
        lessonsCompleted: completedLessonsResult.count ?? 0,
        totalLessons: lessonCountResult.count ?? 0,
        competencyScores,
        recentActivity,
      };

      res.json(dashboard);
    } catch (error) {
      logger.error('Error building student dashboard', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to build student dashboard');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /student/:userId/competency/:competencyKey — Competency deep-dive
// ---------------------------------------------------------------------------

router.get(
  '/student/:userId/competency/:competencyKey',
  validateParams(competencyParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, competencyKey } = req.params;

    try {
      // Fetch mastery record for the specific competency
      const { data: mastery, error: masteryError } = await supabase
        .from('academy_competency_mastery')
        .select('score, last_assessed_at, created_at, updated_at')
        .eq('user_id', userId)
        .eq('competency_key', competencyKey)
        .maybeSingle();

      if (masteryError) {
        logger.error('Failed to fetch competency mastery', { userId, competencyKey, error: masteryError.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch competency data');
        return;
      }

      // Fetch recent learning events related to this competency
      const { data: events, error: eventsError } = await supabase
        .from('academy_learning_events')
        .select('event_type, xp_earned, metadata, created_at')
        .eq('user_id', userId)
        .contains('metadata', { competencyKey })
        .order('created_at', { ascending: false })
        .limit(25);

      if (eventsError) {
        logger.warn('Failed to fetch competency events', { userId, competencyKey, error: eventsError.message });
      }

      // Fetch lessons linked to this competency
      const { data: linkedLessons, error: lessonsError } = await supabase
        .from('academy_lesson_competencies')
        .select(`
          academy_lessons (
            id,
            title,
            slug,
            difficulty
          )
        `)
        .eq('competency_key', competencyKey)
        .limit(10);

      if (lessonsError) {
        logger.warn('Failed to fetch linked lessons', { competencyKey, error: lessonsError.message });
      }

      res.json({
        competencyKey,
        title: formatCompetencyTitle(competencyKey),
        mastery: mastery
          ? {
              score: mastery.score,
              lastAssessedAt: mastery.last_assessed_at,
              firstRecordedAt: mastery.created_at,
              updatedAt: mastery.updated_at,
            }
          : null,
        recentEvents: (events ?? []).map(e => ({
          type: e.event_type,
          xpEarned: e.xp_earned,
          metadata: e.metadata,
          createdAt: e.created_at,
        })),
        linkedLessons: (linkedLessons ?? []).map(l => l.academy_lessons),
        recommendations: buildCompetencyRecommendations(mastery?.score ?? 0),
      });
    } catch (error) {
      logger.error('Error fetching competency deep-dive', { userId, competencyKey, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch competency data');
    }
  }
);

// ---------------------------------------------------------------------------
// GET /student/:userId/performance — Assessment performance trends
// ---------------------------------------------------------------------------

router.get(
  '/student/:userId/performance',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const { data: attempts, error } = await supabase
        .from('academy_assessment_attempts')
        .select('assessment_id, score, max_score, passed, time_spent_ms, completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch assessment attempts', { userId, error: error.message });
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch performance data');
        return;
      }

      const attemptsData = attempts ?? [];

      // Aggregate stats
      const totalAttempts = attemptsData.length;
      const passedAttempts = attemptsData.filter(a => a.passed).length;
      const passRate = totalAttempts > 0 ? passedAttempts / totalAttempts : 0;

      const avgScorePercent =
        totalAttempts > 0
          ? attemptsData.reduce((sum, a) => {
              const pct = a.max_score > 0 ? a.score / a.max_score : 0;
              return sum + pct;
            }, 0) / totalAttempts
          : 0;

      const avgTimeMs =
        totalAttempts > 0
          ? attemptsData.reduce((sum, a) => sum + (a.time_spent_ms ?? 0), 0) / totalAttempts
          : 0;

      // Trend: last 10 vs all-time average
      const recent10 = attemptsData.slice(0, 10);
      const recentAvgScore =
        recent10.length > 0
          ? recent10.reduce((sum, a) => sum + (a.max_score > 0 ? a.score / a.max_score : 0), 0) / recent10.length
          : 0;

      const trend: 'improving' | 'declining' | 'stable' =
        recentAvgScore > avgScorePercent + 0.05
          ? 'improving'
          : recentAvgScore < avgScorePercent - 0.05
            ? 'declining'
            : 'stable';

      res.json({
        totalAttempts,
        passedAttempts,
        passRate: Math.round(passRate * 1000) / 10, // percentage with 1 decimal
        avgScorePercent: Math.round(avgScorePercent * 1000) / 10,
        avgTimeMs: Math.round(avgTimeMs),
        trend,
        recentAttempts: recent10.map(a => ({
          assessmentId: a.assessment_id,
          score: a.score,
          maxScore: a.max_score,
          scorePercent: a.max_score > 0 ? Math.round((a.score / a.max_score) * 1000) / 10 : 0,
          passed: a.passed,
          timeSpentMs: a.time_spent_ms,
          completedAt: a.completed_at,
        })),
      });
    } catch (error) {
      logger.error('Error fetching performance data', { userId, error });
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Failed to fetch performance data');
    }
  }
);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Converts a snake_case competency key to a human-readable title.
 * e.g. "options_chain_reading" → "Options Chain Reading"
 */
function formatCompetencyTitle(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Builds a human-readable description for a learning event.
 */
function describeEvent(eventType: string, metadata: Record<string, unknown> | null): string {
  switch (eventType) {
    case 'activity_submission': {
      const blockType = typeof metadata?.['blockType'] === 'string' ? metadata['blockType'] : 'activity';
      const score = typeof metadata?.['score'] === 'number' ? metadata['score'] : null;
      const maxScore = typeof metadata?.['maxScore'] === 'number' ? metadata['maxScore'] : null;
      if (score !== null && maxScore !== null && maxScore > 0) {
        return `Completed ${blockType.replace(/_/g, ' ')} — scored ${score}/${maxScore}`;
      }
      return `Completed ${blockType.replace(/_/g, ' ')}`;
    }
    case 'lesson_completion':
      return 'Completed a lesson';
    case 'assessment_passed':
      return 'Passed an assessment';
    case 'STREAK_7_DAY_MILESTONE':
      return '7-day learning streak achieved';
    case 'STREAK_30_DAY_MILESTONE':
      return '30-day learning streak achieved';
    case 'STREAK_100_DAY_MILESTONE':
      return '100-day learning streak achieved';
    default:
      return eventType.replace(/_/g, ' ').toLowerCase();
  }
}

/**
 * Returns actionable recommendations based on a competency score (0–100).
 */
function buildCompetencyRecommendations(score: number): string[] {
  if (score >= 90) {
    return ['Mastery level achieved. Consider tackling advanced modules.'];
  }
  if (score >= 70) {
    return [
      'Strong foundation. Focus on edge-case scenarios to reach mastery.',
      'Review lessons tagged with this competency for refinement.',
    ];
  }
  if (score >= 50) {
    return [
      'Developing competency. Revisit foundational lessons before advancing.',
      'Practice with flashcard drills and scenario exercises.',
    ];
  }
  return [
    'This competency needs attention. Start with the introductory lesson for this topic.',
    'Use the flashcard deck to build foundational recall.',
    'Attempt lower-difficulty lessons before progressing.',
  ];
}

export default router;
