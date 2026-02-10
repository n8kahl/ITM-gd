import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

/**
 * GET /api/academy/lessons/[id]
 * Full lesson content including quiz data and user progress.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params

    // Fetch lesson with course info
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        slug,
        description,
        content,
        content_format,
        lesson_type,
        estimated_minutes,
        display_order,
        is_published,
        is_free_preview,
        video_url,
        resources,
        course_id,
        courses(id, title, slug)
      `)
      .eq('id', id)
      .eq('is_published', true)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Fetch quiz questions for this lesson
    const { data: quizQuestions } = await supabase
      .from('quiz_questions')
      .select(`
        id,
        question_text,
        question_type,
        options,
        explanation,
        display_order,
        points
      `)
      .eq('lesson_id', id)
      .order('display_order', { ascending: true })

    // Fetch user progress for this lesson
    const { data: progress } = await supabase
      .from('user_lesson_progress')
      .select('status, progress_pct, completed_at, quiz_score, quiz_attempts, time_spent_seconds')
      .eq('user_id', user.id)
      .eq('lesson_id', id)
      .maybeSingle()

    // Get previous and next lessons in the same course
    const { data: siblingLessons } = await supabase
      .from('lessons')
      .select('id, title, slug, display_order')
      .eq('course_id', lesson.course_id)
      .eq('is_published', true)
      .order('display_order', { ascending: true })

    const currentIndex = (siblingLessons || []).findIndex(
      (l: { id: string }) => l.id === id
    )
    const prevLesson = currentIndex > 0 ? siblingLessons![currentIndex - 1] : null
    const nextLesson =
      currentIndex >= 0 && currentIndex < (siblingLessons?.length || 0) - 1
        ? siblingLessons![currentIndex + 1]
        : null

    return NextResponse.json({
      success: true,
      data: {
        ...lesson,
        quiz: {
          questions: quizQuestions || [],
          total_points: (quizQuestions || []).reduce(
            (sum: number, q: { points: number }) => sum + (q.points || 1),
            0
          ),
        },
        user_progress: progress || {
          status: 'not_started',
          progress_pct: 0,
          completed_at: null,
          quiz_score: null,
          quiz_attempts: 0,
          time_spent_seconds: 0,
        },
        navigation: {
          previous: prevLesson,
          next: nextLesson,
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
