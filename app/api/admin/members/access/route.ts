import { NextRequest, NextResponse } from 'next/server'
import { evaluateMemberAccess } from '@/lib/access-control/evaluate-member-access'
import { searchLinkedUserIdsByEmail } from '@/lib/access-control/identity'
import { requireAdminAccess } from '@/lib/access-control/admin-access'
import { createServiceRoleSupabaseClient } from '@/lib/server-supabase'

function mapLegacyTabDetails(evaluation: Awaited<ReturnType<typeof evaluateMemberAccess>>) {
  return evaluation.tabDecisions.map((decision) => ({
    tab_id: decision.tabId,
    label: decision.label,
    path: decision.path,
    required_tier: decision.requiredTier,
    required_roles: decision.requiredRoleIds.map((roleId) => ({
      role_id: roleId,
      role_name: evaluation.roleTitlesById[roleId] || `Unknown role (${roleId})`,
    })),
    allowed: decision.allowed,
    reason_code: decision.reasonCode,
    reason: decision.reason,
  }))
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Access debugger unavailable' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')?.trim() || null
  const email = searchParams.get('email')?.trim() || null
  const discordUserId = searchParams.get('discord_user_id')?.trim() || null
  const shouldReturnOverview = !userId && !email && !discordUserId
    || ['1', 'true', 'yes'].includes((searchParams.get('overview') || '').trim().toLowerCase())

  if (shouldReturnOverview) {
    const [guildMemberCount, linkedCount, activeOverrideCount, activeTabCount] = await Promise.all([
      supabase.from('discord_guild_members').select('discord_user_id', { count: 'exact', head: true }),
      supabase.from('discord_guild_members').select('discord_user_id', { count: 'exact', head: true }).not('linked_user_id', 'is', null),
      supabase.from('member_access_overrides').select('id', { count: 'exact', head: true }).is('revoked_at', null),
      supabase.from('tab_configurations').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    return NextResponse.json({
      success: true,
      mode: 'overview',
      overview: {
        counts: {
          guild_member_count: guildMemberCount.count ?? 0,
          linked_member_count: linkedCount.count ?? 0,
          active_override_count: activeOverrideCount.count ?? 0,
          active_tab_count: activeTabCount.count ?? 0,
        },
        deprecated: true,
        message: 'This legacy endpoint now proxies the canonical access-control service. Use /api/admin/members/directory for the full control-center surface.',
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  let resolvedUserId = userId
  if (!resolvedUserId && email) {
    const matchingIds = await searchLinkedUserIdsByEmail(supabase, email)
    resolvedUserId = matchingIds[0] || null
  }

  const evaluation = await evaluateMemberAccess(supabase, {
    userId: resolvedUserId,
    discordUserId,
  })

  if (!evaluation.userId && !evaluation.discordUserId) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    mode: 'user',
    resolution: {
      mode: discordUserId ? 'discord_user_id' : resolvedUserId ? 'user_id' : 'email',
      value: discordUserId || resolvedUserId || email,
      source: 'canonical_access_wrapper',
    },
    user: {
      id: evaluation.userId,
      email: evaluation.email,
    },
    discord_profile: {
      discord_user_id: evaluation.discordUserId,
      discord_username: evaluation.username,
      discord_avatar: evaluation.avatar,
      discord_roles: evaluation.effectiveDiscordRoleIds,
      last_synced_at: evaluation.lastSyncedAt,
    },
    access: {
      effective_role_ids: evaluation.effectiveDiscordRoleIds,
      effective_roles: evaluation.effectiveDiscordRoleIds.map((roleId) => ({
        role_id: roleId,
        role_name: evaluation.roleTitlesById[roleId] || `Unknown role (${roleId})`,
      })),
      role_titles_by_id: evaluation.roleTitlesById,
      has_members_required_role: evaluation.hasMembersAccess,
      resolved_tier: evaluation.resolvedTier,
      allowed_tabs: evaluation.allowedTabs,
      allowed_tabs_details: mapLegacyTabDetails(evaluation),
    },
    diagnosis: {
      is_admin: evaluation.isAdmin,
      is_privileged: evaluation.isPrivileged,
      link_status: evaluation.linkStatus,
      health_warnings: evaluation.healthWarnings,
      active_overrides: evaluation.activeOverrides,
      sources: evaluation.sources,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
