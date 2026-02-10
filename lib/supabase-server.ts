import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * This client reads session from cookies and can verify user authentication.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
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

/**
 * Gets the current user with their app_metadata.
 * Returns null if not authenticated.
 */
export async function getServerUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return {
    ...user,
    appMetadata: (user.app_metadata || {}) as AppMetadata,
  }
}

/**
 * Checks if the current user has admin access.
 * Returns true if user has is_admin=true in app_metadata (set by Discord role sync).
 */
export async function isAdminUser(): Promise<boolean> {
  const e2eBypassEnabled = process.env.E2E_BYPASS_AUTH === 'true'
  const e2eBypassAllowed = process.env.NODE_ENV !== 'production' && e2eBypassEnabled
  if (e2eBypassAllowed) {
    const headerStore = await headers()
    if (headerStore.get('x-e2e-bypass-auth') === '1') {
      return true
    }
  }

  // Check RBAC claim from Discord OAuth
  const user = await getServerUser()
  return user?.appMetadata?.is_admin === true
}
