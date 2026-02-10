import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

/**
 * GET /api/academy/dashboard
 * Personalized academy dashboard: current lesson (in_progress),
 * XP stats, streak, recent achievements, and recommendations.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth

    // Fetch all dashboard data in parallel
    const [
      profileResult,
      currentLessonResult,
      xpResult,
      streakResult,
      achievementsResult,
      recentProgressResult,
    ] = await Promise.all([
      // User learning profile
      supabase
        .from('user_learning_profiles')
        .select('*, learning_paths:recommended_path_id(id, name, slug)')
        .eq('user_id', user.id)
        .maybeSingle(),

      // Current in-progress lesson
      supabase
        .from('user_lesson_progress')
        .select('*, lessons(id, title, slug, estimated_minutes, courses(id, title, slug))')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // XP stats
      supabase
        .from('user_xp_summary')
        .select('total_xp, level, xp_to_next_level, rank')
        .eq('user_id', user.id)
        .maybeSingle(),

      // Learning streak
      supabase
        .from('learning_streaks')
        .select('current_streak, longest_streak, last_activity_date')
        .eq('user_id', user.id)
        .maybeSingle(),

      // Recent achievements (last 5)
      supabase
        .from('user_achievements')
        .select('*, achievements(name, description, icon, badge_image_url, category)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(5),

      // Recent progress (last 7 days for activity graph)
      supabase
        .from('user_lesson_progress')
        .select('status, completed_at, updated_at')
        .eq('user_id', user.id)
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false }),
    ])

    // Compute summary stats
    const completedLessons = recentProgressResult.data?.filter(
      (p) => p.status === 'completed'
    ).length || 0

    const streak = streakResult.data || { current_streak: 0, longest_streak: 0, last_activity_date: null }
    const xp = xpResult.data || { total_xp: 0, level: 1, xp_to_next_level: 100, rank: null }

    return NextResponse.json({
      success: true,
      data: {
        profile: profileResult.data || null,
        current_lesson: currentLessonResult.data || null,
        xp: {
          total: xp.total_xp,
          level: xp.level,
          xp_to_next_level: xp.xp_to_next_level,
          rank: xp.rank,
        },
        streak: {
          current: streak.current_streak,
          longest: streak.longest_streak,
          last_activity: streak.last_activity_date,
        },
        recent_achievements: achievementsResult.data || [],
        weekly_activity: {
          lessons_completed: completedLessons,
          total_activities: recentProgressResult.data?.length || 0,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
