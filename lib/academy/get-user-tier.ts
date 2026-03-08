import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRoleTierMapping } from '@/lib/role-tier-mapping'

export const TIER_HIERARCHY: Record<string, number> = { core: 1, pro: 2, executive: 3 }

export function getAccessibleTiers(userTier: string): string[] {
  const level = TIER_HIERARCHY[userTier] || 1
  return Object.entries(TIER_HIERARCHY)
    .filter(([, l]) => l <= level)
    .map(([tier]) => tier)
}

/**
 * Determine a user's membership tier from their Discord roles + app_settings mapping.
 * Falls back to 'core' if anything fails.
 */
export async function getUserTier(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const [profileResult, roleTierMapping] = await Promise.all([
      supabase
        .from('user_discord_profiles')
        .select('discord_roles')
        .eq('user_id', userId)
        .maybeSingle(),
      fetchRoleTierMapping(supabase),
    ])

    const roles: string[] = Array.isArray(profileResult.data?.discord_roles)
      ? profileResult.data.discord_roles.map((roleId: unknown) => String(roleId))
      : []
    if (roles.length === 0) return 'core'

    // Check in order of highest tier first
    const tierOrder: string[] = ['executive', 'pro', 'core']
    for (const tier of tierOrder) {
      for (const [roleId, mappedTier] of Object.entries(roleTierMapping)) {
        if (mappedTier === tier && roles.includes(roleId)) {
          return tier
        }
      }
    }

    return 'core'
  } catch {
    return 'core'
  }
}
