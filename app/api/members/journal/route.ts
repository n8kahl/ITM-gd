import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { sanitizeJournalEntries, sanitizeJournalEntry } from '@/lib/journal/sanitize-entry'
import { enqueueJournalAnalyticsRefresh } from '@/lib/journal/analytics-refresh-queue'
import { journalEntrySchema, journalEntryUpdateSchema } from '@/lib/validation/journal-entry'

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

function parseMaybeInteger(value: unknown): number | null {
  const parsed = parseMaybeNumber(value)
  if (parsed == null) return null
  return Number.isInteger(parsed) ? parsed : Math.round(parsed)
}

function normalizeDirection(value: unknown): 'long' | 'short' | 'neutral' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (['long', 'call', 'bullish', 'buy'].includes(normalized)) return 'long'
  if (['short', 'put', 'bearish', 'sell'].includes(normalized)) return 'short'
  if (normalized === 'neutral') return 'neutral'
  return null
}

function normalizeContractType(value: unknown): 'stock' | 'call' | 'put' | 'spread' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (['stock', 'equity'].includes(normalized)) return 'stock'
  if (['call', 'calls'].includes(normalized)) return 'call'
  if (['put', 'puts'].includes(normalized)) return 'put'
  if (['spread', 'credit_spread', 'debit_spread'].includes(normalized)) return 'spread'
  return null
}

