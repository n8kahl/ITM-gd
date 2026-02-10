import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

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
  selected_answer: string | string[]
}

interface QuizQuestion {
  id: string
  text: string
  options: Array<{ id: string; text: string }>
  correct_answer: string | string[]
  explanation?: string
}

interface LessonQuizData {
  questions?: QuizQuestion[]
  passing_score?: number
}

/**
 * POST /api/academy/lessons/[id]/quiz
 * Grades inline lesson quiz_data and records best score in user progress.
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
    const quizId = typeof body?.quiz_id === 'string' ? body.quiz_id : null
    const answers = Array.isArray(body?.answers) ? (body.answers as QuizAnswer[]) : []

    if (answers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'answers array is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, quiz_data')
      .eq('id', lessonId)
      .maybeSingle()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const lessonQuiz = (lesson.quiz_data || {}) as LessonQuizData
    const questions = Array.isArray(lessonQuiz.questions) ? lessonQuiz.questions : []
    if (questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No quiz found for this lesson' },
        { status: 404 }
      )
    }

    const passingScore = Number.isFinite(lessonQuiz.passing_score)
      ? Math.max(0, Math.min(100, Number(lessonQuiz.passing_score)))
      : 70

    const questionMap = new Map(questions.map((question) => [question.id, question]))

    // Require an answer for each question (prevents partial submissions skewing score).
    const expectedIds = new Set(questions.map((q) => q.id))
    const providedIds = new Set(answers.map((a) => a.question_id))
    const missing = Array.from(expectedIds).filter((id) => !providedIds.has(id))
    const unknown = answers.map((a) => a.question_id).filter((id) => !expectedIds.has(id))
    if (missing.length > 0 || unknown.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'answers must include exactly one entry per quiz question',
          data: {
            missing_question_ids: missing,
            unknown_question_ids: unknown,
          },
        },
        { status: 400 }
      )
    }

    let questionsCorrect = 0
    const results = answers.map((answer) => {
      const question = questionMap.get(answer.question_id)
      if (!question) {
        return {
          question_id: answer.question_id,
          is_correct: false,
          explanation: 'Question not found',
        }
      }

      const isCorrect = Array.isArray(question.correct_answer)
        ? arraysMatch(
            Array.isArray(answer.selected_answer)
              ? answer.selected_answer.map((value) => String(value))
              : [String(answer.selected_answer)],
            question.correct_answer.map((value) => String(value))
          )
        : String(answer.selected_answer) === String(question.correct_answer)

      if (isCorrect) {
        questionsCorrect += 1
      }

      return {
        question_id: answer.question_id,
        is_correct: isCorrect,
        explanation: question.explanation || null,
      }
    })

    const questionsTotal = questions.length
    const scorePct = questionsTotal > 0
      ? Math.round((questionsCorrect / questionsTotal) * 100)
      : 0
    const passed = scorePct >= passingScore
    const perfect = scorePct === 100

    const { data: existingProgress } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('id, quiz_attempts, quiz_score, status, started_at')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    const attemptNumber = (existingProgress?.quiz_attempts || 0) + 1
    const isFirstAttempt = attemptNumber === 1
    const previouslyPassed = (existingProgress?.quiz_score || 0) >= passingScore

    if (existingProgress) {
      await supabaseAdmin
        .from('user_lesson_progress')
        .update({
          quiz_score: Math.max(scorePct, existingProgress.quiz_score || 0),
          quiz_attempts: attemptNumber,
          quiz_responses: {
            answers,
            results,
            score_pct: scorePct,
            submitted_at: new Date().toISOString(),
          },
          status: existingProgress.status === 'not_started' ? 'in_progress' : existingProgress.status,
          started_at: existingProgress.started_at || new Date().toISOString(),
        })
        .eq('id', existingProgress.id)
    } else {
      await supabaseAdmin.from('user_lesson_progress').insert({
        user_id: user.id,
        lesson_id: lessonId,
        course_id: lesson.course_id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        quiz_score: scorePct,
        quiz_attempts: attemptNumber,
        quiz_responses: {
          answers,
          results,
          score_pct: scorePct,
          submitted_at: new Date().toISOString(),
        },
      })
    }

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

      await supabaseAdmin.from('user_learning_activity_log').insert({
        user_id: user.id,
        activity_type: 'quiz_pass',
        entity_id: lessonId,
        entity_type: 'lesson',
        xp_earned: xpAwarded,
        metadata: {
          score_pct: scorePct,
          attempt_number: attemptNumber,
          perfect,
        },
      })
    } else {
      await supabaseAdmin.from('user_learning_activity_log').insert({
        user_id: user.id,
        activity_type: 'quiz_attempt',
        entity_id: lessonId,
        entity_type: 'lesson',
        xp_earned: 0,
        metadata: {
          score_pct: scorePct,
          attempt_number: attemptNumber,
          passed,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        quiz_id: quizId,
        lesson_id: lessonId,
        score_pct: scorePct,
        score_percent: scorePct,
        questions_correct: questionsCorrect,
        questions_total: questionsTotal,
        passed,
        perfect,
        attempt_number: attemptNumber,
        xp_awarded: xpAwarded,
        xp_earned: xpAwarded,
        results,
      },
    })
  } catch (error) {
    console.error('academy quiz failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

function arraysMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false

  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB[index])
}
