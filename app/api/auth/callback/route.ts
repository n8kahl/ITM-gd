import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSafeRedirect } from '@/lib/safe-redirect'
import { getAbsoluteUrl } from '@/lib/url-helpers'
import {
  hasAdminRoleAccess,
  hasMembersAreaAccess,
  normalizeDiscordRoleIds,
} from '@/lib/discord-role-access'

/**
 * Server-side OAuth callback handler
 *
 * This route handles the OAuth callback from Discord and performs:
 * 1. Code exchange for session (server-side, sets httpOnly cookies)
 * 2. Discord role sync to update permissions
 * 3. Session refresh to get updated app_metadata claims
 * 4. Smart redirect based on user role and membership
 *
 * Required query params:
 * - code: OAuth authorization code from Discord
 * - next: Optional redirect destination (default: auto-detect)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const skipCodeExchange = searchParams.get('skip_code_exchange') === '1'
  // Support both 'next' and 'redirect' query params for backwards compatibility
  const next = searchParams.get('next') || searchParams.get('redirect')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    const loginUrl = getAbsoluteUrl('/login', request)
    loginUrl.searchParams.set('error', 'oauth')
    loginUrl.searchParams.set('message', errorDescription || error)
    return NextResponse.redirect(loginUrl)
  }

  // Code is required unless client already exchanged it and asked us to finalize.
  if (!skipCodeExchange && !code) {
    console.error('No code provided in OAuth callback')
    const loginUrl = getAbsoluteUrl('/login', request)
    loginUrl.searchParams.set('error', 'oauth')
    loginUrl.searchParams.set('message', 'No authorization code received')
    return NextResponse.redirect(loginUrl)
  }

  try {
    const cookieStore = await cookies()

    // Create server-side Supabase client with cookie handling
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

    // STEP 1: Establish session
    let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null

    if (skipCodeExchange) {
      console.log('Skipping server-side code exchange (client already exchanged code)')
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !existingSession) {
        console.error('Session missing after client exchange:', sessionError)
        const loginUrl = getAbsoluteUrl('/login', request)
        loginUrl.searchParams.set('error', 'oauth')
        loginUrl.searchParams.set('message', sessionError?.message || 'Session missing after authentication')
        return NextResponse.redirect(loginUrl)
      }
      session = existingSession
    } else {
      console.log('Exchanging OAuth code for session (server-side)')
      const { data: { session: exchangedSession }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code!)

      if (exchangeError || !exchangedSession) {
        console.error('Code exchange error:', exchangeError)
        const loginUrl = getAbsoluteUrl('/login', request)
        loginUrl.searchParams.set('error', 'oauth')
        loginUrl.searchParams.set('message', exchangeError?.message || 'Failed to exchange authorization code')
        return NextResponse.redirect(loginUrl)
      }
      session = exchangedSession
    }

    console.log('✓ Session created for user:', session.user.id)

    // STEP 2: Sync Discord roles and permissions (best-effort)
    // This updates the user_permissions table and triggers the sync_permissions_to_claims() function
    let syncResult: { success: boolean; code?: string; permissions?: any[] } | null = null

    try {
      console.log('Calling Discord role sync...')
      const syncResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (syncResponse.ok) {
        syncResult = await syncResponse.json()
        console.log('✓ Discord sync completed:', syncResult?.success ? 'success' : 'failed')

        // Log sync details for debugging
        if (syncResult?.permissions) {
          const permissionNames = syncResult.permissions.map((p: any) => p.name)
          console.log('Synced permissions:', permissionNames)
          console.log('Has admin_dashboard permission:', permissionNames.includes('admin_dashboard'))
        }
      } else {
        const errorData = await syncResponse.json().catch(() => ({}))
        syncResult = errorData as any
        console.warn('Discord sync failed (non-fatal):', syncResponse.status, errorData)
      }
    } catch (syncError) {
      console.error('Discord sync error (non-fatal):', syncError)
      // Continue with redirect - sync is best-effort
    }

    // STEP 3: Poll for JWT claims to propagate
    // The Edge Function updates auth.users.raw_app_meta_data, but Supabase's
    // internal caches may need time to propagate the changes
    console.log('Polling for metadata propagation...')

    let currentSession = session
    let isAdmin = false
    let isMember = false
    const maxAttempts = 5
    const pollInterval = 500 // 500ms between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Wait before each attempt (except first)
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }

      // Refresh session to get updated claims
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError) {
        console.warn(`Attempt ${attempt}: Session refresh error:`, refreshError.message)
        continue
      }

      if (refreshedSession) {
        currentSession = refreshedSession
        const appMetadata = refreshedSession.user.app_metadata || {}
        isAdmin = appMetadata.is_admin === true
        isMember = appMetadata.is_member === true

        // If we got the claims we expected from sync, we're done
        if (syncResult?.success && syncResult.permissions) {
          const expectedAdmin = syncResult.permissions.some((p: any) => p.name === 'admin_dashboard')
          const rolesFromSync = normalizeDiscordRoleIds(
            Array.isArray((syncResult as any).roles)
              ? (syncResult as any).roles.map((r: any) => r?.id)
              : [],
          )
          const expectedMember = hasMembersAreaAccess(rolesFromSync)

          if ((!expectedAdmin || isAdmin) && (!expectedMember || isMember)) {
            console.log(`✓ Claims propagated on attempt ${attempt}`)
            break
          }
        } else if (isAdmin || isMember) {
          // No sync result to compare, but we got some claims
          console.log(`✓ Claims found on attempt ${attempt}`)
          break
        }
      }

      console.log(`Attempt ${attempt}/${maxAttempts}: Claims not ready yet (isAdmin=${isAdmin}, isMember=${isMember})`)
    }

    // FALLBACK: If polling didn't pick up the claims, use sync result
    // This handles cases where database is slow or claims don't propagate
    if (syncResult?.success && syncResult.permissions) {
      const hasAdminPerm = syncResult.permissions.some((p: any) => p.name === 'admin_dashboard')
      const rolesFromSync = normalizeDiscordRoleIds(
        Array.isArray((syncResult as any).roles)
          ? (syncResult as any).roles.map((r: any) => r?.id)
          : [],
      )
      const hasMemberPerm = hasMembersAreaAccess(rolesFromSync)

      // Override with sync result if it's more permissive
      if (hasAdminPerm && !isAdmin) {
        console.warn('⚠️  Using sync result for admin status (claims did not propagate)')
        isAdmin = true
      }
      if (hasMemberPerm && !isMember) {
        console.warn('⚠️  Using sync result for member status (claims did not propagate)')
        isMember = true
      }
    }

    const appMetadata = currentSession.user.app_metadata || {}
    console.log('User metadata:', {
      isAdmin,
      isMember,
      userId: currentSession.user.id,
      email: currentSession.user.email,
      source: (isAdmin !== (appMetadata.is_admin === true) || isMember !== (appMetadata.is_member === true))
        ? 'sync_result_fallback'
        : 'jwt_claims'
    })

    // STEP 4: Determine redirect destination
    let redirectUrl: string

    // Check if Discord sync returned NOT_MEMBER error
    if (syncResult && !syncResult.success && syncResult.code === 'NOT_MEMBER') {
      console.log('→ Redirecting to /join-discord (user not in Discord server)')
      redirectUrl = '/join-discord'
    }
    else {
      // Members and admin-area fallback checks are role-gated.
      let hasMembersRole = false
      let hasAdminRole = false

      // 1) Prefer JWT app_metadata (best case: edge function stored discord_roles).
      const rolesFromJwt = normalizeDiscordRoleIds(
        (currentSession.user.app_metadata as { discord_roles?: unknown } | undefined)?.discord_roles,
      )
      hasMembersRole = hasMembersAreaAccess(rolesFromJwt)
      hasAdminRole = hasAdminRoleAccess(rolesFromJwt)

      // 2) Fall back to edge function response.
      if ((!hasMembersRole || !hasAdminRole) && syncResult?.success) {
        const rolesFromSync = normalizeDiscordRoleIds(
          Array.isArray((syncResult as any).roles)
            ? (syncResult as any).roles.map((r: any) => r?.id)
            : [],
        )
        if (!hasMembersRole) hasMembersRole = hasMembersAreaAccess(rolesFromSync)
        if (!hasAdminRole) hasAdminRole = hasAdminRoleAccess(rolesFromSync)
      }

      // 3) Final fallback: cached DB profile (works even if claims didn't propagate yet).
      if (!hasMembersRole || !hasAdminRole) {
        try {
          const { data: discordProfile } = await supabase
            .from('user_discord_profiles')
            .select('discord_roles')
            .eq('user_id', currentSession.user.id)
            .maybeSingle()

          const rolesFromProfile = normalizeDiscordRoleIds(discordProfile?.discord_roles)
          if (!hasMembersRole) hasMembersRole = hasMembersAreaAccess(rolesFromProfile)
          if (!hasAdminRole) hasAdminRole = hasAdminRoleAccess(rolesFromProfile)
        } catch (err) {
          console.warn('Role lookup failed during callback (non-fatal):', err)
        }
      }

      // User explicitly requested a destination
      if (next) {
        const safeNext = getSafeRedirect(next)

        // Block direct member-area redirects when missing the required role.
        if (safeNext === '/members' || safeNext.startsWith('/members/')) {
          if (!hasMembersRole) {
            console.log('→ Redirecting to /access-denied (missing required members role)')
            redirectUrl = '/access-denied?area=members'
          } else {
            console.log('→ Redirecting to requested destination:', safeNext)
            redirectUrl = safeNext
          }
        } else {
          console.log('→ Redirecting to requested destination:', safeNext)
          redirectUrl = safeNext
        }
      }
      // Admin users go to admin dashboard
      else if (isAdmin || hasAdminRole) {
        console.log('→ Redirecting to /admin (admin user)')
        redirectUrl = '/admin'
      }
      // Members (role-gated) go to member portal
      else if (hasMembersRole) {
        console.log('→ Redirecting to /members (authorized member role)')
        redirectUrl = '/members'
      }
      // Default: deny
      else {
        console.log('→ Redirecting to /access-denied (missing required members role)')
        redirectUrl = '/access-denied?area=members'
      }
    }

    return NextResponse.redirect(getAbsoluteUrl(redirectUrl, request))

  } catch (error) {
    console.error('Unexpected error in OAuth callback:', error)
    const loginUrl = getAbsoluteUrl('/login', request)
    loginUrl.searchParams.set('error', 'server')
    loginUrl.searchParams.set('message', 'An unexpected error occurred during authentication')
    return NextResponse.redirect(loginUrl)
  }
}
