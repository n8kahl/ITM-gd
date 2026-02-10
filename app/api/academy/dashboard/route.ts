import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  toSafeErrorMessage,
} from '@/lib/academy/api-utils'
import { resolveAcademyResumeTarget } from '@/lib/academy/resume'

interface DashboardCourse {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  tier_required: 'core' | 'pro' | 'executive'
  estimated_hours: number | null
  learning_path_id: string | null
}

function normalizePathName(course: DashboardCourse, pathNamesById: Map<string, string>): string {
  if (!course.learning_path_id) {
    return 'General'
  }

  return pathNamesById.get(course.learning_path_id) || 'General'
}

/**
 * GET /api/academy/dashboard
 * Returns dashboard payload consumed by academy-hub UI.
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

    const [xpResult, recentAchievementsResult, courseProgressResult, lessonProgressResult, coursesResult, activityResult, resumeTarget] = await Promise.all([
      supabase
        .from('user_xp')
        .select('total_xp, current_streak')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_achievements')
        .select('id, achievement_key, achievement_type, achievement_data, earned_at')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(5),
      supabase
        .from('user_course_progress')
        .select('course_id, status')
        .eq('user_id', user.id),
      supabase
        .from('user_lesson_progress')
        .select('course_id, lesson_id, status, quiz_score')
        .eq('user_id', user.id),
      supabase
        .from('courses')
        .select(`
          id,
          title,
          slug,
          description,
          thumbnail_url,
          difficulty_level,
          tier_required,
          estimated_hours,
          learning_path_id
        `)
        .eq('is_published', true)
        .order('display_order', { ascending: true })
        .limit(12),
      supabase
        .from('user_learning_activity_log')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
      resolveAcademyResumeTarget(supabase, { userId: user.id }),
    ])

    const courses = (coursesResult.data || []) as DashboardCourse[]
    const learningPathIds = Array.from(
      new Set(courses.map((course) => course.learning_path_id).filter((value): value is string => !!value))
    )
    const { data: learningPaths } = learningPathIds.length > 0
      ? await supabase
          .from('learning_paths')
          .select('id, name')
          .in('id', learningPathIds)
      : { data: [] as Array<{ id: string; name: string | null }> }
    const pathNamesById = new Map(
      (learningPaths || []).map((row) => [row.id, row.name || 'General'])
    )

    const courseIds = courses.map((course) => course.id)

    const { data: lessonsForCourses } = courseIds.length > 0
      ? await supabase
          .from('lessons')
          .select('id, course_id, estimated_minutes')
          .in('course_id', courseIds)
      : { data: [] as Array<{ id: string; course_id: string; estimated_minutes: number | null }> }

    const lessonCountByCourse = new Map<string, number>()
    const estimatedMinutesByCourse = new Map<string, number>()
    for (const lesson of lessonsForCourses || []) {
      lessonCountByCourse.set(lesson.course_id, (lessonCountByCourse.get(lesson.course_id) || 0) + 1)
      estimatedMinutesByCourse.set(
        lesson.course_id,
        (estimatedMinutesByCourse.get(lesson.course_id) || 0) + (lesson.estimated_minutes || 0)
      )
    }

    const lessonProgressRows = lessonProgressResult.data || []
    const completedLessonsByCourse = new Map<string, number>()
    let lessonsCompleted = 0
    let quizzesPassed = 0
    for (const row of lessonProgressRows) {
      if (row.status === 'completed') {
        lessonsCompleted += 1
        completedLessonsByCourse.set(row.course_id, (completedLessonsByCourse.get(row.course_id) || 0) + 1)
      }

      if ((row.quiz_score || 0) >= 70) {
        quizzesPassed += 1
      }
    }

    const courseProgressRows = courseProgressResult.data || []
    const coursesCompleted = courseProgressRows.filter((row) => row.status === 'completed').length

    const totalLessons = Array.from(lessonCountByCourse.values()).reduce((sum, value) => sum + value, 0)
    const totalCourses = courses.length

    const recommendedCourses = courses.slice(0, 4).map((course) => {
      const totalLessonsForCourse = lessonCountByCourse.get(course.id) || 0
      const completedLessons = completedLessonsByCourse.get(course.id) || 0
      return {
        slug: course.slug,
        title: course.title,
        description: course.description || '',
        thumbnailUrl: course.thumbnail_url,
        difficulty: course.difficulty_level,
        path: normalizePathName(course, pathNamesById),
        totalLessons: totalLessonsForCourse,
        completedLessons,
        estimatedMinutes: estimatedMinutesByCourse.get(course.id) || Math.round((course.estimated_hours || 0) * 60),
      }
    })

    const activityDates = new Set(
      (activityResult.data || [])
        .map((row) => row.created_at)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => value.slice(0, 10))
    )

    const recentAchievements = (recentAchievementsResult.data || []).map((achievement) => {
      const metadata = achievement.achievement_data as { title?: string; description?: string; icon?: string; category?: string } | null
      return {
        id: achievement.id,
        title: metadata?.title || achievement.achievement_key,
        description: metadata?.description || achievement.achievement_type.replace(/_/g, ' '),
        icon: metadata?.icon || undefined,
        earnedAt: achievement.earned_at,
        category: metadata?.category || achievement.achievement_type,
      }
    })

    const currentLesson: {
      lessonId: string
      lessonTitle: string
      courseTitle: string
      courseSlug: string
      progress: number
      totalLessons: number
      currentLesson: number
    } | null = resumeTarget
      ? {
          lessonId: resumeTarget.lessonId,
          lessonTitle: resumeTarget.lessonTitle,
          courseTitle: resumeTarget.courseTitle,
          courseSlug: resumeTarget.courseSlug,
          progress: resumeTarget.courseProgressPercent,
          totalLessons: resumeTarget.totalLessons,
          currentLesson: resumeTarget.lessonNumber,
        }
      : null

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          coursesCompleted,
          totalCourses,
          lessonsCompleted,
          totalLessons,
          quizzesPassed,
          currentXp: xpResult.data?.total_xp || 0,
          currentStreak: xpResult.data?.current_streak || 0,
          activeDays: Array.from(activityDates),
        },
        currentLesson,
        recommendedCourses,
        recentAchievements,
      },
    })
  } catch (error) {
    console.error('academy dashboard failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
