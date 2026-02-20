import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DISCORD_API_BASE = 'https://discord.com/api/v10'
const DISCORD_PRIVILEGED_ROLE_ID = '1465515598640447662'
const DISCORD_MEMBERS_ROLE_ID = '1471195516070264863'
const MEMBERS_ALLOWED_ROLE_IDS = new Set([
  DISCORD_MEMBERS_ROLE_ID,
  DISCORD_PRIVILEGED_ROLE_ID,
])

// Error codes for specific error handling on frontend
const ERROR_CODES = {
  NOT_MEMBER: 'NOT_MEMBER',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_SESSION: 'INVALID_SESSION',
  GUILD_NOT_CONFIGURED: 'GUILD_NOT_CONFIGURED',
  SYNC_FAILED: 'SYNC_FAILED',
} as const

interface DiscordMember {
  user: {
    id: string
    username: string
    discriminator: string
    avatar: string | null
  }
  roles: string[]
  nick: string | null
  joined_at: string
}

interface DiscordGuildRole {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
  mentionable: boolean
}

interface AppPermission {
  id: string
  name: string
  description: string | null
}

interface SyncResult {
  success: boolean
  discord_user_id: string
  discord_username: string
  discord_avatar: string | null
  roles: Array<{
    id: string
    name: string | null
  }>
  permissions: Array<{
    id: string
    name: string
    description: string | null
    granted_by_role: string | null
  }>
  synced_at: string
}

interface SyncError {
  success: false
  error: string
  code: string
}

function hasMembersAreaAccess(roleIds: string[]): boolean {
  return roleIds.some((roleId) => MEMBERS_ALLOWED_ROLE_IDS.has(roleId))
}

function getBestEffortDiscordUsername(user: any): string {
  if (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim().length > 0) {
    return user.user_metadata.full_name.trim()
  }

  if (typeof user?.email === 'string' && user.email.includes('@')) {
    return user.email.split('@')[0]
  }

  return 'Unknown'
}

async function revokeAccessForNonMember(params: {
  supabaseAdmin: any
  user: any
  discordUserId: string
}): Promise<void> {
  const { supabaseAdmin, user, discordUserId } = params
  const nowIso = new Date().toISOString()

  try {
    const { error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user.id)
    if (permissionsError) {
      console.error('[sync-discord-roles] Failed to clear user_permissions on NOT_MEMBER:', permissionsError)
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_discord_profiles')
      .upsert({
        user_id: user.id,
        discord_user_id: discordUserId,
        discord_username: getBestEffortDiscordUsername(user),
        discord_discriminator: '0',
        discord_avatar: null,
        discord_roles: [],
        last_synced_at: nowIso,
        updated_at: nowIso,
      }, {
        onConflict: 'user_id',
      })
    if (profileError) {
      console.error('[sync-discord-roles] Failed to clear user_discord_profiles roles on NOT_MEMBER:', profileError)
    }

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...(user.app_metadata || {}),
          is_admin: false,
          is_member: false,
          discord_roles: [],
        },
      }
    )
    if (metadataError) {
      console.error('[sync-discord-roles] Failed to clear auth metadata on NOT_MEMBER:', metadataError)
    }
  } catch (error) {
    console.error('[sync-discord-roles] Unexpected error while revoking NOT_MEMBER access:', error)
  }
}

async function fetchGuildRoles(
  guildId: string,
  botToken: string,
): Promise<DiscordGuildRole[]> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error('[sync-discord-roles] Failed to fetch guild roles:', response.status, body)
      return []
    }

    const data = await response.json()
    if (!Array.isArray(data)) return []

    return data
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
    console.error('[sync-discord-roles] Exception fetching guild roles:', error)
    return []
  }
}

