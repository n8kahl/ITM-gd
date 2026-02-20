import type { User } from '@supabase/supabase-js'

// Discord role that must always be treated as privileged for both /members and /admin areas.
export const DISCORD_PRIVILEGED_ROLE_ID = '1465515598640447662'

// Existing members-gate role that should continue to grant member access.
export const DISCORD_MEMBERS_ROLE_ID = '1471195516070264863'

export const MEMBERS_ALLOWED_ROLE_IDS = [
  DISCORD_MEMBERS_ROLE_ID,
  DISCORD_PRIVILEGED_ROLE_ID,
] as const

export const ADMIN_ALLOWED_ROLE_IDS = [
  DISCORD_PRIVILEGED_ROLE_ID,
] as const

export function normalizeDiscordRoleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const roleIds = raw
    .map((id) => String(id).trim())
    .filter(Boolean)

  return Array.from(new Set(roleIds))
}

export function extractDiscordRoleIdsFromUser(
  user: Pick<User, 'app_metadata' | 'user_metadata'> | null | undefined,
): string[] {
  const appMetaRoles = (user?.app_metadata as { discord_roles?: unknown } | undefined)?.discord_roles
  const appMetaRoleIds = normalizeDiscordRoleIds(appMetaRoles)
  if (appMetaRoleIds.length > 0) return appMetaRoleIds

  const userMetaRoles = (user?.user_metadata as { discord_roles?: unknown } | undefined)?.discord_roles
  return normalizeDiscordRoleIds(userMetaRoles)
}

export function hasAnyDiscordRole(
  roleIds: string[],
  allowedRoleIds: readonly string[],
): boolean {
  return roleIds.some((roleId) => allowedRoleIds.includes(roleId))
}

export function hasMembersAreaAccess(roleIds: string[]): boolean {
  return hasAnyDiscordRole(roleIds, MEMBERS_ALLOWED_ROLE_IDS)
}

export function hasAdminRoleAccess(roleIds: string[]): boolean {
  return hasAnyDiscordRole(roleIds, ADMIN_ALLOWED_ROLE_IDS)
}
