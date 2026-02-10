import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

const TIER_HIERARCHY: Record<string, number> = { core: 1, pro: 2, executive: 3 }

function getAccessibleTiers(userTier: string): string[] {
  const level = TIER_HIERARCHY[userTier] || 1
  return Object.entries(TIER_HIERARCHY)
    .filter(([, l]) => l <= level)
    .map(([tier]) => tier)
}

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

    // Get user tier
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle()

    const userTier = membership?.tier || 'core'
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
        difficulty,
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
      query = query.eq('difficulty', difficulty)
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
        .eq('path_id', pathId)
        .order('display_order', { ascending: true })

      pathCourseIds = (pathCourses || []).map((pc) => pc.course_id)
    }

    // Get user course progress
    const { data: courseProgress } = await supabase
      .from('user_course_progress')
      .select('course_id, progress_pct, status, completed_at')
      .eq('user_id', user.id)

    const progressMap = new Map(
      (courseProgress || []).map((p) => [p.course_id, p])
    )

    let filteredCourses = courses || []
    if (pathCourseIds) {
      filteredCourses = filteredCourses.filter((c) => pathCourseIds!.includes(c.id))
    }

    const coursesWithProgress = filteredCourses.map((course) => ({
      ...course,
      lesson_count: course.lessons?.length || 0,
      lessons: undefined, // Remove raw lessons array
      user_progress: progressMap.get(course.id) || {
        progress_pct: 0,
        status: 'not_started',
        completed_at: null,
      },
    }))

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
