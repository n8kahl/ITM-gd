import { NextRequest, NextResponse } from 'next/server'
import { draftFromSessionSchema } from '@/lib/validation/journal-api'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { extractDraftCandidates } from '@/lib/journal/draft-candidate-extractor'

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = draftFromSessionSchema.parse(await request.json())
    const marketDate = payload.marketDate || new Date().toISOString().split('T')[0]

    const supabase = getSupabaseAdminClient()
    const { data: session, error: sessionError } = await supabase
      .from('ai_coach_sessions')
      .select('id,user_id')
      .eq('id', payload.sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const dayStart = `${marketDate}T00:00:00.000Z`
    const dayEnd = `${marketDate}T23:59:59.999Z`
    const { data: messages, error: messagesError } = await supabase
      .from('ai_coach_messages')
      .select('content,role,created_at')
      .eq('session_id', payload.sessionId)
      .eq('user_id', userId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json({ success: false, error: messagesError.message }, { status: 500 })
    }

    const candidates = extractDraftCandidates(messages || [], 10)

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        data: { created: 0, message: 'No trade candidates detected in session.' },
      })
    }

    const draftRows = candidates.slice(0, 10).map((candidate) => ({
      user_id: userId,
      trade_date: `${marketDate}T16:05:00.000Z`,
      symbol: candidate.symbol,
      direction: candidate.direction,
      setup_notes: `Auto-draft from AI Coach session ${payload.sessionId}:\n\n${candidate.notes}`,
      tags: ['ai-session-draft'],
      smart_tags: ['Auto Draft'],
      session_id: payload.sessionId,
      is_draft: true,
      draft_status: 'pending',
      draft_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      is_open: false,
    }))

    const { data: created, error: createError } = await supabase
      .from('journal_entries')
      .insert(draftRows)
      .select('id,symbol,draft_status,is_draft')

    if (createError) {
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        created: created?.length || 0,
        drafts: created || [],
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid draft generation payload' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
