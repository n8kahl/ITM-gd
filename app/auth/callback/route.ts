import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSafeRedirect } from '@/lib/safe-redirect'

/**
 * Server-side OAuth callback handler
 *
 * This route handler exchanges the OAuth code for a session and sets
 * the auth cookies server-side. This is critical because:
 * 1. Middleware reads session from cookies (not localStorage)
 * 2. Client-side code exchange doesn't set cookies that middleware can read
 * 3. Server-side exchange ensures cookies are properly set before redirect
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from Discord
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    const errorUrl = new URL('/login', origin)
    errorUrl.searchParams.set('error', error)
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(errorUrl)
  }

  // If no code, redirect to login with error
  if (!code) {
    console.error('No code in OAuth callback')
    const errorUrl = new URL('/login', origin)
    errorUrl.searchParams.set('error', 'no_code')
    errorUrl.searchParams.set('error_description', 'No authorization code received')
    return NextResponse.redirect(errorUrl)
  }

  try {
    const cookieStore = await cookies()

    // Create server client with cookie handlers
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

    // Exchange the code for a session - this sets auth cookies
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      const errorUrl = new URL('/login', origin)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('error_description', exchangeError.message)
      return NextResponse.redirect(errorUrl)
    }

    if (!data.session) {
      console.error('No session after code exchange')
      const errorUrl = new URL('/login', origin)
      errorUrl.searchParams.set('error', 'no_session')
      errorUrl.searchParams.set('error_description', 'Failed to create session')
      return NextResponse.redirect(errorUrl)
    }

    // Success - redirect to intended destination
    // Check if user is admin and adjust redirect if needed
    const isAdmin = data.session.user?.app_metadata?.is_admin === true

    // If redirect is /members but user is admin, consider redirecting to /admin
    // But respect explicit redirect requests
    let finalRedirect = redirectTo
    if (redirectTo === '/members' && isAdmin) {
      // Keep /members as default even for admins - they chose to go there
      // They can manually go to /admin if needed
    }

    console.log(`Auth callback success for user ${data.session.user.id}, redirecting to ${finalRedirect}`)

    return NextResponse.redirect(new URL(finalRedirect, origin))
  } catch (err) {
    console.error('Auth callback error:', err)
    const errorUrl = new URL('/login', origin)
    errorUrl.searchParams.set('error', 'callback_error')
    errorUrl.searchParams.set('error_description', err instanceof Error ? err.message : 'Authentication failed')
    return NextResponse.redirect(errorUrl)
  }
}
