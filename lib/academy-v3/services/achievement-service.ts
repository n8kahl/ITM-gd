import type { SupabaseClient } from '@supabase/supabase-js'

interface AchievementUnlock {
  achievementId: string
  key: string
  title: string
  xpReward: number
}

interface AchievementCheckContext {
  userId: string
  lessonsCompleted: number
  streakDays: number
  tracksCompleted: string[]
  totalReviewCount: number
}

/**
 * Achievement unlock service for the academy gamification system.
 *
 * After each learning event, evaluates relevant achievement criteria
 * and unlocks any newly-earned achievements.
 */
export class AcademyAchievementService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all achievements and the user's unlock status.
   */
  async getAchievementsWithStatus(userId: string): Promise<{
    achievements: Array<{
      id: string
      key: string
      title: string
      description: string | null
      iconUrl: string | null
      category: string
      xpReward: number
      unlockedAt: string | null
    }>
    unlockedCount: number
    totalCount: number
  }> {
    const [achievementsResult, unlocksResult] = await Promise.all([
      this.supabase
        .from('academy_achievements')
        .select('id, key, title, description, icon_url, category, xp_reward, is_active')
        .eq('is_active', true)
        .order('category')
        .order('xp_reward', { ascending: true }),
      this.supabase
        .from('academy_user_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', userId),
    ])

    if (achievementsResult.error) throw new Error(`Failed to fetch achievements: ${achievementsResult.error.message}`)
    if (unlocksResult.error) throw new Error(`Failed to fetch unlocks: ${unlocksResult.error.message}`)

    const unlockMap = new Map(
      (unlocksResult.data ?? []).map(u => [u.achievement_id, u.unlocked_at])
    )

    const achievements = (achievementsResult.data ?? []).map(a => ({
      id: a.id,
      key: a.key,
      title: a.title,
      description: a.description,
      iconUrl: a.icon_url,
      category: a.category,
      xpReward: a.xp_reward,
      unlockedAt: unlockMap.get(a.id) ?? null,
    }))

    return {
      achievements,
      unlockedCount: achievements.filter(a => a.unlockedAt !== null).length,
      totalCount: achievements.length,
    }
  }

  /**
   * Evaluate and unlock achievements based on user progress context.
   *
   * Returns newly unlocked achievements (empty array if none).
   */
  async evaluateAndUnlock(context: AchievementCheckContext): Promise<AchievementUnlock[]> {
    const { userId } = context

    // Get all active achievements and user's existing unlocks
    const [achievementsResult, existingResult] = await Promise.all([
      this.supabase
        .from('academy_achievements')
        .select('id, key, title, unlock_criteria, xp_reward, is_active')
        .eq('is_active', true),
      this.supabase
        .from('academy_user_achievements')
        .select('achievement_id')
        .eq('user_id', userId),
    ])

    if (achievementsResult.error) throw new Error(`Failed to fetch achievements: ${achievementsResult.error.message}`)
    if (existingResult.error) throw new Error(`Failed to fetch user achievements: ${existingResult.error.message}`)

    const existingIds = new Set((existingResult.data ?? []).map(e => e.achievement_id))
    const newUnlocks: AchievementUnlock[] = []

    for (const achievement of achievementsResult.data ?? []) {
      if (existingIds.has(achievement.id)) continue

      const criteria = achievement.unlock_criteria as Record<string, unknown>
      if (!criteria) continue

      const shouldUnlock = this.evaluateCriteria(criteria, context)
      if (!shouldUnlock) continue

      // Unlock the achievement
      const { error } = await this.supabase
        .from('academy_user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievement.id,
        })

      if (error) {
        // Ignore duplicate (race condition)
        if (error.code !== '23505') {
          console.error(`Failed to unlock achievement ${achievement.key}:`, error.message)
        }
        continue
      }

      newUnlocks.push({
        achievementId: achievement.id,
        key: achievement.key,
        title: achievement.title,
        xpReward: achievement.xp_reward,
      })

      // Emit achievement_unlocked event (fire-and-forget)
      await this.supabase
        .from('academy_learning_events')
        .insert({
          user_id: userId,
          event_type: 'achievement_unlocked',
          payload: {
            achievementKey: achievement.key,
            achievementTitle: achievement.title,
            xpReward: achievement.xp_reward,
          },
        })
        .then(() => {})
        .catch(() => {})
    }

    return newUnlocks
  }

  /**
   * Evaluate a single achievement's unlock criteria against user context.
   */
  private evaluateCriteria(
    criteria: Record<string, unknown>,
    context: AchievementCheckContext,
  ): boolean {
    const type = criteria.type as string | undefined

    switch (type) {
      case 'lessons_completed':
        return context.lessonsCompleted >= (criteria.count as number ?? Infinity)

      case 'streak_days':
        return context.streakDays >= (criteria.days as number ?? Infinity)

      case 'track_completed':
        return context.tracksCompleted.includes(criteria.trackCode as string ?? '')

      case 'reviews_completed':
        return context.totalReviewCount >= (criteria.count as number ?? Infinity)

      case 'all_tracks_completed': {
        const requiredTracks = criteria.trackCodes as string[] ?? []
        return requiredTracks.every(code => context.tracksCompleted.includes(code))
      }

      default:
        return false
    }
  }
}
