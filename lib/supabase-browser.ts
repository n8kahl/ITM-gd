import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use globalThis to ensure true singleton across Turbopack chunk evaluations
const SUPABASE_KEY = '__supabase_browser_client'

export function createBrowserSupabase() {
  // Diagnostic: log env var status on first call
  if (typeof window !== 'undefined' && !(globalThis as any)[SUPABASE_KEY]) {
    console.log('[Supabase] Creating browser client:', {
      hasUrl: !!supabaseUrl,
      urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
      hasAnonKey: !!supabaseAnonKey,
      anonKeyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'MISSING',
      hasNavigatorLocks: typeof navigator !== 'undefined' && !!navigator.locks,
    })
  }

  if ((globalThis as any)[SUPABASE_KEY]) {
    console.log('[Supabase] Returning cached singleton')
    return (globalThis as any)[SUPABASE_KEY]
  }

  console.log('[Supabase] Creating NEW client instance')
  const client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  ;(globalThis as any)[SUPABASE_KEY] = client
  return client
}
