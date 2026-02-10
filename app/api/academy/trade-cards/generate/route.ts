import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  generateAllTradeCards,
  TIER_COLOR_MAP,
} from '@/lib/academy/trade-card-generator'
import { uploadTradeCardToStorage } from '@/lib/uploads/trade-card-storage'
import type { TradeCardMetadata, TradeCardFormat } from '@/lib/types/academy'
import { getRankForXP } from '@/lib/academy/xp-utils'
import { generateVerificationCode } from '@/lib/validation/crypto-utils'
import { resolveUserMembershipTier, toSafeErrorMessage } from '@/lib/academy/api-utils'

/**
 * POST /api/academy/trade-cards/generate
 * Generates all trade-card formats and stores URLs in achievement metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const body = await request.json()
    const achievementId = body?.achievementId

    if (!achievementId || typeof achievementId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'achievementId is required' },
        { status: 400 }
      )
    }

    const { data: achievement, error: achievementError } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('id', achievementId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (achievementError || !achievement) {
      return NextResponse.json(
        { success: false, error: 'Achievement not found' },
        { status: 404 }
      )
    }

    const verificationCode = achievement.verification_code || generateVerificationCode()

    const [tier, xpResult, completedCoursesResult, courseStatsResult, totalCoursesResult, totalLessonsCompletedResult, discordProfileResult] = await Promise.all([
      resolveUserMembershipTier(user, supabase),
      supabase
        .from('user_xp')
        .select('total_xp, current_streak')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_course_progress')
        .select('courses(title)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .limit(7),
      supabase
        .from('user_course_progress')
        .select('status, overall_quiz_average')
        .eq('user_id', user.id),
      supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('user_lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed'),
      supabase
        .from('user_discord_profiles')
        .select('discord_username')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const tierColors = TIER_COLOR_MAP[tier] || TIER_COLOR_MAP.core
    const totalXP = xpResult.data?.total_xp || 0
    const currentRank = getRankForXP(totalXP)

    const coursesCompletedCount = (courseStatsResult.data || []).filter((row) => row.status === 'completed').length
    const quizScores = (courseStatsResult.data || [])
      .map((row) => row.overall_quiz_average)
      .filter((value): value is number => typeof value === 'number')
    const quizAverage = quizScores.length > 0
      ? Math.round(quizScores.reduce((sum, value) => sum + value, 0) / quizScores.length)
      : 0

    const coursesCompletedList = (completedCoursesResult.data || [])
      .map((row) => {
        const relation = row.courses as { title?: string } | Array<{ title?: string }> | null
        if (Array.isArray(relation)) {
          return relation[0]?.title || null
        }

        return relation?.title || null
      })
      .filter((title): title is string => typeof title === 'string' && title.length > 0)

    const memberName =
      discordProfileResult.data?.discord_username ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'TITM Member'

    const achievementData = (achievement.achievement_data || {}) as Record<string, unknown>
    const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const metadata: TradeCardMetadata = {
      achievementTitle:
        typeof achievementData.title === 'string'
          ? achievementData.title
          : achievement.achievement_key || 'Achievement Unlocked',
      memberName,
      earnedDate,
      verificationCode,
      achievementIcon:
        typeof achievementData.icon === 'string'
          ? achievementData.icon
          : 'trophy',
      tier,
      stats: {
        coursesCompleted: coursesCompletedCount,
        totalCourses: totalCoursesResult.count || 0,
        quizAverage,
        totalLessons: totalLessonsCompletedResult.count || 0,
        dayStreak: xpResult.data?.current_streak || 0,
        currentRank,
      },
      coursesCompletedList,
    }

    const cards = await generateAllTradeCards(metadata, tierColors)

    const uploadResults: Partial<Record<TradeCardFormat, string>> = {}
    for (const card of cards) {
      const uploadPath = `${user.id}/${achievementId}-${card.format}.png`
      const publicUrl = await uploadTradeCardToStorage(card.buffer, uploadPath)
      uploadResults[card.format] = publicUrl
    }

    const nextAchievementData: Record<string, unknown> = {
      ...achievementData,
      trade_cards: uploadResults,
    }

    await supabase
      .from('user_achievements')
      .update({
        verification_code: verificationCode,
        trade_card_image_url: uploadResults.landscape || achievement.trade_card_image_url,
        achievement_data: nextAchievementData,
      })
      .eq('id', achievementId)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      data: {
        achievementId,
        verificationCode,
        cards: uploadResults,
      },
    })
  } catch (error) {
    console.error('academy trade card generation failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
