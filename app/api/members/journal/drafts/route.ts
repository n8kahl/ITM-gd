import { NextRequest, NextResponse } from 'next/server'
import { listDraftsSchema } from '@/lib/validation/journal-api'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { status, limit } = listDraftsSchema.parse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    const supabase = getSupabaseAdminClient()
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_draft', true)
      .order('trade_date', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('draft_status', status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid draft query' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
