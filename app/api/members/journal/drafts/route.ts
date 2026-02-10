import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdminClient()

    // Draft entries have been retired from the journal product.
    // Purge any legacy draft rows for this member and return an empty payload.
    const { data: deletedRows, error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('user_id', userId)
      .eq('is_draft', true)
      .select('id')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: [],
      notification: null,
      retired: {
        removed: deletedRows?.length || 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

