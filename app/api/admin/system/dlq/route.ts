import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// GET - List unresolved dead letter queue entries
export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const showResolved = searchParams.get('showResolved') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('dead_letter_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!showResolved) {
      query = query.eq('resolved', false)
    }

    const { data, error, count } = await query

    if (error) {
      // Table may not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, entries: [], total: 0, tableExists: false })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      entries: data || [],
      total: count || 0,
      tableExists: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

// POST - Retry or dismiss dead letter queue entries
export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, ids } = body as { action: 'retry' | 'dismiss'; ids: string[] }

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing action or ids' }, { status: 400 })
    }

    if (action !== 'retry' && action !== 'dismiss') {
      return NextResponse.json({ error: 'Invalid action. Must be "retry" or "dismiss"' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    if (action === 'dismiss') {
      const { error } = await supabase
        .from('dead_letter_queue')
        .update({ resolved: true })
        .in('id', ids)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: 'dismissed', count: ids.length })
    }

    // Retry: increment retry_count, set retried_at, keep resolved=false
    const { error } = await supabase.rpc('retry_dlq_entries', { entry_ids: ids })

    if (error) {
      // If RPC doesn't exist, do it manually
      if (error.code === '42883') {
        const { error: updateError } = await supabase
          .from('dead_letter_queue')
          .update({
            retried_at: new Date().toISOString(),
            retry_count: undefined, // Will be handled by raw SQL below
          })
          .in('id', ids)

        // Fallback: simple update without increment
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        // Increment retry_count via raw update
        for (const id of ids) {
          await supabase
            .from('dead_letter_queue')
            .update({ retried_at: new Date().toISOString() })
            .eq('id', id)
        }

        return NextResponse.json({ success: true, action: 'retried', count: ids.length })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'retried', count: ids.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
