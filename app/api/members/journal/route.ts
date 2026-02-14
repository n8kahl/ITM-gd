import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { contractTypeSchema, directionSchema, journalEntryCreateSchema, journalEntryUpdateSchema } from '@/lib/validation/journal-entry'
import { sanitizeJournalEntries, sanitizeJournalEntry, sanitizeJournalWriteInput } from '@/lib/journal/sanitize-entry'

const listQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  symbol: z.string().max(16).optional(),
  direction: directionSchema.optional(),
  contractType: contractTypeSchema.optional(),
  isWinner: z.enum(['true', 'false']).optional(),
  isOpen: z.enum(['true', 'false']).optional(),
  tags: z.string().optional(),
  sortBy: z.enum(['trade_date', 'pnl', 'symbol']).default('trade_date'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const deleteQuerySchema = z.object({
  id: z.string().uuid(),
})

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toDateKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0]
  return parsed.toISOString().split('T')[0]
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function calculatePnl(
  direction: 'long' | 'short',
  entryPrice: number | null,
  exitPrice: number | null,
  positionSize: number | null,
): number | null {
  if (entryPrice == null || exitPrice == null) return null
  const size = positionSize && positionSize > 0 ? positionSize : 1
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return round(perUnit * size, 2)
}

function calculatePnlPercentage(
  direction: 'long' | 'short',
  entryPrice: number | null,
  exitPrice: number | null,
): number | null {
  if (entryPrice == null || exitPrice == null || entryPrice === 0) return null
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return round((perUnit / entryPrice) * 100, 4)
}

async function recalculateStreaks(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('trade_date')
    .eq('user_id', userId)
    .order('trade_date', { ascending: true })

  if (error) {
    console.error('Failed to recalculate streaks (load entries):', error)
    return
  }

  const dateSet = new Set<string>()
  for (const row of data ?? []) {
    if (typeof row.trade_date === 'string') {
      dateSet.add(toDateKey(row.trade_date))
    }
  }

  const dates = Array.from(dateSet).sort()

  if (dates.length === 0) {
    await supabase.from('journal_streaks').upsert({
      user_id: userId,
      current_streak: 0,
      longest_streak: 0,
      last_entry_date: null,
      updated_at: new Date().toISOString(),
    })
    return
  }

  let longest = 1
  let running = 1

  for (let index = 1; index < dates.length; index += 1) {
    const expected = addDays(dates[index - 1], 1)
    if (dates[index] === expected) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 1
    }
  }

  let current = 1
  for (let index = dates.length - 1; index > 0; index -= 1) {
    const expectedPrevious = addDays(dates[index], -1)
    if (dates[index - 1] === expectedPrevious) {
      current += 1
    } else {
      break
    }
  }

  await supabase.from('journal_streaks').upsert({
    user_id: userId,
    current_streak: current,
    longest_streak: longest,
    last_entry_date: dates[dates.length - 1],
    updated_at: new Date().toISOString(),
  })
}

