import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildRoleTierMapping,
  fetchPricingTiers,
  normalizeMembershipTier,
} from '@/lib/access-control/tiers'

export type MembershipTier = 'core' | 'pro' | 'executive'

export type RoleTierMapping = Record<string, MembershipTier>

function normalizeTier(value: unknown): MembershipTier | null {
  return normalizeMembershipTier(value)
}

export function parseRoleTierMapping(rawValue: unknown): RoleTierMapping {
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
      const normalizedRoleId = String(roleId).trim()
      if (normalizedRoleId) {
        mapping[normalizedRoleId] = normalized
      }
    }
  }

  return mapping
}

export async function fetchRoleTierMapping(supabase: SupabaseClient): Promise<RoleTierMapping> {
  const pricingTiers = await fetchPricingTiers(supabase)
  return buildRoleTierMapping(pricingTiers)
}
