import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const XP_QUIZ_PASS_FIRST = 50
const XP_QUIZ_PASS_RETAKE = 25
const XP_QUIZ_PERFECT = 100

interface QuizAnswer {
  question_id: string
  selected_option_id: string
}

interface QuizQuestion {
  id: string
  question: string
  options: Array<{ id: string; text: string }>
  correct_option_id: string
  explanation: string
}

interface QuizData {
  questions: QuizQuestion[]
  passing_score: number
}

/**
 * POST /api/academy/lessons/[id]/quiz
 * Submit quiz answers, calculate score, award XP.
 * Body: { answers: [{ question_id, selected_option_id }] }
 */
export async function POST(
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

    const { user } = auth
    const { id: lessonId } = await params
    const body = await request.json()
    const { answers } = body as { answers: QuizAnswer[] }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'answers array is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Fetch lesson to get quiz_data JSONB and course_id
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, quiz_data')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const quizData = lesson.quiz_data as QuizData | null

    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No quiz found for this lesson' },
        { status: 404 }
      )
    }

    const questions = quizData.questions
    const passingScore = quizData.passing_score ?? 70

    // Build lookup map for correct answers
    const questionMap = new Map(
      questions.map((q) => [q.id, q])
    )

    // Grade each answer
    const totalQuestions = questions.length
    let correctCount = 0
    const results = answers.map((answer) => {
      const question = questionMap.get(answer.question_id)
      if (!question) {
        return {
          question_id: answer.question_id,
          correct: false,
          explanation: null,
          error: 'Question not found',
        }
      }

      const isCorrect = answer.selected_option_id === question.correct_option_id

      if (isCorrect) {
        correctCount++
      }

      return {
        question_id: answer.question_id,
        correct: isCorrect,
        explanation: question.explanation,
      }
    })

    const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const passed = scorePct >= passingScore
    const perfect = scorePct === 100

    // Check previous attempts
    const { data: existingProgress } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('id, quiz_attempts, quiz_score')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    const attemptNumber = (existingProgress?.quiz_attempts || 0) + 1
    const isFirstAttempt = attemptNumber === 1
    const previouslyPassed = (existingProgress?.quiz_score || 0) >= passingScore

    // Update lesson progress with quiz score and responses
    if (existingProgress) {
      await supabaseAdmin
        .from('user_lesson_progress')
        .update({
          quiz_score: Math.max(scorePct, existingProgress.quiz_score || 0),
          quiz_attempts: attemptNumber,
          quiz_responses: answers,
        })
        .eq('id', existingProgress.id)
    } else {
      await supabaseAdmin.from('user_lesson_progress').insert({
        user_id: user.id,
        lesson_id: lessonId,
        course_id: lesson.course_id,
        status: 'in_progress',
        quiz_score: scorePct,
        quiz_attempts: 1,
        quiz_responses: answers,
        started_at: new Date().toISOString(),
      })
    }

    // Award XP if passed and not previously passed
    let xpAwarded = 0
    if (passed && !previouslyPassed) {
      if (perfect) {
        xpAwarded = XP_QUIZ_PERFECT
      } else if (isFirstAttempt) {
        xpAwarded = XP_QUIZ_PASS_FIRST
      } else {
        xpAwarded = XP_QUIZ_PASS_RETAKE
      }

      await supabaseAdmin.rpc('increment_user_xp', {
        p_user_id: user.id,
        p_xp: xpAwarded,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        score_pct: scorePct,
        correct_count: correctCount,
        total_questions: totalQuestions,
        passing_score: passingScore,
        passed,
        perfect,
        attempt_number: attemptNumber,
        xp_awarded: xpAwarded,
        results,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
