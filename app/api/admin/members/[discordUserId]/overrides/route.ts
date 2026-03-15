import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  fetchActiveMemberAccessOverrides,
} from '@/lib/access-control/overrides'
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

const createOverrideSchema = z.object({
  action: z.literal('create'),
  overrideType: z.enum([
    'suspend_members_access',
    'allow_members_access',
    'allow_specific_tabs',
    'deny_specific_tabs',
    'temporary_admin',
  ]),
  reason: z.string().trim().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

const revokeOverrideSchema = z.object({
  action: z.literal('revoke'),
  overrideId: z.string().uuid(),
  reason: z.string().trim().min(1),
})

const requestSchema = z.union([createOverrideSchema, revokeOverrideSchema])

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
    return NextResponse.json({ success: false, error: 'Override service unavailable' }, { status: 500 })
  }

  const subject = await loadAccessControlSubject(supabase, { discordUserId })
  if (!subject.discordMember && !subject.linkedProfile) {
    return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
  }

  const body = requestSchema.parse(await request.json())
  const userId = subject.linkedAuthUser?.id || subject.linkedProfile?.userId || subject.discordMember?.linkedUserId || null

  if (body.action === 'create') {
    const { error } = await supabase
      .from('member_access_overrides')
      .insert({
        discord_user_id: discordUserId,
        user_id: userId,
        override_type: body.overrideType,
        payload: body.payload || {},
        reason: body.reason,
        created_by_user_id: admin.user.id,
        expires_at: body.expiresAt || null,
      })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'member_access_override_created',
      targetType: 'discord_member',
      targetId: discordUserId,
      details: {
        discord_user_id: discordUserId,
        user_id: userId,
        override_type: body.overrideType,
        expires_at: body.expiresAt || null,
      },
    })
  } else {
    const { error } = await supabase
      .from('member_access_overrides')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by_user_id: admin.user.id,
        revocation_reason: body.reason,
      })
      .eq('id', body.overrideId)
      .is('revoked_at', null)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'member_access_override_revoked',
      targetType: 'discord_member',
      targetId: discordUserId,
      details: {
        discord_user_id: discordUserId,
        user_id: userId,
        override_id: body.overrideId,
      },
    })
  }

  const overrides = await fetchActiveMemberAccessOverrides(supabase, {
    userId,
    discordUserId,
  })

  return NextResponse.json({
    success: true,
    data: overrides,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
