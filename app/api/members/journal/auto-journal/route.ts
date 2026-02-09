import { NextRequest, NextResponse } from 'next/server'
import { autoJournalSchema } from '@/lib/validation/journal-api'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { extractDraftCandidates } from '@/lib/journal/draft-candidate-extractor'

function getEasternMarketDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function getUtcRangeForMarketDate(marketDate: string): { startIso: string; endIso: string } {
  const start = new Date(`${marketDate}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function dedupeKey(sessionId: string | null, symbol: string | null): string | null {
  if (!sessionId || !symbol) return null
  return `${sessionId}:${symbol.toUpperCase()}`
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = autoJournalSchema.parse(await request.json().catch(() => ({})))
    const marketDate = payload.marketDate || getEasternMarketDate()
    const { startIso, endIso } = getUtcRangeForMarketDate(marketDate)
    const supabase = getSupabaseAdminClient()

    const { data: dayMessages, error: messagesError } = await supabase
      .from('ai_coach_messages')
      .select('session_id,content,created_at')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json({ success: false, error: messagesError.message }, { status: 500 })
    }

    const messagesBySession = new Map<string, Array<{ content: string | null; created_at: string }>>()
    for (const message of dayMessages || []) {
      if (!message.session_id || typeof message.session_id !== 'string') continue
      const sessionMessages = messagesBySession.get(message.session_id) || []
      sessionMessages.push({ content: message.content, created_at: message.created_at })
      messagesBySession.set(message.session_id, sessionMessages)
    }

    if (messagesBySession.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          created: 0,
          sessionsScanned: 0,
          message: 'No AI Coach sessions found for this market date.',
        },
      })
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('journal_entries')
      .select('session_id,symbol')
      .eq('user_id', userId)
      .gte('trade_date', startIso)
      .lt('trade_date', endIso)

    if (existingError) {
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 })
    }

    const existingKeys = new Set<string>()
    for (const existing of existingRows || []) {
      const key = dedupeKey(existing.session_id, existing.symbol)
      if (key) existingKeys.add(key)
    }

    const draftRows: Array<Record<string, unknown>> = []

    for (const [sessionId, messages] of messagesBySession.entries()) {
      const candidates = extractDraftCandidates(messages, 10)
      for (const candidate of candidates) {
        const key = dedupeKey(sessionId, candidate.symbol)
        if (!key || existingKeys.has(key)) continue

        draftRows.push({
          user_id: userId,
          trade_date: `${marketDate}T16:05:00.000Z`,
          symbol: candidate.symbol,
          direction: candidate.direction,
          setup_notes: `Auto-draft from AI Coach session ${sessionId}:\n\n${candidate.notes}`,
          tags: ['ai-session-draft'],
          smart_tags: ['Auto Draft'],
          session_id: sessionId,
          is_draft: true,
          draft_status: 'pending',
          draft_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          is_open: false,
        })
        existingKeys.add(key)
      }
    }

    if (draftRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          created: 0,
          sessionsScanned: messagesBySession.size,
          message: 'No new draft trades detected.',
        },
      })
    }

    const { data: createdRows, error: createError } = await supabase
      .from('journal_entries')
      .insert(draftRows.slice(0, 50))
      .select('id,symbol,session_id,draft_status,is_draft')

    if (createError) {
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        created: createdRows?.length || 0,
        sessionsScanned: messagesBySession.size,
        marketDate,
        drafts: createdRows || [],
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid auto-journal payload' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

