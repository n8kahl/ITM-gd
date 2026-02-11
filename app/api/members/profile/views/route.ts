import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { ProfileViewStats } from '@/lib/types/social'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Total views
    const { count: totalViews } = await supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', user.id)

    // Views this week
    const { count: viewsThisWeek } = await supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', user.id)
      .gte('created_at', weekAgo)

    // Views this month
    const { count: viewsThisMonth } = await supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', user.id)
      .gte('created_at', monthAgo)

    // Unique viewers this month
    const { data: uniqueViewers } = await supabase
      .from('profile_views')
      .select('viewer_id')
      .eq('profile_user_id', user.id)
      .gte('created_at', monthAgo)
      .not('viewer_id', 'is', null)

    const uniqueViewerIds = new Set(uniqueViewers?.map(v => v.viewer_id) || [])

    const stats: ProfileViewStats = {
      total_views: totalViews ?? 0,
      views_this_week: viewsThisWeek ?? 0,
      views_this_month: viewsThisMonth ?? 0,
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
