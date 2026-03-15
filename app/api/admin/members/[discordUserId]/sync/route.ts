import { NextRequest, NextResponse } from 'next/server'
import {
  evaluateMemberAccess,
} from '@/lib/access-control/evaluate-member-access'
import {
  loadAccessControlSubject,
  refreshSingleDiscordGuildMember,
} from '@/lib/access-control/identity'
import {
  syncLinkedMemberCaches,
} from '@/lib/access-control/linked-cache-sync'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'
import { logAdminActivity } from '@/lib/admin/audit-log'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ discordUserId: string }> },
) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { discordUserId } = await context.params
  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Sync unavailable' }, { status: 500 })
  }

  const subject = await loadAccessControlSubject(supabase, { discordUserId })
  const linkedUserId = subject.linkedAuthUser?.id || subject.linkedProfile?.userId || subject.discordMember?.linkedUserId || null

  const refreshedMember = await refreshSingleDiscordGuildMember(supabase, discordUserId)
  if (linkedUserId) {
    await syncLinkedMemberCaches({
      supabase,
      userId: linkedUserId,
      discordUserId,
      username: refreshedMember?.username || subject.linkedProfile?.discordUsername || null,
      avatar: refreshedMember?.avatar || subject.linkedProfile?.discordAvatar || null,
      roleIds: refreshedMember?.discordRoles || [],
    })
  }

  const evaluation = await evaluateMemberAccess(supabase, { discordUserId })

  await logAdminActivity({
    action: 'member_access_single_sync_requested',
    targetType: 'discord_member',
    targetId: discordUserId,
    details: {
      discord_user_id: discordUserId,
      user_id: linkedUserId,
      in_guild: refreshedMember?.isInGuild ?? false,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      member: refreshedMember,
      evaluation,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
