import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { logAdminActivity } from '@/lib/admin/audit-log'
import { recomputeUsersForRoleIds } from '@/lib/discord-permission-sync'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

async function upsertRoleCatalogEntry(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  roleId: string
  roleName: string | null | undefined
}): Promise<void> {
  const roleName = typeof params.roleName === 'string' ? params.roleName.trim() : ''
  if (!roleName) return

  const nowIso = new Date().toISOString()
  const supabaseAny = params.supabase as any
  const { error } = await supabaseAny
    .from('discord_guild_roles')
    .upsert({
      discord_role_id: params.roleId,
      discord_role_name: roleName,
      last_synced_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'discord_role_id' })

  if (error) {
    console.warn('[Admin Roles API] Failed to upsert discord role catalog entry:', error.message)
  }
}

// GET - Fetch all Discord role permission mappings and app permissions
export async function GET() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Fetch all role permission mappings
    const { data: roleMappings, error: mappingError } = await supabase
      .from('discord_role_permissions')
      .select(`
        id,
        discord_role_id,
        discord_role_name,
        permission_id,
        created_at
      `)
      .order('discord_role_name', { ascending: true })

    if (mappingError) {
      return NextResponse.json({ error: mappingError.message }, { status: 500 })
    }

    // Fetch all available permissions
    const { data: permissions, error: permError } = await supabase
      .from('app_permissions')
      .select('*')
      .order('name', { ascending: true })

    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 500 })
    }

    const { data: catalogRoles } = await (supabase as any)
      .from('discord_guild_roles')
      .select('discord_role_id, discord_role_name')
      .order('position', { ascending: false })

    // Group mappings by discord_role_id
    const roleGroups: Record<string, {
      discord_role_id: string
      discord_role_name: string | null
      permission_ids: string[]
      mapping_ids: string[]
    }> = {}

    for (const mapping of roleMappings || []) {
      if (!roleGroups[mapping.discord_role_id]) {
        roleGroups[mapping.discord_role_id] = {
          discord_role_id: mapping.discord_role_id,
          discord_role_name: mapping.discord_role_name,
          permission_ids: [],
          mapping_ids: [],
        }
      }
      roleGroups[mapping.discord_role_id].permission_ids.push(mapping.permission_id)
      roleGroups[mapping.discord_role_id].mapping_ids.push(mapping.id)
    }

    for (const catalogRole of catalogRoles || []) {
      const roleId = String((catalogRole as any)?.discord_role_id || '').trim()
      if (!roleId) continue

      const roleName = String((catalogRole as any)?.discord_role_name || '').trim() || null
      if (!roleGroups[roleId]) {
        roleGroups[roleId] = {
          discord_role_id: roleId,
          discord_role_name: roleName,
          permission_ids: [],
          mapping_ids: [],
        }
      } else if (!roleGroups[roleId].discord_role_name && roleName) {
        roleGroups[roleId].discord_role_name = roleName
      }
    }

    const roles = Object.values(roleGroups).sort((a, b) => {
      const aName = (a.discord_role_name || '').toLowerCase()
      const bName = (b.discord_role_name || '').toLowerCase()
      if (aName !== bName) return aName.localeCompare(bName)
      return a.discord_role_id.localeCompare(b.discord_role_id)
    })

    return NextResponse.json({
      success: true,
      roles,
      permissions: permissions || [],
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// POST - Create new role permission mapping(s)
export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { discord_role_id, discord_role_name, permission_ids } = body
    const normalizedRoleId = String(discord_role_id || '').trim()

    if (!normalizedRoleId) {
      return NextResponse.json({ error: 'Discord Role ID is required' }, { status: 400 })
    }

    if (permission_ids !== undefined && !Array.isArray(permission_ids)) {
      return NextResponse.json({ error: 'permission_ids must be an array' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const normalizedPermissionIds = Array.isArray(permission_ids)
      ? permission_ids.map((permissionId: unknown) => String(permissionId).trim()).filter(Boolean)
      : []

    await upsertRoleCatalogEntry({
      supabase,
      roleId: normalizedRoleId,
      roleName: discord_role_name || null,
    })

    if (normalizedPermissionIds.length === 0) {
      await logAdminActivity({
        action: 'role_permissions_changed',
        targetType: 'discord_role',
        targetId: normalizedRoleId,
        details: {
          operation: 'create',
          discord_role_name: discord_role_name || null,
          permission_ids: [],
          note: 'Role saved without app permissions',
        },
      })

      return NextResponse.json({
        success: true,
        data: [],
        propagation: {
          processed: 0,
          failed: 0,
          affectedUserIds: [],
          errors: [],
        },
      })
    }

    // Insert all permission mappings for this role
    const mappings = normalizedPermissionIds.map((permId: string) => ({
      discord_role_id: normalizedRoleId,
      discord_role_name: discord_role_name || null,
      permission_id: permId,
    }))

    const { data, error } = await supabase
      .from('discord_role_permissions')
      .insert(mappings)
      .select()

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'Some permission mappings already exist for this role',
        }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'role_permissions_changed',
      targetType: 'discord_role',
      targetId: normalizedRoleId,
      details: {
        operation: 'create',
        discord_role_name: discord_role_name || null,
        permission_ids: normalizedPermissionIds,
      },
    })

    const propagation = await recomputeUsersForRoleIds({
      supabaseAdmin: supabase,
      roleIds: [normalizedRoleId],
    }).catch((error) => ({
      processed: 0,
      failed: 0,
      affectedUserIds: [],
      errors: [error instanceof Error ? error.message : 'Role propagation failed'],
    }))

    return NextResponse.json({
      success: true,
      data,
      propagation,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// PUT - Update role permission mappings (replace all permissions for a role)
export async function PUT(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { discord_role_id, discord_role_name, permission_ids } = body
    const normalizedRoleId = String(discord_role_id || '').trim()

    if (!normalizedRoleId) {
      return NextResponse.json({ error: 'Discord Role ID is required' }, { status: 400 })
    }

    if (permission_ids !== undefined && !Array.isArray(permission_ids)) {
      return NextResponse.json({ error: 'permission_ids must be an array' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const normalizedPermissionIds = Array.isArray(permission_ids)
      ? permission_ids.map((permissionId: unknown) => String(permissionId).trim()).filter(Boolean)
      : []

    await upsertRoleCatalogEntry({
      supabase,
      roleId: normalizedRoleId,
      roleName: discord_role_name || null,
    })

    // Delete existing mappings for this role
    const { error: deleteError } = await supabase
      .from('discord_role_permissions')
      .delete()
      .eq('discord_role_id', normalizedRoleId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // If no permissions, we're done (role removed)
    if (normalizedPermissionIds.length === 0) {
      await logAdminActivity({
        action: 'role_permissions_changed',
        targetType: 'discord_role',
        targetId: normalizedRoleId,
        details: {
          operation: 'replace',
          discord_role_name: discord_role_name || null,
          permission_ids: [],
        },
      })
      const propagation = await recomputeUsersForRoleIds({
        supabaseAdmin: supabase,
        roleIds: [normalizedRoleId],
      }).catch((error) => ({
        processed: 0,
        failed: 0,
        affectedUserIds: [],
        errors: [error instanceof Error ? error.message : 'Role propagation failed'],
      }))

      return NextResponse.json({
        success: true,
        data: [],
        propagation,
      })
    }

    // Insert new permission mappings
    const mappings = normalizedPermissionIds.map((permId: string) => ({
      discord_role_id: normalizedRoleId,
      discord_role_name: discord_role_name || null,
      permission_id: permId,
    }))

    const { data, error: insertError } = await supabase
      .from('discord_role_permissions')
      .insert(mappings)
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'role_permissions_changed',
      targetType: 'discord_role',
      targetId: normalizedRoleId,
      details: {
        operation: 'replace',
        discord_role_name: discord_role_name || null,
        permission_ids: normalizedPermissionIds,
      },
    })

    const propagation = await recomputeUsersForRoleIds({
      supabaseAdmin: supabase,
      roleIds: [normalizedRoleId],
    }).catch((error) => ({
      processed: 0,
      failed: 0,
      affectedUserIds: [],
      errors: [error instanceof Error ? error.message : 'Role propagation failed'],
    }))

    return NextResponse.json({
      success: true,
      data,
      propagation,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// DELETE - Delete all permission mappings for a role
export async function DELETE(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const discordRoleId = String(searchParams.get('discord_role_id') || '').trim()

    if (!discordRoleId) {
      return NextResponse.json({ error: 'Discord Role ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('discord_role_permissions')
      .delete()
      .eq('discord_role_id', discordRoleId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'role_permissions_changed',
      targetType: 'discord_role',
      targetId: discordRoleId,
      details: {
        operation: 'delete',
      },
    })

    const propagation = await recomputeUsersForRoleIds({
      supabaseAdmin: supabase,
      roleIds: [discordRoleId],
    }).catch((error) => ({
      processed: 0,
      failed: 0,
      affectedUserIds: [],
      errors: [error instanceof Error ? error.message : 'Role propagation failed'],
    }))

    return NextResponse.json({
      success: true,
      propagation,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}
