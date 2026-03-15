import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getOverrideTabIds,
} from '@/lib/access-control/overrides'
import {
  hasAnyDiscordRole,
} from '@/lib/access-control/roles'
import type {
  ActiveMemberAccessOverride,
  MemberAccessHealthWarning,
  MemberTabDecision,
  MembershipTier,
  RequiredTier,
  TabConfigRecord,
} from '@/lib/access-control/types'

const TIER_LEVELS: Record<MembershipTier, number> = {
  core: 1,
  pro: 2,
  executive: 3,
}

export async function fetchActiveTabConfigurations(
  supabase: SupabaseClient,
): Promise<TabConfigRecord[]> {
  const { data, error } = await supabase
    .from('tab_configurations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !Array.isArray(data)) {
    return []
  }

  const normalizedTabs: TabConfigRecord[] = []

  for (const row of data) {
    const tabId = typeof row?.tab_id === 'string' ? row.tab_id.trim() : ''
    if (!tabId) continue

    normalizedTabs.push({
      id: String(row?.id ?? tabId),
      tab_id: tabId,
      label: typeof row?.label === 'string' && row.label.trim().length > 0
        ? row.label.trim()
        : tabId,
      icon: typeof row?.icon === 'string' ? row.icon : 'LayoutDashboard',
      path: typeof row?.path === 'string' ? row.path : `/members/${tabId}`,
      required_tier: (typeof row?.required_tier === 'string'
        ? row.required_tier
        : 'core') as RequiredTier,
      badge_text: typeof row?.badge_text === 'string' ? row.badge_text : null,
      badge_variant: (
        row?.badge_variant === 'emerald'
        || row?.badge_variant === 'champagne'
        || row?.badge_variant === 'destructive'
      )
        ? row.badge_variant
        : null,
      description: typeof row?.description === 'string' ? row.description : null,
      mobile_visible: row?.mobile_visible !== false,
      sort_order: Number(row?.sort_order || 0),
      is_required: row?.is_required === true,
      is_active: row?.is_active !== false,
      required_discord_role_ids: Array.isArray(row?.required_discord_role_ids)
        ? row.required_discord_role_ids.map((roleId: unknown) => String(roleId).trim()).filter(Boolean)
        : [],
    })
  }

  return normalizedTabs
}

function buildReasonMessage(reasonCode: string, label: string): string {
  switch (reasonCode) {
    case 'override_suspended':
      return 'Access is suspended by an active override.'
    case 'override_denied_tab':
      return `Access to ${label} is denied by an active override.`
    case 'override_allowed_tab':
      return `Access to ${label} is granted by an active override.`
    case 'temporary_admin':
      return 'Allowed because the member has active admin access.'
    case 'admin_role':
      return 'Allowed because the member holds an admin or privileged Discord role.'
    case 'admin_only':
      return 'Denied because this tab is reserved for admins.'
    case 'members_gate_denied':
      return 'Denied because the member does not satisfy the members-area role policy.'
    case 'tier_requirement_failed':
      return `Denied because the member tier is below the requirement for ${label}.`
    case 'role_gate_failed':
      return `Denied because the member is missing the Discord role gate for ${label}.`
    default:
      return `Allowed because the member meets the access requirements for ${label}.`
  }
}

export function evaluateTabAccess(params: {
  tabs: TabConfigRecord[]
  resolvedTier: MembershipTier | null
  roleIds: string[]
  roleTitlesById: Record<string, string>
  isAdmin: boolean
  hasMembersAccess: boolean
  activeOverrides: ActiveMemberAccessOverride[]
}): {
  allowedTabs: string[]
  tabDecisions: MemberTabDecision[]
  warnings: MemberAccessHealthWarning[]
} {
  const {
    tabs,
    resolvedTier,
    roleIds,
    roleTitlesById,
    isAdmin,
    hasMembersAccess,
    activeOverrides,
  } = params

  const warnings: MemberAccessHealthWarning[] = []
  if (tabs.length === 0) {
    warnings.push({
      code: 'missing_tab_configuration',
      severity: 'critical',
      message: 'No active tab configuration exists. Access is intentionally degraded until tabs are configured.',
    })
  }

  const suspended = activeOverrides.some((override) => override.overrideType === 'suspend_members_access')
  const temporaryAdmin = activeOverrides.some((override) => override.overrideType === 'temporary_admin')
  const allowSpecificTabs = new Set(
    activeOverrides
      .filter((override) => override.overrideType === 'allow_specific_tabs')
      .flatMap(getOverrideTabIds),
  )
  const denySpecificTabs = new Set(
    activeOverrides
      .filter((override) => override.overrideType === 'deny_specific_tabs')
      .flatMap(getOverrideTabIds),
  )

  const effectiveAdmin = isAdmin || temporaryAdmin
  const userTierLevel = resolvedTier ? TIER_LEVELS[resolvedTier] : 0
  const allowedTabs: string[] = []
  const tabDecisions: MemberTabDecision[] = []

  for (const tab of tabs) {
    let allowed = false
    let reasonCode = 'allowed'
    let overrideApplied: ActiveMemberAccessOverride['overrideType'] | null = null

    if (suspended) {
      reasonCode = 'override_suspended'
    } else if (denySpecificTabs.has(tab.tab_id)) {
      reasonCode = 'override_denied_tab'
      overrideApplied = 'deny_specific_tabs'
    } else if (allowSpecificTabs.has(tab.tab_id)) {
      allowed = true
      reasonCode = 'override_allowed_tab'
      overrideApplied = 'allow_specific_tabs'
    } else if (effectiveAdmin) {
      allowed = true
      reasonCode = temporaryAdmin ? 'temporary_admin' : 'admin_role'
      overrideApplied = temporaryAdmin ? 'temporary_admin' : null
    } else if (!hasMembersAccess) {
      reasonCode = 'members_gate_denied'
    } else if (tab.required_tier === 'admin') {
      reasonCode = 'admin_only'
    } else {
      const requiredTierLevel = TIER_LEVELS[tab.required_tier as MembershipTier] || 0
      if (!tab.is_required && userTierLevel < requiredTierLevel) {
        reasonCode = 'tier_requirement_failed'
      } else if (
        tab.required_discord_role_ids.length > 0
        && !hasAnyDiscordRole(roleIds, tab.required_discord_role_ids)
      ) {
        reasonCode = 'role_gate_failed'
      } else {
        allowed = true
      }
    }

    if (allowed) {
      allowedTabs.push(tab.tab_id)
    }

    tabDecisions.push({
      tabId: tab.tab_id,
      label: tab.label,
      path: tab.path,
      requiredTier: tab.required_tier,
      requiredRoleIds: tab.required_discord_role_ids,
      requiredRoleNames: tab.required_discord_role_ids.map(
        (roleId) => roleTitlesById[roleId] || `Unknown role (${roleId})`,
      ),
      isRequired: tab.is_required,
      mobileVisible: tab.mobile_visible,
      allowed,
      reasonCode,
      reason: buildReasonMessage(reasonCode, tab.label),
      overrideApplied,
    })
  }

  return {
    allowedTabs,
    tabDecisions,
    warnings,
  }
}
