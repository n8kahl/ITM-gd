import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

type MasteryStage = 'awareness' | 'applied' | 'independent'

const XP_CORRECT = 5
const XP_ATTEMPT = 2

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function toMasteryStage(score: number): MasteryStage {
  if (score >= 67) return 'independent'
  if (score >= 34) return 'applied'
  return 'awareness'
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeConfidence(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 3
  return Math.max(1, Math.min(5, Math.round(parsed)))
}

function normalizeLatencyMs(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed)
}

function normalizeScoreDelta(args: {
  isCorrect: boolean
  confidence: number
}): number {
  if (args.isCorrect) {
    return args.confidence >= 4 ? 4 : 3
  }

  return args.confidence <= 2 ? -4 : -3
}

/**
 * POST /api/academy/review/submit
 * Body: {
 *   queue_item_id: string,
 *   answer_data: object,
 *   is_correct: boolean,
 *   confidence: number,
 *   latency_ms: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user } = auth
    const body = await request.json().catch(() => ({}))

    const queueItemId = typeof body?.queue_item_id === 'string' ? body.queue_item_id : null
    const answerData =
      body?.answer_data && typeof body.answer_data === 'object' ? body.answer_data : {}
    const isCorrect = Boolean(body?.is_correct)
    const confidence = normalizeConfidence(body?.confidence)
    const latencyMs = normalizeLatencyMs(body?.latency_ms)

    if (!queueItemId) {
      return NextResponse.json(
        { success: false, error: 'queue_item_id is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: queueItem, error: queueItemError } = await supabaseAdmin
      .from('review_queue_items')
      .select('id, user_id, competency_key, difficulty_rating, stability_days, interval_stage')
      .eq('id', queueItemId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (queueItemError || !queueItem) {
      return NextResponse.json(
        { success: false, error: 'Review item not found' },
        { status: 404 }
      )
    }

    const { error: attemptInsertError } = await supabaseAdmin.from('review_attempts').insert({
      queue_item_id: queueItem.id,
      user_id: user.id,
      answer_data: answerData,
      is_correct: isCorrect,
      confidence_rating: confidence,
      latency_ms: latencyMs,
    })

    if (attemptInsertError) {
      return NextResponse.json(
        { success: false, error: 'Failed to record review attempt' },
        { status: 500 }
      )
    }

    const intervalResult = await supabaseAdmin.rpc('calculate_next_review_interval', {
      p_difficulty: Number(queueItem.difficulty_rating || 5),
      p_stability: Number(queueItem.stability_days || 1),
      p_is_correct: isCorrect,
      p_confidence: confidence,
    })

    if (intervalResult.error || !intervalResult.data?.[0]) {
      return NextResponse.json(
        { success: false, error: 'Failed to calculate next interval' },
        { status: 500 }
      )
    }

    const interval = intervalResult.data[0]
    const nextDueAt = interval.next_due_at as string
    const newDifficulty = Number(interval.new_difficulty || queueItem.difficulty_rating || 5)
    const newStability = Number(interval.new_stability || queueItem.stability_days || 1)
    const nextStage = isCorrect
      ? Number(queueItem.interval_stage || 0) + 1
      : 0

    const { error: queueUpdateError } = await supabaseAdmin
      .from('review_queue_items')
      .update({
        due_at: nextDueAt,
        difficulty_rating: newDifficulty,
        stability_days: newStability,
        interval_stage: nextStage,
        status: 'due',
      })
      .eq('id', queueItem.id)

    if (queueUpdateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update review queue item' },
        { status: 500 }
      )
    }

    const { data: existingScore } = await supabaseAdmin
      .from('user_competency_scores')
      .select('score, assessments_count')
      .eq('user_id', user.id)
      .eq('competency_key', queueItem.competency_key)
      .maybeSingle()

    const currentScore = Number(existingScore?.score || 0)
    const scoreDelta = normalizeScoreDelta({ isCorrect, confidence })
    const nextScore = clampScore(currentScore + scoreDelta)
    const nextAssessmentsCount = Number(existingScore?.assessments_count || 0) + 1
    const nextMasteryStage = toMasteryStage(nextScore)

    const { error: competencyUpsertError } = await supabaseAdmin
      .from('user_competency_scores')
      .upsert(
        {
          user_id: user.id,
          competency_key: queueItem.competency_key,
          score: nextScore,
          mastery_stage: nextMasteryStage,
          assessments_count: nextAssessmentsCount,
          last_assessed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,competency_key' }
      )

    if (competencyUpsertError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update competency score' },
        { status: 500 }
      )
    }

    const xpAwarded = isCorrect ? XP_CORRECT : XP_ATTEMPT
    await supabaseAdmin.rpc('increment_user_xp', {
      p_user_id: user.id,
      p_xp: xpAwarded,
    })

    await supabaseAdmin.from('user_learning_activity_log').insert({
      user_id: user.id,
      activity_type: 'review_complete',
      entity_id: queueItem.id,
      entity_type: 'review_item',
      xp_earned: xpAwarded,
      metadata: {
        competency_key: queueItem.competency_key,
        is_correct: isCorrect,
        confidence,
        latency_ms: latencyMs,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        queue_item_id: queueItem.id,
        is_correct: isCorrect,
        confidence,
        xp_awarded: xpAwarded,
        next_due_at: nextDueAt,
        interval_stage: nextStage,
        competency_key: queueItem.competency_key,
        competency_score: nextScore,
        mastery_stage: nextMasteryStage,
      },
    })
  } catch (error) {
    console.error('academy review submit failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
