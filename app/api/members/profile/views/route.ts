import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import type { ProfileViewStats } from '@/lib/types/social'

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
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Run all queries in parallel for better performance
    const [totalResult, weekResult, monthResult, uniqueResult] = await Promise.all([
      supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('profile_user_id', user.id),
      supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('profile_user_id', user.id)
        .gte('created_at', weekAgo),
      supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('profile_user_id', user.id)
        .gte('created_at', monthAgo),
      supabase
        .from('profile_views')
        .select('viewer_id')
        .eq('profile_user_id', user.id)
        .gte('created_at', monthAgo)
        .not('viewer_id', 'is', null),
    ])

    const uniqueViewerIds = new Set(uniqueResult.data?.map(v => v.viewer_id) || [])

    const stats: ProfileViewStats = {
      total_views: totalResult.count ?? 0,
      views_this_week: weekResult.count ?? 0,
      views_this_month: monthResult.count ?? 0,
      unique_viewers_this_month: uniqueViewerIds.size,
    }

    return successResponse(stats)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
