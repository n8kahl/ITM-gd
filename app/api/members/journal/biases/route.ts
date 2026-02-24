import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'
import { analyzeBiases } from '@/lib/journal/bias-detector'
import { analyticsPeriodSchema } from '@/lib/validation/journal-entry'
import { ZodError } from 'zod'

/**
 * GET /api/members/journal/biases
 *
 * Analyzes the user's journal entries for cognitive biases.
 * Returns detected bias signals with confidence and recommendations.
 *
 * Query params:
 *   period: '7d' | '30d' | '90d' | '1y' | 'all' (default: '90d')
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 3, Slice 3C
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const { searchParams } = new URL(request.url)
    const period = analyticsPeriodSchema.parse(searchParams.get('period') ?? '90d')

    const day = 24 * 60 * 60 * 1000
    const now = Date.now()
    const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
    const periodStart = period === 'all'
      ? '1970-01-01T00:00:00.000Z'
      : new Date(now - ((periodDays[period] ?? 90) * day)).toISOString()

    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_draft', false)
      .order('trade_date', { ascending: true })

    if (period !== 'all') {
      query = query.gte('trade_date', periodStart)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to load entries for bias analysis:', error)
      return errorResponse('Failed to load entries', 500)
    }

    const entries = sanitizeJournalEntries(data ?? [])
    const result = analyzeBiases(entries)

    return successResponse(result)
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse('Invalid request', 400, err.flatten())
    }

    console.error('Bias analysis failed:', err)
    return errorResponse('Internal server error', 500)
  }
}
