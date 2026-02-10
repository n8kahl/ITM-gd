import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  getAccessibleTierIds,
  resolveUserMembershipTier,
  toSafeErrorMessage,
} from '@/lib/academy/api-utils'

interface LearningPathRow {
  id: string
  name: string
  slug: string
  description: string | null
  tier_required: 'core' | 'pro' | 'executive'
  estimated_hours: number | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  icon_name: string | null
  is_published: boolean
  display_order: number
}

/**
 * GET /api/academy/paths
 * Returns learning paths filtered by member tier with derived progress.
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
    const userTier = await resolveUserMembershipTier(user, supabase)
    const accessibleTiers = getAccessibleTierIds(userTier)

    const { data: paths, error: pathsError } = await supabase
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
        display_order
      `)
      .eq('is_published', true)
      .in('tier_required', accessibleTiers)
      .order('display_order', { ascending: true })

    if (pathsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load learning paths' },
        { status: 500 }
      )
    }

    const learningPaths = (paths || []) as LearningPathRow[]
    const pathIds = learningPaths.map((path) => path.id)

    const { data: pathCourses } = pathIds.length > 0
      ? await supabase
          .from('learning_path_courses')
          .select('learning_path_id, course_id, sequence_order')
          .in('learning_path_id', pathIds)
          .order('sequence_order', { ascending: true })
      : { data: [] as Array<{ learning_path_id: string; course_id: string; sequence_order: number }> }

    const courseIds = Array.from(new Set((pathCourses || []).map((row) => row.course_id)))

    const { data: courseProgress } = courseIds.length > 0
      ? await supabase
          .from('user_course_progress')
          .select('course_id, status')
          .eq('user_id', user.id)
          .in('course_id', courseIds)
      : { data: [] as Array<{ course_id: string; status: string }> }

    const progressByCourse = new Map(
      (courseProgress || []).map((row) => [row.course_id, row.status])
    )

    const coursesByPath = new Map<string, Array<{ course_id: string; sequence_order: number }>>()
    for (const row of pathCourses || []) {
      const existing = coursesByPath.get(row.learning_path_id) || []
      existing.push({
        course_id: row.course_id,
        sequence_order: row.sequence_order,
      })
      coursesByPath.set(row.learning_path_id, existing)
    }

    const mappedPaths = learningPaths.map((path) => {
      const coursesForPath = coursesByPath.get(path.id) || []
      const completedCount = coursesForPath.filter(
        (course) => progressByCourse.get(course.course_id) === 'completed'
      ).length

      const progressPct = coursesForPath.length > 0
        ? Math.round((completedCount / coursesForPath.length) * 100)
        : 0

      return {
        ...path,
        user_progress: {
          progress_pct: progressPct,
          status:
            completedCount === 0
              ? 'not_started'
              : completedCount >= coursesForPath.length
                ? 'completed'
                : 'in_progress',
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        paths: mappedPaths,
        user_tier: userTier,
      },
    })
  } catch (error) {
    console.error('academy paths failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
