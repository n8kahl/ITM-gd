import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = body?.action === 'dismiss' ? 'dismiss' : 'confirm'

    const supabase = getSupabaseAdminClient()
    const updates = action === 'confirm'
      ? { draft_status: 'confirmed', is_draft: false, draft_expires_at: null }
      : { draft_status: 'dismissed', is_draft: true }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_draft', true)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
