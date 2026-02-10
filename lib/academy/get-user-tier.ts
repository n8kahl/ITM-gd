import type { SupabaseClient } from '@supabase/supabase-js'

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
    const [profileResult, settingsResult] = await Promise.all([
      supabase
        .from('user_discord_profiles')
        .select('discord_roles')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'role_tier_mapping')
        .maybeSingle(),
    ])

    const roles: string[] = profileResult.data?.discord_roles || []
    if (roles.length === 0) return 'core'

    const rawMapping = settingsResult.data?.value
    if (!rawMapping) return 'core'

    const mapping: Record<string, string> =
      typeof rawMapping === 'string' ? JSON.parse(rawMapping) : rawMapping

    // Check in order of highest tier first
    const tierOrder: string[] = ['executive', 'pro', 'core']
    for (const tier of tierOrder) {
      for (const [roleId, mappedTier] of Object.entries(mapping)) {
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
