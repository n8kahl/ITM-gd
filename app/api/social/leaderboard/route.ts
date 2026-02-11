import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { LeaderboardResponse } from '@/lib/types/social'
import { leaderboardQuerySchema } from '@/lib/validation/social'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rateLimitResult.success) {
    return errorResponse('Too many requests', 429)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  const searchParams = new URL(request.url).searchParams
  const parsedQuery = leaderboardQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))

  if (!parsedQuery.success) {
    return errorResponse('Invalid query parameters', 400, parsedQuery.error.flatten())
  }

  const { period, category, limit } = parsedQuery.data

  const { data: latestSnapshotRows, error: latestSnapshotError } = await supabase
    .from('leaderboard_snapshots')
    .select('snapshot_date')
    .eq('period', period)
    .eq('category', category)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (latestSnapshotError) {
    return errorResponse(latestSnapshotError.message, 500)
  }

  const latestSnapshotDate = latestSnapshotRows?.[0]?.snapshot_date

  if (!latestSnapshotDate) {
    const emptyResponse: LeaderboardResponse = {
      period,
      category,
      entries: [],
      user_entry: null,
      snapshot_date: new Date().toISOString().split('T')[0],
    }

    return successResponse(emptyResponse)
  }

  const [entriesResult, userEntryResult] = await Promise.all([
    supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('period', period)
      .eq('category', category)
      .eq('snapshot_date', latestSnapshotDate)
      .order('rank', { ascending: true })
      .limit(limit),
    supabase
      .from('leaderboard_snapshots')
      .select('*')
      .eq('period', period)
      .eq('category', category)
      .eq('snapshot_date', latestSnapshotDate)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (entriesResult.error || userEntryResult.error) {
    return errorResponse('Failed to load leaderboard data', 500)
  }

  const response: LeaderboardResponse = {
    period,
    category,
    entries: entriesResult.data ?? [],
    user_entry: userEntryResult.data ?? null,
    snapshot_date: latestSnapshotDate,
  }

  return successResponse(response)
}
