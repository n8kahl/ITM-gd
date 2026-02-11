import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

/**
 * GET /api/admin/notifications/search-users?q=<query>
 *
 * Searches Discord profiles by username, returning only users
 * who have at least one active push subscription.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const supabase = getSupabaseAdmin()

    // Search by discord_username (case-insensitive) or user_id prefix
    const { data: profiles, error } = await supabase
      .from('user_discord_profiles')
      .select('user_id, discord_username, discord_avatar, discord_user_id')
      .or(`discord_username.ilike.%${query}%,user_id.ilike.${query}%`)
      .limit(15)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!profiles?.length) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Check which users have active push subscriptions
    const userIds = profiles.map((p) => p.user_id)
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    const subscribedUserIds = new Set((subscriptions ?? []).map((s) => s.user_id))

    const results = profiles.map((p) => ({
      user_id: p.user_id,
      discord_username: p.discord_username,
      discord_avatar: p.discord_avatar,
      discord_user_id: p.discord_user_id,
      has_subscription: subscribedUserIds.has(p.user_id),
    }))

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
