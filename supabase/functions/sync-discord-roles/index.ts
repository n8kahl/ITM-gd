import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TODO: Fetch GUILD_ID from app_settings table instead of hardcoding
// For now, use environment variable or placeholder
const DISCORD_GUILD_ID = Deno.env.get('DISCORD_GUILD_ID') || 'YOUR_GUILD_ID_HERE'
const DISCORD_API_BASE = 'https://discord.com/api/v10'

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

interface DiscordRolePermission {
  id: string
  discord_role_id: string
  discord_role_name: string | null
  permission_id: string
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
      throw new Error('Missing authorization header')
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
      throw new Error('Invalid or expired token')
    }

    // Get the user's session to retrieve the provider token (Discord access token)
    const { data: { session }, error: sessionError } = await supabaseUser.auth.getSession()
    if (sessionError || !session) {
      throw new Error('No active session found')
    }

    const discordAccessToken = session.provider_token
    if (!discordAccessToken) {
      throw new Error('Discord access token not found. Please re-authenticate with Discord.')
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // TODO: Optionally fetch GUILD_ID from app_settings
    // const { data: guildSetting } = await supabaseAdmin
    //   .from('app_settings')
    //   .select('value')
    //   .eq('key', 'discord_guild_id')
    //   .single()
    // const guildId = guildSetting?.value || DISCORD_GUILD_ID

    const guildId = DISCORD_GUILD_ID

    // Call Discord API to get user's guild member info
    const discordResponse = await fetch(
      `${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${discordAccessToken}`,
        },
      }
    )

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error('Discord API error:', discordResponse.status, errorText)

      if (discordResponse.status === 401) {
        throw new Error('Discord token expired. Please re-authenticate.')
      }
      if (discordResponse.status === 404) {
        throw new Error('User is not a member of the TradeITM Discord server.')
      }
      throw new Error(`Discord API error: ${discordResponse.status}`)
    }

    const memberData: DiscordMember = await discordResponse.json()
    const discordUserId = memberData.user.id
    const discordUsername = memberData.user.username
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
      throw new Error('Failed to fetch role permissions')
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
          grantedByRoleName: rp.discord_role_name,
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
        discord_discriminator: memberData.user.discriminator,
        discord_avatar: memberData.user.avatar,
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

    // Delete existing permissions for this user (full sync)
    const { error: deleteError } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting existing permissions:', deleteError)
    }

    // Insert new permissions
    const permissionsToInsert = Array.from(permissionMap.values()).map(({ permission, grantedByRoleId, grantedByRoleName }) => ({
      user_id: user.id,
      discord_user_id: discordUserId,
      permission_id: permission.id,
      granted_by_role_id: grantedByRoleId,
      granted_by_role_name: grantedByRoleName,
    }))

    if (permissionsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('user_permissions')
        .insert(permissionsToInsert)

      if (insertError) {
        console.error('Error inserting permissions:', insertError)
        throw new Error('Failed to update user permissions')
      }
    }

    // Build response with role and permission details
    const roleDetails = discordRoles.map(roleId => {
      const rp = (rolePermissions || []).find(r => r.discord_role_id === roleId)
      return {
        id: roleId,
        name: rp?.discord_role_name || null,
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
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
