import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { resolveAcademyResumeTarget } from '@/lib/academy/resume'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

/**
 * GET /api/academy/resume
 * Optional query params:
 * - course_slug: scope resume target to a single published course.
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
    const courseSlug = searchParams.get('course_slug')

    let scopedCourse: { id: string; slug: string; title: string } | null = null

    if (courseSlug) {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, slug, title')
        .eq('slug', courseSlug)
        .eq('is_published', true)
        .maybeSingle()

      if (courseError || !course) {
        return NextResponse.json(
          { success: false, error: 'Course not found' },
          { status: 404 }
        )
      }

      scopedCourse = {
        id: course.id,
        slug: course.slug,
        title: course.title,
      }
    }

    const target = await resolveAcademyResumeTarget(supabase, {
      userId: user.id,
      courseId: scopedCourse?.id,
    })

    const canonicalPayload = target
      ? {
          next_lesson_id: target.lessonId,
          course_slug: target.courseSlug,
          course_title: target.courseTitle,
          lesson_title: target.lessonTitle,
          lesson_position: target.lessonNumber,
          total_lessons: target.totalLessons,
          source_reason: target.source_reason,
        }
      : {
          next_lesson_id: null,
          course_slug: null,
          course_title: null,
          lesson_title: null,
          lesson_position: null,
          total_lessons: null,
          source_reason: null,
        }

    return NextResponse.json({
      success: true,
      data: {
        ...canonicalPayload,
        target,
        scope: scopedCourse ? 'course' : 'global',
        course: scopedCourse,
      },
    })
  } catch (error) {
    console.error('academy resume failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
