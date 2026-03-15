import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { evaluateMemberAccess } from '@/lib/access-control/evaluate-member-access'
import { createServiceRoleSupabaseClient } from '@/lib/server-supabase'

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

  const serviceRoleSupabase = createServiceRoleSupabaseClient()
  if (!serviceRoleSupabase) {
    return jsonNoStore(
      {
        success: false,
        error: 'Access control unavailable',
      },
      500,
    )
  }

  const evaluation = await evaluateMemberAccess(serviceRoleSupabase, { userId: user.id })
  if (evaluation.isAdmin || evaluation.allowedTabs.includes('money-maker')) {
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
