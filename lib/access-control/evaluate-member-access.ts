import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadAccessControlSubject,
} from '@/lib/access-control/identity'
import {
  fetchActiveMemberAccessOverrides,
} from '@/lib/access-control/overrides'
import {
  getDefaultAccessControlSettings,
  hasAnyDiscordRole,
  normalizeDiscordRoleIds,
  resolveAccessControlSettings,
  resolveRoleTitlesById,
} from '@/lib/access-control/roles'
import {
  buildRoleTierMapping,
  fetchPricingTiers,
  resolveTierFromRoleIds,
} from '@/lib/access-control/tiers'
import {
  evaluateTabAccess,
  fetchActiveTabConfigurations,
} from '@/lib/access-control/tabs'
import type {
  AccessControlSettings,
  AccessControlSubject,
  ActiveMemberAccessOverride,
  MemberAccessEvaluation,
  MemberAccessHealthWarning,
  PricingTierRecord,
  TabConfigRecord,
} from '@/lib/access-control/types'

type LoadedAccessResources = {
  settings: AccessControlSettings
  pricingTiers: PricingTierRecord[]
  roleTierMapping: Record<string, 'core' | 'pro' | 'executive'>
  tabs: TabConfigRecord[]
  roleTitlesById: Record<string, string>
}

function buildUnknownRoleTitles(
  roleIds: string[],
  roleTitlesById: Record<string, string>,
): Record<string, string> {
  const next = { ...roleTitlesById }
  for (const roleId of roleIds) {
    if (!next[roleId]) {
      next[roleId] = `Unknown role (${roleId})`
    }
  }
  return next
}

function resolveEffectiveRoleIds(subject: AccessControlSubject): {
  roleIds: string[]
  source: MemberAccessEvaluation['sources']['roles']
} {
  if (subject.discordMember?.isInGuild) {
    return {
      roleIds: normalizeDiscordRoleIds(subject.discordMember.discordRoles),
      source: 'discord_guild_members',
    }
  }

  if (subject.linkedProfile) {
    return {
      roleIds: normalizeDiscordRoleIds(subject.linkedProfile.discordRoles),
      source: 'user_discord_profiles',
    }
  }

  return {
    roleIds: [],
    source: 'none',
  }
}

function getIdentitySource(subject: AccessControlSubject): MemberAccessEvaluation['sources']['identity'] {
  if (subject.discordMember) return 'discord_guild_members'
  if (subject.linkedProfile) return 'user_discord_profiles'
  if (subject.linkedAuthUser) return 'auth_user'
  return 'none'
}

function isOlderThanHours(dateString: string | null | undefined, hours: number): boolean {
  if (!dateString) return false
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return false
  return (Date.now() - parsed.getTime()) > (hours * 60 * 60 * 1000)
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return [...left].sort().every((value, index) => value === [...right].sort()[index])
}

export async function loadAccessControlResources(
  supabase: SupabaseClient,
  roleIds: string[],
): Promise<LoadedAccessResources> {
  const [settings, pricingTiers, tabs] = await Promise.all([
    resolveAccessControlSettings(supabase),
    fetchPricingTiers(supabase),
    fetchActiveTabConfigurations(supabase),
  ])

  const roleTierMapping = buildRoleTierMapping(pricingTiers)
  const roleIdsForCatalog = Array.from(new Set([
    ...roleIds,
    ...settings.membersAllowedRoleIds,
    ...settings.privilegedRoleIds,
    ...settings.adminRoleIds,
    ...tabs.flatMap((tab) => tab.required_discord_role_ids),
    ...pricingTiers
      .map((tier) => tier.discordRoleId)
      .filter((roleId): roleId is string => Boolean(roleId)),
  ]))

  const roleTitlesById = await resolveRoleTitlesById(supabase, roleIdsForCatalog)

  return {
    settings: settings || getDefaultAccessControlSettings(),
    pricingTiers,
    roleTierMapping,
    tabs,
    roleTitlesById,
  }
}

