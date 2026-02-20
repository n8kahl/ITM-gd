import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import {
  MEMBERS_ALLOWED_ROLE_IDS,
  hasMembersAreaAccess,
} from '@/lib/discord-role-access'

type MembershipTier = 'core' | 'pro' | 'executive'

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

function parseRoleTierMapping(raw: unknown): Record<string, MembershipTier> {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return {}
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  const result: Record<string, MembershipTier> = {}
  for (const [roleId, tier] of Object.entries(parsed as Record<string, unknown>)) {
    if (tier === 'core' || tier === 'pro' || tier === 'executive') {
      result[String(roleId)] = tier
    }
  }

  return result
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

async function resolveTargetUserId(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ userId: string | null; resolution: Record<string, unknown> }> {
  const { searchParams } = new URL(request.url)
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

    return { userId: data?.user_id ?? null, resolution: { mode: 'discord_user_id', value: discordUserIdParam } }
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

/**
 * GET /api/admin/members/access
 * Admin-only member access debugger.
 *
 * Query params:
 * - user_id (preferred)
 * - email
 * - discord_user_id
 */
export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { userId, resolution } = await resolveTargetUserId(request, supabaseAdmin)
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
    const discordUserIdFromAuth = authUser.user_metadata?.provider_id || authUser.user_metadata?.sub || null
    const rolesFromJwt = extractDiscordRoleIds(authUser)

    const [{ data: discordProfile }, { data: userPermissions }, { data: roleTierSetting }, { data: tabConfigs }] = await Promise.all([
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
        .from('app_settings')
        .select('value')
        .eq('key', 'role_tier_mapping')
        .maybeSingle(),
      supabaseAdmin
        .from('tab_configurations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ])

    const rolesFromProfile = Array.isArray(discordProfile?.discord_roles)
      ? discordProfile!.discord_roles.map((id: unknown) => String(id)).filter(Boolean)
      : []

    const effectiveRoleIds = rolesFromJwt.length > 0 ? rolesFromJwt : rolesFromProfile
    const hasMembersRole = hasMembersAreaAccess(effectiveRoleIds)

    const roleTierMapping = parseRoleTierMapping(roleTierSetting?.value)
    const resolvedTier = resolveTierFromRoles(effectiveRoleIds, roleTierMapping)

    const permissionRows = Array.isArray(userPermissions) ? userPermissions : []
    const permissionNames = permissionRows
      .map((row: any) => row?.app_permissions?.name)
      .filter((name: any) => typeof name === 'string')
    const uniquePermissionNames = Array.from(new Set(permissionNames)).sort()
    const hasAdminPermission = uniquePermissionNames.includes('admin_dashboard')

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
          .filter((name: any) => typeof name === 'string')
      )).sort()

      for (const row of mappingRows) {
        const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id : null
        const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name : null
        if (roleId && roleName && !roleTitlesById[roleId]) {
          roleTitlesById[roleId] = roleName
        }
      }
    }

    const expectedMissing = expectedPermissionNames.filter((name) => !uniquePermissionNames.includes(name))
    const unexpectedExtra = uniquePermissionNames.filter((name) => !expectedPermissionNames.includes(name))

    const membersAllowedRoleIdSet = new Set<string>(MEMBERS_ALLOWED_ROLE_IDS)
    const membersAllowedRoleTitlesById: Record<string, string> = {}
    const roleIdsForCatalog = Array.from(new Set([
      ...effectiveRoleIds,
      ...MEMBERS_ALLOWED_ROLE_IDS,
    ]))

    if (roleIdsForCatalog.length > 0) {
      const { data: guildRoleRows } = await supabaseAdmin
        .from('discord_guild_roles')
        .select('discord_role_id, discord_role_name')
        .in('discord_role_id', roleIdsForCatalog)

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

    const { data: membersAllowedRoleMappings } = await supabaseAdmin
      .from('discord_role_permissions')
      .select('discord_role_id, discord_role_name')
      .in('discord_role_id', [...MEMBERS_ALLOWED_ROLE_IDS])

    for (const row of Array.isArray(membersAllowedRoleMappings) ? membersAllowedRoleMappings : []) {
      const roleId = typeof row?.discord_role_id === 'string' ? row.discord_role_id : null
      const roleName = typeof row?.discord_role_name === 'string' ? row.discord_role_name : null
      if (roleId && roleName && !membersAllowedRoleTitlesById[roleId]) {
        membersAllowedRoleTitlesById[roleId] = roleName
      }
    }

    const tierHierarchy: Record<MembershipTier, number> = { core: 1, pro: 2, executive: 3 }
    const userTierLevel = resolvedTier ? tierHierarchy[resolvedTier] : 0
    const allowedTabs = Array.isArray(tabConfigs)
      ? tabConfigs
        .filter((tab: any) => {
          if (tab.is_required) return true
          const required = String(tab.required_tier || '')
          const requiredLevel = tierHierarchy[required as MembershipTier] || 0
          return userTierLevel >= requiredLevel
        })
        .map((tab: any) => String(tab.tab_id))
      : []

    return NextResponse.json({
      success: true,
      resolution,
      constants: {
        members_allowed_role_ids: MEMBERS_ALLOWED_ROLE_IDS,
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
        role_titles_by_id: roleTitlesById,
        has_members_required_role: hasMembersRole,
        resolved_tier: resolvedTier,
        allowed_tabs: allowedTabs,
      },
      permissions: {
        current: uniquePermissionNames,
        expected_from_mappings: expectedPermissionNames,
        expected_missing: expectedMissing,
        unexpected_extra: unexpectedExtra,
        has_admin_dashboard_permission: hasAdminPermission,
      },
      diagnosis: {
        has_discord_user_id: !!discordUserIdFromAuth,
        has_cached_discord_profile: !!discordProfile,
        effective_roles_source: rolesFromJwt.length > 0 ? 'jwt' : (rolesFromProfile.length > 0 ? 'user_discord_profiles' : 'none'),
        likely_members_access_issue: !hasMembersRole
          ? 'Missing required members role'
          : null,
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
