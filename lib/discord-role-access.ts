import type { User } from '@supabase/supabase-js'

// Discord role that must always be treated as privileged for both /members and /admin areas.
export const DISCORD_PRIVILEGED_ROLE_ID = '1465515598640447662'

// Existing members-gate role that should continue to grant member access.
export const DISCORD_MEMBERS_ROLE_ID = '1471195516070264863'

const MEMBERS_ALLOWED_ROLE_IDS_ENV_KEY = 'DISCORD_MEMBERS_ALLOWED_ROLE_IDS'
export const MEMBERS_REQUIRED_ROLE_IDS_SETTING_KEY = 'members_required_role_ids'
export const MEMBERS_REQUIRED_ROLE_ID_LEGACY_SETTING_KEY = 'members_required_role_id'
const MEMBERS_ALLOWED_ROLE_IDS_CACHE_TTL_MS = 60_000

type MembersAllowedRoleIdsCache = {
  value: string[]
  expiresAt: number
}

let membersAllowedRoleIdsCache: MembersAllowedRoleIdsCache | null = null

const DEFAULT_MEMBERS_ALLOWED_ROLE_IDS = [
  DISCORD_MEMBERS_ROLE_ID,
  DISCORD_PRIVILEGED_ROLE_ID,
] as const

export const ADMIN_ALLOWED_ROLE_IDS = [
  DISCORD_PRIVILEGED_ROLE_ID,
] as const

function parseRoleIdsFromString(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return normalizeDiscordRoleIds(parsed)
    }
    if (typeof parsed === 'string') {
      return parseRoleIdsFromString(parsed)
    }
  } catch {
    // Fall through to CSV parser.
  }

  return normalizeDiscordRoleIds(trimmed.split(','))
}

export function getDefaultMembersAllowedRoleIds(): string[] {
  const fromEnv = parseRoleIdsFromString(process.env[MEMBERS_ALLOWED_ROLE_IDS_ENV_KEY] || '')
  if (fromEnv.length > 0) {
    return fromEnv
  }

  return [...DEFAULT_MEMBERS_ALLOWED_ROLE_IDS]
}

export const MEMBERS_ALLOWED_ROLE_IDS = getDefaultMembersAllowedRoleIds()

export function clearMembersAllowedRoleIdsCache(): void {
  membersAllowedRoleIdsCache = null
}

export async function resolveMembersAllowedRoleIds(params?: {
  supabase?: any
  useCache?: boolean
  forceRefresh?: boolean
}): Promise<string[]> {
  const supabase = params?.supabase
  const useCache = params?.useCache !== false
  const forceRefresh = params?.forceRefresh === true

  if (!supabase) {
    return getDefaultMembersAllowedRoleIds()
  }

  const now = Date.now()
  if (!forceRefresh && useCache && membersAllowedRoleIdsCache && membersAllowedRoleIdsCache.expiresAt > now) {
    return membersAllowedRoleIdsCache.value
  }

  try {
    const { data, error } = await supabase
      .from('access_control_settings')
      .select('members_allowed_role_ids')
      .eq('singleton', true)
      .maybeSingle()

    if (error) {
      const fallback = getDefaultMembersAllowedRoleIds()
      membersAllowedRoleIdsCache = {
        value: fallback,
        expiresAt: now + MEMBERS_ALLOWED_ROLE_IDS_CACHE_TTL_MS,
      }
      return fallback
    }

    const configuredRoleIds = normalizeDiscordRoleIds((data as { members_allowed_role_ids?: unknown } | null)?.members_allowed_role_ids)
    const resolvedRoleIds = configuredRoleIds.length > 0
      ? configuredRoleIds
      : getDefaultMembersAllowedRoleIds()

    membersAllowedRoleIdsCache = {
      value: resolvedRoleIds,
      expiresAt: now + MEMBERS_ALLOWED_ROLE_IDS_CACHE_TTL_MS,
    }
    return resolvedRoleIds
  } catch {
    const fallback = getDefaultMembersAllowedRoleIds()
    membersAllowedRoleIdsCache = {
      value: fallback,
      expiresAt: now + MEMBERS_ALLOWED_ROLE_IDS_CACHE_TTL_MS,
    }
    return fallback
  }
}

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

export function hasMembersAreaAccess(
  roleIds: string[],
  allowedRoleIds: readonly string[] = MEMBERS_ALLOWED_ROLE_IDS,
): boolean {
  return hasAnyDiscordRole(roleIds, allowedRoleIds)
}

export function hasAdminRoleAccess(roleIds: string[]): boolean {
  return hasAnyDiscordRole(roleIds, ADMIN_ALLOWED_ROLE_IDS)
}
