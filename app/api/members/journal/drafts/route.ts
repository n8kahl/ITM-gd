import { NextRequest, NextResponse } from 'next/server'
import { listDraftsSchema } from '@/lib/validation/journal-api'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

interface JournalNotificationRow {
  id: string
  type: 'auto_journal_ready'
  market_date: string
  title: string
  message: string
  payload: Record<string, unknown> | null
  created_at: string
  read_at: string | null
}

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

    const { error: expireError } = await supabase
      .from('journal_entries')
      .update({ draft_status: 'dismissed' })
      .eq('user_id', userId)
      .eq('is_draft', true)
      .eq('draft_status', 'pending')
      .not('draft_expires_at', 'is', null)
      .lt('draft_expires_at', new Date().toISOString())

    if (expireError) {
      return NextResponse.json({ success: false, error: expireError.message }, { status: 500 })
    }

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

    const { data: unreadNotification, error: notificationError } = await supabase
      .from('journal_notifications')
      .select('id,type,market_date,title,message,payload,created_at,read_at')
      .eq('user_id', userId)
      .eq('type', 'auto_journal_ready')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (notificationError) {
      return NextResponse.json({ success: false, error: notificationError.message }, { status: 500 })
    }

    let deliveredNotification: JournalNotificationRow | null = null
    if (unreadNotification) {
      const readAt = new Date().toISOString()
      const { error: markReadError } = await supabase
        .from('journal_notifications')
        .update({ read_at: readAt })
        .eq('id', unreadNotification.id)
        .eq('user_id', userId)

      if (markReadError) {
        return NextResponse.json({ success: false, error: markReadError.message }, { status: 500 })
      }

      deliveredNotification = {
        ...(unreadNotification as JournalNotificationRow),
        read_at: readAt,
      }
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      notification: deliveredNotification,
    })
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
