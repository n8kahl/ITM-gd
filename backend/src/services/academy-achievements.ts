/**
 * Academy Achievement Unlock Service
 *
 * Handles inserting achievement unlocks into the database,
 * awarding XP, and triggering push notifications.
 */

import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { awardXp } from './academy-xp';
import { notifyAchievementUnlocked } from './academy-notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnlockResult {
  unlocked: boolean;
  alreadyUnlocked: boolean;
  xpAwarded: number;
}

// ---------------------------------------------------------------------------
// Core unlock function
// ---------------------------------------------------------------------------

/**
 * Unlock an achievement for a user.
 *
 * - Checks if already unlocked (idempotent).
 * - Inserts into academy_user_achievements.
 * - Awards the achievement's XP reward.
 * - Sends a push notification (best-effort, never throws).
 */
export async function unlockAchievement(
  userId: string,
  achievementKey: string
): Promise<UnlockResult> {
  // Look up the achievement definition by key
  const { data: achievement, error: lookupError } = await supabase
    .from('academy_achievements')
    .select('id, key, title, category, xp_reward, is_active')
    .eq('key', achievementKey)
    .eq('is_active', true)
    .maybeSingle();

  if (lookupError || !achievement) {
    logger.warn('Achievement not found or inactive', { achievementKey, error: lookupError?.message });
    return { unlocked: false, alreadyUnlocked: false, xpAwarded: 0 };
  }

  // Check if already unlocked
  const { data: existing } = await supabase
    .from('academy_user_achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('achievement_id', achievement.id)
    .maybeSingle();

  if (existing) {
    return { unlocked: false, alreadyUnlocked: true, xpAwarded: 0 };
  }

  // Insert unlock record
  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from('academy_user_achievements')
    .insert({
      user_id: userId,
      achievement_id: achievement.id,
      unlocked_at: now,
    });

  if (insertError) {
    logger.error('Failed to unlock achievement', {
      userId,
      achievementKey,
      error: insertError.message,
    });
    return { unlocked: false, alreadyUnlocked: false, xpAwarded: 0 };
  }

  // Award XP
  let xpAwarded = 0;
  if (achievement.xp_reward > 0) {
    try {
      await awardXp(userId, achievement.xp_reward, 'achievement_unlocked', {
        achievementKey,
        achievementId: achievement.id,
      });
      xpAwarded = achievement.xp_reward;
    } catch (err) {
      logger.warn('Failed to award achievement XP', {
        userId,
        achievementKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Send push notification (best-effort)
  notifyAchievementUnlocked(userId, achievement.title, achievement.category).catch(() => {});

  logger.info('Achievement unlocked', { userId, achievementKey, xpAwarded });

  return { unlocked: true, alreadyUnlocked: false, xpAwarded };
}

// ---------------------------------------------------------------------------
// Batch check — evaluate all achievements for a user (lightweight)
// ---------------------------------------------------------------------------

/**
 * Check and auto-unlock achievements based on user stats.
 * Called after XP awards, level-ups, or milestone events.
 */
export async function evaluateAchievements(
  userId: string,
  context: {
    totalXp?: number;
    currentLevel?: number;
    currentStreak?: number;
    tradesJournaled?: number;
    challengesCompleted?: number;
  }
): Promise<string[]> {
  const unlocked: string[] = [];

  // Level-based achievements
  if (context.currentLevel !== undefined) {
    const levelAchievements: Array<{ key: string; level: number }> = [
      { key: 'reach_level_5', level: 5 },
      { key: 'reach_level_10', level: 10 },
      { key: 'reach_level_25', level: 25 },
      { key: 'reach_level_50', level: 50 },
    ];

    for (const { key, level } of levelAchievements) {
      if (context.currentLevel >= level) {
        const result = await unlockAchievement(userId, key);
        if (result.unlocked) unlocked.push(key);
      }
    }
  }

  // Streak-based achievements
  if (context.currentStreak !== undefined) {
    const streakAchievements: Array<{ key: string; days: number }> = [
      { key: 'streak_7_days', days: 7 },
      { key: 'streak_30_days', days: 30 },
      { key: 'streak_100_days', days: 100 },
    ];

    for (const { key, days } of streakAchievements) {
      if (context.currentStreak >= days) {
        const result = await unlockAchievement(userId, key);
        if (result.unlocked) unlocked.push(key);
      }
    }
  }

  // XP-based achievements
  if (context.totalXp !== undefined) {
    const xpAchievements: Array<{ key: string; xp: number }> = [
      { key: 'earn_1000_xp', xp: 1000 },
      { key: 'earn_5000_xp', xp: 5000 },
      { key: 'earn_10000_xp', xp: 10000 },
    ];

    for (const { key, xp } of xpAchievements) {
      if (context.totalXp >= xp) {
        const result = await unlockAchievement(userId, key);
        if (result.unlocked) unlocked.push(key);
      }
    }
  }

  // Trade journaling achievements
  if (context.tradesJournaled !== undefined) {
    const tradeAchievements: Array<{ key: string; count: number }> = [
      { key: 'journal_first_trade', count: 1 },
      { key: 'journal_10_trades', count: 10 },
      { key: 'journal_50_trades', count: 50 },
    ];

    for (const { key, count } of tradeAchievements) {
      if (context.tradesJournaled >= count) {
        const result = await unlockAchievement(userId, key);
        if (result.unlocked) unlocked.push(key);
      }
    }
  }

  return unlocked;
}
