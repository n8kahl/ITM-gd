import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sanitizeLimit(raw: string | null): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 8
  return Math.min(20, Math.max(1, Math.round(parsed)))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ success: false, error: 'Invalid session id' }, { status: 400 })
    }

    const searchParams = new URL(request.url).searchParams
    const limit = sanitizeLimit(searchParams.get('limit'))
    const supabase = getSupabaseAdminClient()

    const { data: session, error: sessionError } = await supabase
      .from('ai_coach_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const { data: messages, error: messagesError } = await supabase
      .from('ai_coach_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (messagesError) {
      return NextResponse.json({ success: false, error: messagesError.message }, { status: 500 })
    }

    const orderedMessages = [...(messages || [])]
      .reverse()
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: typeof message.content === 'string'
          ? message.content.slice(0, 4000)
          : '',
        created_at: message.created_at,
      }))

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        messages: orderedMessages,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
