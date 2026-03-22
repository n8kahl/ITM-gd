import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyDifficulty } from '@/lib/academy-v3/contracts/domain'

interface XpAwardResult {
  totalXp: number
  currentLevel: number
  awarded: number
  leveledUp: boolean
  previousLevel: number
}

/**
 * XP award table matching the spec.
 */
const XP_TABLE: Record<string, number> = {
  block_completed: 10,
  lesson_completed: 50,
  assessment_passed_first: 100,
  assessment_passed_retry: 50,
  module_completed: 200,
  track_completed: 500,
  review_correct: 15,
  review_correct_streak: 20,
}

const DIFFICULTY_MULTIPLIER: Record<AcademyDifficulty, number> = {
  beginner: 1.0,
  intermediate: 1.5,
  advanced: 2.0,
}

const XP_PER_LEVEL = 500
const MAX_STREAK_BONUS = 0.5 // +50%

/**
 * XP service for the academy gamification system.
 *
 * Calculates XP awards with difficulty multipliers and streak bonuses,
 * updates the academy_user_xp table, and emits xp_earned events.
 */
export class AcademyXpService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current XP state for a user.
   */
  async getXp(userId: string): Promise<{ totalXp: number; currentLevel: number } | null> {
    const { data, error } = await this.supabase
      .from('academy_user_xp')
      .select('total_xp, current_level')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch XP: ${error.message}`)
    if (!data) return null

    return { totalXp: data.total_xp, currentLevel: data.current_level }
  }

  /**
   * Award XP to a user for a specific event.
   *
   * @param userId - The user receiving XP
   * @param event - Event type from the XP table
   * @param difficulty - Lesson/module difficulty for multiplier
   * @param streakDays - Current streak days for bonus
   */
  async awardXp(
    userId: string,
    event: string,
    difficulty: AcademyDifficulty = 'beginner',
    streakDays = 0,
  ): Promise<XpAwardResult> {
    const baseXp = XP_TABLE[event]
    if (!baseXp) {
      throw new Error(`Unknown XP event: ${event}`)
    }

    // Apply difficulty multiplier
    const diffMultiplier = DIFFICULTY_MULTIPLIER[difficulty] ?? 1.0

    // Apply streak bonus: +10% per streak day, capped at +50%
    const streakBonus = Math.min(streakDays * 0.1, MAX_STREAK_BONUS)
    const streakMultiplier = 1.0 + streakBonus

    const awarded = Math.round(baseXp * diffMultiplier * streakMultiplier)

    // Get or create XP record
    const existing = await this.getXp(userId)
    const previousXp = existing?.totalXp ?? 0
    const previousLevel = existing?.currentLevel ?? 1
    const newTotalXp = previousXp + awarded
    const newLevel = Math.max(1, Math.floor(newTotalXp / XP_PER_LEVEL) + 1)
    const leveledUp = newLevel > previousLevel

    if (existing) {
      const { error } = await this.supabase
        .from('academy_user_xp')
        .update({
          total_xp: newTotalXp,
          current_level: newLevel,
        })
        .eq('user_id', userId)

      if (error) throw new Error(`Failed to update XP: ${error.message}`)
    } else {
      const { error } = await this.supabase
        .from('academy_user_xp')
        .insert({
          user_id: userId,
          total_xp: newTotalXp,
          current_level: newLevel,
        })

      if (error) throw new Error(`Failed to create XP: ${error.message}`)
    }

    // Emit xp_earned event (fire-and-forget, must not block user flow)
    await this.supabase
      .from('academy_learning_events')
      .insert({
        user_id: userId,
        event_type: 'xp_earned',
        payload: {
          amount: awarded,
          source: event,
          multipliers: {
            difficulty: diffMultiplier,
            streak: streakMultiplier,
          },
        },
      })
      .then(() => {})
      .catch(() => {})

    return {
      totalXp: newTotalXp,
      currentLevel: newLevel,
      awarded,
      leveledUp,
      previousLevel,
    }
  }
}
