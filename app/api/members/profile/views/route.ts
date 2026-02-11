import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { ProfileViewStats } from '@/lib/types/social'

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

  const now = Date.now()
  const weekAgoIso = new Date(now - (7 * 24 * 60 * 60 * 1000)).toISOString()
  const monthAgoIso = new Date(now - (30 * 24 * 60 * 60 * 1000)).toISOString()

  const [
    totalViewsResult,
    weeklyViewsResult,
    monthlyViewsResult,
    uniqueViewerRowsResult,
  ] = await Promise.all([
    supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', user.id),
    supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', user.id)
      .gte('created_at', weekAgoIso),
    supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', user.id)
      .gte('created_at', monthAgoIso),
    supabase
      .from('profile_views')
      .select('viewer_id')
      .eq('profile_user_id', user.id)
      .gte('created_at', monthAgoIso)
      .not('viewer_id', 'is', null),
  ])

  if (totalViewsResult.error || weeklyViewsResult.error || monthlyViewsResult.error || uniqueViewerRowsResult.error) {
    return errorResponse('Failed to load profile view stats', 500)
  }

  const uniqueViewerIds = new Set(
    (uniqueViewerRowsResult.data ?? [])
      .map((row) => row.viewer_id)
      .filter((viewerId): viewerId is string => typeof viewerId === 'string'),
  )

  const stats: ProfileViewStats = {
    total_views: totalViewsResult.count ?? 0,
    views_this_week: weeklyViewsResult.count ?? 0,
    views_this_month: monthlyViewsResult.count ?? 0,
    unique_viewers_this_month: uniqueViewerIds.size,
  }

  return successResponse(stats)
}
