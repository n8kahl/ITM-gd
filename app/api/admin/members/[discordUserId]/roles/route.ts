import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  evaluateMemberAccess,
  evaluateMemberAccessFromSubject,
  loadAccessControlResources,
} from '@/lib/access-control/evaluate-member-access'
import {
  fetchActiveMemberAccessOverrides,
} from '@/lib/access-control/overrides'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  getDiscordRoleMutationContext,
  loadAccessControlSubject,
  mutateDiscordMemberRole,
  refreshSingleDiscordGuildMember,
} from '@/lib/access-control/identity'
import {
  syncLinkedMemberCaches,
} from '@/lib/access-control/linked-cache-sync'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'
import {
  resolveAccessControlSettings,
} from '@/lib/access-control/roles'
import { logAdminActivity } from '@/lib/admin/audit-log'

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('preview'),
    operation: z.enum(['add', 'remove']),
    roleId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('apply'),
    operation: z.enum(['add', 'remove']),
    roleId: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  }),
])

function buildNextRoleIds(params: {
  currentRoleIds: string[]
  roleId: string
  operation: 'add' | 'remove'
}): string[] {
  const current = new Set(params.currentRoleIds)
  if (params.operation === 'add') {
    current.add(params.roleId)
  } else {
    current.delete(params.roleId)
  }
  return Array.from(current)
}

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
    return NextResponse.json({ success: false, error: 'Role mutation unavailable' }, { status: 500 })
  }

  const body = requestSchema.parse(await request.json())
  const [settings, subject] = await Promise.all([
    resolveAccessControlSettings(supabase),
    loadAccessControlSubject(supabase, { discordUserId }),
  ])

  if (!subject.discordMember || !subject.discordMember.isInGuild) {
    return NextResponse.json({
      success: false,
      error: 'Discord role actions require a guild member cached in the roster.',
    }, { status: 409 })
  }

  const currentRoleIds = subject.discordMember.discordRoles
  const nextRoleIds = buildNextRoleIds({
    currentRoleIds,
    roleId: body.roleId,
    operation: body.operation,
  })
  const linkedUserId = subject.linkedAuthUser?.id || subject.linkedProfile?.userId || subject.discordMember.linkedUserId || null

  const [resources, activeOverrides, mutationContext] = await Promise.all([
    loadAccessControlResources(supabase, Array.from(new Set([...currentRoleIds, ...nextRoleIds]))),
    fetchActiveMemberAccessOverrides(supabase, {
      userId: linkedUserId,
      discordUserId,
    }),
    getDiscordRoleMutationContext({
      supabase,
      targetRoleId: body.roleId,
    }),
  ])

  const previewEvaluation = evaluateMemberAccessFromSubject({
    subject: {
      ...subject,
      discordMember: {
        ...subject.discordMember,
        discordRoles: nextRoleIds,
      },
    },
    resources,
    activeOverrides,
  })

  if (body.action === 'preview') {
    return NextResponse.json({
      success: true,
      data: {
        mutation_enabled: settings.allowDiscordRoleMutation,
        manageable: mutationContext.manageable,
        manageability_reason: mutationContext.reason,
        role: mutationContext.role,
        current_role_ids: currentRoleIds,
        next_role_ids: nextRoleIds,
        preview_evaluation: previewEvaluation,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  if (!settings.allowDiscordRoleMutation) {
    return NextResponse.json({
      success: false,
      error: 'Discord role mutation is disabled in access control settings.',
    }, { status: 409 })
  }

  if (!mutationContext.manageable || !mutationContext.role) {
    return NextResponse.json({
      success: false,
      error: mutationContext.reason || 'Discord role is not manageable by the bot.',
    }, { status: 409 })
  }

  if (nextRoleIds.length === currentRoleIds.length && nextRoleIds.every((roleId) => currentRoleIds.includes(roleId))) {
    return NextResponse.json({
      success: true,
      data: {
        mutation_enabled: true,
        manageable: true,
        role: mutationContext.role,
        evaluation: await evaluateMemberAccess(supabase, { discordUserId }),
        no_op: true,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  await mutateDiscordMemberRole({
    supabase,
    discordUserId,
    roleId: body.roleId,
    operation: body.operation,
  })

  const refreshedMember = await refreshSingleDiscordGuildMember(supabase, discordUserId)
  if (linkedUserId) {
    await syncLinkedMemberCaches({
      supabase,
      userId: linkedUserId,
      discordUserId,
      username: refreshedMember?.username || subject.discordMember.username || subject.linkedProfile?.discordUsername || null,
      avatar: refreshedMember?.avatar || subject.discordMember.avatar || subject.linkedProfile?.discordAvatar || null,
      roleIds: refreshedMember?.discordRoles || [],
    })
  }

  const evaluation = await evaluateMemberAccess(supabase, { discordUserId })

  await logAdminActivity({
    action: body.operation === 'add'
      ? 'member_discord_role_add_requested'
      : 'member_discord_role_remove_requested',
    targetType: 'discord_member',
    targetId: discordUserId,
    details: {
      discord_user_id: discordUserId,
      user_id: linkedUserId,
      role_id: body.roleId,
      role_name: mutationContext.role.name,
      reason: body.reason,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      role: mutationContext.role,
      evaluation,
      current_role_ids: refreshedMember?.discordRoles || [],
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
