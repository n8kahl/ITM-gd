import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import { logAdminActivity } from '@/lib/admin/audit-log'
import { hasMembersAreaAccess } from '@/lib/discord-role-access'

const DISCORD_API_BASE = 'https://discord.com/api/v10'

const ERROR_CODES = {
  NOT_MEMBER: 'NOT_MEMBER',
  GUILD_NOT_CONFIGURED: 'GUILD_NOT_CONFIGURED',
  SYNC_FAILED: 'SYNC_FAILED',
} as const

interface DiscordGuildRole {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
  mentionable: boolean
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function getDiscordConfig(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>): Promise<{ guildId: string; botToken: string }> {
  const { data: settings, error } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['discord_guild_id', 'discord_bot_token'])

  if (error) {
    throw new Error(`Failed to fetch Discord settings: ${error.message}`)
  }

  const map = Object.fromEntries((settings || []).map((row: any) => [row.key, row.value]))
  const guildId = String(map.discord_guild_id || '').trim()
  const botToken = String(map.discord_bot_token || '').trim()

  if (!guildId || !botToken) {
    const missing = [
      !guildId ? 'discord_guild_id' : null,
      !botToken ? 'discord_bot_token' : null,
    ].filter(Boolean)
    const err = new Error(`Discord configuration missing: ${missing.join(', ')}`)
    ;(err as any).code = ERROR_CODES.GUILD_NOT_CONFIGURED
    throw err
  }

  return { guildId, botToken }
}

async function fetchDiscordMemberRoles(
  guildId: string,
  botToken: string,
  discordUserId: string,
): Promise<{ roles: string[]; username: string; avatar: string | null }> {
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (response.status === 404) {
      const err = new Error('User is not a member of the Discord server')
      ;(err as any).code = ERROR_CODES.NOT_MEMBER
      throw err
    }

    const err = new Error(`Discord API error: ${response.status} ${body}`)
    ;(err as any).code = ERROR_CODES.SYNC_FAILED
    throw err
  }

  const memberData = await response.json() as any
  const username = memberData?.user?.username || memberData?.nick || 'Unknown'
  const roles = Array.isArray(memberData?.roles) ? memberData.roles.map((id: unknown) => String(id)).filter(Boolean) : []
  const avatar = memberData?.user?.avatar || null

  return { roles, username, avatar }
}

function getBestEffortDiscordUsername(authUser: any): string {
  if (typeof authUser?.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name.trim().length > 0) {
    return authUser.user_metadata.full_name.trim()
  }

  if (typeof authUser?.email === 'string' && authUser.email.includes('@')) {
    return authUser.email.split('@')[0]
  }

  return 'Unknown'
}

async function revokeAccessForNonMember(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  userId: string
  discordUserId: string
  authUser: any
}) {
  const { supabaseAdmin, userId, discordUserId, authUser } = params
  const nowIso = new Date().toISOString()

  const { error: permissionsError } = await supabaseAdmin
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
  if (permissionsError) {
    console.warn('[Admin Force Sync] Failed to clear user_permissions on NOT_MEMBER:', permissionsError.message)
  }

  const { error: profileError } = await supabaseAdmin
    .from('user_discord_profiles')
    .upsert({
      user_id: userId,
      discord_user_id: discordUserId,
      discord_username: getBestEffortDiscordUsername(authUser),
      discord_discriminator: '0',
      discord_avatar: null,
      discord_roles: [],
      last_synced_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'user_id' })
  if (profileError) {
    console.warn('[Admin Force Sync] Failed to clear user_discord_profiles on NOT_MEMBER:', profileError.message)
  }

  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(authUser?.app_metadata || {}),
      is_admin: false,
      is_member: false,
      discord_roles: [],
    },
  })
  if (metadataError) {
    console.warn('[Admin Force Sync] Failed to clear auth metadata on NOT_MEMBER:', metadataError.message)
  }
}

