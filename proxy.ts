import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient, type AppMetadata } from '@/lib/supabase-middleware'
import { getAbsoluteUrl } from '@/lib/url-helpers'
import {
  extractDiscordRoleIdsFromUser,
  hasAdminRoleAccess,
  hasMembersAreaAccess,
  normalizeDiscordRoleIds,
} from '@/lib/discord-role-access'

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

/**
 * Build a Content Security Policy header with a per-request nonce.
 *
 * - script-src uses nonce + strict-dynamic instead of unsafe-inline
 * - style-src keeps unsafe-inline (required by React inline styles + Tailwind)
 * - object-src, base-uri, form-action locked down
 */
function buildCSP(nonce: string): string {
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.openai.com',
    'https://*.up.railway.app',
    'wss://*.up.railway.app',
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
  ]

  // Local AI Coach backend for development and E2E.
  if (process.env.NODE_ENV !== 'production') {
    connectSrc.push('http://localhost:3001', 'ws://localhost:3001', 'http://127.0.0.1:3001', 'ws://127.0.0.1:3001')
  }

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join('; ') + ';';
}

/**
 * Adds security headers (CSP, HSTS, etc.) to a response.
 */
function addSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCSP(nonce))
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // X-XSS-Protection set to 0: the legacy XSS filter was itself exploitable
  // and has been removed from modern browsers. CSP replaces it.
  response.headers.set('X-XSS-Protection', '0')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // Only send HSTS in production over HTTPS. Sending HSTS on localhost breaks
  // local development and Playwright by forcing HTTP -> HTTPS upgrades.
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return response
}

// Prefixes that require authentication / authorization checks
const AUTH_PREFIXES = [
  '/api/admin',
  '/admin',
  '/api/members',
  '/api/social',
  '/api/academy-v3',
  '/members',
  '/join-discord',
  '/login',
  '/auth/callback',
  '/api/auth/callback',
]

