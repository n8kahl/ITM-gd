import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Admin Debug Endpoint - Diagnose Discord role sync issues
 *
 * This endpoint helps debug why admin access isn't working by showing:
 * - Current user's Discord roles
 * - Database role mappings
 * - Current JWT claims
 * - What the sync would return
 *
 * Access: Must be authenticated AND have is_admin claim
 * URL: /api/admin/debug-roles
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Create authenticated Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // SECURITY: Use getUser() instead of getSession() — validates JWT server-side
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        message: 'You must be logged in to use this endpoint'
      }, { status: 401 })
    }

    // SECURITY: Require admin role — this endpoint exposes sensitive role mappings
    const appMetadata = user.app_metadata || {}
    if (appMetadata.is_admin !== true) {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Admin access required'
      }, { status: 403 })
    }

    const userId = user.id
    const email = user.email

    // Get session for access_token (needed for sync call)
    const { data: { session } } = await supabase.auth.getSession()

    // Call Discord sync to see what it returns
    let syncResult: any = null
    let syncError: any = null

    try {
      const syncResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (syncResponse.ok) {
        syncResult = await syncResponse.json()
      } else {
        syncError = await syncResponse.json().catch(() => ({ message: 'Unknown error' }))
      }
    } catch (err) {
      syncError = { message: err instanceof Error ? err.message : 'Fetch failed' }
    }

    // Get database role mappings
    const { data: roleMappings } = await supabase
      .from('discord_role_permissions')
      .select(`
        discord_role_id,
        discord_role_name,
        permission_id,
        app_permissions (
          name,
          description
        )
      `)

    // Get user's Discord profile
    const { data: discordProfile } = await supabase
      .from('user_discord_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Get user's current permissions
    const { data: userPermissions } = await supabase
      .from('user_permissions')
      .select(`
        permission_id,
        granted_by_role_id,
        granted_by_role_name,
        app_permissions (
          name,
          description
        )
      `)
      .eq('user_id', userId)

    // Build diagnostic response
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      user: {
        id: userId,
        email: email,
      },
      jwt_claims: {
        is_admin: appMetadata.is_admin,
        is_member: appMetadata.is_member,
        raw: appMetadata,
      },
      discord_profile: discordProfile ? {
        discord_user_id: discordProfile.discord_user_id,
        discord_username: discordProfile.discord_username,
        discord_roles: discordProfile.discord_roles,
        last_synced_at: discordProfile.last_synced_at,
      } : null,
      sync_result: syncResult,
      sync_error: syncError,
      database_mappings: {
        all_role_mappings: roleMappings,
        admin_role_mapping: roleMappings?.find(
          (m: any) => m.discord_role_id === '1465515598640447662'
        ),
        user_has_admin_role: discordProfile?.discord_roles?.includes('1465515598640447662'),
      },
      user_permissions: userPermissions,
      diagnosis: {
        has_discord_profile: !!discordProfile,
        discord_roles_count: discordProfile?.discord_roles?.length || 0,
        has_admin_role_in_discord: discordProfile?.discord_roles?.includes('1465515598640447662') || false,
        admin_role_mapped_in_db: !!roleMappings?.find((m: any) => m.discord_role_id === '1465515598640447662'),
        has_admin_permission_in_db: !!userPermissions?.find((p: any) => p.app_permissions?.name === 'admin_dashboard'),
        jwt_has_admin_claim: appMetadata.is_admin === true,
        should_have_admin_access: false, // Will be computed below
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
