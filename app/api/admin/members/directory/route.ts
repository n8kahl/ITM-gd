import { NextRequest, NextResponse } from 'next/server'
import {
  evaluateMemberAccessFromSubject,
  loadAccessControlResources,
} from '@/lib/access-control/evaluate-member-access'
import {
  fetchActiveMemberAccessOverrides,
} from '@/lib/access-control/overrides'
import {
  searchLinkedUserIdsByEmail,
} from '@/lib/access-control/identity'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'
import type {
  AccessControlSubject,
  DiscordGuildMemberRecord,
  LinkedAuthUserRecord,
} from '@/lib/access-control/types'

const STALE_SYNC_HOURS = 24

function normalizeGuildMemberRow(row: Record<string, unknown>): DiscordGuildMemberRecord | null {
  const discordUserId = typeof row.discord_user_id === 'string' ? row.discord_user_id.trim() : ''
  if (!discordUserId) return null

  return {
    discordUserId,
    username: typeof row.username === 'string' ? row.username : 'Unknown',
    globalName: typeof row.global_name === 'string' ? row.global_name : null,
    nickname: typeof row.nickname === 'string' ? row.nickname : null,
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    discordRoles: Array.isArray(row.discord_roles)
      ? row.discord_roles.map((roleId) => String(roleId).trim()).filter(Boolean)
      : [],
    isInGuild: row.is_in_guild !== false,
    joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
    lastSyncedAt: typeof row.last_synced_at === 'string' ? row.last_synced_at : null,
    linkedUserId: typeof row.linked_user_id === 'string' ? row.linked_user_id : null,
    syncSource: typeof row.sync_source === 'string' ? row.sync_source : null,
    syncError: typeof row.sync_error === 'string' ? row.sync_error : null,
  }
}

