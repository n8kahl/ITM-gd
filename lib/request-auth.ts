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

export async function getAuthenticatedUserFromRequest(
  request: NextRequest,
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const supabase = await createRequestSupabaseClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return { user, supabase }
}

