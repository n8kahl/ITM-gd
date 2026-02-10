/**
 * File: app/api/academy/competency-scores/route.ts
 * Created: 2026-02-10
 * Purpose: Return per-user Academy competency scores for the mastery radar chart.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

type CompetencyKey =
  | 'market_context'
  | 'entry_validation'
  | 'position_sizing'
  | 'trade_management'
  | 'exit_discipline'
  | 'review_reflection'

type CompetencyScores = Record<CompetencyKey, number>

const EMPTY_SCORES: CompetencyScores = {
  market_context: 0,
  entry_validation: 0,
  position_sizing: 0,
  trade_management: 0,
  exit_discipline: 0,
  review_reflection: 0,
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabase } = auth

    const { data, error } = await supabase
      .from('user_competency_scores')
      .select('competency_key, score')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to load competency scores' }, { status: 500 })
    }

    const scores: CompetencyScores = { ...EMPTY_SCORES }
    for (const row of data || []) {
      const key = row.competency_key as CompetencyKey
      if (!(key in scores)) continue
      scores[key] = clampScore(Number(row.score || 0))
    }

    return NextResponse.json({
      success: true,
      data: { scores },
    })
  } catch (error) {
    console.error('academy competency scores failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
