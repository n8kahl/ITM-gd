import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  evaluateMemberAccess,
} from '@/lib/access-control/evaluate-member-access'
import {
  clearLinkedMemberCaches,
} from '@/lib/access-control/linked-cache-sync'
import {
  loadAccessControlSubject,
} from '@/lib/access-control/identity'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'
import { logAdminActivity } from '@/lib/admin/audit-log'

const requestSchema = z.object({
  reason: z.string().trim().min(1),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ discordUserId: string }> },
) {
  const admin = await requireAdminAccess()
  if (!admin.authorized || !admin.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { discordUserId } = await context.params
  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Unlink service unavailable' }, { status: 500 })
  }

  const body = requestSchema.parse(await request.json())
  const subject = await loadAccessControlSubject(supabase, { discordUserId })
  if (!subject.discordMember && !subject.linkedProfile) {
    return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
  }

  const linkedUserId = subject.linkedAuthUser?.id || subject.linkedProfile?.userId || subject.discordMember?.linkedUserId || null
  if (!linkedUserId) {
    return NextResponse.json({
      success: true,
      data: {
        no_op: true,
        evaluation: await evaluateMemberAccess(supabase, { discordUserId }),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  const { error: rosterError } = await supabase
    .from('discord_guild_members')
    .update({
      linked_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('discord_user_id', discordUserId)

  if (rosterError) {
    return NextResponse.json({ success: false, error: rosterError.message }, { status: 500 })
  }

  await clearLinkedMemberCaches({
    supabase,
    userId: linkedUserId,
  })

  const evaluation = await evaluateMemberAccess(supabase, { discordUserId })

  await logAdminActivity({
    action: 'member_access_link_removed',
    targetType: 'discord_member',
    targetId: discordUserId,
    details: {
      discord_user_id: discordUserId,
      user_id: linkedUserId,
      reason: body.reason,
    },
  })

  return NextResponse.json({
    success: true,
    data: evaluation,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