async function fetchGuildRoles(
  guildId: string,
  botToken: string,
): Promise<DiscordGuildRole[]> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn('[Admin Force Sync] Failed to fetch guild role catalog:', response.status, body)
      return []
    }

    const rows = await response.json()
    if (!Array.isArray(rows)) return []

    return rows
      .map((row: any) => ({
        id: String(row?.id || ''),
        name: String(row?.name || ''),
        color: Number(row?.color || 0),
        position: Number(row?.position || 0),
        managed: row?.managed === true,
        mentionable: row?.mentionable === true,
      }))
      .filter((role: DiscordGuildRole) => role.id.length > 0)
  } catch (error) {
    console.warn('[Admin Force Sync] Exception while fetching guild role catalog:', error)
    return []
  }
}

async function upsertGuildRoleCatalog(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  roles: DiscordGuildRole[],
): Promise<void> {
  if (roles.length === 0) return

  const nowIso = new Date().toISOString()
  const payload = roles.map((role) => ({
    discord_role_id: role.id,
    discord_role_name: role.name,
    role_color: role.color || null,
    position: role.position,
    managed: role.managed,
    mentionable: role.mentionable,
    last_synced_at: nowIso,
    updated_at: nowIso,
  }))

  const { error } = await supabaseAdmin
    .from('discord_guild_roles')
    .upsert(payload, { onConflict: 'discord_role_id' })

  if (error) {
    console.warn('[Admin Force Sync] Failed to upsert guild role catalog:', error.message)
  }
}

function buildPermissionMap(rolePermissions: any[]): Map<string, { permission: any; grantedByRoleId: string; grantedByRoleName: string | null }> {
  const permissionMap = new Map<string, { permission: any; grantedByRoleId: string; grantedByRoleName: string | null }>()

  for (const rp of rolePermissions || []) {
    const permission = (rp as any).app_permissions
    if (!permission?.id) continue

    if (!permissionMap.has(permission.id)) {
      permissionMap.set(permission.id, {
        permission,
        grantedByRoleId: String((rp as any).discord_role_id),
        grantedByRoleName: (rp as any).discord_role_name || null,
      })
    }
  }

  return permissionMap
}

/**
 * POST /api/admin/members/force-sync
 * Admin-only. Forces a Discord role sync for a target user using the bot token (no end-user token required).
 *
 * Body: { user_id: string }
 */
