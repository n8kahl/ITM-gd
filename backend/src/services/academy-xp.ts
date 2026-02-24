/**
 * Academy XP Service
 * Handles XP award logic, level calculation, streak tracking, and milestone rewards.
 */

import { supabase } from '../config/database';
import { logger } from '../lib/logger';

export const XP_REWARDS = {
  BLOCK_COMPLETION: 10,
  LESSON_COMPLETION: 50,
  ASSESSMENT_PASSED: 100,
  ACTIVITY_PERFECT_SCORE: 25,
  STREAK_7_DAY: 100,
  STREAK_30_DAY: 500,
  STREAK_100_DAY: 2000,
} as const;

/** Level thresholds: Level N requires N * 500 XP total */
export function calculateLevelFromXp(totalXp: number): number {
  return Math.max(1, Math.floor(totalXp / 500) + 1);
}

export function nextLevelThreshold(currentLevel: number): number {
  return currentLevel * 500;
}

export interface XpAwardResult {
  totalXp: number;
  currentLevel: number;
  leveledUp: boolean;
}

/**
 * Awards XP to a user and records the event.
 * Upserts academy_user_xp, logs to academy_learning_events.
 */
export async function awardXp(
  userId: string,
  amount: number,
  source: string,
  metadata?: Record<string, unknown>
): Promise<XpAwardResult> {
  // Fetch existing XP record
  const { data: existing, error: fetchError } = await supabase
    .from('academy_user_xp')
    .select('total_xp, current_level')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    logger.error('Failed to fetch user XP record', { userId, error: fetchError.message });
    throw new Error(`Failed to fetch XP record: ${fetchError.message}`);
  }

  const previousXp = existing?.total_xp ?? 0;
  const previousLevel = existing?.current_level ?? 1;
  const newXp = previousXp + amount;
  const newLevel = calculateLevelFromXp(newXp);
  const leveledUp = newLevel > previousLevel;

  const now = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('academy_user_xp')
    .upsert(
      {
        user_id: userId,
        total_xp: newXp,
        current_level: newLevel,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) {
    logger.error('Failed to upsert user XP', { userId, error: upsertError.message });
    throw new Error(`Failed to upsert XP: ${upsertError.message}`);
  }

  // Record learning event
  const { error: eventError } = await supabase.from('academy_learning_events').insert({
    user_id: userId,
    event_type: source,
    xp_earned: amount,
    metadata: metadata ?? null,
    created_at: now,
  });

  if (eventError) {
    // Non-fatal — log but do not throw; XP was already recorded
    logger.warn('Failed to record learning event', {
      userId,
      source,
      error: eventError.message,
    });
  }

  if (leveledUp) {
    logger.info('User leveled up', { userId, previousLevel, newLevel, totalXp: newXp });
  }

  return { totalXp: newXp, currentLevel: newLevel, leveledUp };
}

export interface StreakUpdateResult {
  currentStreak: number;
  longestStreak: number;
  milestoneReached: number | null;
}

/**
 * Updates the user's daily activity streak.
 * - Same day: no change
 * - Previous day: increments streak
 * - Older gap (with freeze available): consumes freeze
 * - Older gap (no freeze): resets to 1
 * Awards milestone XP for 7, 30, and 100 day streaks.
 */
export async function updateStreak(userId: string): Promise<StreakUpdateResult> {
  const { data: existing, error: fetchError } = await supabase
    .from('academy_user_streaks')
    .select(
      'current_streak_days, longest_streak_days, last_activity_date, streak_freeze_available'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    logger.error('Failed to fetch streak record', { userId, error: fetchError.message });
    throw new Error(`Failed to fetch streak: ${fetchError.message}`);
  }

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // First-time user — create streak record
  if (!existing) {
    const { error: insertError } = await supabase.from('academy_user_streaks').insert({
      user_id: userId,
      current_streak_days: 1,
      longest_streak_days: 1,
      last_activity_date: todayStr,
      streak_freeze_available: false,
    });

    if (insertError) {
      logger.error('Failed to create streak record', { userId, error: insertError.message });
      throw new Error(`Failed to create streak: ${insertError.message}`);
    }

    return { currentStreak: 1, longestStreak: 1, milestoneReached: null };
  }

  const lastDate = existing.last_activity_date;

  // Already active today — no change needed
  if (lastDate === todayStr) {
    return {
      currentStreak: existing.current_streak_days,
      longestStreak: existing.longest_streak_days,
      milestoneReached: null,
    };
  }

  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak: number;
  let freezeConsumed = false;

  if (lastDate === yesterdayStr) {
    // Consecutive day
    newStreak = existing.current_streak_days + 1;
  } else if (existing.streak_freeze_available && lastDate) {
    // Gap but freeze available — check if freeze can bridge the gap (1 missed day only)
    const lastMs = Date.parse(lastDate);
    const todayMs = Date.parse(todayStr);
    const daysDiff = Math.round((todayMs - lastMs) / 86400000);
    if (daysDiff === 2) {
      // Exactly one missed day — freeze covers it
      newStreak = existing.current_streak_days + 1;
      freezeConsumed = true;
    } else {
      // Gap is too large even with freeze
      newStreak = 1;
    }
  } else {
    // No freeze and gap > 1 day — reset
    newStreak = 1;
  }

  const newLongest = Math.max(existing.longest_streak_days, newStreak);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('academy_user_streaks')
    .update({
      current_streak_days: newStreak,
      longest_streak_days: newLongest,
      last_activity_date: todayStr,
      streak_freeze_available: freezeConsumed ? false : existing.streak_freeze_available,
      updated_at: now,
    })
    .eq('user_id', userId);

  if (updateError) {
    logger.error('Failed to update streak', { userId, error: updateError.message });
    throw new Error(`Failed to update streak: ${updateError.message}`);
  }

  // Check milestone XP awards
  const milestones: Array<{ threshold: number; xp: number }> = [
    { threshold: 7, xp: XP_REWARDS.STREAK_7_DAY },
    { threshold: 30, xp: XP_REWARDS.STREAK_30_DAY },
    { threshold: 100, xp: XP_REWARDS.STREAK_100_DAY },
  ];

  let milestoneReached: number | null = null;
  for (const { threshold, xp } of milestones) {
    if (newStreak === threshold) {
      milestoneReached = threshold;
      await awardXp(userId, xp, `STREAK_${threshold}_DAY_MILESTONE`, {
        streakDays: threshold,
      }).catch((err: unknown) => {
        logger.warn('Failed to award streak milestone XP', {
          userId,
          threshold,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      break;
    }
  }

  if (freezeConsumed) {
    logger.info('Streak freeze consumed', { userId, newStreak });
  }

  return { currentStreak: newStreak, longestStreak: newLongest, milestoneReached };
}
