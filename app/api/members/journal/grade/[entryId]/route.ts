import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId } = await params
    const supabase = getSupabaseAdminClient()

    const { data: entry, error } = await supabase
      .from('journal_entries')
      .select('id, ai_analysis')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single()

    if (error || !entry) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 })
    }

    const aiAnalysis = entry.ai_analysis && typeof entry.ai_analysis === 'object'
      ? entry.ai_analysis as Record<string, unknown>
      : null

    return NextResponse.json({
      success: true,
      data: {
        entryId: entry.id,
        grade: aiAnalysis?.trade_grade ?? null,
        ai_analysis: aiAnalysis,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
