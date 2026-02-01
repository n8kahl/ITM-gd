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

          // Preserve other query params like conversation ID
          const id = request.nextUrl.searchParams.get('id')
          if (id) {
            verifyUrl.searchParams.set('id', id)
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
  // Members route - check for Supabase session cookie
  else if (pathname.startsWith('/members')) {
    // Supabase stores session in cookies with prefix 'sb-'
    // We check for any Supabase auth cookie
    const cookies = request.cookies.getAll()
    const hasSupabaseSession = cookies.some(
      cookie => cookie.name.includes('-auth-token') || cookie.name.includes('sb-')
    )

    if (!hasSupabaseSession) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      response = NextResponse.redirect(loginUrl)
    } else {
      response = NextResponse.next()
    }
  }
  // All other routes
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
    // Match all admin routes
    '/admin/:path*',
    // Match all members routes
    '/members/:path*',
    // Match API routes that need protection (optional, for CSRF later)
    // '/api/admin/:path*',
  ],
}