function normalizeMood(value: unknown): 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim()
  if (['confident', 'neutral', 'anxious', 'frustrated', 'excited', 'fearful'].includes(normalized)) {
    return normalized as 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful'
  }
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

  const entryTimestamp = getFirstDefined<unknown>(input.entry_timestamp, input.entryTimestamp)
  if (entryTimestamp !== undefined) {
    payload.entry_timestamp =
      typeof entryTimestamp === 'string' && entryTimestamp.trim().length > 0
        ? entryTimestamp.trim()
        : null
  }

  const exitTimestamp = getFirstDefined<unknown>(input.exit_timestamp, input.exitTimestamp)
  if (exitTimestamp !== undefined) {
    payload.exit_timestamp =
      typeof exitTimestamp === 'string' && exitTimestamp.trim().length > 0
        ? exitTimestamp.trim()
        : null
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

  if (input.stop_loss !== undefined) {
    payload.stop_loss = parseMaybeNumber(input.stop_loss)
  }

  if (input.initial_target !== undefined) {
    payload.initial_target = parseMaybeNumber(input.initial_target)
  }

  if (input.strategy !== undefined) {
    payload.strategy = typeof input.strategy === 'string' && input.strategy.trim().length > 0
      ? input.strategy.trim()
      : null
  }

  if (input.hold_duration_min !== undefined) {
    payload.hold_duration_min = parseMaybeInteger(input.hold_duration_min)
  }

  if (input.mfe_percent !== undefined) {
    payload.mfe_percent = parseMaybeNumber(input.mfe_percent)
  }

  if (input.mae_percent !== undefined) {
    payload.mae_percent = parseMaybeNumber(input.mae_percent)
  }

  if (input.contract_type !== undefined) {
    payload.contract_type = normalizeContractType(input.contract_type)
  }

  if (input.strike_price !== undefined) {
    payload.strike_price = parseMaybeNumber(input.strike_price)
  }

  if (input.expiration_date !== undefined) {
    payload.expiration_date = typeof input.expiration_date === 'string' && input.expiration_date.trim().length > 0
      ? input.expiration_date.trim()
      : null
  }

  if (input.dte_at_entry !== undefined) {
    payload.dte_at_entry = parseMaybeInteger(input.dte_at_entry)
  }

  if (input.dte_at_exit !== undefined) {
    payload.dte_at_exit = parseMaybeInteger(input.dte_at_exit)
  }

  if (input.iv_at_entry !== undefined) {
    payload.iv_at_entry = parseMaybeNumber(input.iv_at_entry)
  }

  if (input.iv_at_exit !== undefined) {
    payload.iv_at_exit = parseMaybeNumber(input.iv_at_exit)
  }

  if (input.delta_at_entry !== undefined) {
    payload.delta_at_entry = parseMaybeNumber(input.delta_at_entry)
  }

  if (input.theta_at_entry !== undefined) {
    payload.theta_at_entry = parseMaybeNumber(input.theta_at_entry)
  }

  if (input.gamma_at_entry !== undefined) {
    payload.gamma_at_entry = parseMaybeNumber(input.gamma_at_entry)
  }

  if (input.vega_at_entry !== undefined) {
    payload.vega_at_entry = parseMaybeNumber(input.vega_at_entry)
  }

  if (input.underlying_at_entry !== undefined) {
    payload.underlying_at_entry = parseMaybeNumber(input.underlying_at_entry)
  }

  if (input.underlying_at_exit !== undefined) {
    payload.underlying_at_exit = parseMaybeNumber(input.underlying_at_exit)
  }

  if (input.mood_before !== undefined) {
    payload.mood_before = normalizeMood(input.mood_before)
  }

  if (input.mood_after !== undefined) {
    payload.mood_after = normalizeMood(input.mood_after)
  }

  if (input.discipline_score !== undefined) {
    payload.discipline_score = parseMaybeInteger(input.discipline_score)
  }

  if (input.followed_plan !== undefined) {
    payload.followed_plan = parseMaybeBoolean(input.followed_plan)
  }

  if (input.deviation_notes !== undefined) {
    payload.deviation_notes = typeof input.deviation_notes === 'string' && input.deviation_notes.trim().length > 0
      ? input.deviation_notes.trim()
      : null
  }

  if (input.session_id !== undefined) {
    payload.session_id = typeof input.session_id === 'string' && input.session_id.trim().length > 0
      ? input.session_id.trim()
      : null
  }

  if (input.is_favorite !== undefined) {
    const maybeFavorite = parseMaybeBoolean(input.is_favorite)
    if (maybeFavorite !== null) {
      payload.is_favorite = maybeFavorite
    }
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

  if (input.setup_notes !== undefined) {
    payload.setup_notes = typeof input.setup_notes === 'string' ? input.setup_notes : null
  }
  if (input.execution_notes !== undefined) {
    payload.execution_notes = typeof input.execution_notes === 'string' ? input.execution_notes : null
  }
  if (input.lessons_learned !== undefined) {
    payload.lessons_learned = typeof input.lessons_learned === 'string' ? input.lessons_learned : null
  }

  if (input.tags !== undefined) {
    payload.tags = normalizeTags(input.tags)
  } else if (mode === 'create') {
    payload.tags = []
  }

  if (input.rating !== undefined) {
    payload.rating = parseMaybeNumber(input.rating)
  }

  if (input.ai_analysis !== undefined) {
    payload.ai_analysis = input.ai_analysis
  }

  if (input.is_winner !== undefined) {
    payload.is_winner = parseMaybeBoolean(input.is_winner)
  } else if (mode === 'create' && typeof payload.pnl === 'number') {
    payload.is_winner = payload.pnl > 0 ? true : payload.pnl < 0 ? false : null
  }

  // Draft entries are deprecated from the member journal flow.
  // Always persist standard entries only.
  payload.is_draft = false
  payload.draft_status = null
  payload.draft_expires_at = null

  return payload
}

// ============================================
// CANONICAL TABLE: journal_entries
// Field names match lib/types/journal.ts:
//   direction, pnl, pnl_percentage, position_size
// ============================================

// GET - Fetch journal entries for user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(500, Math.max(parsedLimit, 1))
      : 50

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .or('is_draft.is.null,is_draft.eq.false')
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
      data: sanitizeJournalEntries(entries || []),
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
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const parsedBody = journalEntrySchema.parse(body)
    const payload = normalizeJournalWritePayload(parsedBody, 'create')
    const symbol = typeof payload.symbol === 'string' ? payload.symbol : ''
    if (!symbol || !symbol.trim()) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

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

    enqueueJournalAnalyticsRefresh(userId)

    return NextResponse.json({ success: true, data: sanitizeJournalEntry(entry, 'new-entry') })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Invalid journal entry payload',
        details: error.flatten(),
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// PATCH - Update journal entry
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { id, ...rawUpdates } = body

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const parsedUpdates = journalEntryUpdateSchema.parse(rawUpdates)

    // Map any legacy field names to canonical names
    const updates: Record<string, unknown> = { ...parsedUpdates }
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

    enqueueJournalAnalyticsRefresh(userId)

    return NextResponse.json({ success: true, data: sanitizeJournalEntry(data[0], 'updated-entry') })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Invalid journal update payload',
        details: error.flatten(),
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// DELETE - Delete journal entry
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    const userId = auth?.user.id ?? null

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

    enqueueJournalAnalyticsRefresh(userId)

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
    .or('is_draft.is.null,is_draft.eq.false')
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
