import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient, type AppMetadata } from '@/lib/supabase-middleware'
import { getAbsoluteUrl } from '@/lib/url-helpers'

/**
 * Validate redirect path to prevent open redirect attacks.
 * Only allows relative paths starting with / that don't contain protocol markers.
 */
function isValidRedirect(path: string): boolean {
  // Must start with /
  if (!path.startsWith('/')) return false;
  // Must not contain protocol markers
  if (path.includes('://') || path.startsWith('//')) return false;
  // Must only contain valid URL characters
  if (!/^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/.test(path)) return false;
  return true;
}

// Security headers to add to all responses
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://*.up.railway.app wss://*.up.railway.app https://*.ingest.sentry.io; frame-ancestors 'none';",
}

/**
 * Adds security headers to a response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create Supabase middleware client to handle session refresh
  const { supabase, response } = createMiddlewareClient(request)

  // CRITICAL: Use getUser() instead of getSession() for authorization
  // getUser() validates the JWT with the server, preventing spoofing
  // Add timeout to prevent hanging (5 seconds max)
  const getUserWithTimeout = async () => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getUser timeout')), 5000)
    )
    return Promise.race([
      supabase.auth.getUser(),
      timeout
    ]) as Promise<{ data: { user: any }, error: any }>
  }

  let user = null
  let authError = null

  try {
    const result = await getUserWithTimeout()
    user = result.data.user
    authError = result.error
  } catch (err) {
    console.error('[Middleware] getUser() failed or timed out:', err)
    // On timeout/error, allow page to load but mark as unauthenticated
    user = null
    authError = err
  }

  // Extract app_metadata from user (contains RBAC claims)
  const appMetadata = (user?.app_metadata || {}) as AppMetadata
  const isAdmin = appMetadata.is_admin === true
  const isAuthenticated = !!user

  // ============================================
  // ADMIN ROUTES PROTECTION
  // ============================================
  if (pathname.startsWith('/admin')) {
    // Strict Discord-only authentication
    // Only users with is_admin claim (from Discord roles) can access
    if (!isAdmin) {
      // Not authorized - redirect to login
      const loginUrl = getAbsoluteUrl('/login', request)
      loginUrl.searchParams.set('redirect', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl))
    }

    // Admin authorized - proceed
    return addSecurityHeaders(response)
  }

  // ============================================
  // MEMBERS ROUTES PROTECTION
  // ============================================
  if (pathname.startsWith('/members')) {
    if (!isAuthenticated) {
      // Not logged in - redirect to login
      const loginUrl = getAbsoluteUrl('/login', request)
      loginUrl.searchParams.set('redirect', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl))
    }

    // User is authenticated - proceed
    return addSecurityHeaders(response)
  }

  // ============================================
  // JOIN DISCORD PAGE - ALLOW AUTHENTICATED USERS
  // ============================================
  if (pathname === '/join-discord') {
    // This page is for authenticated users who are NOT Discord members
    // Allow access if authenticated, redirect to login if not
    if (!isAuthenticated) {
      const loginUrl = getAbsoluteUrl('/login', request)
      loginUrl.searchParams.set('redirect', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl))
    }

    // Authenticated users can access this page (even if not Discord members)
    return addSecurityHeaders(response)
  }

  // ============================================
  // LOGIN PAGE - REDIRECT IF ALREADY AUTHENTICATED
  // ============================================
  if (pathname === '/login') {
    if (isAuthenticated) {
      // User is already logged in
      // Check redirect param, or send to appropriate dashboard
      const redirectParam = request.nextUrl.searchParams.get('redirect')

      if (redirectParam && isValidRedirect(redirectParam)) {
        return addSecurityHeaders(NextResponse.redirect(getAbsoluteUrl(redirectParam, request)))
      }

      // Default: send admins to /admin, members to /members
      const defaultRedirect = isAdmin ? '/admin' : '/members'
      return addSecurityHeaders(NextResponse.redirect(getAbsoluteUrl(defaultRedirect, request)))
    }

    // Not authenticated - allow access to login page
    return addSecurityHeaders(response)
  }

  // ============================================
  // ALL OTHER ROUTES
  // ============================================
  return addSecurityHeaders(response)
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Admin routes - protected by RBAC (is_admin claim from Discord roles)
    '/admin/:path*',
    // Members routes - protected by authentication
    '/members/:path*',
    // Join Discord page - for authenticated non-members
    '/join-discord',
    // Login page - redirect if already authenticated
    '/login',
    // Auth callback - needs session refresh
    '/auth/callback',
    // API auth callback - server-side OAuth handling
    '/api/auth/callback',
  ],
}
