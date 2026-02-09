import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { dashboardLayoutSchema } from '@/lib/validation/journal-api'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('ai_coach_user_preferences')
      .select('dashboard_layout')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data?.dashboard_layout || null,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = dashboardLayoutSchema.parse(await request.json())
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('ai_coach_user_preferences')
      .upsert({
        user_id: userId,
        dashboard_layout: payload.layout,
      }, {
        onConflict: 'user_id',
      })
      .select('dashboard_layout')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || 'Failed to save layout' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data.dashboard_layout })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid dashboard layout payload' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
