import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import {
  hasMembersAreaAccess,
  resolveMembersAllowedRoleIds,
} from '@/lib/discord-role-access'
import { resolveDiscordUserIdFromAuthUser } from '@/lib/discord-user-sync'
import { fetchRoleTierMapping } from '@/lib/role-tier-mapping'
import { buildTierPermissionNameAssignments } from '@/lib/tier-permission-presets'

type MembershipTier = 'core' | 'pro' | 'executive'
type TabTier = MembershipTier | 'admin'
type GapSeverity = 'critical' | 'warning' | 'info'

const STALE_SYNC_HOURS = 24
const DISCORD_CONFIG_SETTING_KEYS = ['discord_guild_id', 'discord_bot_token', 'discord_invite_url'] as const

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function normalizeRoleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.map((id) => String(id).trim()).filter(Boolean)))
}

function resolveTierFromRoles(roleIds: string[], mapping: Record<string, MembershipTier>): MembershipTier | null {
  const found = new Set<MembershipTier>()
  for (const roleId of roleIds) {
    const tier = mapping[roleId]
    if (tier) found.add(tier)
  }
  if (found.has('executive')) return 'executive'
  if (found.has('pro')) return 'pro'
  if (found.has('core')) return 'core'
  return null
}

function extractDiscordRoleIds(user: any): string[] {
  const appMetaRoles = (user?.app_metadata as { discord_roles?: unknown } | undefined)?.discord_roles
  if (Array.isArray(appMetaRoles)) {
    return appMetaRoles.map((id) => String(id)).filter(Boolean)
  }

  const userMetaRoles = (user?.user_metadata as { discord_roles?: unknown } | undefined)?.discord_roles
  if (Array.isArray(userMetaRoles)) {
    return userMetaRoles.map((id) => String(id)).filter(Boolean)
  }

  return []
}

function hasLookupParams(searchParams: URLSearchParams): boolean {
  return Boolean(
    searchParams.get('user_id')?.trim()
    || searchParams.get('email')?.trim()
    || searchParams.get('discord_user_id')?.trim(),
  )
}

function shouldReturnOverview(searchParams: URLSearchParams): boolean {
  const overviewParam = searchParams.get('overview')
  if (overviewParam != null) {
    const normalized = overviewParam.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
    if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  }

  return !hasLookupParams(searchParams)
}

function sortRoleRowsByName<T extends { role_id: string; role_name: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aName = (a.role_name || '').toLowerCase()
    const bName = (b.role_name || '').toLowerCase()
    if (aName !== bName) return aName.localeCompare(bName)
    return a.role_id.localeCompare(b.role_id)
  })
}

function roleDisplayLabel(roleId: string, roleTitlesById: Record<string, string>): string {
  const roleName = roleTitlesById[roleId]
  if (roleName && roleName.trim().length > 0) return roleName
  return `Unknown role (${roleId})`
}