function buildDiscordAvatarUrl(discordUserId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`
}

function parseBooleanParam(value: string | null): boolean | null {
  if (value == null) return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function loadLinkedAuthUsers(
  supabase: NonNullable<ReturnType<typeof createServiceRoleSupabaseClient>>,
  userIds: string[],
): Promise<Map<string, LinkedAuthUserRecord>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId)
      if (error || !data?.user) return null
      return [
        userId,
        {
          id: userId,
          email: typeof data.user.email === 'string' ? data.user.email : null,
          createdAt: typeof data.user.created_at === 'string' ? data.user.created_at : null,
          lastSignInAt: typeof data.user.last_sign_in_at === 'string' ? data.user.last_sign_in_at : null,
        } satisfies LinkedAuthUserRecord,
      ] as const
    }),
  )

  return new Map(entries.filter((entry): entry is readonly [string, LinkedAuthUserRecord] => entry !== null))
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Directory unavailable' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || ''
  const linkedFilter = searchParams.get('linked') || 'all'
  const staleFilter = parseBooleanParam(searchParams.get('stale'))
  const tierFilter = searchParams.get('tier') || 'all'
  const privilegedFilter = parseBooleanParam(searchParams.get('privileged'))
  const overrideFilter = searchParams.get('override') || 'all'
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200)

  let directoryQuery = supabase
    .from('discord_guild_members')
    .select('*')
    .order('username', { ascending: true })
    .limit(limit)

  if (linkedFilter === 'linked') {
    directoryQuery = directoryQuery.not('linked_user_id', 'is', null)
  } else if (linkedFilter === 'unlinked') {
    directoryQuery = directoryQuery.is('linked_user_id', null)
  }

  if (staleFilter !== null) {
    const staleBefore = new Date(Date.now() - (STALE_SYNC_HOURS * 60 * 60 * 1000)).toISOString()
    directoryQuery = staleFilter
      ? directoryQuery.lt('last_synced_at', staleBefore)
      : directoryQuery.gte('last_synced_at', staleBefore)
  }

  if (query) {
    if (isUuid(query)) {
      directoryQuery = directoryQuery.eq('linked_user_id', query)
    } else if (/^\d{17,20}$/.test(query)) {
      directoryQuery = directoryQuery.eq('discord_user_id', query)
    } else if (query.includes('@')) {
      const linkedUserIds = await searchLinkedUserIdsByEmail(supabase, query)
      if (linkedUserIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          meta: { resultCount: 0 },
        }, { headers: { 'Cache-Control': 'no-store' } })
      }
      directoryQuery = directoryQuery.in('linked_user_id', linkedUserIds)
    } else {
      const escaped = query.replaceAll('%', '\\%').replaceAll(',', '\\,')
      directoryQuery = directoryQuery.or(
        [
          `username.ilike.%${escaped}%`,
          `global_name.ilike.%${escaped}%`,
          `nickname.ilike.%${escaped}%`,
        ].join(','),
      )
    }
  }

  const { data, error } = await directoryQuery
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const guildMembers = (data || [])
    .map((row) => normalizeGuildMemberRow(row as Record<string, unknown>))
    .filter((row): row is DiscordGuildMemberRecord => row !== null)

  const linkedAuthUsers = await loadLinkedAuthUsers(
    supabase,
    guildMembers.map((member) => member.linkedUserId || '').filter(Boolean),
  )

  const resources = await loadAccessControlResources(
    supabase,
    guildMembers.flatMap((member) => member.discordRoles),
  )

  const rows = await Promise.all(
    guildMembers.map(async (guildMember) => {
      const subject: AccessControlSubject = {
        discordMember: guildMember,
        linkedProfile: null,
        linkedAuthUser: guildMember.linkedUserId
          ? linkedAuthUsers.get(guildMember.linkedUserId) || null
          : null,
      }
      const activeOverrides = await fetchActiveMemberAccessOverrides(supabase, {
        userId: guildMember.linkedUserId,
        discordUserId: guildMember.discordUserId,
      })
      const evaluation = evaluateMemberAccessFromSubject({
        subject,
        resources,
        activeOverrides,
      })

      const isSuspended = activeOverrides.some((override) => override.overrideType === 'suspend_members_access')
      const accessStatus = isSuspended
        ? 'suspended'
        : evaluation.isAdmin
          ? 'admin'
          : evaluation.hasMembersAccess
            ? 'member'
            : 'denied'

      return {
        discord_user_id: guildMember.discordUserId,
        username: guildMember.username,
        global_name: guildMember.globalName,
        nickname: guildMember.nickname,
        avatar: guildMember.avatar,
        avatar_url: buildDiscordAvatarUrl(guildMember.discordUserId, guildMember.avatar),
        linked_user_id: guildMember.linkedUserId,
        email: evaluation.email,
        link_status: evaluation.linkStatus,
        resolved_tier: evaluation.resolvedTier,
        access_status: accessStatus,
        is_admin: evaluation.isAdmin,
        is_privileged: evaluation.isPrivileged,
        has_members_access: evaluation.hasMembersAccess,
        active_override_count: activeOverrides.length,
        role_summary: evaluation.effectiveDiscordRoleIds.slice(0, 4).map((roleId) => ({
          role_id: roleId,
          role_name: evaluation.roleTitlesById[roleId] || `Unknown role (${roleId})`,
        })),
        role_count: evaluation.effectiveDiscordRoleIds.length,
        last_synced_at: evaluation.lastSyncedAt,
        sync_error: guildMember.syncError,
      }
    }),
  )

  const filteredRows = rows.filter((row) => {
    if (tierFilter !== 'all' && (row.resolved_tier || 'none') !== tierFilter) {
      return false
    }
    if (privilegedFilter !== null && row.is_privileged !== privilegedFilter) {
      return false
    }
    if (overrideFilter === 'blocked' && row.access_status !== 'suspended') {
      return false
    }
    if (overrideFilter === 'overridden' && row.active_override_count === 0) {
      return false
    }
    if (overrideFilter === 'none' && row.active_override_count > 0) {
      return false
    }
    return true
  })

  return NextResponse.json({
    success: true,
    data: filteredRows,
    meta: {
      resultCount: filteredRows.length,
      staleSyncHours: STALE_SYNC_HOURS,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
