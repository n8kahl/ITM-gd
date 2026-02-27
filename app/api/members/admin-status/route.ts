import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface AdminStatusSuccessResponse {
  success: true
  isAdmin: boolean
  warning?: string
}

interface AdminStatusErrorResponse {
  success: false
  error: string
}

function jsonNoStore(
  payload: AdminStatusSuccessResponse | AdminStatusErrorResponse,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(payload, { ...init, headers })
}

function createServiceRoleClient() {
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

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonNoStore({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleClient = createServiceRoleClient()
  if (!serviceRoleClient) {
    return jsonNoStore({
      success: true,
      isAdmin: false,
      warning: 'Admin status unavailable.',
    })
  }

  try {
    const { data: profile, error: profileError } = await serviceRoleClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return jsonNoStore({
        success: true,
        isAdmin: false,
        warning: 'Admin status unavailable.',
      })
    }

    const isAdmin = (profile as { role?: string } | null)?.role === 'admin'
    return jsonNoStore({ success: true, isAdmin })
  } catch {
    return jsonNoStore({
      success: true,
      isAdmin: false,
      warning: 'Admin status unavailable.',
    })
  }
}