async function resolveTargetUserId(
  searchParams: URLSearchParams,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ userId: string | null; resolution: Record<string, unknown> }> {
  const userIdParam = searchParams.get('user_id')?.trim() || null
  const discordUserIdParam = searchParams.get('discord_user_id')?.trim() || null
  const emailParam = searchParams.get('email')?.trim().toLowerCase() || null

  if (userIdParam) {
    return { userId: userIdParam, resolution: { mode: 'user_id', value: userIdParam } }
  }

  if (discordUserIdParam) {
    const { data, error } = await supabaseAdmin
      .from('user_discord_profiles')
      .select('user_id')
      .eq('discord_user_id', discordUserIdParam)
      .maybeSingle()

    if (error) {
      return { userId: null, resolution: { mode: 'discord_user_id', value: discordUserIdParam, error: error.message } }
    }

    if (data?.user_id) {
      return {
        userId: data.user_id,
        resolution: {
          mode: 'discord_user_id',
          value: discordUserIdParam,
          source: 'user_discord_profiles',
        },
      }
    }

    let rpcLookupError: string | null = null
    try {
      const { data: rpcUserId, error: rpcError } = await supabaseAdmin.rpc('find_user_id_by_discord_user_id', {
        target_discord_user_id: discordUserIdParam,
      })

      if (!rpcError && typeof rpcUserId === 'string' && rpcUserId.trim().length > 0) {
        return {
          userId: rpcUserId,
          resolution: {
            mode: 'discord_user_id',
            value: discordUserIdParam,
            source: 'auth_lookup_rpc',
          },
        }
      }

      if (rpcError) {
        rpcLookupError = rpcError.message
      }
    } catch (rpcErr) {
      rpcLookupError = rpcErr instanceof Error ? rpcErr.message : 'rpc_lookup_failed'
    }

    // Fallback: resolve directly from auth metadata/identities when profile rows are missing.
    const perPage = 200
    const maxPages = 10
    for (let page = 1; page <= maxPages; page++) {
      const { data: usersResult, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (listError) {
        return {
          userId: null,
          resolution: {
            mode: 'discord_user_id',
            value: discordUserIdParam,
            source: 'auth_users_scan',
            error: listError.message,
            rpc_lookup_error: rpcLookupError,
          },
        }
      }

      const users = usersResult?.users || []
      const match = users.find((user) => resolveDiscordUserIdFromAuthUser(user) === discordUserIdParam)
      if (match) {
        return {
          userId: match.id,
          resolution: {
            mode: 'discord_user_id',
            value: discordUserIdParam,
            source: 'auth_metadata',
            scanned_pages: page,
            rpc_lookup_error: rpcLookupError,
          },
        }
      }

      if (users.length < perPage) break
    }

    return {
      userId: null,
      resolution: {
        mode: 'discord_user_id',
        value: discordUserIdParam,
        source: 'auth_users_scan',
        error: 'not_found',
        rpc_lookup_error: rpcLookupError,
      },
    }
  }

  if (emailParam) {
    // Supabase Admin APIs don’t support server-side filtering by email directly; iterate a few pages.
    const perPage = 200
    const maxPages = 10
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) {
        return { userId: null, resolution: { mode: 'email', value: emailParam, error: error.message } }
      }

      const users = data?.users || []
      const match = users.find((u) => String(u.email || '').toLowerCase() === emailParam)
      if (match) {
        return { userId: match.id, resolution: { mode: 'email', value: emailParam, scanned_pages: page } }
      }

      if (users.length < perPage) break
    }

    return { userId: null, resolution: { mode: 'email', value: emailParam, error: 'not_found' } }
  }

  return { userId: null, resolution: { mode: 'missing' } }
}

