import { NextRequest, NextResponse } from 'next/server'

import { getAcademyAchievementsResponseSchema } from '@/lib/academy-v3/contracts/api'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
} from '@/lib/academy-v3/access-control'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { academyV3ErrorResponse, logAcademyError } from '@/app/api/academy-v3/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }
    await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })

    // Fetch all active achievement definitions
    const { data: definitions, error: defError } = await auth.supabase
      .from('academy_achievements')
      .select('id, key, title, description, icon_url, category, xp_reward')
      .eq('is_active', true)
      .order('category')
      .order('xp_reward', { ascending: true })

    if (defError) {
      // Table may not exist yet if migration hasn't been applied
      logAcademyError('GET /api/academy-v3/achievements', 'ACHIEVEMENTS_FETCH_FAILED', defError)
      return NextResponse.json(
        getAcademyAchievementsResponseSchema.parse({
          data: { achievements: [], unlockedCount: 0, totalCount: 0 },
        })
      )
    }

    const allDefs = Array.isArray(definitions) ? definitions : []

    // Fetch user's unlocked achievements
    const { data: userAchievements } = await auth.supabase
      .from('academy_user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', auth.user.id)

    const unlockedMap = new Map<string, string>()
    for (const row of userAchievements || []) {
      if (row.achievement_id && row.unlocked_at) {
        unlockedMap.set(String(row.achievement_id), String(row.unlocked_at))
      }
    }

    const achievements = allDefs.map((def) => ({
      key: String(def.key),
      title: String(def.title),
      description: def.description ? String(def.description) : null,
      iconUrl: def.icon_url ? String(def.icon_url) : null,
      category: String(def.category),
      xpReward: typeof def.xp_reward === 'number' ? def.xp_reward : 0,
      unlockedAt: unlockedMap.get(String(def.id)) ?? null,
    }))

    return NextResponse.json(
      getAcademyAchievementsResponseSchema.parse({
        data: {
          achievements,
          unlockedCount: unlockedMap.size,
          totalCount: allDefs.length,
        },
      })
    )
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    logAcademyError('GET /api/academy-v3/achievements', 'INTERNAL_ERROR', error)
    return academyV3ErrorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch achievements')
  }
}