function requiresAuth(pathname: string): boolean {
  return AUTH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

function isApiRoute(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

function isMembersAreaRoute(pathname: string): boolean {
  return pathname === '/members' || pathname.startsWith('/members/') ||
    pathname === '/api/members' || pathname.startsWith('/api/members/') ||
    pathname === '/api/social' || pathname.startsWith('/api/social/') ||
    pathname === '/api/academy-v3' || pathname.startsWith('/api/academy-v3/')
}

async function resolveDiscordRoleIds(
  supabase: any,
  user: any,
  forceProfileLookup = false,
): Promise<string[]> {
  let roleIds = extractDiscordRoleIdsFromUser(user)
  if (!forceProfileLookup && roleIds.length > 0) return roleIds

  // Fallback: query cached Discord profile roles if JWT metadata does not include them.
  try {
    const rolesResult = await Promise.race([
      supabase
        .from('user_discord_profiles')
        .select('discord_roles')
        .eq('user_id', user.id)
        .maybeSingle(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('roles lookup timeout')), 2000)),
    ]) as any

    const profileRoleIds = normalizeDiscordRoleIds(rolesResult?.data?.discord_roles)
    if (profileRoleIds.length > 0) {
      roleIds = Array.from(new Set([...roleIds, ...profileRoleIds]))
    }
  } catch (err) {
    console.warn('[Middleware] Failed to lookup user_discord_profiles.discord_roles:', err)
  }

  return roleIds
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Generate a unique nonce per request for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Clone request headers and add nonce so layout/components can read it
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  // Canonical route for the legacy members library namespace.
  if (pathname === '/members/library') {
    return addSecurityHeaders(
      NextResponse.redirect(getAbsoluteUrl('/members/academy-v3', request), 308),
      nonce,
    )
  }

  // E2E auth bypass for deterministic Playwright coverage on middleware-protected routes.
  // Production guard is required so test headers can never bypass auth in live environments.
  const e2eBypassHeader = request.headers.get('x-e2e-bypass-auth') === '1'
  const e2eBypassCookie = request.cookies.get('e2e_bypass_auth')?.value === '1'
  const e2eBypassQuery = request.nextUrl.searchParams.get('e2eBypassAuth') === '1'
  // Allow header-based bypass in non-production so Playwright can reliably
  // authenticate against reused local dev servers.
  const e2eBypassAllowed = process.env.NODE_ENV !== 'production' && (e2eBypassHeader || e2eBypassCookie || e2eBypassQuery)
  if (e2eBypassAllowed) {
    const bypassPrefixes = [
      '/members',
      '/admin',
      '/api/members',
      '/api/social',
      '/api/admin',
      '/join-discord',
    ]
    const shouldBypass = bypassPrefixes.some((prefix) => (
      pathname === prefix || pathname.startsWith(prefix + '/')
    ))
    if (shouldBypass) {
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      })
      return addSecurityHeaders(response, nonce)
    }
  }

  // For routes that don't need auth, pass through with security headers only
  if (!requiresAuth(pathname)) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })
    return addSecurityHeaders(response, nonce)
  }

  // Create Supabase middleware client to handle session refresh
  const { supabase, response } = createMiddlewareClient(request, requestHeaders)

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
  try {
    const result = await getUserWithTimeout()
    user = result.data.user
  } catch (err) {
    console.error('[Middleware] getUser() failed or timed out:', err)
    // On timeout/error, allow page to load but mark as unauthenticated
    user = null
  }

  // Extract app_metadata from user (contains RBAC claims)
  const appMetadata = (user?.app_metadata || {}) as AppMetadata
  const isAdmin = appMetadata.is_admin === true
  const isAuthenticated = !!user

  // ============================================
  // ADMIN ROUTES PROTECTION
  // ============================================
  if (isAdminRoute(pathname)) {
    if (!isAuthenticated) {
      if (isApiRoute(pathname)) {
        return addSecurityHeaders(jsonError('Unauthorized', 401), nonce)
      }

      const loginUrl = getAbsoluteUrl('/login', request)
      loginUrl.searchParams.set('redirect', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl), nonce)
    }

    let hasAdminAccess = isAdmin
    if (!hasAdminAccess) {
      let roleIds = await resolveDiscordRoleIds(supabase, user)
      hasAdminAccess = hasAdminRoleAccess(roleIds)
      if (!hasAdminAccess) {
        roleIds = await resolveDiscordRoleIds(supabase, user, true)
        hasAdminAccess = hasAdminRoleAccess(roleIds)
      }
    }

    if (!hasAdminAccess) {
      if (isApiRoute(pathname)) {
        return addSecurityHeaders(jsonError('Forbidden', 403), nonce)
      }
      // Not authorized - redirect to login
      const loginUrl = getAbsoluteUrl('/login', request)
      loginUrl.searchParams.set('redirect', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl), nonce)
    }

    // Admin authorized - proceed
    return addSecurityHeaders(response, nonce)
  }

  // ============================================
  // MEMBERS ROUTES PROTECTION
  // ============================================
  if (isMembersAreaRoute(pathname)) {
    if (!isAuthenticated) {
      if (isApiRoute(pathname)) {
        return addSecurityHeaders(jsonError('Unauthorized', 401), nonce)
      }
      // Not logged in - redirect to login
      const loginUrl = getAbsoluteUrl('/login', request)
      loginUrl.searchParams.set('redirect', pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl), nonce)
    }

    let roleIds = await resolveDiscordRoleIds(supabase, user)
    let hasMembersRole = hasMembersAreaAccess(roleIds)
    if (!hasMembersRole) {
      roleIds = await resolveDiscordRoleIds(supabase, user, true)
      hasMembersRole = hasMembersAreaAccess(roleIds)
    }

    if (!hasMembersRole) {
      if (isApiRoute(pathname)) {
        return addSecurityHeaders(jsonError('Forbidden', 403), nonce)
      }

      const deniedUrl = getAbsoluteUrl('/access-denied', request)
      deniedUrl.searchParams.set('area', 'members')
      return addSecurityHeaders(NextResponse.redirect(deniedUrl), nonce)
    }

    // Authenticated + authorized - proceed
    return addSecurityHeaders(response, nonce)
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
      return addSecurityHeaders(NextResponse.redirect(loginUrl), nonce)
    }

    // Authenticated users can access this page (even if not Discord members)
    return addSecurityHeaders(response, nonce)
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
        return addSecurityHeaders(NextResponse.redirect(getAbsoluteUrl(redirectParam, request)), nonce)
      }

      // Default: send admins to /admin, members to /members
      let shouldRedirectToAdmin = isAdmin
      if (!shouldRedirectToAdmin) {
        let roleIds = await resolveDiscordRoleIds(supabase, user)
        shouldRedirectToAdmin = hasAdminRoleAccess(roleIds)
        if (!shouldRedirectToAdmin) {
          roleIds = await resolveDiscordRoleIds(supabase, user, true)
          shouldRedirectToAdmin = hasAdminRoleAccess(roleIds)
        }
      }

      const defaultRedirect = shouldRedirectToAdmin ? '/admin' : '/members'
      return addSecurityHeaders(NextResponse.redirect(getAbsoluteUrl(defaultRedirect, request)), nonce)
    }

    // Not authenticated - allow access to login page
    return addSecurityHeaders(response, nonce)
  }

  // ============================================
  // ALL OTHER AUTH ROUTES (auth/callback, etc.)
  // ============================================
  return addSecurityHeaders(response, nonce)
}

// Configure which routes the proxy runs on
// Broad matcher: all routes except Next.js internals and static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|monitoring|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml|webmanifest)$).*)',
  ],
}
