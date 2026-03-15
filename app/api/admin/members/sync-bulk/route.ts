import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  refreshDiscordGuildRoster,
  refreshSingleDiscordGuildMember,
} from '@/lib/access-control/identity'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'
import { logAdminActivity } from '@/lib/admin/audit-log'

const requestSchema = z.union([
  z.object({
    mode: z.literal('guild_roster'),
  }),
  z.object({
    mode: z.literal('members'),
    discordUserIds: z.array(z.string().min(1)).min(1),
  }),
])

export async function POST(request: NextRequest) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Bulk sync unavailable' }, { status: 500 })
  }

  const body = requestSchema.parse(await request.json().catch(() => ({ mode: 'guild_roster' })))

  if (body.mode === 'guild_roster') {
    const result = await refreshDiscordGuildRoster(supabase)

    await logAdminActivity({
      action: 'member_access_guild_sync_requested',
      targetType: 'discord_guild',
      targetId: 'guild_roster',
      details: result,
    })

    return NextResponse.json({ success: true, data: result })
  }

  const refreshed = await Promise.all(
    body.discordUserIds.map((discordUserId) => refreshSingleDiscordGuildMember(supabase, discordUserId)),
  )

  await logAdminActivity({
    action: 'member_access_bulk_member_sync_requested',
    targetType: 'discord_member_batch',
    targetId: String(body.discordUserIds.length),
    details: {
      discord_user_ids: body.discordUserIds,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      requestedCount: body.discordUserIds.length,
      refreshedCount: refreshed.filter(Boolean).length,
    },
  })
}
