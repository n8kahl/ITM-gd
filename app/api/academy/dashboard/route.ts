import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { getUserTier, getAccessibleTiers } from '@/lib/academy/get-user-tier'

/**
 * GET /api/academy/dashboard
 * Returns the full dashboard payload: stats, current lesson, recommended courses,
 * recent achievements — shaped exactly for the AcademyHub component.
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

    // Get user tier for course filtering
    const userTier = await getUserTier(supabase, user.id)
    const accessibleTiers = getAccessibleTiers(userTier)

    // Fetch all dashboard data in parallel
    const [
      xpResult,
      currentLessonResult,
      achievementsResult,
      coursesResult,
      activityResult,
      lessonProgressResult,
      courseProgressResult,
    ] = await Promise.all([
      // XP + streak data from user_xp table
      supabase
        .from('user_xp')
        .select('total_xp, current_rank, current_streak, longest_streak, last_activity_date, lessons_completed_count, courses_completed_count, quizzes_passed_count')
        .eq('user_id', user.id)
        .maybeSingle(),

      // Current in-progress lesson
      supabase
        .from('user_lesson_progress')
        .select('lesson_id, status, lessons(id, title, slug, estimated_minutes, course_id, courses(id, title, slug))')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle(),

      // Recent achievements (last 5)
      supabase
        .from('user_achievements')
        .select('id, achievement_type, achievement_key, achievement_data, xp_earned, earned_at')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(5),

      // All published courses with lesson counts (for recommendations + totals)
      supabase
        .from('courses')
        .select('id, title, slug, description, thumbnail_url, difficulty_level, tier_required, estimated_hours, display_order, lessons(id)')
        .eq('is_published', true)
        .order('display_order', { ascending: true }),

      // Recent activity log (last 7 days for active days)
      supabase
        .from('user_learning_activity_log')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // All lesson progress for counting
      supabase
        .from('user_lesson_progress')
        .select('lesson_id, status, quiz_score')
        .eq('user_id', user.id),

      // Course progress
      supabase
        .from('user_course_progress')
        .select('course_id, status')
        .eq('user_id', user.id),
    ])

    // Parse XP data
    const xp = xpResult.data || {
      total_xp: 0,
      current_rank: 'Rookie',
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null,
      lessons_completed_count: 0,
      courses_completed_count: 0,
      quizzes_passed_count: 0,
    }

    // Filter courses accessible by user tier
    const allCourses = (coursesResult.data || []).filter((c) =>
      accessibleTiers.includes(c.tier_required || 'core')
    )

    // Count totals
    const totalCourses = allCourses.length
    const totalLessons = allCourses.reduce(
      (sum, c) => sum + (c.lessons?.length || 0),
      0
    )

    // Count completed from progress records
    const completedLessons = (lessonProgressResult.data || []).filter(
      (p) => p.status === 'completed'
    ).length
    const quizzesPassed = (lessonProgressResult.data || []).filter(
      (p) => p.quiz_score !== null && p.quiz_score >= 70
    ).length
    const coursesCompleted = (courseProgressResult.data || []).filter(
      (p) => p.status === 'completed'
    ).length

    // Build active days array (unique dates in the past week)
    const activeDays = [
      ...new Set(
        (activityResult.data || []).map((a) =>
          new Date(a.created_at).toISOString().slice(0, 10)
        )
      ),
    ]

    // Build current lesson info
    let currentLesson = null
    if (currentLessonResult.data) {
      const lp = currentLessonResult.data
      const lesson = lp.lessons as { id: string; title: string; slug: string; estimated_minutes: number; course_id: string; courses: { id: string; title: string; slug: string } } | null
      if (lesson) {
        const courseLessonsCount = allCourses.find(
          (c) => c.id === lesson.course_id
        )?.lessons?.length || 0
        const completedInCourse = (lessonProgressResult.data || []).filter(
          (p) => p.status === 'completed'
        ).length
        currentLesson = {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          courseTitle: lesson.courses?.title || '',
          courseSlug: lesson.courses?.slug || '',
          progress: courseLessonsCount > 0
            ? Math.round((completedInCourse / courseLessonsCount) * 100)
            : 0,
          totalLessons: courseLessonsCount,
          currentLesson: completedInCourse + 1,
        }
      }
    }

    // Build recommended courses (first 4 not completed)
    const completedCourseIds = new Set(
      (courseProgressResult.data || [])
        .filter((p) => p.status === 'completed')
        .map((p) => p.course_id)
    )
    const recommendedCourses = allCourses
      .filter((c) => !completedCourseIds.has(c.id))
      .slice(0, 4)
      .map((course) => ({
        slug: course.slug,
        title: course.title,
        description: course.description || '',
        thumbnailUrl: course.thumbnail_url,
        difficulty: (course.difficulty_level || 'beginner') as 'beginner' | 'intermediate' | 'advanced',
        path: '',
        totalLessons: course.lessons?.length || 0,
        completedLessons: 0,
        estimatedMinutes: Math.round((course.estimated_hours || 1) * 60),
      }))

    // Build achievements
    const recentAchievements = (achievementsResult.data || []).map((a) => ({
      id: a.id,
      title: (a.achievement_data as Record<string, string>)?.title || a.achievement_key,
      description: (a.achievement_data as Record<string, string>)?.description || '',
      icon: (a.achievement_data as Record<string, string>)?.icon,
      earnedAt: a.earned_at,
      category: a.achievement_type,
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          coursesCompleted,
          totalCourses,
          lessonsCompleted: completedLessons,
          totalLessons,
          quizzesPassed,
          currentXp: xp.total_xp,
          currentStreak: xp.current_streak,
          activeDays,
        },
        currentLesson,
        recommendedCourses,
        recentAchievements,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
