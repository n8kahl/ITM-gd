import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccessControlSettings } from '@/lib/access-control/types'

export const DEFAULT_ADMIN_ROLE_ID = '1465515598640447662'
export const DEFAULT_MEMBERS_ROLE_ID = '1471195516070264863'

export function normalizeDiscordRoleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  return Array.from(
    new Set(
      raw
        .map((roleId) => String(roleId).trim())
        .filter(Boolean),
    ),
  )
}

export function hasAnyDiscordRole(roleIds: string[], allowedRoleIds: readonly string[]): boolean {
  return roleIds.some((roleId) => allowedRoleIds.includes(roleId))
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

export function getDefaultAccessControlSettings(): AccessControlSettings {
  return {
    membersAllowedRoleIds: [DEFAULT_MEMBERS_ROLE_ID, DEFAULT_ADMIN_ROLE_ID],
    privilegedRoleIds: [DEFAULT_ADMIN_ROLE_ID],
    adminRoleIds: [DEFAULT_ADMIN_ROLE_ID],
    defaultLinkedUserStatus: 'inactive',
    allowDiscordRoleMutation: false,
  }
}

export async function resolveAccessControlSettings(
  supabase: SupabaseClient,
): Promise<AccessControlSettings> {
  const defaults = getDefaultAccessControlSettings()

  try {
    const { data, error } = await supabase
      .from('access_control_settings')
      .select(`
        members_allowed_role_ids,
        privileged_role_ids,
        admin_role_ids,
        default_linked_user_status,
        allow_discord_role_mutation
      `)
      .eq('singleton', true)
      .maybeSingle()

    if (error || !data) {
      return defaults
    }

    return {
      membersAllowedRoleIds: normalizeDiscordRoleIds(data.members_allowed_role_ids),
      privilegedRoleIds: normalizeDiscordRoleIds(data.privileged_role_ids),
      adminRoleIds: normalizeDiscordRoleIds(data.admin_role_ids),
      defaultLinkedUserStatus: typeof data.default_linked_user_status === 'string'
        ? data.default_linked_user_status
        : defaults.defaultLinkedUserStatus,
      allowDiscordRoleMutation: normalizeBoolean(
        data.allow_discord_role_mutation,
        defaults.allowDiscordRoleMutation,
      ),
    }
  } catch {
    return defaults
  }
}

export async function resolveRoleTitlesById(
  supabase: SupabaseClient,
  roleIds: string[],
): Promise<Record<string, string>> {
  const normalizedRoleIds = normalizeDiscordRoleIds(roleIds)
  if (normalizedRoleIds.length === 0) {
    return {}
  }

  const roleTitlesById: Record<string, string> = {}

  const [guildRoleResult, permissionRoleResult] = await Promise.all([
    supabase
      .from('discord_guild_roles')
      .select('discord_role_id, discord_role_name')
      .in('discord_role_id', normalizedRoleIds),
    supabase
      .from('discord_role_permissions')
      .select('discord_role_id, discord_role_name')
      .in('discord_role_id', normalizedRoleIds),
  ])

  for (const row of guildRoleResult.data || []) {
    const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id.trim() : ''
    const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name.trim() : ''
    if (!roleId || !roleName) continue
    roleTitlesById[roleId] = roleName
  }

  for (const row of permissionRoleResult.data || []) {
    const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id.trim() : ''
    const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name.trim() : ''
    if (!roleId || !roleName || roleTitlesById[roleId]) continue
    roleTitlesById[roleId] = roleName
  }

  return roleTitlesById
}
