import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from './supabase-server'

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token.length > 0 ? token : null
}

export async function createRequestSupabaseClient(
  request: NextRequest,
): Promise<SupabaseClient> {
  const accessToken = getBearerToken(request)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (accessToken && url && anonKey) {
    return createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
  }

  return createServerSupabaseClient()
}

function shouldUseE2EBypass(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.E2E_BYPASS_AUTH !== 'true') return false
  return request.headers.get('x-e2e-bypass-auth') === '1'
}

function createE2EBypassAuth(request: NextRequest): { user: User; supabase: SupabaseClient } | null {
  if (!shouldUseE2EBypass(request)) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.warn('[request-auth] E2E bypass requested but Supabase service role configuration is missing.')
    return null
  }

  const bypassUserId =
    request.headers.get('x-e2e-bypass-user-id') ||
    process.env.E2E_BYPASS_AUTH_USER_ID ||
    '00000000-0000-4000-8000-000000000001'

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const bypassUser = {
    id: bypassUserId,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  } as User

  return { user: bypassUser, supabase }
}

export async function getAuthenticatedUserFromRequest(
  request: NextRequest,
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const bypassAuth = createE2EBypassAuth(request)
  if (bypassAuth) {
    return bypassAuth
  }

  const requestSupabase = await createRequestSupabaseClient(request)
  const { data: { user: requestUser }, error: requestError } = await requestSupabase.auth.getUser()

  if (!requestError && requestUser) {
    return { user: requestUser, supabase: requestSupabase }
  }

  // If a stale/invalid bearer token was supplied, retry with cookie-based auth.
  // This prevents custom Authorization headers from shadowing valid browser sessions.
  if (getBearerToken(request)) {
    const cookieSupabase = await createServerSupabaseClient()
    const { data: { user: cookieUser }, error: cookieError } = await cookieSupabase.auth.getUser()
    if (!cookieError && cookieUser) {
      return { user: cookieUser, supabase: cookieSupabase }
    }
  }

  return null
}
