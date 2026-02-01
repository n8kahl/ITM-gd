import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSafeRedirect } from '@/lib/safe-redirect'

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
  // Support both 'next' and 'redirect' query params for backwards compatibility
  const next = searchParams.get('next') || searchParams.get('redirect')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'oauth')
    loginUrl.searchParams.set('message', errorDescription || error)
    return NextResponse.redirect(loginUrl)
  }

  // Code is required for PKCE flow
  if (!code) {
    console.error('No code provided in OAuth callback')
    const loginUrl = new URL('/login', request.url)
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

    // STEP 1: Exchange code for session (server-side)
    console.log('Exchanging OAuth code for session (server-side)')
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError || !session) {
      console.error('Code exchange error:', exchangeError)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'oauth')
      loginUrl.searchParams.set('message', exchangeError?.message || 'Failed to exchange authorization code')
      return NextResponse.redirect(loginUrl)
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
      } else {
        const errorData = await syncResponse.json().catch(() => ({}))
        syncResult = errorData as any
        console.warn('Discord sync failed (non-fatal):', syncResponse.status, errorData)
      }
    } catch (syncError) {
      console.error('Discord sync error (non-fatal):', syncError)
      // Continue with redirect - sync is best-effort
    }

    // STEP 3: Refresh session to get updated app_metadata claims
    // The database trigger should have updated auth.users.raw_app_meta_data
    // Refreshing the session ensures the JWT contains the latest claims
    console.log('Refreshing session to get updated claims...')
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

    if (refreshError) {
      console.warn('Session refresh error (non-fatal):', refreshError)
      // Continue with original session
    } else if (refreshedSession) {
      console.log('✓ Session refreshed with updated claims')
    }

    // Use refreshed session for metadata checks, fallback to original
    const currentSession = refreshedSession || session
    const appMetadata = currentSession.user.app_metadata || {}
    const isAdmin = appMetadata.is_admin === true
    const isMember = appMetadata.is_member === true

    console.log('User metadata:', {
      isAdmin,
      isMember,
      userId: currentSession.user.id,
      email: currentSession.user.email
    })

    // STEP 4: Determine redirect destination
    let redirectUrl: string

    // Check if Discord sync returned NOT_MEMBER error
    if (syncResult && !syncResult.success && syncResult.code === 'NOT_MEMBER') {
      console.log('→ Redirecting to /join-discord (user not in Discord server)')
      redirectUrl = '/join-discord'
    }
    // User explicitly requested a destination
    else if (next) {
      const safeNext = getSafeRedirect(next)
      console.log('→ Redirecting to requested destination:', safeNext)
      redirectUrl = safeNext
    }
    // Admin users go to admin dashboard
    else if (isAdmin) {
      console.log('→ Redirecting to /admin (admin user)')
      redirectUrl = '/admin'
    }
    // Members go to member portal
    else if (isMember) {
      console.log('→ Redirecting to /members (member user)')
      redirectUrl = '/members'
    }
    // Default: members area (middleware will handle auth)
    else {
      console.log('→ Redirecting to /members (default)')
      redirectUrl = '/members'
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url))

  } catch (error) {
    console.error('Unexpected error in OAuth callback:', error)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'server')
    loginUrl.searchParams.set('message', 'An unexpected error occurred during authentication')
    return NextResponse.redirect(loginUrl)
  }
}
