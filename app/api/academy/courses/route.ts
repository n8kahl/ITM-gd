import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { getUserTier, getAccessibleTiers } from '@/lib/academy/get-user-tier'

/**
 * GET /api/academy/courses
 * List courses with user progress. Supports optional query params:
 *   - path_id: filter by learning path
 *   - difficulty: filter by difficulty level
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
    const { searchParams } = new URL(request.url)
    const pathId = searchParams.get('path_id')
    const difficulty = searchParams.get('difficulty')

    // Get user tier from discord profile + app_settings mapping
    const userTier = await getUserTier(supabase, user.id)
    const accessibleTiers = getAccessibleTiers(userTier)

    // Build course query
    let query = supabase
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
        is_published,
        display_order,
        lessons(id)
      `)
      .eq('is_published', true)
      .in('tier_required', accessibleTiers)
      .order('display_order', { ascending: true })

    if (difficulty) {
      query = query.eq('difficulty_level', difficulty)
    }

    const { data: courses, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // If filtering by path, get course IDs in the path
    let pathCourseIds: string[] | null = null
    if (pathId) {
      const { data: pathCourses } = await supabase
        .from('learning_path_courses')
        .select('course_id')
        .eq('learning_path_id', pathId)
        .order('sequence_order', { ascending: true })

      pathCourseIds = (pathCourses || []).map((pc) => pc.course_id)
    }

    // Get user course progress
    const { data: courseProgress } = await supabase
      .from('user_course_progress')
      .select('course_id, lessons_completed, total_lessons, status, completed_at')
      .eq('user_id', user.id)

    const progressMap = new Map(
      (courseProgress || []).map((p) => [p.course_id, p])
    )

    let filteredCourses = courses || []
    if (pathCourseIds) {
      filteredCourses = filteredCourses.filter((c) => pathCourseIds!.includes(c.id))
    }

    const coursesWithProgress = filteredCourses.map((course) => {
      const progress = progressMap.get(course.id)
      const totalLessons = course.lessons?.length || 0
      const lessonsCompleted = progress?.lessons_completed || 0
      return {
        ...course,
        lesson_count: totalLessons,
        lessons: undefined,
        user_progress: progress
          ? {
              lessons_completed: lessonsCompleted,
              total_lessons: progress.total_lessons || totalLessons,
              progress_pct: totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0,
              status: progress.status,
              completed_at: progress.completed_at,
            }
          : {
              lessons_completed: 0,
              total_lessons: totalLessons,
              progress_pct: 0,
              status: 'not_started',
              completed_at: null,
            },
      }
    })

    return NextResponse.json({
      success: true,
      data: coursesWithProgress,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
