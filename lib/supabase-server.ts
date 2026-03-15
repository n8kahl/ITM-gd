import { isCurrentUserAdmin } from '@/lib/access-control/admin-access'
import { createServerSupabaseClient as createServerSupabaseClientInternal } from '@/lib/server-supabase'

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * This client reads session from cookies and can verify user authentication.
 */
export const createServerSupabaseClient = createServerSupabaseClientInternal

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
 * Checks if the current user has admin access via the canonical access evaluator.
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    return await isCurrentUserAdmin()
  } catch {
    return false
  }
}
