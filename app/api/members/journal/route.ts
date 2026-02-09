import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

/**
 * Get authenticated user ID from Supabase session (server-validated via getUser)
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('Missing Supabase environment variables')
    return null
  }

  const authHeader = request.headers.get('authorization')
  let accessToken: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7)
  } else {
    const cookies = request.cookies.getAll()
    const authCookie = cookies.find(c => c.name.includes('-auth-token'))
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        accessToken = parsed[0] || parsed.access_token
      } catch {
        // Cookie might be in different format
      }
    }
  }

  if (!accessToken) {
    return null
  }

  const supabase = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user.id
}

// ============================================
// CANONICAL TABLE: journal_entries
// Field names match lib/types/journal.ts:
//   direction, pnl, pnl_percentage, position_size
// ============================================

// GET - Fetch journal entries for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false })
      .limit(limit)

    if (startDate) {
      query = query.gte('trade_date', startDate)
    }
    if (endDate) {
      query = query.lte('trade_date', endDate)
    }

    const { data: entries, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also fetch streak data
    const { data: streaks } = await supabase
      .from('journal_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      success: true,
      data: entries || [],
      streaks: streaks || {
        current_streak: 0,
        longest_streak: 0,
        total_entries: 0,
        total_winners: 0,
        total_losers: 0,
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// POST - Create new journal entry
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    const body = await request.json()

    // Accept both canonical and legacy field names for backwards compatibility
    const direction = body.direction || body.trade_type || null
    const pnl = body.pnl ?? body.profit_loss ?? null
    const pnl_percentage = body.pnl_percentage ?? body.profit_loss_percent ?? null

    const {
      trade_date,
      symbol,
      entry_price,
      exit_price,
      position_size,
      screenshot_url,
      setup_notes,
      execution_notes,
      lessons_learned,
      tags,
      rating,
      is_winner,
      ai_analysis,
    } = body

    if (!symbol || !symbol.trim()) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        trade_date: trade_date ? new Date(trade_date).toISOString() : new Date().toISOString(),
        symbol: symbol.toUpperCase(),
        direction,
        entry_price: entry_price != null ? parseFloat(entry_price) : null,
        exit_price: exit_price != null ? parseFloat(exit_price) : null,
        position_size: position_size != null ? parseFloat(position_size) : null,
        pnl: pnl != null ? parseFloat(pnl) : null,
        pnl_percentage: pnl_percentage != null ? parseFloat(pnl_percentage) : null,
        screenshot_url: screenshot_url || null,
        setup_notes: setup_notes || null,
        execution_notes: execution_notes || null,
        lessons_learned: lessons_learned || null,
        tags: tags || [],
        rating: rating || null,
        is_winner,
        ai_analysis: ai_analysis || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update streak data
    await updateStreaks(supabase, userId, is_winner, trade_date)

    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// PATCH - Update journal entry
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, ...rawUpdates } = body

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    // Map any legacy field names to canonical names
    const updates: Record<string, unknown> = { ...rawUpdates }
    if ('trade_type' in updates) {
      updates.direction = updates.trade_type
      delete updates.trade_type
    }
    if ('profit_loss' in updates) {
      updates.pnl = updates.profit_loss
      delete updates.profit_loss
    }
    if ('profit_loss_percent' in updates) {
      updates.pnl_percentage = updates.profit_loss_percent
      delete updates.profit_loss_percent
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// DELETE - Delete journal entry
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate streaks
    await recalculateStreaks(supabase, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// Helper: Update streak data after new entry
async function updateStreaks(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  isWinner: boolean | undefined,
  tradeDate: string
) {
  const today = new Date().toISOString().split('T')[0]
  const entryDate = tradeDate || today

  const { data: current } = await supabase
    .from('journal_streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!current) {
    await supabase
      .from('journal_streaks')
      .insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_entry_date: entryDate,
        total_entries: 1,
        total_winners: isWinner ? 1 : 0,
        total_losers: isWinner === false ? 1 : 0,
      })
    return
  }

  let newStreak = current.current_streak
  const lastDate = current.last_entry_date ? new Date(current.last_entry_date) : null
  const newDate = new Date(entryDate)

  if (lastDate) {
    const diffDays = Math.floor((newDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      newStreak = current.current_streak + 1
    } else if (diffDays > 1) {
      newStreak = 1
    }
  }

  const longestStreak = Math.max(newStreak, current.longest_streak)

  await supabase
    .from('journal_streaks')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_entry_date: entryDate,
      total_entries: current.total_entries + 1,
      total_winners: current.total_winners + (isWinner ? 1 : 0),
      total_losers: current.total_losers + (isWinner === false ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

// Helper: Recalculate all streak data
async function recalculateStreaks(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('trade_date, is_winner')
    .eq('user_id', userId)
    .order('trade_date', { ascending: true })

  if (!entries || entries.length === 0) {
    await supabase
      .from('journal_streaks')
      .delete()
      .eq('user_id', userId)
    return
  }

  const totalEntries = entries.length
  const totalWinners = entries.filter(e => e.is_winner === true).length
  const totalLosers = entries.filter(e => e.is_winner === false).length
  const lastDate = entries[entries.length - 1].trade_date

  let longestStreak = 1
  let tempStreak = 1

  for (let i = 1; i < entries.length; i++) {
    const prevDate = new Date(entries[i - 1].trade_date)
    const currDate = new Date(entries[i].trade_date)
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      tempStreak++
    } else if (diffDays > 1) {
      tempStreak = 1
    }

    longestStreak = Math.max(longestStreak, tempStreak)
  }

  const currentStreak = tempStreak

  await supabase
    .from('journal_streaks')
    .upsert({
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_entry_date: lastDate,
      total_entries: totalEntries,
      total_winners: totalWinners,
      total_losers: totalLosers,
      updated_at: new Date().toISOString(),
    })
}
