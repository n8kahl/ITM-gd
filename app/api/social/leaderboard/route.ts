import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { leaderboardQuerySchema } from '@/lib/validation/social'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import type { LeaderboardResponse } from '@/lib/types/social'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rl.success) return errorResponse('Too many requests', 429)

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    const parsed = leaderboardQuerySchema.safeParse(params)

    if (!parsed.success) {
      return errorResponse('Invalid query parameters', 400, parsed.error.flatten())
    }

    const { period, category, limit } = parsed.data

    // Get the latest snapshot date for this period/category
    const { data: latestSnapshot } = await supabase
      .from('leaderboard_snapshots')
      .select('snapshot_date')
      .eq('period', period)
      .eq('category', category)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (!latestSnapshot) {
      const response: LeaderboardResponse = {
        period,
        category,
        entries: [],
        user_entry: null,
        snapshot_date: new Date().toISOString().split('T')[0],
      }
      return successResponse(response)
    }

    const snapshotDate = latestSnapshot.snapshot_date

    // Fetch leaderboard entries
    const { data: entries, error: queryError } = await supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('period', period)
      .eq('category', category)
      .eq('snapshot_date', snapshotDate)
      .order('rank', { ascending: true })
      .limit(limit)

    if (queryError) {
      return errorResponse(queryError.message, 500)
    }

    // Fetch current user's entry
    const { data: userEntry } = await supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('period', period)
      .eq('category', category)
      .eq('snapshot_date', snapshotDate)
      .eq('user_id', user.id)
      .single()

    const response: LeaderboardResponse = {
      period,
      category,
      entries: entries ?? [],
      user_entry: userEntry ?? null,
      snapshot_date: snapshotDate,
    }

    return successResponse(response)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
