import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

interface AchievementMetadata {
  title?: string
  description?: string
  icon?: string
  category?: string
  tier?: string
}

/**
 * GET /api/academy/achievements
 * Lists user achievements with lightweight pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10)))
    const category = searchParams.get('category')?.trim().toLowerCase() || null
    const offset = (page - 1) * limit

    const { data: rows, error, count } = await supabase
      .from('user_achievements')
      .select(
        'id, achievement_type, achievement_key, achievement_data, xp_earned, verification_code, earned_at, trade_card_image_url',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load achievements' },
        { status: 500 }
      )
    }

    let achievements = (rows || []).map((row) => {
      const metadata = (row.achievement_data || {}) as AchievementMetadata
      return {
        id: row.id,
        achievement_type: row.achievement_type,
        achievement_key: row.achievement_key,
        title: metadata.title || row.achievement_key,
        description: metadata.description || row.achievement_type.replace(/_/g, ' '),
        icon: metadata.icon || null,
        category: metadata.category || row.achievement_type,
        tier: metadata.tier || null,
        xp_earned: row.xp_earned,
        verification_code: row.verification_code,
        trade_card_image_url: row.trade_card_image_url,
        earned_at: row.earned_at,
      }
    })

    if (category) {
      achievements = achievements.filter((achievement) =>
        achievement.category.toLowerCase() === category
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        achievements,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
        summary: {
          earned: count || 0,
          total_available: count || 0,
        },
      },
    })
  } catch (error) {
    console.error('academy achievements failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
