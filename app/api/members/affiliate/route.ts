import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { AffiliateReferral, AffiliateStats } from '@/lib/types/social'

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return 0
}

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

  const [profileResult, referralsResult] = await Promise.all([
    supabase
      .from('member_profiles')
      .select('whop_affiliate_url')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('affiliate_referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (profileResult.error || referralsResult.error) {
    return errorResponse('Failed to load affiliate data', 500)
  }

  const referrals = (referralsResult.data ?? []) as AffiliateReferral[]

  const totalReferrals = referrals.length
  const activeReferrals = referrals.filter((referral) => referral.status === 'subscribed').length
  const totalEarnings = referrals.reduce((sum, referral) => sum + toNumber(referral.commission_amount), 0)
  const unpaidEarnings = referrals
    .filter((referral) => !referral.commission_paid)
    .reduce((sum, referral) => sum + toNumber(referral.commission_amount), 0)

  const convertedReferrals = referrals.filter((referral) => referral.status !== 'pending').length
  const conversionRate = totalReferrals > 0
    ? Number(((convertedReferrals / totalReferrals) * 100).toFixed(2))
    : null

  const referralCode = referrals[0]?.referral_code || user.id.slice(0, 8)
  const affiliateUrl = profileResult.data?.whop_affiliate_url
    || `https://whop.com/checkout/?a=${referralCode}`

  const stats: AffiliateStats = {
    total_referrals: totalReferrals,
    active_referrals: activeReferrals,
    total_earnings: Number(totalEarnings.toFixed(2)),
    unpaid_earnings: Number(unpaidEarnings.toFixed(2)),
    conversion_rate: conversionRate,
    referral_code: referralCode,
    affiliate_url: affiliateUrl,
  }

  return successResponse({
    stats,
    recent_referrals: referrals.slice(0, 20),
  })
}
