import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

// Get user ID from request (in production, verify with Discord OAuth)
function getUserId(request: NextRequest): string {
  // For demo, check cookie or use default
  const cookies = request.cookies
  const memberCookie = cookies.get('titm_member')

  if (memberCookie) {
    try {
      const session = JSON.parse(memberCookie.value)
      return session.id
    } catch {
      // Fall through
    }
  }

  // Default demo user
  return 'demo_user'
}

// GET - Fetch journal entries for user
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('trading_journal_entries')
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
    const userId = getUserId(request)
    const body = await request.json()

    const {
      trade_date,
      symbol,
      trade_type,
      entry_price,
      exit_price,
      position_size,
      profit_loss,
      profit_loss_percent,
      screenshot_url,
      setup_notes,
      execution_notes,
      lessons_learned,
      tags,
      rating,
      is_winner,
    } = body

    const supabase = getSupabaseAdmin()

    // Insert journal entry
    const { data: entry, error } = await supabase
      .from('trading_journal_entries')
      .insert({
        user_id: userId,
        trade_date: trade_date || new Date().toISOString().split('T')[0],
        symbol,
        trade_type,
        entry_price,
        exit_price,
        position_size,
        profit_loss,
        profit_loss_percent,
        screenshot_url,
        setup_notes,
        execution_notes,
        lessons_learned,
        tags: tags || [],
        rating,
        is_winner,
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
    const userId = getUserId(request)
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('trading_journal_entries')
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
    const userId = getUserId(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('trading_journal_entries')
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

  // Get current streak data
  const { data: current } = await supabase
    .from('journal_streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!current) {
    // Create new streak record
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

  // Calculate streak
  let newStreak = current.current_streak
  const lastDate = current.last_entry_date ? new Date(current.last_entry_date) : null
  const newDate = new Date(entryDate)

  if (lastDate) {
    const diffDays = Math.floor((newDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      // Consecutive day
      newStreak = current.current_streak + 1
    } else if (diffDays > 1) {
      // Streak broken
      newStreak = 1
    }
    // diffDays === 0: same day, keep streak
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
  // Get all entries for user
  const { data: entries } = await supabase
    .from('trading_journal_entries')
    .select('trade_date, is_winner')
    .eq('user_id', userId)
    .order('trade_date', { ascending: true })

  if (!entries || entries.length === 0) {
    // Delete streak record if no entries
    await supabase
      .from('journal_streaks')
      .delete()
      .eq('user_id', userId)
    return
  }

  // Calculate stats
  const totalEntries = entries.length
  const totalWinners = entries.filter(e => e.is_winner === true).length
  const totalLosers = entries.filter(e => e.is_winner === false).length
  const lastDate = entries[entries.length - 1].trade_date

  // Calculate streaks
  let currentStreak = 1
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

  currentStreak = tempStreak

  // Upsert streak record
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
