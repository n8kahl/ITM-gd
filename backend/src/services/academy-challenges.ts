/**
 * Academy Challenges Service
 * Manages seasonal/time-limited challenges with progress tracking and XP rewards.
 */

import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { awardXp } from './academy-xp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChallengeType = 'daily' | 'weekly' | 'monthly' | 'seasonal';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  challengeType: ChallengeType;
  criteria: { action: string; count: number };
  xpReward: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface UserChallengeProgress {
  challengeId: string;
  progress: number;
  completedAt: string | null;
  xpAwarded: boolean;
  challenge: Challenge;
}

// ---------------------------------------------------------------------------
// Fetch active challenges
// ---------------------------------------------------------------------------

export async function getActiveChallenges(): Promise<Challenge[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('academy_challenges')
    .select('id, title, description, challenge_type, criteria, xp_reward, starts_at, ends_at, is_active')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at', { ascending: true });

  if (error) {
    logger.error('Failed to fetch active challenges', { error: error.message });
    throw new Error(`Failed to fetch challenges: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    challengeType: row.challenge_type as ChallengeType,
    criteria: row.criteria as { action: string; count: number },
    xpReward: row.xp_reward,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
  }));
}

// ---------------------------------------------------------------------------
// Fetch user's challenge progress
// ---------------------------------------------------------------------------

export async function getUserChallengeProgress(
  userId: string
): Promise<UserChallengeProgress[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('academy_user_challenge_progress')
    .select(`
      challenge_id,
      progress,
      completed_at,
      xp_awarded,
      academy_challenges (
        id, title, description, challenge_type, criteria, xp_reward, starts_at, ends_at, is_active
      )
    `)
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to fetch user challenge progress', { userId, error: error.message });
    throw new Error(`Failed to fetch challenge progress: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => {
      const challenge = (row.academy_challenges as unknown) as Record<string, unknown> | null;
      if (!challenge) return false;
      return challenge.is_active === true && (challenge.ends_at as string) >= now;
    })
    .map((row) => {
      const c = (row.academy_challenges as unknown) as Record<string, unknown>;
      return {
        challengeId: row.challenge_id,
        progress: row.progress,
        completedAt: row.completed_at,
        xpAwarded: row.xp_awarded,
        challenge: {
          id: c.id as string,
          title: c.title as string,
          description: c.description as string,
          challengeType: c.challenge_type as ChallengeType,
          criteria: c.criteria as { action: string; count: number },
          xpReward: c.xp_reward as number,
          startsAt: c.starts_at as string,
          endsAt: c.ends_at as string,
          isActive: c.is_active as boolean,
        },
      };
    });
}

// ---------------------------------------------------------------------------
// Increment challenge progress
// ---------------------------------------------------------------------------

export interface IncrementResult {
  progress: number;
  target: number;
  completed: boolean;
  xpAwarded: number;
}

/**
 * Increments a user's progress toward a specific challenge.
 * If the target is met, marks the challenge complete and awards XP.
 */
export async function incrementChallengeProgress(
  userId: string,
  challengeId: string,
  incrementBy: number = 1
): Promise<IncrementResult> {
  // Fetch challenge to get target
  const { data: challenge, error: challengeError } = await supabase
    .from('academy_challenges')
    .select('id, criteria, xp_reward, ends_at, is_active')
    .eq('id', challengeId)
    .maybeSingle();

  if (challengeError || !challenge) {
    throw new Error(`Challenge not found: ${challengeId}`);
  }

  if (!challenge.is_active || new Date(challenge.ends_at) < new Date()) {
    throw new Error(`Challenge ${challengeId} is no longer active`);
  }

  const criteria = challenge.criteria as { action: string; count: number };
  const target = criteria.count;

  // Upsert progress
  const { data: existing } = await supabase
    .from('academy_user_challenge_progress')
    .select('progress, completed_at, xp_awarded')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle();

  if (existing?.completed_at) {
    // Already completed
    return {
      progress: existing.progress,
      target,
      completed: true,
      xpAwarded: 0,
    };
  }

  const currentProgress = existing?.progress ?? 0;
  const newProgress = Math.min(currentProgress + incrementBy, target);
  const isCompleted = newProgress >= target;
  const now = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('academy_user_challenge_progress')
    .upsert(
      {
        user_id: userId,
        challenge_id: challengeId,
        progress: newProgress,
        completed_at: isCompleted ? now : null,
        xp_awarded: isCompleted,
      },
      { onConflict: 'user_id,challenge_id' }
    );

  if (upsertError) {
    logger.error('Failed to update challenge progress', { userId, challengeId, error: upsertError.message });
    throw new Error(`Failed to update challenge progress: ${upsertError.message}`);
  }

  // Award XP on completion
  let xpAwarded = 0;
  if (isCompleted) {
    try {
      await awardXp(userId, challenge.xp_reward, 'challenge_completed', {
        challengeId,
      });
      xpAwarded = challenge.xp_reward;
      logger.info('Challenge completed', { userId, challengeId, xpAwarded });
    } catch (err) {
      logger.warn('Failed to award challenge XP', {
        userId,
        challengeId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    progress: newProgress,
    target,
    completed: isCompleted,
    xpAwarded,
  };
}
