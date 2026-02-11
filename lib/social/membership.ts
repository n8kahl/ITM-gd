import type { SupabaseClient } from '@supabase/supabase-js'

export type MembershipTier = 'core' | 'pro' | 'executive'

interface RoleTierMapping {
  [roleId: string]: MembershipTier
}

export interface SocialUserMeta {
  display_name: string | null
  discord_username: string | null
  discord_avatar: string | null
  discord_user_id: string | null
  membership_tier: MembershipTier | null
  discord_roles: string[]
}

const TIER_PRIORITY: Record<MembershipTier, number> = {
  core: 1,
  pro: 2,
  executive: 3,
}

function normalizeTier(value: unknown): MembershipTier | null {
  if (value === 'core' || value === 'pro' || value === 'executive') {
    return value
  }

  if (value === 'execute') {
    return 'executive'
  }

  return null
}

function parseRoleTierMapping(rawValue: unknown): RoleTierMapping {
  if (!rawValue) return {}

  let parsed: unknown = rawValue

  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      return {}
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  const mapping: RoleTierMapping = {}

  for (const [roleId, rawTier] of Object.entries(parsed)) {
    const normalized = normalizeTier(rawTier)
    if (normalized) {
      mapping[String(roleId)] = normalized
    }
  }

  return mapping
}

export function resolveMembershipTierFromRoles(
  discordRoles: string[] | null | undefined,
  roleTierMapping: RoleTierMapping,
): MembershipTier {
  const roles = Array.isArray(discordRoles) ? discordRoles : []
  let highestTier: MembershipTier = 'core'

  for (const roleId of roles) {
    const mappedTier = roleTierMapping[roleId]
    if (!mappedTier) continue

    if (TIER_PRIORITY[mappedTier] > TIER_PRIORITY[highestTier]) {
      highestTier = mappedTier
    }
  }

  return highestTier
}

export async function fetchRoleTierMapping(
  supabase: SupabaseClient,
): Promise<RoleTierMapping> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'role_tier_mapping')
    .maybeSingle()

  if (error) {
    return {}
  }

  return parseRoleTierMapping(data?.value)
}

export async function getSocialUserMetaMap(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, SocialUserMeta>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  const metaMap = new Map<string, SocialUserMeta>()

  if (uniqueUserIds.length === 0) {
    return metaMap
  }

  const [profilesResult, discordProfilesResult, roleTierMapping] = await Promise.all([
    supabase
      .from('member_profiles')
      .select('user_id, display_name')
      .in('user_id', uniqueUserIds),
    supabase
      .from('user_discord_profiles')
      .select('user_id, discord_user_id, discord_username, discord_avatar, discord_roles')
      .in('user_id', uniqueUserIds),
    fetchRoleTierMapping(supabase),
  ])

  const profileByUserId = new Map<string, { display_name: string | null }>()
  for (const profile of profilesResult.data ?? []) {
    profileByUserId.set(profile.user_id, {
      display_name: profile.display_name,
    })
  }

  const discordByUserId = new Map<string, {
    discord_user_id: string | null
    discord_username: string | null
    discord_avatar: string | null
    discord_roles: string[]
  }>()

  for (const row of discordProfilesResult.data ?? []) {
    discordByUserId.set(row.user_id, {
      discord_user_id: row.discord_user_id,
      discord_username: row.discord_username,
      discord_avatar: row.discord_avatar,
      discord_roles: Array.isArray(row.discord_roles)
        ? row.discord_roles.map((roleId) => String(roleId))
        : [],
    })
  }

  for (const userId of uniqueUserIds) {
    const profile = profileByUserId.get(userId)
    const discord = discordByUserId.get(userId)

    metaMap.set(userId, {
      display_name: profile?.display_name ?? null,
      discord_username: discord?.discord_username ?? null,
      discord_avatar: discord?.discord_avatar ?? null,
      discord_user_id: discord?.discord_user_id ?? null,
      membership_tier: resolveMembershipTierFromRoles(discord?.discord_roles, roleTierMapping),
      discord_roles: discord?.discord_roles ?? [],
    })
  }

  return metaMap
}
