import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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

const requestSchema = z.object({
  userId: z.string().uuid(),
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
    return NextResponse.json({ success: false, error: 'Link service unavailable' }, { status: 500 })
  }

  const body = requestSchema.parse(await request.json())
  const subject = await loadAccessControlSubject(supabase, { discordUserId })
  if (!subject.discordMember && !subject.linkedProfile) {
    return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
  }

  const { data: authUserResult, error: authUserError } = await supabase.auth.admin.getUserById(body.userId)
  if (authUserError || !authUserResult?.user) {
    return NextResponse.json({ success: false, error: 'Target site user was not found' }, { status: 404 })
  }

  const [
    existingDiscordLinkResult,
    existingUserLinkResult,
    guildMemberLinkResult,
    conflictingGuildMemberResult,
  ] = await Promise.all([
    supabase
      .from('user_discord_profiles')
      .select('user_id')
      .eq('discord_user_id', discordUserId)
      .maybeSingle(),
    supabase
      .from('user_discord_profiles')
      .select('discord_user_id')
      .eq('user_id', body.userId)
      .maybeSingle(),
    supabase
      .from('discord_guild_members')
      .select('linked_user_id')
      .eq('discord_user_id', discordUserId)
      .maybeSingle(),
    supabase
      .from('discord_guild_members')
      .select('discord_user_id')
      .eq('linked_user_id', body.userId)
      .neq('discord_user_id', discordUserId)
      .limit(1)
      .maybeSingle(),
  ])

  const existingDiscordLink = typeof existingDiscordLinkResult.data?.user_id === 'string'
    ? existingDiscordLinkResult.data.user_id
    : null
  if (existingDiscordLink && existingDiscordLink !== body.userId) {
    return NextResponse.json({
      success: false,
      error: 'This Discord member is already linked to a different site user.',
    }, { status: 409 })
  }

  const existingUserLink = typeof existingUserLinkResult.data?.discord_user_id === 'string'
    ? existingUserLinkResult.data.discord_user_id
    : null
  if (existingUserLink && existingUserLink !== discordUserId) {
    return NextResponse.json({
      success: false,
      error: 'This site user is already linked to a different Discord member.',
    }, { status: 409 })
  }

  const guildLinkedUserId = typeof guildMemberLinkResult.data?.linked_user_id === 'string'
    ? guildMemberLinkResult.data.linked_user_id
    : null
  if (guildLinkedUserId && guildLinkedUserId !== body.userId) {
    return NextResponse.json({
      success: false,
      error: 'The guild roster cache already links this Discord member to another site user.',
    }, { status: 409 })
  }

  const conflictingGuildMemberId = typeof conflictingGuildMemberResult.data?.discord_user_id === 'string'
    ? conflictingGuildMemberResult.data.discord_user_id
    : null
  if (conflictingGuildMemberId && conflictingGuildMemberId !== discordUserId) {
    return NextResponse.json({
      success: false,
      error: 'The target site user is already linked to a different Discord member in the roster cache.',
    }, { status: 409 })
  }

  const { error: rosterUpdateError } = await supabase
    .from('discord_guild_members')
    .update({
      linked_user_id: body.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('discord_user_id', discordUserId)

  if (rosterUpdateError) {
    return NextResponse.json({ success: false, error: rosterUpdateError.message }, { status: 500 })
  }

  const refreshedMember = await refreshSingleDiscordGuildMember(supabase, discordUserId).catch(() => null)
  const roleIds = refreshedMember?.discordRoles
    || subject.discordMember?.discordRoles
    || subject.linkedProfile?.discordRoles
    || []

  await syncLinkedMemberCaches({
    supabase,
    userId: body.userId,
    discordUserId,
    username: refreshedMember?.username || subject.discordMember?.username || subject.linkedProfile?.discordUsername || null,
    avatar: refreshedMember?.avatar || subject.discordMember?.avatar || subject.linkedProfile?.discordAvatar || null,
    roleIds,
  })

  const evaluation = await evaluateMemberAccess(supabase, { discordUserId })

  await logAdminActivity({
    action: 'member_access_link_created',
    targetType: 'discord_member',
    targetId: discordUserId,
    details: {
      discord_user_id: discordUserId,
      user_id: body.userId,
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
