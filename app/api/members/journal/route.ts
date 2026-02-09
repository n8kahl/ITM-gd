import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

function getFirstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined)
}

function parseMaybeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMaybeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function normalizeDirection(value: unknown): 'long' | 'short' | 'neutral' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (['long', 'call', 'bullish', 'buy'].includes(normalized)) return 'long'
  if (['short', 'put', 'bearish', 'sell'].includes(normalized)) return 'short'
  if (normalized === 'neutral') return 'neutral'
  return null
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function normalizeJournalWritePayload(
  input: Record<string, unknown>,
  mode: 'create' | 'update',
) {
  const payload: Record<string, unknown> = {}

  const tradeDate = getFirstDefined<unknown>(input.trade_date, input.tradeDate)
  if (tradeDate !== undefined) {
    payload.trade_date = tradeDate
  } else if (mode === 'create') {
    payload.trade_date = new Date().toISOString()
  }

  if (input.symbol !== undefined) {
    payload.symbol =
      typeof input.symbol === 'string' && input.symbol.trim().length > 0
        ? input.symbol.trim().toUpperCase()
        : null
  }

  const directionInput = getFirstDefined<unknown>(input.direction, input.trade_type)
  if (directionInput !== undefined) {
    payload.direction = normalizeDirection(directionInput)
  }

  const entryPriceInput = getFirstDefined<unknown>(input.entry_price)
  if (entryPriceInput !== undefined) {
    payload.entry_price = parseMaybeNumber(entryPriceInput)
  }

  const exitPriceInput = getFirstDefined<unknown>(input.exit_price)
  if (exitPriceInput !== undefined) {
    payload.exit_price = parseMaybeNumber(exitPriceInput)
  }

  const positionSizeInput = getFirstDefined<unknown>(input.position_size)
  if (positionSizeInput !== undefined) {
    payload.position_size = parseMaybeNumber(positionSizeInput)
  }

  const pnlInput = getFirstDefined<unknown>(input.pnl, input.profit_loss)
  if (pnlInput !== undefined) {
    payload.pnl = parseMaybeNumber(pnlInput)
  }

  const pnlPctInput = getFirstDefined<unknown>(input.pnl_percentage, input.profit_loss_percent)
  if (pnlPctInput !== undefined) {
    payload.pnl_percentage = parseMaybeNumber(pnlPctInput)
  }

  if (input.screenshot_url !== undefined) {
    payload.screenshot_url =
      typeof input.screenshot_url === 'string' && input.screenshot_url.trim().length > 0
        ? input.screenshot_url.trim()
        : null
  }

  if (input.screenshot_thumbnail_url !== undefined) {
    payload.screenshot_thumbnail_url =
      typeof input.screenshot_thumbnail_url === 'string' && input.screenshot_thumbnail_url.trim().length > 0
        ? input.screenshot_thumbnail_url.trim()
        : null
  }

  if (input.setup_notes !== undefined) payload.setup_notes = input.setup_notes
  if (input.execution_notes !== undefined) payload.execution_notes = input.execution_notes
  if (input.lessons_learned !== undefined) payload.lessons_learned = input.lessons_learned

  if (input.tags !== undefined) {
    payload.tags = normalizeTags(input.tags)
  } else if (mode === 'create') {
    payload.tags = []
  }

  if (input.rating !== undefined) {
    payload.rating = parseMaybeNumber(input.rating)
  }

  if (input.is_winner !== undefined) {
    payload.is_winner = parseMaybeBoolean(input.is_winner)
  } else if (mode === 'create' && typeof payload.pnl === 'number') {
    payload.is_winner = payload.pnl > 0 ? true : payload.pnl < 0 ? false : null
  }

  return payload
}

/**
 * Get authenticated user ID from Supabase session
 * Returns null if not authenticated
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('Missing Supabase environment variables')
    return null
  }

  // Get the access token from Authorization header or cookies
  const authHeader = request.headers.get('authorization')
  let accessToken: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7)
  } else {
    // Try to get from Supabase auth cookie
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

  // Verify the token with Supabase
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

    const payload = normalizeJournalWritePayload(body, 'create')

    const supabase = getSupabaseAdmin()

    // Insert journal entry
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update streak data
    await updateStreaks(
      supabase,
      userId,
      typeof payload.is_winner === 'boolean' ? payload.is_winner : null,
      typeof payload.trade_date === 'string' ? payload.trade_date : undefined,
    )

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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const normalizedUpdates = normalizeJournalWritePayload(updates, 'update')

    const { data, error } = await supabase
      .from('journal_entries')
      .update(normalizedUpdates)
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
  isWinner: boolean | null,
  tradeDate?: string
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
    .from('journal_entries')
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
