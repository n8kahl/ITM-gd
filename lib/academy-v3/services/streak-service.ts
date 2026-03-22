import type { SupabaseClient } from '@supabase/supabase-js'

interface StreakData {
  userId: string
  currentStreakDays: number
  longestStreakDays: number
  lastActivityDate: string | null
  streakFreezeAvailable: boolean
}

/**
 * Streak service for the academy gamification system.
 *
 * On any learning event, checks if the streak should be incremented,
 * maintained, frozen, or reset. Updates the academy_user_streaks table.
 */
export class AcademyStreakService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current streak for a user.
   */
  async getStreak(userId: string): Promise<StreakData | null> {
    const { data, error } = await this.supabase
      .from('academy_user_streaks')
      .select('user_id, current_streak_days, longest_streak_days, last_activity_date, streak_freeze_available')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch streak: ${error.message}`)
    if (!data) return null

    return {
      userId: data.user_id,
      currentStreakDays: data.current_streak_days,
      longestStreakDays: data.longest_streak_days,
      lastActivityDate: data.last_activity_date,
      streakFreezeAvailable: data.streak_freeze_available,
    }
  }

  /**
   * Record activity for today, updating the streak accordingly.
   *
   * Logic:
   * - If last activity was today: no-op
   * - If last activity was yesterday: increment streak
   * - If last activity was >1 day ago: check freeze, or reset to 1
   */
  async recordActivity(userId: string): Promise<StreakData> {
    const existing = await this.getStreak(userId)
    const today = new Date().toISOString().split('T')[0]

    if (!existing) {
      // First-ever activity — create streak record
      const newStreak = {
        user_id: userId,
        current_streak_days: 1,
        longest_streak_days: 1,
        last_activity_date: today,
        streak_freeze_available: true,
      }

      const { error } = await this.supabase
        .from('academy_user_streaks')
        .insert(newStreak)

      if (error) throw new Error(`Failed to create streak: ${error.message}`)

      return {
        userId,
        currentStreakDays: 1,
        longestStreakDays: 1,
        lastActivityDate: today,
        streakFreezeAvailable: true,
      }
    }

    // Already counted today
    if (existing.lastActivityDate === today) {
      return existing
    }

    const lastDate = existing.lastActivityDate
      ? new Date(existing.lastActivityDate)
      : new Date(0)
    const todayDate = new Date(today)
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    let newStreakDays: number
    let freezeAvailable = existing.streakFreezeAvailable

    if (daysDiff === 1) {
      // Consecutive day
      newStreakDays = existing.currentStreakDays + 1
    } else if (daysDiff === 2 && existing.streakFreezeAvailable) {
      // Missed one day, use freeze
      newStreakDays = existing.currentStreakDays + 1
      freezeAvailable = false
    } else {
      // Streak broken
      newStreakDays = 1
    }

    const newLongest = Math.max(existing.longestStreakDays, newStreakDays)

    const { error } = await this.supabase
      .from('academy_user_streaks')
      .update({
        current_streak_days: newStreakDays,
        longest_streak_days: newLongest,
        last_activity_date: today,
        streak_freeze_available: freezeAvailable,
      })
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to update streak: ${error.message}`)

    // Emit streak milestone events
    const milestones = [7, 14, 30, 60, 100]
    if (milestones.includes(newStreakDays)) {
      await this.supabase
        .from('academy_learning_events')
        .insert({
          user_id: userId,
          event_type: 'streak_milestone',
          payload: { streakDays: newStreakDays },
        })
        .then(() => {}) // fire-and-forget
        .catch(() => {}) // event logging must not block user flows
    }

    return {
      userId,
      currentStreakDays: newStreakDays,
      longestStreakDays: newLongest,
      lastActivityDate: today,
      streakFreezeAvailable: freezeAvailable,
    }
  }
}
