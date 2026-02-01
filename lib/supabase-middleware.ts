import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Creates a Supabase client for use in Next.js middleware.
 * This client can read/refresh sessions from cookies.
 */
export function createMiddlewareClient(request: NextRequest) {
  // Create an unmodified response initially
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          // Update response cookies
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  return { supabase, response }
}

/**
 * Helper type for app_metadata with RBAC claims
 */
export interface AppMetadata {
  is_admin?: boolean
  is_member?: boolean
  provider?: string
  providers?: string[]
}
