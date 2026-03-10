import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isAdminUser } from '@/lib/supabase-server'

function jsonNoStore(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function authorizeMoneyMakerMemberRequest(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonNoStore(
      {
        success: false,
        error: 'Unauthorized',
      },
      401,
    )
  }

  const isAdmin = await isAdminUser()
  if (isAdmin) {
    return null
  }

  return jsonNoStore(
    {
      success: false,
      error: 'Forbidden',
    },
    403,
  )
}
