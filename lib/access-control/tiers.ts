import type { SupabaseClient } from '@supabase/supabase-js'
import type { MembershipTier, PricingTierRecord } from '@/lib/access-control/types'

export function normalizeMembershipTier(value: unknown): MembershipTier | null {
  if (value === 'core' || value === 'pro' || value === 'executive') {
    return value
  }

  if (value === 'execute') {
    return 'executive'
  }

  return null
}

export async function fetchPricingTiers(
  supabase: SupabaseClient,
): Promise<PricingTierRecord[]> {
  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('id, name, discord_role_id, is_active, display_order')
    .order('display_order', { ascending: true })

  if (error || !Array.isArray(data)) {
    return []
  }

  return data
    .map((row) => {
      const id = normalizeMembershipTier(row?.id)
      if (!id) return null

      return {
        id,
        name: typeof row?.name === 'string' && row.name.trim().length > 0
          ? row.name.trim()
          : id,
        discordRoleId: typeof row?.discord_role_id === 'string' && row.discord_role_id.trim().length > 0
          ? row.discord_role_id.trim()
          : null,
        isActive: row?.is_active !== false,
        displayOrder: Number(row?.display_order || 0),
      } satisfies PricingTierRecord
    })
    .filter((row): row is PricingTierRecord => row !== null)
}

export function buildRoleTierMapping(
  pricingTiers: PricingTierRecord[],
): Record<string, MembershipTier> {
  const mapping: Record<string, MembershipTier> = {}

  for (const tier of pricingTiers) {
    if (!tier.discordRoleId) continue
    mapping[tier.discordRoleId] = tier.id
  }

  return mapping
}

export function resolveTierFromRoleIds(
  roleIds: string[],
  roleTierMapping: Record<string, MembershipTier>,
): MembershipTier | null {
  const tiers = new Set<MembershipTier>()

  for (const roleId of roleIds) {
    const tier = roleTierMapping[roleId]
    if (tier) {
      tiers.add(tier)
    }
  }

  if (tiers.has('executive')) return 'executive'
  if (tiers.has('pro')) return 'pro'
  if (tiers.has('core')) return 'core'

  return null
}
