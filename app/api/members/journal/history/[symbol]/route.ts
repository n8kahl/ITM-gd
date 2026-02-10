import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { symbol } = await params
    const normalizedSymbol = symbol.toUpperCase().trim()
    if (!normalizedSymbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', normalizedSymbol)
      .or('is_draft.is.null,is_draft.eq.false')
      .order('trade_date', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: sanitizeJournalEntries(data || []) })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
