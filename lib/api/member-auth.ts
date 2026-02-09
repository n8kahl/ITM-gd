import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

export async function getRequestUserId(request: NextRequest): Promise<string | null> {
  const auth = await getAuthenticatedUserFromRequest(request)
  return auth?.user.id ?? null
}