async function fetchAccessOverview(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  const generatedAt = new Date().toISOString()
  const staleBeforeIso = new Date(Date.now() - (STALE_SYNC_HOURS * 60 * 60 * 1000)).toISOString()
  const membersAllowedRoleIds = await resolveMembersAllowedRoleIds({
    supabase: supabaseAdmin,
    useCache: false,
    forceRefresh: true,
  })

  const membersMatchingPromise = membersAllowedRoleIds.length > 0
    ? supabaseAdmin
      .from('user_discord_profiles')
      .select('id', { count: 'exact', head: true })
      .overlaps('discord_roles', membersAllowedRoleIds)
    : Promise.resolve({ data: null, error: null, count: 0 } as any)

  const [
    roleTierMapping,
    settingsResult,
    rolePermissionsResult,
    tabConfigsResult,
    appPermissionsResult,
    pricingTiersResult,
    totalProfilesResult,
    staleProfilesCountResult,
    staleProfilesRowsResult,
    membersMatchingResult,
    permissionGrantCountResult,
    guildRoleCatalogCountResult,
    latestGuildRoleSyncResult,
  ] = await Promise.all([
    fetchRoleTierMapping(supabaseAdmin as any),
    supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', [...DISCORD_CONFIG_SETTING_KEYS, 'members_required_role_ids']),
    supabaseAdmin
      .from('discord_role_permissions')
      .select(`
        discord_role_id,
        discord_role_name,
        app_permissions (
          name
        )
      `),
    supabaseAdmin
      .from('tab_configurations')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('app_permissions')
      .select('name')
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('pricing_tiers')
      .select('id, name, discord_role_id, is_active')
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('user_discord_profiles')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('user_discord_profiles')
      .select('id', { count: 'exact', head: true })
      .lt('last_synced_at', staleBeforeIso),
    supabaseAdmin
      .from('user_discord_profiles')
      .select('user_id, discord_user_id, discord_username, last_synced_at')
      .lt('last_synced_at', staleBeforeIso)
      .order('last_synced_at', { ascending: true })
      .limit(10),
    membersMatchingPromise,
    supabaseAdmin
      .from('user_permissions')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('discord_guild_roles')
      .select('discord_role_id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('discord_guild_roles')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const queryErrors: string[] = []
  const captureQueryError = (label: string, error: any) => {
    if (error && typeof error.message === 'string') {
      queryErrors.push(`${label}: ${error.message}`)
    }
  }

  captureQueryError('app_settings', settingsResult.error)
  captureQueryError('discord_role_permissions', rolePermissionsResult.error)
  captureQueryError('tab_configurations', tabConfigsResult.error)
  captureQueryError('app_permissions', appPermissionsResult.error)
  captureQueryError('pricing_tiers', pricingTiersResult.error)
  captureQueryError('user_discord_profiles.total_count', totalProfilesResult.error)
  captureQueryError('user_discord_profiles.stale_count', staleProfilesCountResult.error)
  captureQueryError('user_discord_profiles.stale_rows', staleProfilesRowsResult.error)
  captureQueryError('user_discord_profiles.members_matching', (membersMatchingResult as any)?.error)
  captureQueryError('user_permissions.total_count', permissionGrantCountResult.error)
  captureQueryError('discord_guild_roles.total_count', guildRoleCatalogCountResult.error)
  captureQueryError('discord_guild_roles.latest_sync', latestGuildRoleSyncResult.error)

  const settingsByKey = new Map<string, string>()
  for (const row of Array.isArray(settingsResult.data) ? settingsResult.data : []) {
    const key = typeof (row as any)?.key === 'string' ? (row as any).key : ''
    if (!key) continue
    settingsByKey.set(key, String((row as any)?.value || '').trim())
  }

  const discordGuildId = settingsByKey.get('discord_guild_id') || ''
  const discordBotToken = settingsByKey.get('discord_bot_token') || ''
  const discordInviteUrl = settingsByKey.get('discord_invite_url') || ''

  const roleTitlesById: Record<string, string> = {}
  const rolePermissionMap = new Map<string, { roleName: string | null; permissionNames: Set<string> }>()
  const mappedPermissionNames = new Set<string>()

  for (const row of Array.isArray(rolePermissionsResult.data) ? rolePermissionsResult.data : []) {
    const roleId = typeof (row as any)?.discord_role_id === 'string'
      ? String((row as any).discord_role_id).trim()
      : ''
    if (!roleId) continue

    const roleName = typeof (row as any)?.discord_role_name === 'string'
      ? String((row as any).discord_role_name).trim()
      : ''
    if (roleName && !roleTitlesById[roleId]) {
      roleTitlesById[roleId] = roleName
    }

    const permissionName = typeof (row as any)?.app_permissions?.name === 'string'
      ? String((row as any).app_permissions.name).trim()
      : ''

    if (!rolePermissionMap.has(roleId)) {
      rolePermissionMap.set(roleId, {
        roleName: roleName || null,
        permissionNames: new Set<string>(),
      })
    }
    const entry = rolePermissionMap.get(roleId)!
    if (!entry.roleName && roleName) {
      entry.roleName = roleName
    }
    if (permissionName) {
      entry.permissionNames.add(permissionName)
      mappedPermissionNames.add(permissionName)
    }
  }

  const tabRows = Array.isArray(tabConfigsResult.data) ? tabConfigsResult.data : []
  const activeTabs = tabRows
    .map((tab: any) => ({
      tab_id: String(tab?.tab_id || '').trim(),
      label: String(tab?.label || '').trim(),
      path: String(tab?.path || '').trim(),
      required_tier: String(tab?.required_tier || 'core') as TabTier,
      required_role_ids: normalizeRoleIds(tab?.required_discord_role_ids),
      is_required: tab?.is_required === true,
      mobile_visible: tab?.mobile_visible !== false,
      sort_order: Number(tab?.sort_order || 0),
    }))
    .filter((tab) => tab.tab_id.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order)

  const tierMappedRoleIds = Object.keys(roleTierMapping)
  const permissionMappedRoleIds = Array.from(rolePermissionMap.keys())
  const tabRequiredRoleIds = Array.from(new Set(activeTabs.flatMap((tab) => tab.required_role_ids)))

  const relevantRoleIds = Array.from(new Set([
    ...membersAllowedRoleIds,
    ...tierMappedRoleIds,
    ...permissionMappedRoleIds,
    ...tabRequiredRoleIds,
  ]))

  let guildRoleCatalogError: string | null = null
  if (relevantRoleIds.length > 0) {
    const { data: guildRoleRows, error } = await supabaseAdmin
      .from('discord_guild_roles')
      .select('discord_role_id, discord_role_name')
      .in('discord_role_id', relevantRoleIds)

    if (error) {
      guildRoleCatalogError = error.message
    } else {
      for (const row of Array.isArray(guildRoleRows) ? guildRoleRows : []) {
        const roleId = typeof (row as any)?.discord_role_id === 'string'
          ? String((row as any).discord_role_id).trim()
          : ''
        const roleName = typeof (row as any)?.discord_role_name === 'string'
          ? String((row as any).discord_role_name).trim()
          : ''
        if (!roleId || !roleName) continue
        if (!roleTitlesById[roleId]) {
          roleTitlesById[roleId] = roleName
        }
      }
    }
  }

  const membersAllowedRoles = membersAllowedRoleIds.map((roleId) => ({
    role_id: roleId,
    role_name: roleTitlesById[roleId] || null,
    is_known: Boolean(roleTitlesById[roleId]),
  }))

  const rolePermissionMappings = sortRoleRowsByName(
    Array.from(rolePermissionMap.entries()).map(([roleId, entry]) => ({
      role_id: roleId,
      role_name: roleTitlesById[roleId] || entry.roleName || null,
      tier: roleTierMapping[roleId] || null,
      permission_names: Array.from(entry.permissionNames).sort(),
    })),
  )

  const roleTierMappings = sortRoleRowsByName(
    Object.entries(roleTierMapping).map(([roleId, tier]) => ({
      role_id: roleId,
      role_name: roleTitlesById[roleId] || null,
      tier,
      has_permission_mapping: rolePermissionMap.has(roleId),
    })),
  )

  const tabSummaries = activeTabs.map((tab) => {
    const requiredRoles = tab.required_role_ids.map((roleId) => ({
      role_id: roleId,
      role_name: roleTitlesById[roleId] || null,
      is_known: Boolean(roleTitlesById[roleId]),
    }))
    const unknownRequiredRoleIds = requiredRoles
      .filter((role) => !role.is_known)
      .map((role) => role.role_id)

    return {
      ...tab,
      required_roles: requiredRoles,
      unknown_required_role_ids: unknownRequiredRoleIds,
    }
  })

  const appPermissionNames = Array.isArray(appPermissionsResult.data)
    ? appPermissionsResult.data
      .map((row: any) => (typeof row?.name === 'string' ? row.name.trim() : ''))
      .filter(Boolean)
      .sort()
    : []

  const tierFallbackAssignments = buildTierPermissionNameAssignments({
    roleIds: tierMappedRoleIds,
    roleTierMapping,
  })
  const expectedPermissionNames = new Set<string>([
    ...Array.from(mappedPermissionNames),
    ...Array.from(tierFallbackAssignments.keys()),
  ])
  const unmappedAppPermissions = appPermissionNames
    .filter((permissionName) => !expectedPermissionNames.has(permissionName))
    .sort()

  const rolesMissingTierMapping = sortRoleRowsByName(
    rolePermissionMappings
      .filter((row) => !row.tier)
      .map((row) => ({
        role_id: row.role_id,
        role_name: row.role_name,
      })),
  )

  const tierMappedRolesWithoutPermissionMapping = sortRoleRowsByName(
    roleTierMappings
      .filter((row) => !row.has_permission_mapping)
      .map((row) => ({
        role_id: row.role_id,
        role_name: row.role_name,
        tier: row.tier,
      })),
  )

  const tabsWithUnknownRoleIds = tabSummaries
    .filter((tab) => tab.unknown_required_role_ids.length > 0)
    .map((tab) => ({
      tab_id: tab.tab_id,
      label: tab.label || tab.tab_id,
      unknown_role_ids: tab.unknown_required_role_ids,
    }))

  const pricingTiers = Array.isArray(pricingTiersResult.data)
    ? pricingTiersResult.data.map((row: any) => {
      const tierId = String(row?.id || '').trim()
      const discordRoleId = typeof row?.discord_role_id === 'string'
        ? String(row.discord_role_id).trim()
        : ''
      return {
        tier_id: tierId,
        tier_name: String(row?.name || tierId).trim(),
        is_active: row?.is_active !== false,
        discord_role_id: discordRoleId || null,
        discord_role_name: discordRoleId ? (roleTitlesById[discordRoleId] || null) : null,
      }
    })
    : []

  const staleProfiles = Array.isArray(staleProfilesRowsResult.data)
    ? staleProfilesRowsResult.data.map((row: any) => ({
      user_id: String(row?.user_id || ''),
      discord_user_id: typeof row?.discord_user_id === 'string' ? row.discord_user_id : null,
      discord_username: typeof row?.discord_username === 'string' ? row.discord_username : null,
      last_synced_at: typeof row?.last_synced_at === 'string' ? row.last_synced_at : null,
    }))
    : []

  const membersAllowedRoleTitlesById: Record<string, string> = {}
  for (const role of membersAllowedRoles) {
    if (role.role_name) {
      membersAllowedRoleTitlesById[role.role_id] = role.role_name
    }
  }

  const totalProfileCount = totalProfilesResult.count ?? 0
  const staleProfileCount = staleProfilesCountResult.count ?? 0
  const membersMatchingProfileCount = (membersMatchingResult as any)?.count ?? 0
  const permissionGrantCount = permissionGrantCountResult.count ?? 0
  const guildRoleCatalogCount = guildRoleCatalogCountResult.count ?? 0
  const latestGuildRoleSyncAt = typeof latestGuildRoleSyncResult.data?.last_synced_at === 'string'
    ? latestGuildRoleSyncResult.data.last_synced_at
    : null

  const gaps: Array<{
    id: string
    severity: GapSeverity
    title: string
    description: string
    count: number
    items: string[]
  }> = []

  if (!discordGuildId || !discordBotToken) {
    gaps.push({
      id: 'discord-config-missing',
      severity: 'critical',
      title: 'Discord bot configuration is incomplete',
      description: 'Role sync and member access claims cannot update until guild and bot token settings are configured.',
      count: 2 - Number(Boolean(discordGuildId)) - Number(Boolean(discordBotToken)),
      items: [
        !discordGuildId ? 'Missing app setting: discord_guild_id' : null,
        !discordBotToken ? 'Missing app setting: discord_bot_token' : null,
      ].filter((item): item is string => item !== null),
    })
  }

  const unknownMembersGateRoles = membersAllowedRoles.filter((role) => !role.is_known)
  if (unknownMembersGateRoles.length > 0) {
    gaps.push({
      id: 'members-gate-unknown-roles',
      severity: 'warning',
      title: 'Members gate references unknown Discord roles',
      description: 'These role IDs are configured for members access but are missing from the guild role catalog.',
      count: unknownMembersGateRoles.length,
      items: unknownMembersGateRoles.map((role) => role.role_id),
    })
  }

  if (staleProfileCount > 0) {
    gaps.push({
      id: 'stale-discord-sync',
      severity: 'warning',
      title: 'Discord profile sync is stale for active members',
      description: `Profiles older than ${STALE_SYNC_HOURS}h can cause stale claims and incorrect tab visibility.`,
      count: staleProfileCount,
      items: staleProfiles
        .filter((row) => row.user_id.length > 0)
        .map((row) => `${row.discord_username || row.user_id} (${row.user_id})`),
    })
  }

  if (rolesMissingTierMapping.length > 0) {
    gaps.push({
      id: 'roles-missing-tier-mapping',
      severity: 'warning',
      title: 'Permission roles missing tier mapping',
      description: 'Roles with permissions but no membership tier can cause inconsistent tab and entitlement behavior.',
      count: rolesMissingTierMapping.length,
      items: rolesMissingTierMapping.map((row) => roleDisplayLabel(row.role_id, roleTitlesById)),
    })
  }

  if (tierMappedRolesWithoutPermissionMapping.length > 0) {
    gaps.push({
      id: 'tier-roles-without-permissions',
      severity: 'info',
      title: 'Tier-mapped roles rely on fallback permission presets',
      description: 'These roles have tier mappings but no explicit app permission rows in role mappings.',
      count: tierMappedRolesWithoutPermissionMapping.length,
      items: tierMappedRolesWithoutPermissionMapping.map((row) => roleDisplayLabel(row.role_id, roleTitlesById)),
    })
  }

  if (tabsWithUnknownRoleIds.length > 0) {
    gaps.push({
      id: 'tabs-unknown-role-ids',
      severity: 'warning',
      title: 'Tabs require unknown Discord role IDs',
      description: 'Unknown role IDs in tab configuration can silently block intended users.',
      count: tabsWithUnknownRoleIds.length,
      items: tabsWithUnknownRoleIds.map((tab) => `${tab.label} (${tab.tab_id})`),
    })
  }

  if (unmappedAppPermissions.length > 0) {
    gaps.push({
      id: 'permissions-without-any-assignment',
      severity: 'info',
      title: 'App permissions are not reachable from any role mapping',
      description: 'These permissions are defined but are not assigned via explicit role mappings or tier fallback presets.',
      count: unmappedAppPermissions.length,
      items: unmappedAppPermissions,
    })
  }

  if (queryErrors.length > 0) {
    gaps.push({
      id: 'diagnostic-query-errors',
      severity: 'warning',
      title: 'Some diagnostics could not be computed',
      description: 'One or more read queries failed; overview data may be incomplete.',
      count: queryErrors.length,
      items: queryErrors,
    })
  }

  return {
    success: true,
    mode: 'overview',
    constants: {
      members_allowed_role_ids: membersAllowedRoleIds,
      members_allowed_role_titles_by_id: membersAllowedRoleTitlesById,
    },
    overview: {
      generated_at: generatedAt,
      intended_use: {
        summary: 'Control members-area access across Discord membership gate, role-permission mappings, tier mappings, and tab visibility.',
        controls: [
          'Configure allowed member gate roles',
          'Map Discord roles to app permissions',
          'Map Discord roles to membership tiers',
          'Review tab-level tier and role requirements',
          'Monitor sync staleness and role catalog health',
        ],
      },
      thresholds: {
        stale_sync_hours: STALE_SYNC_HOURS,
        stale_before: staleBeforeIso,
      },
      counts: {
        members_gate_role_count: membersAllowedRoleIds.length,
        active_tab_count: tabSummaries.length,
        tab_role_gate_count: tabSummaries.filter((tab) => tab.required_role_ids.length > 0).length,
        role_permission_mapping_count: rolePermissionMappings.length,
        tier_mapped_role_count: roleTierMappings.length,
        app_permission_count: appPermissionNames.length,
        user_permission_grant_count: permissionGrantCount,
        discord_profile_count: totalProfileCount,
        stale_discord_profile_count: staleProfileCount,
        members_gate_profile_match_count: membersMatchingProfileCount,
      },
      discord: {
        guild_id_configured: discordGuildId.length > 0,
        bot_token_configured: discordBotToken.length > 0,
        invite_url_configured: discordInviteUrl.length > 0,
        guild_role_catalog_count: guildRoleCatalogCount,
        guild_role_catalog_last_synced_at: latestGuildRoleSyncAt,
        guild_role_catalog_error: guildRoleCatalogError,
      },
      members_gate: {
        roles: membersAllowedRoles,
        matching_profile_count: membersMatchingProfileCount,
      },
      tiers: {
        pricing_tiers: pricingTiers,
        role_tier_mapping: roleTierMappings,
        roles_missing_tier_mapping: rolesMissingTierMapping,
        tier_mapped_roles_without_permission_mapping: tierMappedRolesWithoutPermissionMapping,
      },
      permissions: {
        role_mappings: rolePermissionMappings,
        tier_fallback_permission_names: Array.from(tierFallbackAssignments.keys()).sort(),
        unmapped_app_permissions: unmappedAppPermissions,
      },
      tabs: {
        active: tabSummaries,
        tabs_with_unknown_role_ids: tabsWithUnknownRoleIds,
      },
      sync: {
        stale_profile_count: staleProfileCount,
        total_profile_count: totalProfileCount,
        stale_profiles: staleProfiles,
      },
      diagnostics: {
        query_errors: queryErrors,
      },
      gaps,
    },
  }
}

/**
 * GET /api/admin/members/access
 * Admin-only member access diagnostics.
 *
 * Query params:
 * - overview=1 (default when no lookup params are supplied)
 * - user_id (preferred for user-level diagnostics)
 * - email
 * - discord_user_id
 */
export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    if (shouldReturnOverview(searchParams)) {
      return NextResponse.json(await fetchAccessOverview(supabaseAdmin))
    }

    const { userId, resolution } = await resolveTargetUserId(searchParams, supabaseAdmin)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User not found', resolution },
        { status: 404 },
      )
    }

    if (!isUuid(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user_id format', resolution },
        { status: 400 },
      )
    }

    const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authUserError || !authUserResult?.user) {
      return NextResponse.json(
        { success: false, error: authUserError?.message || 'Failed to load auth user', resolution },
        { status: 500 },
      )
    }

    const authUser = authUserResult.user
    const discordUserIdFromAuth = resolveDiscordUserIdFromAuthUser(authUser)
    const rolesFromJwt = extractDiscordRoleIds(authUser)
    const membersAllowedRoleIds = await resolveMembersAllowedRoleIds({ supabase: supabaseAdmin, forceRefresh: true })

    const [{ data: discordProfile }, { data: userPermissions }, { data: tabConfigs }, roleTierMapping] = await Promise.all([
      supabaseAdmin
        .from('user_discord_profiles')
        .select('discord_user_id, discord_username, discord_avatar, discord_roles, last_synced_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('user_permissions')
        .select(`
          permission_id,
          granted_by_role_id,
          granted_by_role_name,
          expires_at,
          app_permissions (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId),
      supabaseAdmin
        .from('tab_configurations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      fetchRoleTierMapping(supabaseAdmin as any),
    ])

    const rolesFromProfile = Array.isArray(discordProfile?.discord_roles)
      ? discordProfile.discord_roles.map((id: unknown) => String(id)).filter(Boolean)
      : []

    const hasCachedDiscordProfile = !!discordProfile
    const effectiveRoleIds = hasCachedDiscordProfile ? rolesFromProfile : rolesFromJwt
    const hasMembersRole = hasMembersAreaAccess(effectiveRoleIds, membersAllowedRoleIds)
    const resolvedTier = resolveTierFromRoles(effectiveRoleIds, roleTierMapping)

    const permissionRows = Array.isArray(userPermissions) ? userPermissions : []
    const permissionNames = permissionRows
      .map((row: any) => row?.app_permissions?.name)
      .filter((name: any) => typeof name === 'string')
    const uniquePermissionNames = Array.from(new Set(permissionNames)).sort()
    const hasAdminDashboardPermission = uniquePermissionNames.includes('admin_dashboard')

    // Expected permissions based on current role → permission mappings
    let expectedPermissionNames: string[] = []
    const roleTitlesById: Record<string, string> = {}
    for (const row of permissionRows) {
      const roleId = typeof row?.granted_by_role_id === 'string' ? row.granted_by_role_id : null
      const roleName = typeof row?.granted_by_role_name === 'string' ? row.granted_by_role_name : null
      if (roleId && roleName && !roleTitlesById[roleId]) {
        roleTitlesById[roleId] = roleName
      }
    }

    const tierFallbackAssignments = buildTierPermissionNameAssignments({
      roleIds: effectiveRoleIds,
      roleTierMapping,
    })

    if (effectiveRoleIds.length > 0) {
      const { data: rolePermissionMappings } = await supabaseAdmin
        .from('discord_role_permissions')
        .select(`
          discord_role_id,
          discord_role_name,
          app_permissions (
            name
          )
        `)
        .in('discord_role_id', effectiveRoleIds)

      const mappingRows = Array.isArray(rolePermissionMappings) ? rolePermissionMappings : []
      expectedPermissionNames = Array.from(new Set(
        mappingRows
          .map((row: any) => row?.app_permissions?.name)
          .filter((name: any) => typeof name === 'string'),
      )).sort()

      for (const row of mappingRows) {
        const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id : null
        const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name : null
        if (roleId && roleName && !roleTitlesById[roleId]) {
          roleTitlesById[roleId] = roleName
        }
      }
    }

    if (tierFallbackAssignments.size > 0) {
      expectedPermissionNames = Array.from(new Set([
        ...expectedPermissionNames,
        ...Array.from(tierFallbackAssignments.keys()),
      ])).sort()
    }

    const expectedMissing = expectedPermissionNames.filter((name) => !uniquePermissionNames.includes(name))
    const unexpectedExtra = uniquePermissionNames.filter((name) => !expectedPermissionNames.includes(name))

    const membersAllowedRoleIdSet = new Set<string>(membersAllowedRoleIds)
    const membersAllowedRoleTitlesById: Record<string, string> = {}
    const roleIdsForCatalog = Array.from(new Set([
      ...effectiveRoleIds,
      ...membersAllowedRoleIds,
    ]))

    let guildRoleCatalogError: string | null = null
    if (roleIdsForCatalog.length > 0) {
      const { data: guildRoleRows, error: guildRoleError } = await supabaseAdmin
        .from('discord_guild_roles')
        .select('discord_role_id, discord_role_name')
        .in('discord_role_id', roleIdsForCatalog)

      if (guildRoleError) {
        guildRoleCatalogError = guildRoleError.message
      }

      for (const row of Array.isArray(guildRoleRows) ? guildRoleRows : []) {
        const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id : null
        const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name : null
        if (!roleId || !roleName) continue

        if (!roleTitlesById[roleId]) {
          roleTitlesById[roleId] = roleName
        }

        if (membersAllowedRoleIdSet.has(roleId) && !membersAllowedRoleTitlesById[roleId]) {
          membersAllowedRoleTitlesById[roleId] = roleName
        }
      }
    }

    if (membersAllowedRoleIds.length > 0) {
      const { data: membersAllowedRoleMappings } = await supabaseAdmin
        .from('discord_role_permissions')
        .select('discord_role_id, discord_role_name')
        .in('discord_role_id', membersAllowedRoleIds)

      for (const row of Array.isArray(membersAllowedRoleMappings) ? membersAllowedRoleMappings : []) {
        const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id : null
        const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name : null
        if (roleId && roleName && !membersAllowedRoleTitlesById[roleId]) {
          membersAllowedRoleTitlesById[roleId] = roleName
        }
      }
    }

    const tierHierarchy: Record<MembershipTier, number> = { core: 1, pro: 2, executive: 3 }
    const userTierLevel = resolvedTier ? tierHierarchy[resolvedTier] : 0
    const userHasAdminAccess = hasAdminDashboardPermission

    const allowedTabDetails = Array.isArray(tabConfigs)
      ? tabConfigs
        .filter((tab: any) => {
          const requiredRoleIds = normalizeRoleIds(tab?.required_discord_role_ids)
          if (!userHasAdminAccess && requiredRoleIds.length > 0) {
            const hasRequiredRole = requiredRoleIds.some((roleId: string) => effectiveRoleIds.includes(roleId))
            if (!hasRequiredRole) return false
          }
          if (tab?.is_required) return true

          const required = String(tab?.required_tier || '') as TabTier
          if (required === 'admin') return userHasAdminAccess
          const requiredLevel = tierHierarchy[required as MembershipTier] || 0
          return userTierLevel >= requiredLevel
        })
        .map((tab: any) => {
          const requiredRoleIds = normalizeRoleIds(tab?.required_discord_role_ids)
          return {
            tab_id: String(tab?.tab_id || ''),
            label: String(tab?.label || tab?.tab_id || ''),
            path: String(tab?.path || ''),
            required_tier: String(tab?.required_tier || 'core'),
            is_required: tab?.is_required === true,
            required_roles: requiredRoleIds.map((roleId) => ({
              role_id: roleId,
              role_name: roleTitlesById[roleId] || null,
            })),
          }
        })
      : []

    const allowedTabs = allowedTabDetails.map((tab) => tab.tab_id)

    return NextResponse.json({
      success: true,
      mode: 'user',
      resolution,
      constants: {
        members_allowed_role_ids: membersAllowedRoleIds,
        members_allowed_role_titles_by_id: membersAllowedRoleTitlesById,
      },
      user: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
      },
      auth_metadata: {
        discord_user_id: discordUserIdFromAuth,
        is_admin_claim: authUser.app_metadata?.is_admin === true,
        is_member_claim: authUser.app_metadata?.is_member === true,
        discord_roles_in_jwt: rolesFromJwt,
      },
      discord_profile: discordProfile ? {
        discord_user_id: discordProfile.discord_user_id,
        discord_username: discordProfile.discord_username,
        discord_avatar: discordProfile.discord_avatar,
        discord_roles: rolesFromProfile,
        last_synced_at: discordProfile.last_synced_at,
      } : null,
      access: {
        effective_role_ids: effectiveRoleIds,
        effective_roles: effectiveRoleIds.map((roleId) => ({
          role_id: roleId,
          role_name: roleTitlesById[roleId] || null,
        })),
        role_titles_by_id: roleTitlesById,
        has_members_required_role: hasMembersRole,
        resolved_tier: resolvedTier,
        allowed_tabs: allowedTabs,
        allowed_tabs_details: allowedTabDetails,
      },
      permissions: {
        current: uniquePermissionNames,
        expected_from_mappings: expectedPermissionNames,
        expected_missing: expectedMissing,
        unexpected_extra: unexpectedExtra,
        has_admin_dashboard_permission: hasAdminDashboardPermission,
      },
      diagnosis: {
        has_discord_user_id: !!discordUserIdFromAuth,
        has_cached_discord_profile: hasCachedDiscordProfile,
        effective_roles_source: hasCachedDiscordProfile
          ? 'user_discord_profiles'
          : (rolesFromJwt.length > 0 ? 'jwt' : 'none'),
        jwt_profile_role_mismatch: hasCachedDiscordProfile
          ? JSON.stringify([...rolesFromJwt].sort()) !== JSON.stringify([...rolesFromProfile].sort())
          : false,
        likely_members_access_issue: !hasMembersRole
          ? 'Missing required members role'
          : null,
        tier_fallback_expected_permissions: Array.from(tierFallbackAssignments.keys()).sort(),
        discord_guild_role_catalog_error: guildRoleCatalogError,
      },
    })
  } catch (error) {
    console.error('[Admin Member Access] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