export function evaluateMemberAccessFromSubject(params: {
  subject: AccessControlSubject
  resources: LoadedAccessResources
  activeOverrides: ActiveMemberAccessOverride[]
}): MemberAccessEvaluation {
  const { subject, resources, activeOverrides } = params
  const { roleIds, source: roleSource } = resolveEffectiveRoleIds(subject)
  const roleTitlesById = buildUnknownRoleTitles(roleIds, resources.roleTitlesById)

  const suspended = activeOverrides.some((override) => override.overrideType === 'suspend_members_access')
  const allowMembersAccess = activeOverrides.some((override) => override.overrideType === 'allow_members_access')
  const temporaryAdmin = activeOverrides.some((override) => override.overrideType === 'temporary_admin')
  const privilegedByRole = hasAnyDiscordRole(roleIds, resources.settings.privilegedRoleIds)
  const adminByRole = privilegedByRole || hasAnyDiscordRole(roleIds, resources.settings.adminRoleIds)
  const membersByRole = hasAnyDiscordRole(roleIds, resources.settings.membersAllowedRoleIds)

  const resolvedTier = resolveTierFromRoleIds(roleIds, resources.roleTierMapping)
  const isAdmin = !suspended && (temporaryAdmin || adminByRole)
  const hasMembersAccess = !suspended && (allowMembersAccess || isAdmin || membersByRole)

  const tabEvaluation = evaluateTabAccess({
    tabs: resources.tabs,
    resolvedTier,
    roleIds,
    roleTitlesById,
    isAdmin,
    hasMembersAccess,
    activeOverrides,
  })

  const healthWarnings: MemberAccessHealthWarning[] = [...tabEvaluation.warnings]

  if (subject.linkedProfile && !subject.discordMember) {
    healthWarnings.push({
      code: 'missing_guild_member_cache',
      severity: 'warning',
      message: 'Linked member is missing from the canonical guild roster cache.',
    })
  }

  if (
    subject.discordMember
    && subject.linkedProfile
    && !arraysEqual(subject.discordMember.discordRoles, subject.linkedProfile.discordRoles)
  ) {
    healthWarnings.push({
      code: 'role_cache_drift',
      severity: 'warning',
      message: 'Guild roster roles and linked profile roles do not match.',
    })
  }

  const lastSyncedAt = subject.discordMember?.lastSyncedAt || subject.linkedProfile?.lastSyncedAt || null
  if (isOlderThanHours(lastSyncedAt, 24)) {
    healthWarnings.push({
      code: 'stale_sync',
      severity: 'warning',
      message: 'Member access data is stale and should be resynced.',
    })
  }

  if (subject.discordMember?.syncError) {
    healthWarnings.push({
      code: 'guild_sync_error',
      severity: 'warning',
      message: subject.discordMember.syncError,
    })
  }

  const discordUserId = subject.discordMember?.discordUserId || subject.linkedProfile?.discordUserId || null
  const userId = subject.linkedAuthUser?.id || subject.linkedProfile?.userId || subject.discordMember?.linkedUserId || null

  return {
    discordUserId,
    userId,
    email: subject.linkedAuthUser?.email || null,
    username: subject.discordMember?.username || subject.linkedProfile?.discordUsername || null,
    globalName: subject.discordMember?.globalName || null,
    nickname: subject.discordMember?.nickname || null,
    avatar: subject.discordMember?.avatar || subject.linkedProfile?.discordAvatar || null,
    linkStatus: userId && discordUserId
      ? 'linked'
      : discordUserId
        ? 'discord_only'
        : 'site_only',
    isInGuild: subject.discordMember?.isInGuild === true,
    lastSyncedAt,
    effectiveDiscordRoleIds: roleIds,
    roleTitlesById,
    resolvedTier,
    isPrivileged: privilegedByRole,
    isAdmin,
    hasMembersAccess,
    allowedTabs: tabEvaluation.allowedTabs,
    tabDecisions: tabEvaluation.tabDecisions,
    activeOverrides,
    healthWarnings,
    sources: {
      roles: roleSource,
      identity: getIdentitySource(subject),
    },
  }
}

export async function evaluateMemberAccess(
  supabase: SupabaseClient,
  params: {
    userId?: string | null
    discordUserId?: string | null
  },
): Promise<MemberAccessEvaluation> {
  const subject = await loadAccessControlSubject(supabase, params)
  const { roleIds } = resolveEffectiveRoleIds(subject)
  const resources = await loadAccessControlResources(supabase, roleIds)
  const activeOverrides = await fetchActiveMemberAccessOverrides(supabase, {
    userId: subject.linkedAuthUser?.id || subject.linkedProfile?.userId || null,
    discordUserId: subject.discordMember?.discordUserId || subject.linkedProfile?.discordUserId || null,
  })

  return evaluateMemberAccessFromSubject({
    subject,
    resources,
    activeOverrides,
  })
}
