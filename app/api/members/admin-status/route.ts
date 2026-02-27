import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isAdminUser } from '@/lib/supabase-server'

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

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonNoStore({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const isAdmin = await isAdminUser()
    return jsonNoStore({ success: true, isAdmin })
  } catch {
    return jsonNoStore({
      success: true,
      isAdmin: false,
      warning: 'Admin status unavailable.',
    })
  }
}
