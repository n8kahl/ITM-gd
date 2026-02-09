import { NextRequest, NextResponse } from 'next/server'
import { behavioralQuerySchema } from '@/lib/validation/journal-api'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { limit } = behavioralQuerySchema.parse({
      limit: searchParams.get('limit') ?? undefined,
    })

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('ai_behavioral_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .order('analysis_date', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid request query' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
