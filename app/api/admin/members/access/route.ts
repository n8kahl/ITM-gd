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
    const discordUserIdFromAuth = resolveDiscordUserIdFromAuthUser(authUser)
    const rolesFromJwt = extractDiscordRoleIds(authUser)
    const membersAllowedRoleIds = await resolveMembersAllowedRoleIds({ supabase: supabaseAdmin })

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
      ? discordProfile!.discord_roles.map((id: unknown) => String(id)).filter(Boolean)
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

    const tierHierarchy: Record<string, number> = { core: 1, pro: 2, executive: 3 }
    const userTierLevel = resolvedTier ? tierHierarchy[resolvedTier] : 0
    const isAdminUser = hasAdminPermission
    const allowedTabs = Array.isArray(tabConfigs)
      ? tabConfigs
        .filter((tab: any) => {
          const requiredRoleIds = Array.isArray(tab.required_discord_role_ids)
            ? tab.required_discord_role_ids.map((id: unknown) => String(id)).filter(Boolean)
            : []
          if (!isAdminUser && requiredRoleIds.length > 0) {
            const hasRequiredRole = requiredRoleIds.some((roleId: string) => effectiveRoleIds.includes(roleId))
            if (!hasRequiredRole) return false
          }
          if (tab.is_required) return true
          const required = String(tab.required_tier || '')
          if (required === 'admin') return isAdminUser
          const requiredLevel = tierHierarchy[required] || 0
          return userTierLevel >= requiredLevel
        })
        .map((tab: any) => String(tab.tab_id))
      : []

    return NextResponse.json({
      success: true,
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
