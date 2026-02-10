import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

/**
 * GET /api/academy/achievements
 * List user achievements with pagination.
 * Query params: page (default 1), limit (default 20), category (optional filter)
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const category = searchParams.get('category')
    const offset = (page - 1) * limit

    // Build query for user achievements
    let query = supabase
      .from('user_achievements')
      .select(
        '*, achievements(id, name, code, description, icon, badge_image_url, category, tier, xp_reward)',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('achievements.category', category)
    }

    const { data: userAchievements, error, count } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Also fetch total available achievements for progress display
    const { count: totalAvailable } = await supabase
      .from('achievements')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      data: {
        achievements: userAchievements || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
        summary: {
          earned: count || 0,
          total_available: totalAvailable || 0,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
