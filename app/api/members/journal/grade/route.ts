import { NextRequest, NextResponse } from 'next/server'
import { gradeTrade } from '@/lib/journal/trade-grading'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { gradeTradeRequestSchema } from '@/lib/validation/journal-api'

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { entryId } = gradeTradeRequestSchema.parse(body)

    const supabase = getSupabaseAdminClient()
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 })
    }

    const grade = gradeTrade({
      symbol: entry.symbol,
      direction: entry.direction,
      entry_price: toNumber(entry.entry_price),
      exit_price: toNumber(entry.exit_price),
      stop_loss: toNumber(entry.stop_loss),
      initial_target: toNumber(entry.initial_target),
      pnl: toNumber(entry.pnl),
      pnl_percentage: toNumber(entry.pnl_percentage),
      mfe_percent: toNumber(entry.mfe_percent),
      mae_percent: toNumber(entry.mae_percent),
      setup_notes: entry.setup_notes,
      execution_notes: entry.execution_notes,
      lessons_learned: entry.lessons_learned,
      strategy: entry.strategy,
    })

    const existingAi = entry.ai_analysis && typeof entry.ai_analysis === 'object'
      ? entry.ai_analysis as Record<string, unknown>
      : {}

    const nextAiAnalysis = {
      ...existingAi,
      grade: grade.overall_grade,
      grade_score: grade.score,
      trade_grade: grade,
      summary: typeof existingAi.summary === 'string'
        ? existingAi.summary
        : `Overall ${grade.overall_grade} (${grade.score}/100). ${grade.dimensions.execution.feedback}`,
    }

    const { data: updated, error: updateError } = await supabase
      .from('journal_entries')
      .update({
        ai_analysis: nextAiAnalysis,
        enriched_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('user_id', userId)
      .select('id, ai_analysis')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ success: false, error: updateError?.message || 'Failed to save grade' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        entryId: updated.id,
        grade,
        ai_analysis: updated.ai_analysis,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid grade request' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
