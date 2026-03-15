import { NextResponse } from 'next/server'
import {
  evaluateMemberAccess,
} from '@/lib/access-control/evaluate-member-access'
import {
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleSupabase = createServiceRoleSupabaseClient()
  if (!serviceRoleSupabase) {
    return NextResponse.json(
      { success: false, error: 'Access snapshot unavailable' },
      { status: 500 },
    )
  }

  const [evaluation, permissionsResult, tabsResult] = await Promise.all([
    evaluateMemberAccess(serviceRoleSupabase, { userId: user.id }),
    serviceRoleSupabase
      .from('user_permissions')
      .select(`
        permission_id,
        granted_by_role_name,
        app_permissions (
          id,
          name,
          description
        )
      `)
      .eq('user_id', user.id),
    serviceRoleSupabase
      .from('tab_configurations')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const permissions = Array.isArray(permissionsResult.data)
    ? permissionsResult.data.map((row) => ({
      id: typeof row?.app_permissions?.[0]?.id === 'string'
        ? row.app_permissions[0].id
        : String(row?.permission_id || ''),
      name: typeof row?.app_permissions?.[0]?.name === 'string'
        ? row.app_permissions[0].name
        : '',
      description: typeof row?.app_permissions?.[0]?.description === 'string'
        ? row.app_permissions[0].description
        : null,
      granted_by_role: typeof row?.granted_by_role_name === 'string'
        ? row.granted_by_role_name
        : null,
    }))
    : []

  const allowedTabConfigMap = new Map(
    (tabsResult.data || [])
      .filter((row) => typeof row?.tab_id === 'string')
      .map((row) => [row.tab_id as string, row]),
  )

  const allowedTabConfigs = evaluation.allowedTabs
    .map((tabId) => allowedTabConfigMap.get(tabId))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      id: String(row.id || row.tab_id),
      tab_id: String(row.tab_id || ''),
      label: String(row.label || row.tab_id || ''),
      icon: typeof row.icon === 'string' ? row.icon : 'LayoutDashboard',
      path: typeof row.path === 'string' ? row.path : '/members',
      required_tier: String(row.required_tier || 'core'),
      badge_text: typeof row.badge_text === 'string' ? row.badge_text : null,
      badge_variant: (
        row.badge_variant === 'emerald'
        || row.badge_variant === 'champagne'
        || row.badge_variant === 'destructive'
      )
        ? row.badge_variant
        : null,
      description: typeof row.description === 'string' ? row.description : null,
      mobile_visible: row.mobile_visible !== false,
      sort_order: Number(row.sort_order || 0),
      is_required: row.is_required === true,
      is_active: row.is_active !== false,
      required_discord_role_ids: Array.isArray(row.required_discord_role_ids)
        ? row.required_discord_role_ids.map((roleId) => String(roleId))
        : [],
    }))

  return NextResponse.json({
    success: true,
    data: {
      profile: {
        id: evaluation.userId || user.id,
        email: evaluation.email || user.email || null,
        discord_user_id: evaluation.discordUserId,
        discord_username: evaluation.username,
        discord_avatar: evaluation.avatar,
        discord_roles: evaluation.effectiveDiscordRoleIds,
        discord_role_titles: evaluation.roleTitlesById,
        membership_tier: evaluation.resolvedTier,
        role: evaluation.isAdmin ? 'admin' : null,
      },
      permissions,
      allowedTabs: evaluation.allowedTabs,
      tabConfigs: allowedTabConfigs,
      access: {
        isAdmin: evaluation.isAdmin,
        hasMembersAccess: evaluation.hasMembersAccess,
        linkStatus: evaluation.linkStatus,
        tabDecisions: evaluation.tabDecisions,
        activeOverrides: evaluation.activeOverrides,
        healthWarnings: evaluation.healthWarnings,
      },
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