function invalidRequest(error: ZodError) {
  return errorResponse('Invalid request', 400, error.flatten())
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const { searchParams } = new URL(request.url)

    const parsedQuery = listQuerySchema.parse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      symbol: searchParams.get('symbol') ?? undefined,
      direction: searchParams.get('direction') ?? undefined,
      contractType: searchParams.get('contractType') ?? undefined,
      isWinner: searchParams.get('isWinner') ?? undefined,
      isOpen: searchParams.get('isOpen') ?? undefined,
      tags: searchParams.get('tags') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: searchParams.get('sortDir') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    const startDate = parsedQuery.startDate ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = parsedQuery.endDate ?? new Date().toISOString()
    const tags = parsedQuery.tags
      ? parsedQuery.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : []

    let query = supabase
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('trade_date', startDate)
      .lte('trade_date', endDate)

    if (parsedQuery.symbol) {
      query = query.ilike('symbol', `%${parsedQuery.symbol.toUpperCase()}%`)
    }

    if (parsedQuery.direction) {
      query = query.eq('direction', parsedQuery.direction)
    }

    if (parsedQuery.contractType) {
      query = query.eq('contract_type', parsedQuery.contractType)
    }

    if (parsedQuery.isWinner) {
      query = query.eq('is_winner', parsedQuery.isWinner === 'true')
    }

    if (parsedQuery.isOpen) {
      query = query.eq('is_open', parsedQuery.isOpen === 'true')
    }

    if (tags.length > 0) {
      query = query.overlaps('tags', tags)
    }

    const { data, error, count } = await query
      .order(parsedQuery.sortBy, { ascending: parsedQuery.sortDir === 'asc' })
      .range(parsedQuery.offset, parsedQuery.offset + parsedQuery.limit - 1)

    if (error) {
      console.error('Failed to list journal entries:', error)
      return errorResponse('Failed to load journal entries', 500)
    }

    const { data: streak } = await supabase
      .from('journal_streaks')
      .select('current_streak,longest_streak')
      .eq('user_id', user.id)
      .maybeSingle()

    return successResponse(sanitizeJournalEntries(data), {
      total: count ?? 0,
      streaks: {
        current_streak: streak?.current_streak ?? 0,
        longest_streak: streak?.longest_streak ?? 0,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) return invalidRequest(error)

    console.error('Journal GET failed:', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const rawBody = await request.json()
    const validated = journalEntryCreateSchema.parse(rawBody)

    const payload = sanitizeJournalWriteInput(validated as unknown as Record<string, unknown>)

    payload.user_id = user.id
    payload.trade_date = payload.trade_date ?? new Date().toISOString()

    const direction = (payload.direction as 'long' | 'short' | undefined) ?? 'long'
    const entryPrice = toNumber(payload.entry_price)
    const exitPrice = toNumber(payload.exit_price)
    const positionSize = toNumber(payload.position_size)

    if (payload.pnl == null) {
      payload.pnl = calculatePnl(direction, entryPrice, exitPrice, positionSize)
    }

    if (payload.pnl_percentage == null) {
      payload.pnl_percentage = calculatePnlPercentage(direction, entryPrice, exitPrice)
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .insert(payload)
      .select('*')
      .single()

    if (error || !data) {
      console.error('Failed to create journal entry:', error)
      return errorResponse('Failed to create journal entry', 500)
    }

    await recalculateStreaks(supabase, user.id)

    return successResponse(sanitizeJournalEntry(data))
  } catch (error) {
    if (error instanceof ZodError) return invalidRequest(error)

    console.error('Journal POST failed:', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const rawBody = await request.json()
    const validated = journalEntryUpdateSchema.parse(rawBody)
    const { id } = validated

    const { data: existing, error: existingError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError || !existing) {
      return errorResponse('Entry not found', 404)
    }

    const updatePayload = sanitizeJournalWriteInput(validated as unknown as Record<string, unknown>)

    const nextDirection = (updatePayload.direction as 'long' | 'short' | undefined) ?? existing.direction
    const nextEntryPrice = toNumber(updatePayload.entry_price ?? existing.entry_price)
    const nextExitPrice = toNumber(updatePayload.exit_price ?? existing.exit_price)
    const nextPositionSize = toNumber(updatePayload.position_size ?? existing.position_size)

    const recalculationRequested = (
      Object.prototype.hasOwnProperty.call(updatePayload, 'entry_price')
      || Object.prototype.hasOwnProperty.call(updatePayload, 'exit_price')
      || Object.prototype.hasOwnProperty.call(updatePayload, 'direction')
      || Object.prototype.hasOwnProperty.call(updatePayload, 'position_size')
    )

    if (recalculationRequested && !Object.prototype.hasOwnProperty.call(updatePayload, 'pnl')) {
      updatePayload.pnl = calculatePnl(nextDirection, nextEntryPrice, nextExitPrice, nextPositionSize)
    }

    if (recalculationRequested && !Object.prototype.hasOwnProperty.call(updatePayload, 'pnl_percentage')) {
      updatePayload.pnl_percentage = calculatePnlPercentage(nextDirection, nextEntryPrice, nextExitPrice)
    }

    if (
      existing.is_open
      && updatePayload.exit_price != null
      && !Object.prototype.hasOwnProperty.call(updatePayload, 'is_open')
    ) {
      updatePayload.is_open = false
    }

    const mergedValidation = journalEntryCreateSchema.safeParse({
      ...existing,
      ...updatePayload,
    })

    if (!mergedValidation.success) {
      return errorResponse('Invalid journal entry payload', 400, mergedValidation.error.flatten())
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error || !data) {
      console.error('Failed to update journal entry:', error)
      return errorResponse('Failed to update journal entry', 500)
    }

    if (
      Object.prototype.hasOwnProperty.call(updatePayload, 'trade_date')
      || Object.prototype.hasOwnProperty.call(updatePayload, 'pnl')
    ) {
      await recalculateStreaks(supabase, user.id)
    }

    return successResponse(sanitizeJournalEntry(data))
  } catch (error) {
    if (error instanceof ZodError) return invalidRequest(error)

    console.error('Journal PATCH failed:', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const { searchParams } = new URL(request.url)
    const parsed = deleteQuerySchema.parse({ id: searchParams.get('id') })

    const { data: existing, error: existingError } = await supabase
      .from('journal_entries')
      .select('id,screenshot_storage_path')
      .eq('id', parsed.id)
      .eq('user_id', user.id)
      .single()

    if (existingError || !existing) {
      return errorResponse('Entry not found', 404)
    }

    const { error: deleteError } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', parsed.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete journal entry:', deleteError)
      return errorResponse('Failed to delete journal entry', 500)
    }

    if (typeof existing.screenshot_storage_path === 'string' && existing.screenshot_storage_path.length > 0) {
      const { error: storageError } = await supabase
        .storage
        .from('journal-screenshots')
        .remove([existing.screenshot_storage_path])

      if (storageError) {
        console.error('Failed to delete journal screenshot:', storageError)
      }
    }

    await recalculateStreaks(supabase, user.id)

    return successResponse({ deleted: true })
  } catch (error) {
    if (error instanceof ZodError) return invalidRequest(error)

    console.error('Journal DELETE failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
