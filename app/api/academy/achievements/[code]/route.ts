import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface AchievementMetadata {
  title?: string
  description?: string
  icon?: string
  category?: string
  tier?: string
}

/**
 * GET /api/academy/achievements/[code]
 * Public verification endpoint backed by user_achievements.verification_code.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabaseAdmin = getSupabaseAdmin()

    const { data: achievement, error } = await supabaseAdmin
      .from('user_achievements')
      .select('id, user_id, achievement_type, achievement_key, achievement_data, xp_earned, verification_code, earned_at, trade_card_image_url')
      .eq('verification_code', code)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to verify achievement' },
        { status: 500 }
      )
    }

    if (!achievement) {
      return NextResponse.json(
        { success: false, error: 'Achievement not found' },
        { status: 404 }
      )
    }

    const metadata = (achievement.achievement_data || {}) as AchievementMetadata

    const [discordProfileResult, authUserResult] = await Promise.all([
      supabaseAdmin
        .from('user_discord_profiles')
        .select('discord_username, discord_avatar')
        .eq('user_id', achievement.user_id)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(achievement.user_id),
    ])

    const memberName =
      discordProfileResult.data?.discord_username ||
      authUserResult.data.user?.user_metadata?.full_name ||
      authUserResult.data.user?.email?.split('@')[0] ||
      'TITM Member'

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        achievement: {
          id: achievement.id,
          title: metadata.title || achievement.achievement_key,
          description: metadata.description || achievement.achievement_type.replace(/_/g, ' '),
          icon: metadata.icon || null,
          category: metadata.category || achievement.achievement_type,
          tier: metadata.tier || null,
          xp_earned: achievement.xp_earned,
          trade_card_image_url: achievement.trade_card_image_url,
        },
        earned_at: achievement.earned_at,
        earner: {
          display_name: memberName,
          avatar_url: discordProfileResult.data?.discord_avatar || null,
        },
      },
    })
  } catch (error) {
    console.error('academy achievement verification failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
