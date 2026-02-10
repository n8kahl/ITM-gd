import type { SupabaseClient, User } from '@supabase/supabase-js'

type MembershipTier = 'core' | 'pro' | 'executive'

// Some environments use 'execute' as the top tier id in pricing_tiers.
const EXECUTIVE_TIER_IDS = ['executive', 'execute'] as const

const TIER_HIERARCHY: Record<MembershipTier, number> = {
  core: 1,
  pro: 2,
  executive: 3,
}

export function getAccessibleTiers(userTier: MembershipTier): MembershipTier[] {
  const level = TIER_HIERARCHY[userTier] || TIER_HIERARCHY.core
  return (Object.keys(TIER_HIERARCHY) as MembershipTier[]).filter(
    (tier) => TIER_HIERARCHY[tier] <= level
  )
}

export function getAccessibleTierIds(userTier: MembershipTier): string[] {
  const tiers = getAccessibleTiers(userTier)
  const ids: string[] = []
  for (const tier of tiers) {
    if (tier === 'executive') {
      ids.push(...EXECUTIVE_TIER_IDS)
    } else {
      ids.push(tier)
    }
  }
  return Array.from(new Set(ids))
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

function extractDiscordRoleIds(user: User): string[] {
  const appMetaRoles = (user.app_metadata as { discord_roles?: unknown } | undefined)?.discord_roles
  if (Array.isArray(appMetaRoles)) {
    return appMetaRoles
      .map((roleId) => String(roleId))
      .filter((roleId) => roleId.length > 0)
  }

  const userMetaRoles = (user.user_metadata as { discord_roles?: unknown } | undefined)?.discord_roles
  if (Array.isArray(userMetaRoles)) {
    return userMetaRoles
      .map((roleId) => String(roleId))
      .filter((roleId) => roleId.length > 0)
  }

  return []
}

export async function resolveUserMembershipTier(
  user: User,
  supabase: SupabaseClient
): Promise<MembershipTier> {
  const roleIds = extractDiscordRoleIds(user)
  if (roleIds.length === 0) {
    return 'core'
  }

  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('id, discord_role_id')
    .in('id', ['core', 'pro', ...EXECUTIVE_TIER_IDS])
    .not('discord_role_id', 'is', null)

  if (error || !data || data.length === 0) {
    return 'core'
  }

  let highestTier: MembershipTier = 'core'

  for (const row of data) {
    const tier = normalizeTier(row.id)
    if (!tier || !row.discord_role_id) {
      continue
    }

    if (!roleIds.includes(row.discord_role_id)) {
      continue
    }

    if (TIER_HIERARCHY[tier] > TIER_HIERARCHY[highestTier]) {
      highestTier = tier
    }
  }

  return highestTier
}

export function toSafeErrorMessage(
  error: unknown,
  fallback = 'Internal server error'
): string {
  if (
    process.env.NODE_ENV !== 'production' &&
    error instanceof Error &&
    error.message.trim().length > 0
  ) {
    return error.message
  }

  return fallback
}
