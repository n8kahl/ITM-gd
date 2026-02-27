import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import {
  extractDiscordRoleIdsFromUser,
  hasAdminRoleAccess,
  normalizeDiscordRoleIds,
} from '@/lib/discord-role-access'

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

function createServiceRoleSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
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
 * Returns true when either:
 * 1) is_admin=true exists in app_metadata, or
 * 2) the user has the privileged Discord admin role.
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    const e2eBypassEnabled = process.env.E2E_BYPASS_AUTH === 'true'
    const e2eBypassAllowed = process.env.NODE_ENV !== 'production' && e2eBypassEnabled
    if (e2eBypassAllowed) {
      try {
        const headerStore = await headers()
        if (headerStore.get('x-e2e-bypass-auth') === '1') {
          return true
        }
      } catch {
        // Continue with standard auth checks when request headers are unavailable.
      }
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return false
    }

    if ((user.app_metadata as AppMetadata | undefined)?.is_admin === true) {
      return true
    }

    const serviceRoleSupabase = createServiceRoleSupabaseClient()
    if (serviceRoleSupabase) {
      try {
        const { data: profile } = await serviceRoleSupabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if ((profile as { role?: string } | null)?.role === 'admin') {
          return true
        }
      } catch {
        // Fail open to existing Discord role fallback when service-role lookup fails.
      }
    }

    let roleIds = extractDiscordRoleIdsFromUser(user)
    try {
      const { data: profile } = await supabase
        .from('user_discord_profiles')
        .select('discord_roles')
        .eq('user_id', user.id)
        .maybeSingle()
      // Treat cached Discord profile roles as source-of-truth when available.
      if (profile) {
        roleIds = normalizeDiscordRoleIds(profile.discord_roles)
      }
    } catch {
      // Fall back to JWT/user metadata claims when profile lookup fails.
    }

    return hasAdminRoleAccess(roleIds)
  } catch {
    // Admin resolution must fail closed for callers relying on a boolean.
    return false
  }
}
