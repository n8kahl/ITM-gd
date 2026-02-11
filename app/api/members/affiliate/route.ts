import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { AffiliateStats, AffiliateReferral } from '@/lib/types/social'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    // Fetch user's member profile for affiliate URL
    const { data: profile } = await supabase
      .from('member_profiles')
      .select('whop_affiliate_url')
      .eq('user_id', user.id)
      .single()

    // Fetch all referrals
    const { data: referrals, error: refError } = await supabase
      .from('affiliate_referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    if (refError) {
      return errorResponse(refError.message, 500)
    }

    const allReferrals = (referrals ?? []) as AffiliateReferral[]

    // Compute stats
    const totalReferrals = allReferrals.length
    const activeReferrals = allReferrals.filter(r => r.status === 'subscribed').length
    const totalEarnings = allReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0)
    const unpaidEarnings = allReferrals
      .filter(r => !r.commission_paid && r.commission_amount > 0)
      .reduce((sum, r) => sum + r.commission_amount, 0)
    const signedUp = allReferrals.filter(r => r.status !== 'pending').length
    const conversionRate = totalReferrals > 0 ? (signedUp / totalReferrals) * 100 : null

    // Generate referral code from user ID
    const referralCode = user.id.substring(0, 8)

    const stats: AffiliateStats = {
      total_referrals: totalReferrals,
      active_referrals: activeReferrals,
      total_earnings: totalEarnings,
      unpaid_earnings: unpaidEarnings,
      conversion_rate: conversionRate,
      referral_code: referralCode,
      affiliate_url: profile?.whop_affiliate_url ?? '',
    }

    return successResponse({
      stats,
      recent_referrals: allReferrals.slice(0, 10),
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
