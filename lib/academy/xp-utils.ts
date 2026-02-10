import { XP_THRESHOLDS, XP_AWARDS, type Rank } from '@/lib/types/academy'

export function getRankForXP(totalXP: number): Rank {
  const ranks = Object.entries(XP_THRESHOLDS).reverse() as [Rank, number][]
  for (const [rank, threshold] of ranks) {
    if (totalXP >= threshold) return rank
  }
  return 'Rookie'
}

export function getXPToNextRank(totalXP: number): { nextRank: Rank | null; xpNeeded: number; progress: number } {
  const ranks = Object.entries(XP_THRESHOLDS) as [Rank, number][]
  const currentRankIndex = ranks.findIndex(([, threshold]) => totalXP < threshold) - 1

  if (currentRankIndex >= ranks.length - 1) {
    return { nextRank: null, xpNeeded: 0, progress: 100 }
  }

  const nextRankEntry = ranks[currentRankIndex + 1]
  if (!nextRankEntry) return { nextRank: null, xpNeeded: 0, progress: 100 }

  const currentThreshold = currentRankIndex >= 0 ? ranks[currentRankIndex][1] : 0
  const nextThreshold = nextRankEntry[1]
  const xpInCurrentLevel = totalXP - currentThreshold
  const xpForLevel = nextThreshold - currentThreshold

  return {
    nextRank: nextRankEntry[0],
    xpNeeded: nextThreshold - totalXP,
    progress: Math.round((xpInCurrentLevel / xpForLevel) * 100),
  }
}

export async function awardXP(
  supabase: any,
  userId: string,
  amount: number,
  activityType: string,
  entityId?: string
) {
  await supabase.rpc('increment_user_xp', { p_user_id: userId, p_xp: amount })
  await supabase.rpc('update_streak', { p_user_id: userId })
  await supabase.from('user_learning_activity_log').insert({
    user_id: userId,
    activity_type: activityType,
    entity_id: entityId,
    xp_earned: amount,
    metadata: {},
  })
}

export { XP_AWARDS }
