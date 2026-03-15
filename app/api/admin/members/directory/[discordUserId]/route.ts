import { NextRequest, NextResponse } from 'next/server'
import {
  evaluateMemberAccess,
} from '@/lib/access-control/evaluate-member-access'
import {
  loadAccessControlSubject,
} from '@/lib/access-control/identity'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  resolveAccessControlSettings,
} from '@/lib/access-control/roles'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'

function buildDiscordAvatarUrl(discordUserId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ discordUserId: string }> },
) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { discordUserId } = await context.params
  if (!discordUserId?.trim()) {
    return NextResponse.json({ success: false, error: 'discordUserId is required' }, { status: 400 })
  }

  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Detail unavailable' }, { status: 500 })
  }

  const [subject, evaluation, auditResult, settings, roleCatalogResult] = await Promise.all([
    loadAccessControlSubject(supabase, { discordUserId }),
    evaluateMemberAccess(supabase, { discordUserId }),
    supabase
      .from('admin_activity_log')
      .select('id, admin_user_id, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    resolveAccessControlSettings(supabase),
    supabase
      .from('discord_guild_roles')
      .select('discord_role_id, discord_role_name, position, managed')
      .order('position', { ascending: false }),
  ])

  if (!subject.discordMember && !subject.linkedProfile) {
    return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
  }

  const auditRows = (auditResult.data || []).filter((row) => {
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

    return (
      targetId === discordUserId
      || detailDiscordUserId === discordUserId
      || (evaluation.userId && detailUserId === evaluation.userId)
    )
  }).slice(0, 25)

  return NextResponse.json({
    success: true,
    data: {
      identity: {
        discord_user_id: evaluation.discordUserId,
        username: evaluation.username,
        global_name: evaluation.globalName,
        nickname: evaluation.nickname,
        avatar: evaluation.avatar,
        avatar_url: evaluation.discordUserId
          ? buildDiscordAvatarUrl(evaluation.discordUserId, evaluation.avatar)
          : null,
        email: evaluation.email,
        linked_user_id: evaluation.userId,
        link_status: evaluation.linkStatus,
        is_in_guild: evaluation.isInGuild,
        sources: evaluation.sources,
      },
      discord_roles: evaluation.effectiveDiscordRoleIds.map((roleId) => ({
        role_id: roleId,
        role_name: evaluation.roleTitlesById[roleId] || `Unknown role (${roleId})`,
      })),
      app_access: {
        resolved_tier: evaluation.resolvedTier,
        is_admin: evaluation.isAdmin,
        is_privileged: evaluation.isPrivileged,
        has_members_access: evaluation.hasMembersAccess,
        allowed_tabs: evaluation.allowedTabs,
      },
      controls: {
        allow_discord_role_mutation: settings.allowDiscordRoleMutation,
        role_catalog: (roleCatalogResult.data || []).map((row) => ({
          role_id: typeof row?.discord_role_id === 'string' ? row.discord_role_id : '',
          role_name: typeof row?.discord_role_name === 'string' ? row.discord_role_name : 'Unknown role',
          managed: row?.managed === true,
          position: Number(row?.position || 0),
        })).filter((row) => row.role_id),
      },
      tab_matrix: evaluation.tabDecisions,
      profile_sync_health: {
        last_synced_at: evaluation.lastSyncedAt,
        warnings: evaluation.healthWarnings,
        guild_sync_error: subject.discordMember?.syncError || null,
        linked_profile_last_synced_at: subject.linkedProfile?.lastSyncedAt || null,
        linked_auth_created_at: subject.linkedAuthUser?.createdAt || null,
        linked_auth_last_sign_in_at: subject.linkedAuthUser?.lastSignInAt || null,
      },
      overrides: evaluation.activeOverrides,
      audit_history: auditRows,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
