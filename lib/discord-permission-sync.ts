import type { SupabaseClient } from '@supabase/supabase-js'
import { hasMembersAreaAccess } from '@/lib/discord-role-access'

type RolePermissionRow = {
  discord_role_id: string
  discord_role_name: string | null
  permission_id: string
  app_permissions: {
    id: string
    name: string
    description: string | null
  } | null
}

type UserDiscordProfileRow = {
  user_id: string
  discord_user_id: string | null
  discord_roles: string[]
}

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeRoleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.map((id) => String(id).trim()).filter(Boolean)))
}

function normalizeRolePermissionRows(rows: unknown[]): RolePermissionRow[] {
  const normalized: RolePermissionRow[] = []
  for (const row of rows) {
    const roleId = typeof (row as any)?.discord_role_id === 'string'
      ? String((row as any).discord_role_id).trim()
      : ''
    const permissionId = typeof (row as any)?.permission_id === 'string'
      ? String((row as any).permission_id).trim()
      : ''
    const permission = (row as any)?.app_permissions

    if (!roleId || !permissionId || !permission?.id || !permission?.name) {
      continue
    }

    normalized.push({
      discord_role_id: roleId,
      discord_role_name: typeof (row as any)?.discord_role_name === 'string'
        ? (row as any).discord_role_name
        : null,
      permission_id: permissionId,
      app_permissions: {
        id: String(permission.id),
        name: String(permission.name),
        description: typeof permission.description === 'string' ? permission.description : null,
      },
    })
  }

  return normalized
}

async function recomputeSingleUser(params: {
  supabaseAdmin: SupabaseClient
  userProfile: UserDiscordProfileRow
  rolePermissionMap: Map<string, RolePermissionRow[]>
}) {
  const { supabaseAdmin, userProfile, rolePermissionMap } = params
  const roleIds = normalizeRoleIds(userProfile.discord_roles)

  const permissionById = new Map<string, {
    permissionId: string
    permissionName: string
    grantedByRoleId: string
    grantedByRoleName: string | null
  }>()

  for (const roleId of roleIds) {
    const rows = rolePermissionMap.get(roleId) || []
    for (const row of rows) {
      const permission = row.app_permissions
      if (!permission?.id || !permission?.name) continue
      if (!permissionById.has(permission.id)) {
        permissionById.set(permission.id, {
          permissionId: permission.id,
          permissionName: permission.name,
          grantedByRoleId: row.discord_role_id,
          grantedByRoleName: row.discord_role_name,
        })
      }
    }
  }

  const permissionsToSync = Array.from(permissionById.values()).map((permission) => ({
    user_id: userProfile.user_id,
    discord_user_id: userProfile.discord_user_id,
    permission_id: permission.permissionId,
    granted_by_role_id: permission.grantedByRoleId,
    granted_by_role_name: permission.grantedByRoleName,
  }))

  if (permissionsToSync.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('user_permissions')
      .upsert(permissionsToSync, { onConflict: 'user_id,permission_id' })

    if (upsertError) {
      throw new Error(`Failed to upsert user_permissions for ${userProfile.user_id}: ${upsertError.message}`)
    }

    const currentPermissionIds = permissionsToSync
      .map((row) => row.permission_id)
      .filter((permissionId) => VALID_UUID_REGEX.test(String(permissionId)))

    if (currentPermissionIds.length > 0) {
      const { error: cleanupError } = await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', userProfile.user_id)
        .not('permission_id', 'in', `(${currentPermissionIds.join(',')})`)

      if (cleanupError) {
        throw new Error(`Failed to cleanup stale permissions for ${userProfile.user_id}: ${cleanupError.message}`)
      }
    }
  } else {
    const { error: deleteError } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', userProfile.user_id)

    if (deleteError) {
      throw new Error(`Failed to clear user_permissions for ${userProfile.user_id}: ${deleteError.message}`)
    }
  }

  const hasAdminPermission = Array.from(permissionById.values()).some(
    ({ permissionName }) => permissionName === 'admin_dashboard',
  )
  const hasMemberRole = hasMembersAreaAccess(roleIds)

  const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userProfile.user_id)
  if (authUserError || !authUserResult?.user) {
    throw new Error(`Failed to load auth user ${userProfile.user_id}: ${authUserError?.message || 'unknown error'}`)
  }

  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userProfile.user_id, {
    app_metadata: {
      ...(authUserResult.user.app_metadata || {}),
      is_admin: hasAdminPermission,
      is_member: hasMemberRole,
      discord_roles: roleIds,
    },
  })

  if (metadataError) {
    throw new Error(`Failed to update auth metadata for ${userProfile.user_id}: ${metadataError.message}`)
  }
}

export async function recomputeUsersForRoleIds(params: {
  supabaseAdmin: SupabaseClient
  roleIds: string[]
}): Promise<{ processed: number; failed: number; affectedUserIds: string[]; errors: string[] }> {
  const { supabaseAdmin } = params
  const roleIds = normalizeRoleIds(params.roleIds)

  if (roleIds.length === 0) {
    return { processed: 0, failed: 0, affectedUserIds: [], errors: [] }
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('user_discord_profiles')
    .select('user_id, discord_user_id, discord_roles')
    .overlaps('discord_roles', roleIds)

  if (profilesError) {
    throw new Error(`Failed to query affected user_discord_profiles: ${profilesError.message}`)
  }

  const affectedProfiles: UserDiscordProfileRow[] = (profiles || []).map((row: any) => ({
    user_id: String(row.user_id),
    discord_user_id: typeof row.discord_user_id === 'string' ? row.discord_user_id : null,
    discord_roles: normalizeRoleIds(row.discord_roles),
  }))

  if (affectedProfiles.length === 0) {
    return { processed: 0, failed: 0, affectedUserIds: [], errors: [] }
  }

  const allRoleIds = Array.from(new Set(
    affectedProfiles.flatMap((profile) => profile.discord_roles)
  ))

  const { data: rolePermissionRows, error: rolePermissionError } = await supabaseAdmin
    .from('discord_role_permissions')
    .select(`
      discord_role_id,
      discord_role_name,
      permission_id,
      app_permissions (
        id,
        name,
        description
      )
    `)
    .in('discord_role_id', allRoleIds)

  if (rolePermissionError) {
    throw new Error(`Failed to query discord_role_permissions: ${rolePermissionError.message}`)
  }

  const normalizedRolePermissionRows = normalizeRolePermissionRows(rolePermissionRows || [])
  const rolePermissionMap = new Map<string, RolePermissionRow[]>()
  for (const row of normalizedRolePermissionRows) {
    const scopedRows = rolePermissionMap.get(row.discord_role_id) || []
    scopedRows.push(row)
    rolePermissionMap.set(row.discord_role_id, scopedRows)
  }

  let processed = 0
  let failed = 0
  const errors: string[] = []

  for (const userProfile of affectedProfiles) {
    try {
      await recomputeSingleUser({
        supabaseAdmin,
        userProfile,
        rolePermissionMap,
      })
      processed += 1
    } catch (error) {
      failed += 1
      errors.push(error instanceof Error ? error.message : `Unknown recompute failure for ${userProfile.user_id}`)
    }
  }

  return {
    processed,
    failed,
    affectedUserIds: affectedProfiles.map((profile) => profile.user_id),
    errors,
  }
}
