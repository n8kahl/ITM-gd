import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  getAccessibleTierIds,
  resolveUserMembershipTier,
  toSafeErrorMessage,
} from '@/lib/academy/api-utils'

interface LessonWithCourse {
  id: string
  title: string
  slug: string
  estimated_minutes: number | null
  duration_minutes: number | null
  display_order: number
  course_id: string
  courses?: {
    id: string
    title: string
    slug: string
    tier_required: 'core' | 'pro' | 'executive'
  } | Array<{
    id: string
    title: string
    slug: string
    tier_required: 'core' | 'pro' | 'executive'
  }> | null
}

function normalizeCourseRelation(value: LessonWithCourse['courses']) {
  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value || null
}

/**
 * GET /api/academy/recommendations
 * Returns up to 5 lesson recommendations without N+1 queries.
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

    const [profileResult, progressResult] = await Promise.all([
      supabase
        .from('user_learning_profiles')
        .select('current_learning_path_id')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_lesson_progress')
        .select('lesson_id, status')
        .eq('user_id', user.id),
    ])

    const completedLessonIds = new Set(
      (progressResult.data || [])
        .filter((row) => row.status === 'completed')
        .map((row) => row.lesson_id)
    )
    const inProgressLessonIds = new Set(
      (progressResult.data || [])
        .filter((row) => row.status === 'in_progress')
        .map((row) => row.lesson_id)
    )

    const recommendations: Array<{
      lesson: LessonWithCourse
      reason: string
      priority: number
    }> = []

    const seenLessonIds = new Set<string>()

    // Priority 1: continue in-progress lessons
    if (inProgressLessonIds.size > 0) {
      const { data: inProgressLessons } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          slug,
          estimated_minutes,
          duration_minutes,
          display_order,
          course_id,
          courses(id, title, slug, tier_required)
        `)
        .in('id', Array.from(inProgressLessonIds))
        .order('display_order', { ascending: true })
        .limit(2)

      for (const rawLesson of (inProgressLessons || []) as LessonWithCourse[]) {
        const course = normalizeCourseRelation(rawLesson.courses)
        if (!course || !accessibleTiers.includes(course.tier_required)) {
          continue
        }

        recommendations.push({
          lesson: rawLesson,
          reason: 'Continue where you left off',
          priority: 1,
        })
        seenLessonIds.add(rawLesson.id)
      }
    }

    // Priority 2: next lesson in recommended path (batched query)
    const recommendedPathId = profileResult.data?.current_learning_path_id
    if (recommendedPathId && recommendations.length < 5) {
      const { data: pathCourses } = await supabase
        .from('learning_path_courses')
        .select('course_id, sequence_order')
        .eq('learning_path_id', recommendedPathId)
        .order('sequence_order', { ascending: true })

      const orderedCourseIds = (pathCourses || []).map((row) => row.course_id)
      if (orderedCourseIds.length > 0) {
        const { data: pathLessons } = await supabase
          .from('lessons')
          .select(`
            id,
            title,
            slug,
            estimated_minutes,
            duration_minutes,
            display_order,
            course_id,
            courses(id, title, slug, tier_required)
          `)
          .in('course_id', orderedCourseIds)
          .order('course_id', { ascending: true })
          .order('display_order', { ascending: true })

        const firstUncompletedByCourse = new Map<string, LessonWithCourse>()
        for (const rawLesson of (pathLessons || []) as LessonWithCourse[]) {
          if (seenLessonIds.has(rawLesson.id)) continue
          if (completedLessonIds.has(rawLesson.id)) continue
          if (inProgressLessonIds.has(rawLesson.id)) continue

          const course = normalizeCourseRelation(rawLesson.courses)
          if (!course || !accessibleTiers.includes(course.tier_required)) {
            continue
          }

          if (!firstUncompletedByCourse.has(rawLesson.course_id)) {
            firstUncompletedByCourse.set(rawLesson.course_id, rawLesson)
          }
        }

        for (const courseId of orderedCourseIds) {
          if (recommendations.length >= 5) break

          const lesson = firstUncompletedByCourse.get(courseId)
          if (!lesson) continue

          recommendations.push({
            lesson,
            reason: 'Next in your learning path',
            priority: 2,
          })
          seenLessonIds.add(lesson.id)
        }
      }
    }

    // Priority 3: fill with remaining accessible lessons
    if (recommendations.length < 5) {
      const { data: fallbackLessons } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          slug,
          estimated_minutes,
          duration_minutes,
          display_order,
          course_id,
          courses(id, title, slug, tier_required)
        `)
        .order('display_order', { ascending: true })
        .limit(50)

      for (const rawLesson of (fallbackLessons || []) as LessonWithCourse[]) {
        if (recommendations.length >= 5) break
        if (seenLessonIds.has(rawLesson.id)) continue
        if (completedLessonIds.has(rawLesson.id)) continue
        if (inProgressLessonIds.has(rawLesson.id)) continue

        const course = normalizeCourseRelation(rawLesson.courses)
        if (!course || !accessibleTiers.includes(course.tier_required)) {
          continue
        }

        recommendations.push({
          lesson: rawLesson,
          reason: 'Recommended for you',
          priority: 3,
        })
        seenLessonIds.add(rawLesson.id)
      }
    }

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
    console.error('academy recommendations failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
