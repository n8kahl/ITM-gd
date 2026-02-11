import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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

  const [memberCountResult, sharedTradesResult, achievementsResult] = await Promise.all([
    supabase
      .from('member_profiles')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('social_feed_items')
      .select('*', { count: 'exact', head: true })
      .eq('item_type', 'trade_card'),
    supabase
      .from('social_feed_items')
      .select('*', { count: 'exact', head: true })
      .eq('item_type', 'achievement'),
  ])

  if (memberCountResult.error || sharedTradesResult.error || achievementsResult.error) {
    return errorResponse('Failed to load community stats', 500)
  }

  return successResponse({
    total_members: memberCountResult.count ?? 0,
    trades_shared: sharedTradesResult.count ?? 0,
    achievements_earned: achievementsResult.count ?? 0,
  })
}
