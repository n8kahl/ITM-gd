import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  generateAllTradeCards,
  TIER_COLOR_MAP,
} from '@/lib/academy/trade-card-generator'
import { uploadTradeCardToStorage } from '@/lib/uploads/trade-card-storage'
import type { TradeCardMetadata, TradeCardFormat } from '@/lib/types/academy'
import { getRankForXP } from '@/lib/academy/xp-utils'

/**
 * POST /api/academy/trade-cards/generate
 *
 * Generates trade card images (landscape, story, square) for an achievement.
 * Expects JSON body: { achievementId: string }
 *
 * Flow:
 * 1. Authenticate user
 * 2. Fetch achievement + user profile data
 * 3. Build TradeCardMetadata
 * 4. Generate all 3 card formats via Satori/Resvg
 * 5. Upload PNGs to Supabase Storage
 * 6. Update achievement record with image URLs
 * 7. Return URLs
 */
export async function POST(request: NextRequest) {
  try {
    // --- Auth ---
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth

    // --- Parse body ---
    const body = await request.json()
    const { achievementId } = body as { achievementId?: string }

    if (!achievementId) {
      return NextResponse.json(
        { success: false, error: 'achievementId is required' },
        { status: 400 }
      )
    }

    // --- Fetch achievement ---
    const { data: achievement, error: achievementError } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('id', achievementId)
      .eq('user_id', user.id)
      .single()

    if (achievementError || !achievement) {
      return NextResponse.json(
        { success: false, error: 'Achievement not found' },
        { status: 404 }
      )
    }

    // --- Fetch user profile ---
    const { data: profile } = await supabase
      .from('user_learning_profiles')
      .select('display_name, tier')
      .eq('user_id', user.id)
      .maybeSingle()

    // --- Fetch XP data ---
    const { data: xpData } = await supabase
      .from('user_xp_summary')
      .select('total_xp')
      .eq('user_id', user.id)
      .maybeSingle()

    // --- Fetch completed courses ---
    const { data: completedCourses } = await supabase
      .from('user_course_progress')
      .select('courses(title)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .limit(7)

    // --- Fetch aggregate stats ---
    const { data: courseStats } = await supabase
      .from('user_course_progress')
      .select('status, overall_quiz_average')
      .eq('user_id', user.id)

    const { count: totalCourses } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })

    const { count: totalLessonsCompleted } = await supabase
      .from('user_lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')

    // --- Fetch streak ---
    const { data: streakData } = await supabase
      .from('learning_streaks')
      .select('current_streak')
      .eq('user_id', user.id)
      .maybeSingle()

    // --- Compute derived values ---
    const tier = profile?.tier || 'core'
    const tierColors = TIER_COLOR_MAP[tier] || TIER_COLOR_MAP.core
    const totalXP = xpData?.total_xp || 0
    const currentRank = getRankForXP(totalXP)

    const coursesCompletedCount = courseStats?.filter(
      (c: { status: string }) => c.status === 'completed'
    ).length || 0

    const quizScores = courseStats
      ?.map((c: { overall_quiz_average: number | null }) => c.overall_quiz_average)
      .filter((s: number | null): s is number => s !== null) || []
    const quizAverage =
      quizScores.length > 0
        ? Math.round(quizScores.reduce((a: number, b: number) => a + b, 0) / quizScores.length)
        : 0

    const coursesCompletedList = (completedCourses || [])
      .map((cp: { courses: { title: string } | null }) => cp.courses?.title)
      .filter(Boolean) as string[]

    const memberName =
      profile?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'TITM Member'

    const achievementData = achievement.achievement_data || {}
    const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    // --- Build metadata ---
    const metadata: TradeCardMetadata = {
      achievementTitle: achievementData.title || achievement.achievement_key || 'Achievement Unlocked',
      memberName,
      earnedDate,
      verificationCode: achievement.verification_code,
      achievementIcon: achievementData.icon || 'trophy',
      tier,
      stats: {
        coursesCompleted: coursesCompletedCount,
        totalCourses: totalCourses || 0,
        quizAverage,
        totalLessons: totalLessonsCompleted || 0,
        dayStreak: streakData?.current_streak || 0,
        currentRank,
      },
      coursesCompletedList,
    }

    // --- Generate all 3 card formats ---
    const cards = await generateAllTradeCards(metadata, tierColors)

    // --- Upload to storage ---
    const uploadResults: Record<string, string> = {}

    for (const card of cards) {
      const uploadPath = `${user.id}/${achievementId}/${card.format}.png`
      const publicUrl = await uploadTradeCardToStorage(card.buffer, uploadPath)
      uploadResults[card.format] = publicUrl
    }

    // --- Update achievement record with the landscape image URL ---
    await supabase
      .from('user_achievements')
      .update({
        trade_card_image_url: uploadResults.landscape,
      })
      .eq('id', achievementId)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      data: {
        achievementId,
        verificationCode: achievement.verification_code,
        cards: uploadResults,
      },
    })
  } catch (error) {
    console.error('Trade card generation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
