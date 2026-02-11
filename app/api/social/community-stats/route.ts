import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  // Rate limit
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rl.success) {
    return errorResponse('Too many requests', 429)
  }

  try {
    // Count total members (users with profiles)
    const { count: totalMembers } = await supabase
      .from('member_profiles')
      .select('*', { count: 'exact', head: true })

    // Count total shared trades in feed
    const { count: tradesShared } = await supabase
      .from('social_feed_items')
      .select('*', { count: 'exact', head: true })
      .eq('item_type', 'trade_card')

    // Count total achievements in feed
    const { count: achievementsEarned } = await supabase
      .from('social_feed_items')
      .select('*', { count: 'exact', head: true })
      .eq('item_type', 'achievement')

    return successResponse({
      total_members: totalMembers ?? 0,
      trades_shared: tradesShared ?? 0,
      achievements_earned: achievementsEarned ?? 0,
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
