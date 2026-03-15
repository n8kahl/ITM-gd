import { NextRequest, NextResponse } from 'next/server'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Audit unavailable' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const discordUserId = searchParams.get('discord_user_id')?.trim() || null
  const userId = searchParams.get('user_id')?.trim() || null
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200)

  const { data, error } = await supabase
    .from('admin_activity_log')
    .select('id, admin_user_id, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const filtered = (data || []).filter((row) => {
    const targetId = typeof row?.target_id === 'string' ? row.target_id : null
    const details = row?.details && typeof row.details === 'object'
      ? row.details as Record<string, unknown>
      : {}
    const detailDiscordUserId = typeof details.discord_user_id === 'string'
      ? details.discord_user_id
      : null
    const detailUserId = typeof details.user_id === 'string'
      ? details.user_id
      : null

    if (discordUserId && ![targetId, detailDiscordUserId].includes(discordUserId)) {
      return false
    }
    if (userId && detailUserId !== userId) {
      return false
    }

    return true
  })

  return NextResponse.json({
    success: true,
    data: filtered,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
