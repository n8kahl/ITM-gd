import type { MembershipTier, RoleTierMapping } from '@/lib/role-tier-mapping'

// Baseline permission presets used when explicit discord_role_permissions mappings
// are missing for tier-mapped Discord roles.
const TIER_PERMISSION_PRESETS: Record<MembershipTier, readonly string[]> = {
  core: [
    'access_core_content',
    'access_trading_journal',
    'access_course_library',
    'access_live_alerts',
  ],
  pro: [
    'access_core_content',
    'access_pro_content',
    'access_trading_journal',
    'access_ai_analysis',
    'access_course_library',
    'access_live_alerts',
    'access_position_builder',
    'access_community_chat',
  ],
  executive: [
    'access_core_content',
    'access_pro_content',
    'access_executive_content',
    'access_trading_journal',
    'access_ai_analysis',
    'access_course_library',
    'access_live_alerts',
    'access_position_builder',
    'access_market_structure',
    'access_premium_tools',
    'access_community_chat',
  ],
}

export function buildTierPermissionNameAssignments(params: {
  roleIds: string[]
  roleTierMapping: RoleTierMapping
}): Map<string, string> {
  const { roleIds, roleTierMapping } = params

  const assignments = new Map<string, string>()
  const normalizedRoleIds = Array.from(new Set(roleIds.map((roleId) => String(roleId).trim()).filter(Boolean)))

  for (const roleId of normalizedRoleIds) {
    const tier = roleTierMapping[roleId]
    if (!tier) continue

    const tierPermissions = TIER_PERMISSION_PRESETS[tier] || []
    for (const permissionName of tierPermissions) {
      if (!assignments.has(permissionName)) {
        assignments.set(permissionName, roleId)
      }
    }
  }

  return assignments
}
