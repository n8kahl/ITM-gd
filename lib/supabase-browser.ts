import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client for browser/client components.
 *
 * This client uses @supabase/ssr which automatically syncs auth sessions
 * to cookies, making them accessible to middleware and server components.
 *
 * IMPORTANT: Call this function to get a fresh client rather than using
 * a singleton. This ensures cookies are properly read/written.
 */
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
