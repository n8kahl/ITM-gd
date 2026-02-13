import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

interface QuizOption {
  id: string
  text: string
}

interface RawQuizQuestion {
  id: string
  text: string
  options: QuizOption[]
  correct_answer: string
  explanation?: string
}

interface RawLessonQuiz {
  questions?: RawQuizQuestion[]
}

interface FlatQuizQuestion {
  question?: string
  options?: string[]
  correct_index?: number
  explanation?: string
}

/**
 * GET /api/academy/lessons/[id]
 * Returns lesson payload tailored for the academy lesson page.
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

    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        course_id,
        content_markdown,
        chunk_data,
        lesson_type,
        video_url,
        estimated_minutes,
        duration_minutes,
        display_order,
        quiz_data,
        key_takeaways,
        competency_keys,
        ai_tutor_chips,
        courses(id, title, slug)
      `)
      .eq('id', id)
      .maybeSingle()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const courseRelation = Array.isArray(lesson.courses)
      ? lesson.courses[0]
      : lesson.courses

    const [allCourseLessonsResult, progressResult, currentProgressResult] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, title, display_order, estimated_minutes, duration_minutes')
        .eq('course_id', lesson.course_id)
        .order('display_order', { ascending: true }),
      supabase
        .from('user_lesson_progress')
        .select('lesson_id, status')
        .eq('user_id', user.id)
        .eq('course_id', lesson.course_id),
      supabase
        .from('user_lesson_progress')
        .select('status')
        .eq('user_id', user.id)
        .eq('lesson_id', lesson.id)
        .maybeSingle(),
    ])

    if (allCourseLessonsResult.error || progressResult.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load lesson metadata' },
        { status: 500 }
      )
    }

    const progressByLesson = new Map(
      (progressResult.data || []).map((row) => [row.lesson_id, row.status])
    )

    const sidebarLessons = (allCourseLessonsResult.data || []).map((courseLesson, index, list) => {
      const status = progressByLesson.get(courseLesson.id) || 'not_started'
      const isCompleted = status === 'completed'

      const previousLesson = index > 0 ? list[index - 1] : null
      const previousCompleted = previousLesson
        ? progressByLesson.get(previousLesson.id) === 'completed'
        : true

      return {
        id: courseLesson.id,
        title: courseLesson.title,
        order: courseLesson.display_order || index + 1,
        durationMinutes: courseLesson.estimated_minutes || courseLesson.duration_minutes || 0,
        isCompleted,
        isLocked: false, // TODO: restore gating → !isCompleted && !previousCompleted
      }
    })

    const rawQuizData = lesson.quiz_data
    let quizQuestions: Array<{
      id: string
      question: string
      options: QuizOption[]
      correctOptionId: string
      explanation?: string
    }> | null = null

    if (Array.isArray(rawQuizData)) {
      const normalized = (rawQuizData as FlatQuizQuestion[])
        .filter((question) => typeof question.question === 'string' && Array.isArray(question.options))
        .map((question, index) => ({
          id: `q-${index + 1}`,
          question: question.question || '',
          options: (question.options || []).map((option, optionIndex) => ({
            id: String(optionIndex),
            text: option,
          })),
          correctOptionId: String(question.correct_index ?? 0),
          explanation: question.explanation,
        }))
      quizQuestions = normalized.length > 0 ? normalized : null
    } else {
      const quizData = (rawQuizData || {}) as RawLessonQuiz
      quizQuestions = Array.isArray(quizData.questions)
        ? quizData.questions.map((question) => ({
            id: question.id,
            question: question.text,
            options: question.options || [],
            correctOptionId: question.correct_answer,
            explanation: question.explanation,
          }))
        : null
    }

    const contentType =
      lesson.lesson_type === 'video'
        ? 'video'
        : lesson.lesson_type === 'text'
          ? 'markdown'
          : lesson.lesson_type === 'chunk'
            ? 'chunk'
            : 'mixed'
    const tutorChips = Array.isArray(lesson.ai_tutor_chips)
      ? lesson.ai_tutor_chips
        .filter((chip): chip is string => typeof chip === 'string' && chip.trim().length > 0)
        .slice(0, 6)
      : []
    const keyTakeaways = Array.isArray(lesson.key_takeaways)
      ? lesson.key_takeaways
        .filter((takeaway): takeaway is string => typeof takeaway === 'string' && takeaway.trim().length > 0)
        .slice(0, 8)
      : []
    const competencyKeys = Array.isArray(lesson.competency_keys)
      ? lesson.competency_keys
        .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
        .slice(0, 4)
      : []

    return NextResponse.json({
      success: true,
      data: {
        id: lesson.id,
        title: lesson.title,
        content: lesson.content_markdown || '',
        chunkData: Array.isArray(lesson.chunk_data) ? lesson.chunk_data : null,
        contentType,
        videoUrl: lesson.video_url,
        durationMinutes: lesson.estimated_minutes || lesson.duration_minutes || 0,
        order: lesson.display_order || 1,
        isCompleted: currentProgressResult.data?.status === 'completed',
        course: {
          slug: courseRelation?.slug || '',
          title: courseRelation?.title || 'Course',
          lessons: sidebarLessons,
        },
        quiz: quizQuestions,
        aiTutorChips: tutorChips,
        keyTakeaways,
        competencyKeys,
      },
    })
  } catch (error) {
    console.error('academy lesson failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
