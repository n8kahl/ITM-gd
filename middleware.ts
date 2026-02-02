import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient, type AppMetadata } from '@/lib/supabase-middleware'

// Security headers to add to all responses
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
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

  // Refresh session if expired - required for Server Components
  // This call also updates cookies if the session was refreshed
  const { data: { session }, error } = await supabase.auth.getSession()

  // Extract app_metadata from session (contains RBAC claims)
  const appMetadata = (session?.user?.app_metadata || {}) as AppMetadata
  const isAdmin = appMetadata.is_admin === true
  const isAuthenticated = !!session?.user

  // ============================================
  // ADMIN ROUTES PROTECTION
  // ============================================
  if (pathname.startsWith('/admin')) {
    // Strict Discord-only authentication
    // Only users with is_admin claim (from Discord roles) can access
    if (!isAdmin) {
      // Not authorized - redirect to login
      const loginUrl = new URL('/login', request.url)
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
      const loginUrl = new URL('/login', request.url)
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
      const loginUrl = new URL('/login', request.url)
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

      if (redirectParam) {
        return addSecurityHeaders(NextResponse.redirect(new URL(redirectParam, request.url)))
      }

      // Default: send admins to /admin, members to /members
      const defaultRedirect = isAdmin ? '/admin' : '/members'
      return addSecurityHeaders(NextResponse.redirect(new URL(defaultRedirect, request.url)))
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
