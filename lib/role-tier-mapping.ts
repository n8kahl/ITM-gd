import type { SupabaseClient } from '@supabase/supabase-js'

export type MembershipTier = 'core' | 'pro' | 'executive'

export type RoleTierMapping = Record<string, MembershipTier>

function normalizeTier(value: unknown): MembershipTier | null {
  if (value === 'core' || value === 'pro' || value === 'executive') {
    return value
  }

  if (value === 'execute') {
    return 'executive'
  }

  return null
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

function parseRoleTierMappingFromPricingTiers(rows: unknown[]): RoleTierMapping {
  const mapping: RoleTierMapping = {}

  for (const row of rows) {
    const tierId = normalizeTier((row as any)?.id)
    const roleId = typeof (row as any)?.discord_role_id === 'string'
      ? String((row as any).discord_role_id).trim()
      : ''

    if (!tierId || !roleId) continue
    mapping[roleId] = tierId
  }

  return mapping
}

export async function fetchRoleTierMapping(supabase: SupabaseClient): Promise<RoleTierMapping> {
  // Canonical source: pricing_tiers.discord_role_id
  const { data: pricingRows, error: pricingError } = await supabase
    .from('pricing_tiers')
    .select('id, discord_role_id')
    .not('discord_role_id', 'is', null)

  if (!pricingError && Array.isArray(pricingRows)) {
    const fromPricing = parseRoleTierMappingFromPricingTiers(pricingRows)
    if (Object.keys(fromPricing).length > 0) {
      return fromPricing
    }
  }

  // Backward-compatible fallback: app_settings.role_tier_mapping
  const { data: settingsRow, error: settingsError } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'role_tier_mapping')
    .maybeSingle()

  if (settingsError) {
    return {}
  }

  return parseRoleTierMapping(settingsRow?.value)
}
