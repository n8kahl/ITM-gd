import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Security headers to add to all responses
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response (will be modified as needed)
  let response: NextResponse

  // Admin route protection
  if (pathname.startsWith('/admin')) {
    // Allow access to login page without auth
    if (pathname === '/admin/login') {
      response = NextResponse.next()
    } else {
      // Check for admin cookie
      const adminCookie = request.cookies.get('titm_admin')

      if (adminCookie?.value !== 'true') {
        // Check for magic link token in URL
        const token = request.nextUrl.searchParams.get('token')

        if (token) {
          // Redirect to API route to verify token and set cookie
          const verifyUrl = new URL('/api/admin/verify-token', request.url)
          verifyUrl.searchParams.set('token', token)
          verifyUrl.searchParams.set('redirect', pathname)

          // Preserve other query params like conversation ID and highlight
          const id = request.nextUrl.searchParams.get('id')
          if (id) {
            verifyUrl.searchParams.set('id', id)
          }
          const highlight = request.nextUrl.searchParams.get('highlight')
          if (highlight) {
            verifyUrl.searchParams.set('highlight', highlight)
          }

          response = NextResponse.redirect(verifyUrl)
        } else {
          // No auth, redirect to login
          const loginUrl = new URL('/admin/login', request.url)
          response = NextResponse.redirect(loginUrl)
        }
      } else {
        response = NextResponse.next()
      }
    }
  }
  // All other routes (including /members - protected client-side by MemberAuthContext)
  // Note: /members uses Supabase auth which stores sessions in localStorage, not cookies
  // Middleware can't access localStorage, so we rely on client-side protection
  else {
    response = NextResponse.next()
  }

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Match all admin routes (protected by httpOnly cookie)
    '/admin/:path*',
    // Note: /members is NOT in middleware - it uses localStorage-based Supabase auth
    // which is protected client-side by MemberAuthContext
  ],
}
