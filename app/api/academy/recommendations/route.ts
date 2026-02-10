import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

const TIER_HIERARCHY: Record<string, number> = { core: 1, pro: 2, executive: 3 }

function getAccessibleTiers(userTier: string): string[] {
  const level = TIER_HIERARCHY[userTier] || 1
  return Object.entries(TIER_HIERARCHY)
    .filter(([, l]) => l <= level)
    .map(([tier]) => tier)
}

function getCourseTierFromRelation(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0] as { tier_required?: string } | undefined
    return first?.tier_required || 'core'
  }

  if (value && typeof value === 'object') {
    return ((value as { tier_required?: string }).tier_required) || 'core'
  }

  return 'core'
}

/**
 * GET /api/academy/recommendations
 * Get next-lesson recommendations based on user progress and learning path.
 * Returns up to 5 recommended lessons.
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

    // Fetch user profile and membership in parallel
    const [profileResult, membershipResult] = await Promise.all([
      supabase
        .from('user_learning_profiles')
        .select('recommended_path_id, experience_level, learning_goals, preferred_style')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_memberships')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const userTier = membershipResult.data?.tier || 'core'
    const accessibleTiers = getAccessibleTiers(userTier)
    const profile = profileResult.data

    // Get all completed and in-progress lessons
    const { data: userProgress } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id, status')
      .eq('user_id', user.id)

    const completedLessonIds = new Set(
      (userProgress || [])
        .filter((p) => p.status === 'completed')
        .map((p) => p.lesson_id)
    )
    const inProgressLessonIds = new Set(
      (userProgress || [])
        .filter((p) => p.status === 'in_progress')
        .map((p) => p.lesson_id)
    )

    const recommendations: Array<{
      lesson: Record<string, unknown>
      reason: string
      priority: number
    }> = []

    // Priority 1: Continue in-progress lessons
    if (inProgressLessonIds.size > 0) {
      const { data: inProgressLessons } = await supabase
        .from('lessons')
        .select('id, title, slug, estimated_minutes, display_order, course_id, courses(id, title, slug, tier_required)')
        .in('id', Array.from(inProgressLessonIds))
        .eq('is_published', true)
        .limit(2)

      for (const lesson of inProgressLessons || []) {
        const courseTier = getCourseTierFromRelation(lesson.courses)
        if (accessibleTiers.includes(courseTier)) {
          recommendations.push({
            lesson,
            reason: 'Continue where you left off',
            priority: 1,
          })
        }
      }
    }

    // Priority 2: Next lesson in recommended path
    if (profile?.recommended_path_id) {
      const { data: pathCourses } = await supabase
        .from('learning_path_courses')
        .select('course_id, display_order')
        .eq('path_id', profile.recommended_path_id)
        .order('display_order', { ascending: true })

      for (const pc of pathCourses || []) {
        if (recommendations.length >= 5) break

        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, title, slug, estimated_minutes, display_order, course_id, courses(id, title, slug, tier_required)')
          .eq('course_id', pc.course_id)
          .eq('is_published', true)
          .order('display_order', { ascending: true })

        for (const lesson of lessons || []) {
          if (recommendations.length >= 5) break
          if (completedLessonIds.has(lesson.id) || inProgressLessonIds.has(lesson.id)) continue

          const courseTier = getCourseTierFromRelation(lesson.courses)
          if (accessibleTiers.includes(courseTier)) {
            recommendations.push({
              lesson,
              reason: 'Next in your learning path',
              priority: 2,
            })
            break // Only one per course
          }
        }
      }
    }

    // Priority 3: Fill remaining slots with accessible unstarted lessons
    if (recommendations.length < 5) {
      const excludeIds = [
        ...Array.from(completedLessonIds),
        ...Array.from(inProgressLessonIds),
        ...recommendations.map((r) => (r.lesson as { id: string }).id),
      ]

      const { data: nextLessons } = await supabase
        .from('lessons')
        .select('id, title, slug, estimated_minutes, display_order, course_id, courses(id, title, slug, tier_required)')
        .eq('is_published', true)
        .order('display_order', { ascending: true })
        .limit(20)

      for (const lesson of nextLessons || []) {
        if (recommendations.length >= 5) break
        if (excludeIds.includes(lesson.id)) continue

        const courseTier = getCourseTierFromRelation(lesson.courses)
        if (accessibleTiers.includes(courseTier)) {
          recommendations.push({
            lesson,
            reason: 'Recommended for you',
            priority: 3,
          })
        }
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority)

    return NextResponse.json({
      success: true,
      data: {
        recommendations: recommendations.slice(0, 5),
        total_completed: completedLessonIds.size,
        total_in_progress: inProgressLessonIds.size,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
