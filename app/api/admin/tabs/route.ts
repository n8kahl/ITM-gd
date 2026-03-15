import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/admin/audit-log'
import { normalizeDiscordRoleIds } from '@/lib/discord-role-access'
import { requireAdminAccess } from '@/lib/access-control/admin-access'

type DynamicTabRecord = Record<string, unknown> & {
  tab_id?: unknown
  sort_order?: unknown
}

const DISCORD_SNOWFLAKE_REGEX = /^\d{17,20}$/

function sortBySortOrder<T extends { sort_order?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

/**
 * GET /api/admin/tabs — Fetch all tab configurations (admin-only)
 */
export async function GET() {
  try {
    const { authorized } = await requireAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: tabs, error } = await supabase
      .from('tab_configurations')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    const rows = (tabs || []) as DynamicTabRecord[]
    return NextResponse.json({ success: true, data: sortBySortOrder(rows) })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/tabs — Update all tab configurations (admin-only)
 * Accepts: { tabs: TabConfig[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const { authorized, user } = await requireAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { tabs } = body

    if (!Array.isArray(tabs) || tabs.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tabs array is required' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const normalizedTabs = tabs.map((tab: any) => ({
      tab_id: String(tab.tab_id || '').trim(),
      label: String(tab.label || '').trim(),
      icon: String(tab.icon || 'LayoutDashboard').trim(),
      path: String(tab.path || '').trim(),
      required_tier: tab.required_tier,
      required_discord_role_ids: normalizeDiscordRoleIds(tab.required_discord_role_ids),
      badge_text: tab.badge_text ? String(tab.badge_text).trim() : null,
      badge_variant: tab.badge_variant || null,
      description: tab.description ? String(tab.description).trim() : null,
      mobile_visible: tab.mobile_visible ?? true,
      sort_order: Number(tab.sort_order || 0),
      is_required: tab.is_required ?? false,
      is_active: tab.is_active ?? true,
      updated_at: new Date().toISOString(),
    }))

    const incomingIds = normalizedTabs.map((tab) => tab.tab_id).filter(Boolean)
    if (incomingIds.length !== normalizedTabs.length) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Each tab must have a non-empty tab_id' } },
        { status: 400 }
      )
    }

    const incomingIdSet = new Set(incomingIds)
    if (incomingIdSet.size !== incomingIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Duplicate tab_id values are not allowed' } },
        { status: 400 }
      )
    }

    const requiredRoleIds = Array.from(new Set(
      normalizedTabs.flatMap((tab) => Array.isArray(tab.required_discord_role_ids) ? tab.required_discord_role_ids : [])
    ))
    const invalidRoleIds = requiredRoleIds.filter((roleId) => !DISCORD_SNOWFLAKE_REGEX.test(roleId))
    if (invalidRoleIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid Discord role IDs: ${invalidRoleIds.join(', ')}`,
          },
        },
        { status: 400 },
      )
    }

    const { data: existingRows, error: existingRowsError } = await supabase
      .from('tab_configurations')
      .select('tab_id')

    if (existingRowsError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: `Failed to load existing tab IDs: ${existingRowsError.message}` } },
        { status: 500 }
      )
    }

    const existingIds = (existingRows || []).map((row) => String((row as any).tab_id || '')).filter(Boolean)
    const tabIdsToDelete = existingIds.filter((tabId) => !incomingIdSet.has(tabId))

    if (tabIdsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('tab_configurations')
        .delete()
        .in('tab_id', tabIdsToDelete)

      if (deleteError) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: `Failed to remove deleted tabs: ${deleteError.message}` } },
          { status: 500 }
        )
      }
    }

    const { error: upsertError } = await supabase
      .from('tab_configurations')
      .upsert(normalizedTabs, { onConflict: 'tab_id' })

    if (upsertError) {
      if (upsertError.message?.includes('tab_configurations_required_tier_check')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SCHEMA_OUTDATED',
              message:
                'Tab tier schema is outdated. Apply the latest Supabase migrations to support required_tier=admin.',
            },
          },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: `Failed to update tab configurations: ${upsertError.message}` } },
        { status: 500 }
      )
    }

    await logAdminActivity({
      action: 'tabs_updated',
      targetType: 'tab_config',
      targetId: user?.id || null,
      details: {
        tabs_updated: incomingIds,
        tabs_deleted: tabIdsToDelete,
      },
    })

    revalidatePath('/members')
    revalidatePath('/api/config/tabs')

    // Return updated tabs
    const { data: updatedTabs } = await supabase
      .from('tab_configurations')
      .select('*')
      .order('sort_order', { ascending: true })

    let unknownRoleIds: string[] = []
    if (requiredRoleIds.length > 0) {
      const { data: knownGuildRoles } = await supabase
        .from('discord_guild_roles')
        .select('discord_role_id')
        .in('discord_role_id', requiredRoleIds)

      const knownRoleIdSet = new Set(
        (knownGuildRoles || [])
          .map((row: any) => String(row?.discord_role_id || '').trim())
          .filter(Boolean),
      )
      unknownRoleIds = requiredRoleIds.filter((roleId) => !knownRoleIdSet.has(roleId))
    }

    return NextResponse.json({
      success: true,
      data: updatedTabs,
      warnings: unknownRoleIds.length > 0
        ? { unknown_role_ids: unknownRoleIds }
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