export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null
  let authUser: any = null
  let userIdForRevoke: string | null = null
  let discordUserIdForRevoke: string | null = null

  try {
    const body = await request.json().catch(() => ({}))
    const userId = String((body as any).user_id || '').trim()
    userIdForRevoke = userId

    if (!userId || !isUuid(userId)) {
      return NextResponse.json({ success: false, error: 'Valid user_id is required' }, { status: 400 })
    }

    supabaseAdmin = getSupabaseAdmin()

    const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authUserError || !authUserResult?.user) {
      return NextResponse.json(
        { success: false, error: authUserError?.message || 'Failed to load auth user' },
        { status: 500 },
      )
    }

    authUser = authUserResult.user
    const discordUserId = authUser.user_metadata?.provider_id || authUser.user_metadata?.sub || null
    discordUserIdForRevoke = discordUserId
    if (!discordUserId) {
      return NextResponse.json(
        { success: false, error: 'Discord user ID not found in user metadata (provider_id/sub)' },
        { status: 400 },
      )
    }

    const { guildId, botToken } = await getDiscordConfig(supabaseAdmin)
    const guildRoles = await fetchGuildRoles(guildId, botToken)
    await upsertGuildRoleCatalog(supabaseAdmin, guildRoles)
    const guildRoleNameById = new Map<string, string>(guildRoles.map((role) => [role.id, role.name]))
    const { roles: discordRoles, username, avatar } = await fetchDiscordMemberRoles(guildId, botToken, discordUserId)

    // Fetch role→permission mappings
    const { data: rolePermissions, error: rpError } = await supabaseAdmin
      .from('discord_role_permissions')
      .select(`
        id,
        discord_role_id,
        discord_role_name,
        permission_id,
        app_permissions (
          id,
          name,
          description
        )
      `)
      .in('discord_role_id', discordRoles)

    if (rpError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch role permissions: ${rpError.message}` },
        { status: 500 },
      )
    }

    const permissionMap = buildPermissionMap((rolePermissions || []).map((rp: any) => ({
      ...rp,
      discord_role_name: rp.discord_role_name || guildRoleNameById.get(String(rp.discord_role_id)) || null,
    })))

    // Upsert cached Discord profile
    const { error: profileError } = await supabaseAdmin
      .from('user_discord_profiles')
      .upsert({
        user_id: userId,
        discord_user_id: discordUserId,
        discord_username: username,
        discord_discriminator: '0',
        discord_avatar: avatar,
        discord_roles: discordRoles,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (profileError) {
      return NextResponse.json(
        { success: false, error: `Failed to update user_discord_profiles: ${profileError.message}` },
        { status: 500 },
      )
    }

    const permissionsToSync = Array.from(permissionMap.values()).map(({ permission, grantedByRoleId, grantedByRoleName }) => ({
      user_id: userId,
      discord_user_id: discordUserId,
      permission_id: permission.id,
      granted_by_role_id: grantedByRoleId,
      granted_by_role_name: grantedByRoleName,
    }))

    // Upsert effective permissions
    if (permissionsToSync.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('user_permissions')
        .upsert(permissionsToSync, { onConflict: 'user_id,permission_id' })

      if (upsertError) {
        return NextResponse.json(
          { success: false, error: `Failed to upsert user_permissions: ${upsertError.message}` },
          { status: 500 },
        )
      }

      // Cleanup stale permissions.
      const currentPermissionIds = permissionsToSync.map((row) => row.permission_id)
      const sanitizedIds = currentPermissionIds.filter((id) => isUuid(String(id)))
      if (sanitizedIds.length === currentPermissionIds.length && sanitizedIds.length > 0) {
        const { error: cleanupError } = await supabaseAdmin
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .not('permission_id', 'in', `(${sanitizedIds.join(',')})`)

        if (cleanupError) {
          console.warn('[Admin Force Sync] Failed to cleanup stale permissions:', cleanupError.message)
        }
      }
    } else {
      const { error: deleteError } = await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
      if (deleteError) {
        console.warn('[Admin Force Sync] Failed to clear permissions:', deleteError.message)
      }
    }

    const hasAdminPermission = Array.from(permissionMap.values()).some(
      ({ permission }) => permission?.name === 'admin_dashboard',
    )
    const hasMemberPermission = hasMembersAreaAccess(discordRoles)

    // Persist claims + discord_roles into auth app_metadata (so middleware can read them).
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(authUser.app_metadata || {}),
        is_admin: hasAdminPermission,
        is_member: hasMemberPermission,
        discord_roles: discordRoles,
      },
    })

    if (metadataError) {
      console.warn('[Admin Force Sync] Failed to update auth app_metadata:', metadataError.message)
    }

    await logAdminActivity({
      action: 'member_force_synced',
      targetType: 'member',
      targetId: userId,
      details: {
        discord_user_id: discordUserId,
        discord_roles: discordRoles,
        is_admin: hasAdminPermission,
        is_member: hasMemberPermission,
      },
    })

    return NextResponse.json({
      success: true,
      user_id: userId,
      discord_user_id: discordUserId,
      discord_username: username,
      discord_roles: discordRoles,
      has_members_required_role: hasMembersAreaAccess(discordRoles),
      permissions: Array.from(permissionMap.values()).map(({ permission, grantedByRoleName }) => ({
        id: permission.id,
        name: permission.name,
        description: permission.description,
        granted_by_role: grantedByRoleName,
      })),
      claims: {
        is_admin: hasAdminPermission,
        is_member: hasMemberPermission,
      },
      synced_at: new Date().toISOString(),
    })
  } catch (error) {
    const code = (error as any)?.code
    const message = error instanceof Error ? error.message : 'Internal server error'

    if (code === ERROR_CODES.NOT_MEMBER) {
      if (supabaseAdmin && userIdForRevoke && discordUserIdForRevoke && authUser) {
        await revokeAccessForNonMember({
          supabaseAdmin,
          userId: userIdForRevoke,
          discordUserId: discordUserIdForRevoke,
          authUser,
        })
      }
      return NextResponse.json({ success: false, error: message, code }, { status: 403 })
    }

    if (code === ERROR_CODES.GUILD_NOT_CONFIGURED) {
      return NextResponse.json({ success: false, error: message, code }, { status: 500 })
    }

    console.error('[Admin Force Sync] Error:', error)
    return NextResponse.json({ success: false, error: message, code: code || ERROR_CODES.SYNC_FAILED }, { status: 500 })
  }
}
