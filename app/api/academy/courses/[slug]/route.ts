import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

/**
 * GET /api/academy/courses/[slug]
 * Course detail with full lesson list and per-lesson user progress.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { slug } = await params

    // Fetch course with its lessons
    const { data: course, error: courseError } = await supabase
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
        lessons(
          id,
          title,
          slug,
          lesson_type,
          estimated_minutes,
          display_order,
          is_free_preview
        )
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Sort lessons by display_order
    const sortedLessons = (course.lessons || []).sort(
      (a: { display_order: number }, b: { display_order: number }) =>
        a.display_order - b.display_order
    )

    // Fetch user progress for all lessons in this course
    const lessonIds = sortedLessons.map((l: { id: string }) => l.id)
    const { data: lessonProgress } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id, status, completed_at, quiz_score, time_spent_seconds')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds.length > 0 ? lessonIds : ['__none__'])

    const progressMap = new Map(
      (lessonProgress || []).map((p) => [p.lesson_id, p])
    )

    // Fetch overall course progress
    const { data: courseProgress } = await supabase
      .from('user_course_progress')
      .select('lessons_completed, total_lessons, status, completed_at')
      .eq('user_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle()

    const lessonsWithProgress = sortedLessons.map((lesson: Record<string, unknown>) => ({
      ...lesson,
      user_progress: progressMap.get(lesson.id as string) || {
        status: 'not_started',
        completed_at: null,
        quiz_score: null,
        time_spent_seconds: 0,
      },
    }))

    return NextResponse.json({
      success: true,
      data: {
        ...course,
        lessons: lessonsWithProgress,
        lesson_count: lessonsWithProgress.length,
        completed_count: lessonsWithProgress.filter(
          (l: { user_progress: { status: string } }) => l.user_progress.status === 'completed'
        ).length,
        course_progress: courseProgress || {
          lessons_completed: 0,
          total_lessons: 0,
          status: 'not_started',
          completed_at: null,
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
