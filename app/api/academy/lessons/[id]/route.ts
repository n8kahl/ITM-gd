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
        lesson_type,
        estimated_minutes,
        duration_minutes,
        display_order,
        is_free_preview,
        video_url,
        content_markdown,
        course_id,
        quiz_data,
        activity_data,
        ai_tutor_context,
        ai_tutor_chips,
        key_takeaways,
        created_at,
        updated_at,
        courses(id, title, slug)
      `)
      .eq('id', id)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Parse quiz data from the lesson's JSONB field
    const quizData = lesson.quiz_data as {
      questions?: Array<{
        id: string
        question: string
        options: Array<{ id: string; text: string }>
        correct_option_id: string
        explanation: string
      }>
      passing_score?: number
    } | null

    const quizQuestions = quizData?.questions || []

    // Fetch user progress for this lesson
    const { data: progress } = await supabase
      .from('user_lesson_progress')
      .select('status, completed_at, quiz_score, quiz_attempts, quiz_responses, activity_completed, time_spent_seconds, notes')
      .eq('user_id', user.id)
      .eq('lesson_id', id)
      .maybeSingle()

    // Get previous and next lessons in the same course
    const { data: siblingLessons } = await supabase
      .from('lessons')
      .select('id, title, slug, display_order')
      .eq('course_id', lesson.course_id)
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
          questions: quizQuestions.map(({ correct_option_id, ...q }) => q),
          passing_score: quizData?.passing_score ?? 70,
          total_questions: quizQuestions.length,
        },
        user_progress: progress || {
          status: 'not_started',
          completed_at: null,
          quiz_score: null,
          quiz_attempts: 0,
          quiz_responses: null,
          activity_completed: false,
          time_spent_seconds: 0,
          notes: null,
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
