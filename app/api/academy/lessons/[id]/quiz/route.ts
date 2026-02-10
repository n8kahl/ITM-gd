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
  selected_answer: string | string[]
}

/**
 * POST /api/academy/lessons/[id]/quiz
 * Submit quiz answers, calculate score, award XP.
 * Body: { answers: [{ question_id, selected_answer }] }
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

    // Fetch quiz questions with correct answers
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, correct_answer, points, explanation')
      .eq('lesson_id', lessonId)

    if (questionsError || !questions || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No quiz found for this lesson' },
        { status: 404 }
      )
    }

    // Build lookup map for correct answers
    const questionMap = new Map(
      questions.map((q) => [q.id, q])
    )

    // Grade each answer
    let totalPoints = 0
    let earnedPoints = 0
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

      const points = question.points || 1
      totalPoints += points

      const isCorrect = Array.isArray(question.correct_answer)
        ? arraysMatch(
            Array.isArray(answer.selected_answer)
              ? answer.selected_answer
              : [answer.selected_answer],
            question.correct_answer
          )
        : String(answer.selected_answer) === String(question.correct_answer)

      if (isCorrect) {
        earnedPoints += points
      }

      return {
        question_id: answer.question_id,
        correct: isCorrect,
        explanation: question.explanation,
      }
    })

    // Account for any unanswered questions
    for (const q of questions) {
      if (!answers.find((a) => a.question_id === q.id)) {
        totalPoints += q.points || 1
      }
    }

    const scorePct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = scorePct >= 70
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
    const previouslyPassed = (existingProgress?.quiz_score || 0) >= 70

    // Update lesson progress with quiz score
    if (existingProgress) {
      await supabaseAdmin
        .from('user_lesson_progress')
        .update({
          quiz_score: Math.max(scorePct, existingProgress.quiz_score || 0),
          quiz_attempts: attemptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProgress.id)
    } else {
      await supabaseAdmin.from('user_lesson_progress').insert({
        user_id: user.id,
        lesson_id: lessonId,
        status: 'in_progress',
        progress_pct: 50,
        quiz_score: scorePct,
        quiz_attempts: 1,
        started_at: new Date().toISOString(),
      })
    }

    // Save quiz attempt record
    await supabaseAdmin.from('quiz_attempts').insert({
      user_id: user.id,
      lesson_id: lessonId,
      answers: answers,
      score_pct: scorePct,
      earned_points: earnedPoints,
      total_points: totalPoints,
      passed,
      attempt_number: attemptNumber,
    })

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

      await supabaseAdmin.from('xp_transactions').insert({
        user_id: user.id,
        amount: xpAwarded,
        source: perfect ? 'quiz_perfect' : isFirstAttempt ? 'quiz_pass_first' : 'quiz_pass_retake',
        reference_id: lessonId,
        description: perfect
          ? 'Perfect quiz score'
          : isFirstAttempt
            ? 'Passed quiz on first attempt'
            : 'Passed quiz on retake',
      })
      await supabaseAdmin.rpc('increment_user_xp', {
        p_user_id: user.id,
        p_amount: xpAwarded,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        score_pct: scorePct,
        earned_points: earnedPoints,
        total_points: totalPoints,
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

function arraysMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, idx) => val === sortedB[idx])
}
