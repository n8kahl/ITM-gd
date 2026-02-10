import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { getUserTier, getAccessibleTiers } from '@/lib/academy/get-user-tier'

/**
 * GET /api/academy/paths
 * List learning paths filtered by the user's subscription tier.
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

    // Get user tier from Discord roles + app_settings mapping
    const userTier = await getUserTier(supabase, user.id)
    const accessibleTiers = getAccessibleTiers(userTier)

    // Fetch paths filtered by tier
    const { data: paths, error } = await supabase
      .from('learning_paths')
      .select(`
        id,
        name,
        slug,
        description,
        tier_required,
        estimated_hours,
        difficulty_level,
        icon_name,
        is_published,
        display_order,
        courses:learning_path_courses(
          course_id,
          sequence_order,
          is_required,
          courses(id, title, slug)
        )
      `)
      .eq('is_published', true)
      .in('tier_required', accessibleTiers)
      .order('display_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Gather all course IDs across all paths to fetch user progress in one query
    const allCourseIds = new Set<string>()
    for (const path of paths || []) {
      for (const entry of path.courses || []) {
        if (entry.course_id) {
          allCourseIds.add(entry.course_id)
        }
      }
    }

    // Fetch user course progress for all relevant courses in a single query
    let courseProgressMap = new Map<string, { status: string; lessons_completed: number; total_lessons: number }>()

    if (allCourseIds.size > 0) {
      const { data: courseProgress } = await supabase
        .from('user_course_progress')
        .select('course_id, status, lessons_completed, total_lessons')
        .eq('user_id', user.id)
        .in('course_id', Array.from(allCourseIds))

      courseProgressMap = new Map(
        (courseProgress || []).map((p) => [p.course_id, p])
      )
    }

    // Compute per-path progress from individual course progress
    const pathsWithProgress = (paths || []).map((path) => {
      const pathCourses = path.courses || []
      const totalCourses = pathCourses.length
      const completedCourses = pathCourses.filter((entry: { course_id: string }) => {
        const progress = courseProgressMap.get(entry.course_id)
        return progress?.status === 'completed'
      }).length

      const progressPct = totalCourses > 0
        ? Math.round((completedCourses / totalCourses) * 100)
        : 0

      let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
      if (completedCourses === totalCourses && totalCourses > 0) {
        status = 'completed'
      } else if (completedCourses > 0) {
        status = 'in_progress'
      }

      return {
        ...path,
        user_progress: {
          progress_pct: progressPct,
          status,
          completed_courses: completedCourses,
          total_courses: totalCourses,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        paths: pathsWithProgress,
        user_tier: userTier,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
