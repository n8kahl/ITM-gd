'use server'

import { createServerSupabaseClient, isAdminUser } from '@/lib/supabase-server'
import { getDiscordGuildRoles } from '@/lib/discord-admin'
import { RolePermission, MemberTab } from '@/lib/types_db'
import { revalidatePath } from 'next/cache'

/**
 * Fetch all Discord roles from the server and upsert them into the database.
 * Updates role names/colors but preserves existing tab permissions.
 */
export async function syncDiscordRoles(): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify admin access
    if (!await isAdminUser()) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch roles from Discord API
    const discordRoles = await getDiscordGuildRoles()

    if (!discordRoles || discordRoles.length === 0) {
      return { success: false, error: 'No Discord roles found' }
    }

    // Upsert each role (update name/color, keep existing tabs)
    for (const role of discordRoles) {
      const { error } = await supabase
        .schema('app_config')
        .from('role_permissions')
        .upsert({
          discord_role_id: role.id,
          role_name: role.name,
          role_color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : null,
          allowed_tabs: [], // Initialize with empty array for new roles
        }, {
          onConflict: 'discord_role_id',
          ignoreDuplicates: false
        })

      if (error) {
        console.error(`Failed to sync role ${role.name}:`, error)
      }
    }

    revalidatePath('/admin/permissions')

    return {
      success: true,
      message: `Successfully synced ${discordRoles.length} Discord roles`
    }
  } catch (error) {
    console.error('syncDiscordRoles error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync roles'
    }
  }
}

/**
 * Update the allowed_tabs for a specific role
 */
export async function updateRolePermissions(
  roleId: string,
  tabs: MemberTab[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify admin access
    if (!await isAdminUser()) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update the role's allowed_tabs
    const { error } = await supabase
      .schema('app_config')
      .from('role_permissions')
      .update({ allowed_tabs: tabs })
      .eq('discord_role_id', roleId)

    if (error) {
      console.error('updateRolePermissions error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/permissions')

    return { success: true }
  } catch (error) {
    console.error('updateRolePermissions error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update permissions'
    }
  }
}

/**
 * Get all role permissions from the database
 */
export async function getRolePermissions(): Promise<{
  success: boolean
  data?: RolePermission[]
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify admin access
    if (!await isAdminUser()) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .schema('app_config')
      .from('role_permissions')
      .select('*')
      .order('role_name')

    if (error) {
      console.error('getRolePermissions error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as RolePermission[] }
  } catch (error) {
    console.error('getRolePermissions error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch permissions'
    }
  }
}
