import { createClient } from '@supabase/supabase-js'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import type { CoachReviewStatsResponse } from '@/lib/types/coach-review'

interface CompletedRequestRow {
  requested_at: string
  completed_at: string | null
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function startOfTodayIso(now = new Date()): string {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

function startOfWeekIso(now = new Date()): string {
  const start = new Date(now)
  const day = start.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - daysFromMonday)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

export async function GET() {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const supabase = getSupabaseAdmin()
    const todayStart = startOfTodayIso()
    const weekStart = startOfWeekIso()

    const [pendingResult, inReviewResult, completedTodayResult, completedWeekResult, completedRowsResult] = await Promise.all([
      supabase
        .from('coach_review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('coach_review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_review'),
      supabase
        .from('coach_review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', todayStart),
      supabase
        .from('coach_review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', weekStart),
      supabase
        .from('coach_review_requests')
        .select('requested_at,completed_at')
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .limit(1000),
    ])

    const queryError = pendingResult.error
      || inReviewResult.error
      || completedTodayResult.error
      || completedWeekResult.error
      || completedRowsResult.error

    if (queryError) {
      console.error('[TradeReview][Stats] Failed to load stats:', queryError.message)
      return errorResponse('Failed to load trade review stats', 500)
    }

    const completedRows = (completedRowsResult.data ?? []) as CompletedRequestRow[]
    const deltas = completedRows
      .map((row) => {
        const requestedAt = Date.parse(row.requested_at)
        const completedAt = Date.parse(row.completed_at ?? '')
        if (Number.isNaN(requestedAt) || Number.isNaN(completedAt)) return null
        return (completedAt - requestedAt) / (1000 * 60 * 60)
      })
      .filter((value): value is number => value != null && value >= 0)

    const avgResponseHours = deltas.length > 0
      ? Number((deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(2))
      : null

    const payload: CoachReviewStatsResponse = {
      pending_count: pendingResult.count ?? 0,
      in_review_count: inReviewResult.count ?? 0,
      completed_today: completedTodayResult.count ?? 0,
      completed_this_week: completedWeekResult.count ?? 0,
      avg_response_hours: avgResponseHours,
    }

    return successResponse(payload)
  } catch (error) {
    console.error('[TradeReview][Stats] Route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
