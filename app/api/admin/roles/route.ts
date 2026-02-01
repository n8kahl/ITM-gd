import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
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

    return NextResponse.json({
      success: true,
      roles: Object.values(roleGroups),
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

    if (!discord_role_id) {
      return NextResponse.json({ error: 'Discord Role ID is required' }, { status: 400 })
    }

    if (!permission_ids || !Array.isArray(permission_ids) || permission_ids.length === 0) {
      return NextResponse.json({ error: 'At least one permission is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Insert all permission mappings for this role
    const mappings = permission_ids.map((permId: string) => ({
      discord_role_id,
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

    return NextResponse.json({ success: true, data })
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

    if (!discord_role_id) {
      return NextResponse.json({ error: 'Discord Role ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Delete existing mappings for this role
    const { error: deleteError } = await supabase
      .from('discord_role_permissions')
      .delete()
      .eq('discord_role_id', discord_role_id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // If no permissions, we're done (role removed)
    if (!permission_ids || permission_ids.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Insert new permission mappings
    const mappings = permission_ids.map((permId: string) => ({
      discord_role_id,
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

    return NextResponse.json({ success: true, data })
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
    const discordRoleId = searchParams.get('discord_role_id')

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

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}
