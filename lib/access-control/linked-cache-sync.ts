import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeUsersForRoleIds } from '@/lib/discord-permission-sync'
import {
  buildSyncedAppMetadata,
  buildSyncedUserMetadata,
} from '@/lib/discord-user-sync'

function withoutDiscordSyncFields(raw: unknown): Record<string, unknown> {
  const next = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}

  delete next.discord_user_id
  delete next.discord_username
  delete next.discord_avatar
  delete next.discord_avatar_url

  return next
}

export async function syncLinkedMemberCaches(params: {
  supabase: SupabaseClient
  userId: string
  discordUserId: string
  username: string | null
  avatar: string | null
  roleIds: string[]
}) {
  const { supabase, userId, discordUserId, username, avatar, roleIds } = params
  const nowIso = new Date().toISOString()

  const { error: profileError } = await supabase
    .from('user_discord_profiles')
    .upsert({
      user_id: userId,
      discord_user_id: discordUserId,
      discord_username: username,
      discord_avatar: avatar,
      discord_roles: roleIds,
      last_synced_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'user_id' })

  if (profileError) {
    throw new Error(`Failed to sync linked Discord profile: ${profileError.message}`)
  }

  if (roleIds.length > 0) {
    await recomputeUsersForRoleIds({
      supabaseAdmin: supabase,
      roleIds,
    })
    return
  }

  const { error: permissionDeleteError } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)

  if (permissionDeleteError) {
    throw new Error(`Failed to clear derived permissions: ${permissionDeleteError.message}`)
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    throw new Error(`Failed to load auth user for metadata sync: ${error.message}`)
  }

  if (data?.user) {
    const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: buildSyncedAppMetadata({
        existingAppMetadata: data.user.app_metadata,
        discordRoles: [],
        isAdmin: false,
        isMember: false,
        discordUserId,
        discordUsername: username,
        discordAvatar: avatar,
      }),
      user_metadata: buildSyncedUserMetadata({
        existingUserMetadata: data.user.user_metadata,
        discordRoles: [],
        discordUserId,
        discordUsername: username,
        discordAvatar: avatar,
      }),
    })

    if (metadataError) {
      throw new Error(`Failed to clear auth metadata after sync: ${metadataError.message}`)
    }
  }
}

export async function clearLinkedMemberCaches(params: {
  supabase: SupabaseClient
  userId: string
}) {
  const { supabase, userId } = params

  const { error: profileDeleteError } = await supabase
    .from('user_discord_profiles')
    .delete()
    .eq('user_id', userId)

  if (profileDeleteError) {
    throw new Error(`Failed to unlink cached Discord profile: ${profileDeleteError.message}`)
  }

  const { error: permissionDeleteError } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)

  if (permissionDeleteError) {
    throw new Error(`Failed to clear derived permissions: ${permissionDeleteError.message}`)
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    throw new Error(`Failed to load auth user for unlink cleanup: ${error.message}`)
  }

  if (!data?.user) return

  const nextAppMetadata = {
    ...withoutDiscordSyncFields(data.user.app_metadata),
    is_admin: false,
    is_member: false,
    discord_roles: [],
  }
  const nextUserMetadata = {
    ...withoutDiscordSyncFields(data.user.user_metadata),
    discord_roles: [],
  }

  const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: nextAppMetadata,
    user_metadata: nextUserMetadata,
  })

  if (metadataError) {
    throw new Error(`Failed to clear auth metadata during unlink: ${metadataError.message}`)
  }
}
