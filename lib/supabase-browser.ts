import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client for browser/client components.
 *
 * Uses a singleton pattern to prevent multiple auth lock acquisitions
 * which cause navigator.locks deadlocks and getSession() timeouts.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabase() {
  if (_client) return _client
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return _client
}
