import { NextRequest, NextResponse } from 'next/server'
import { dismissBehavioralSchema } from '@/lib/validation/journal-entry'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = dismissBehavioralSchema.parse(await request.json())
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('ai_behavioral_insights')
      .update({ is_dismissed: true })
      .eq('id', insightId)
      .eq('user_id', userId)
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || 'Insight not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid dismiss request' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