async function upsertGuildRoleCatalog(
  supabaseAdmin: any,
  roles: DiscordGuildRole[],
): Promise<void> {
  if (roles.length === 0) return

  try {
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
      console.warn('[sync-discord-roles] Unable to upsert discord_guild_roles (continuing):', error.message || error)
    }
  } catch (error) {
    console.warn('[sync-discord-roles] Exception while upserting discord_guild_roles (continuing):', error)
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Get the authorization header (user's JWT)
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return errorResponse('Missing authorization header', ERROR_CODES.INVALID_SESSION, 401)
    }

    // Create a client with the user's JWT to verify and get user info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Verify the JWT and get user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return errorResponse('Invalid or expired token', ERROR_CODES.INVALID_SESSION, 401)
    }

    // Get Discord user ID from Supabase user metadata (stored during OAuth)
    const discordUserId = user.user_metadata?.provider_id || user.user_metadata?.sub
    if (!discordUserId) {
      return errorResponse(
        'Discord user ID not found. Please re-authenticate with Discord.',
        ERROR_CODES.MISSING_TOKEN,
        401
      )
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch discord_guild_id and discord_bot_token from app_settings table
    const { data: settings, error: settingError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['discord_guild_id', 'discord_bot_token'])

    if (settingError) {
      console.error('Error fetching app_settings:', settingError)
      return errorResponse(
        'System Configuration Error: Failed to fetch settings.',
        ERROR_CODES.GUILD_NOT_CONFIGURED,
        500
      )
    }

    const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]))
    const guildId = settingsMap['discord_guild_id']
    const botToken = settingsMap['discord_bot_token']

    if (!guildId) {
      console.error('Discord Guild ID not configured in app_settings')
      return errorResponse(
        'System Configuration Error: Discord Guild ID not set.',
        ERROR_CODES.GUILD_NOT_CONFIGURED,
        500
      )
    }

    if (!botToken) {
      console.error('Discord Bot Token not configured in app_settings')
      return errorResponse(
        'System Configuration Error: Discord Bot Token not set.',
        ERROR_CODES.GUILD_NOT_CONFIGURED,
        500
      )
    }

    console.log('Using discord_guild_id and bot token from app_settings')
    const guildRoles = await fetchGuildRoles(guildId, botToken)
    await upsertGuildRoleCatalog(supabaseAdmin, guildRoles)
    const guildRoleNameById = new Map<string, string>(
      guildRoles.map((role) => [role.id, role.name])
    )

    // Call Discord API using Bot token to get user's guild member info
    const discordResponse = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/members/${discordUserId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error('Discord API error:', discordResponse.status, errorText)

      if (discordResponse.status === 401 || discordResponse.status === 403) {
        return errorResponse(
          'Bot token invalid or missing permissions. Please check Discord configuration.',
          ERROR_CODES.GUILD_NOT_CONFIGURED,
          500
        )
      }

      if (discordResponse.status === 404) {
        // User is NOT a member of the Discord server
        await revokeAccessForNonMember({
          supabaseAdmin,
          user,
          discordUserId,
        })
        return errorResponse(
          'You must be a member of the TradeITM Discord server to access this area.',
          ERROR_CODES.NOT_MEMBER,
          403
        )
      }

      return errorResponse(
        `Discord API error: ${discordResponse.status}`,
        ERROR_CODES.SYNC_FAILED,
        500
      )
    }

    const memberData: DiscordMember = await discordResponse.json()
    // Note: discordUserId already set from user metadata above
    const discordUsername = memberData.user?.username || memberData.nick || 'Unknown'
    const discordRoles = memberData.roles

    console.log(`Syncing roles for Discord user ${discordUsername} (${discordUserId})`)
    console.log(`Found ${discordRoles.length} roles:`, discordRoles)

    // Query discord_role_permissions to find which permissions these roles grant
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
      console.error('Error fetching role permissions:', rpError)
      return errorResponse('Failed to fetch role permissions', ERROR_CODES.SYNC_FAILED, 500)
    }

    // Build a map of permission_id -> role info (for deduplication)
    const permissionMap = new Map<string, {
      permission: AppPermission
      grantedByRoleId: string
      grantedByRoleName: string | null
    }>()

    for (const rp of rolePermissions || []) {
      const permission = (rp as any).app_permissions as AppPermission
      if (permission && !permissionMap.has(permission.id)) {
        permissionMap.set(permission.id, {
          permission,
          grantedByRoleId: rp.discord_role_id,
          grantedByRoleName: rp.discord_role_name || guildRoleNameById.get(rp.discord_role_id) || null,
        })
      }
    }

    // Update user_discord_profiles table
    const { error: profileError } = await supabaseAdmin
      .from('user_discord_profiles')
      .upsert({
        user_id: user.id,
        discord_user_id: discordUserId,
        discord_username: discordUsername,
        discord_discriminator: memberData.user?.discriminator || '0',
        discord_avatar: memberData.user?.avatar || null,
        discord_roles: discordRoles,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (profileError) {
      console.error('Error updating discord profile:', profileError)
      // Don't throw, continue with permission sync
    }

    // Build permissions to sync
    const permissionsToSync = Array.from(permissionMap.values()).map(({ permission, grantedByRoleId, grantedByRoleName }) => ({
      user_id: user.id,
      discord_user_id: discordUserId,
      permission_id: permission.id,
      granted_by_role_id: grantedByRoleId,
      granted_by_role_name: grantedByRoleName,
    }))

    // Use upsert for atomic permission sync (safer than delete+insert)
    if (permissionsToSync.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('user_permissions')
        .upsert(permissionsToSync, {
          onConflict: 'user_id,permission_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('Error upserting permissions:', upsertError)
        return errorResponse('Failed to update user permissions', ERROR_CODES.SYNC_FAILED, 500)
      }

      // Clean up permissions that are no longer granted by current roles
      // Use filter to exclude current permissions (avoids SQL injection from string interpolation)
      const currentPermissionIds = permissionsToSync.map(p => p.permission_id)

      // Supabase's .not().in() syntax requires parentheses for the filter value
      // We validate UUIDs first to ensure safety
      const validUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const sanitizedIds = currentPermissionIds.filter(id => validUuidRegex.test(id))

      if (sanitizedIds.length !== currentPermissionIds.length) {
        console.error('Invalid permission IDs detected, skipping cleanup')
      } else if (sanitizedIds.length > 0) {
        const { error: cleanupError } = await supabaseAdmin
          .from('user_permissions')
          .delete()
          .eq('user_id', user.id)
          .not('permission_id', 'in', `(${sanitizedIds.join(',')})`)

        if (cleanupError) {
          console.error('Error cleaning up old permissions:', cleanupError)
          // Non-fatal: continue with response
        }
      }
    } else {
      // No permissions to sync - remove all existing permissions for this user
      const { error: deleteError } = await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error clearing permissions:', deleteError)
      }
    }

    // CRITICAL: Update auth.users.raw_app_meta_data with permission claims
    // This ensures the JWT includes the latest role information immediately after sync
    // The database trigger also does this, but we update directly here for immediate effect
    const hasAdminPermission = Array.from(permissionMap.values()).some(
      ({ permission }) => permission.name === 'admin_dashboard'
    )
    const hasMemberPermission = hasMembersAreaAccess(discordRoles)

    console.log(`Updating auth claims: is_admin=${hasAdminPermission}, is_member=${hasMemberPermission}`)

    try {
      // Update app_metadata directly using admin client
      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        {
          app_metadata: {
            ...user.app_metadata,
            is_admin: hasAdminPermission,
            is_member: hasMemberPermission,
            discord_roles: discordRoles,
          }
        }
      )

      if (metadataError) {
        console.error('Error updating user app_metadata:', metadataError)
        // Non-fatal - trigger will update it eventually
      } else {
        console.log('✓ Updated auth.users.raw_app_meta_data with claims')
      }
    } catch (metaErr) {
      console.error('Exception updating app_metadata:', metaErr)
      // Continue - non-fatal
    }

    // Build response with role and permission details
    const roleDetails = discordRoles.map(roleId => {
      const rp = (rolePermissions || []).find(r => r.discord_role_id === roleId)
      return {
        id: roleId,
        name: guildRoleNameById.get(roleId) || rp?.discord_role_name || null,
      }
    })

    const permissionDetails = Array.from(permissionMap.values()).map(({ permission, grantedByRoleName }) => ({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      granted_by_role: grantedByRoleName,
    }))

    const result: SyncResult = {
      success: true,
      discord_user_id: discordUserId,
      discord_username: discordUsername,
      discord_avatar: memberData.user?.avatar || null,
      roles: roleDetails,
      permissions: permissionDetails,
      synced_at: new Date().toISOString(),
    }

    console.log(`Successfully synced ${permissionDetails.length} permissions for user ${user.id}`)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse(errorMessage, ERROR_CODES.SYNC_FAILED, 500)
  }
})

// Helper function to return consistent error responses
function errorResponse(message: string, code: string, status: number): Response {
  const error: SyncError = {
    success: false,
    error: message,
    code,
  }
  return new Response(
    JSON.stringify(error),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    }
  )
}
