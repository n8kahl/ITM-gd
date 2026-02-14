'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { journalEntryCreateSchema, journalEntryUpdateSchema } from '@/lib/validation/journal-entry'
import { sanitizeJournalEntry, sanitizeJournalWriteInput } from '@/lib/journal/sanitize-entry'
import type { JournalDirection, JournalEntry } from '@/lib/types/journal'

interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

const deleteEntrySchema = z.object({
  id: z.string().uuid(),
})

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function calculatePnl(
  direction: JournalDirection,
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
  direction: JournalDirection,
  entryPrice: number | null,
  exitPrice: number | null,
): number | null {
  if (entryPrice == null || exitPrice == null || entryPrice === 0) return null
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return round((perUnit / entryPrice) * 100, 4)
}

export async function createEntry(input: unknown): Promise<ActionResult<JournalEntry>> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = journalEntryCreateSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: 'Invalid journal entry payload' }
    }

    const payload = sanitizeJournalWriteInput(validated.data as unknown as Record<string, unknown>)

    payload.user_id = user.id
    payload.trade_date = payload.trade_date ?? new Date().toISOString()

    const direction = (payload.direction as JournalDirection | undefined) ?? 'long'
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
      console.error('createEntry failed:', error)
      return { success: false, error: 'Failed to create entry' }
    }

    revalidatePath('/members/journal')
    revalidatePath('/members')

    return {
      success: true,
      data: sanitizeJournalEntry(data),
    }
  } catch (error) {
    console.error('createEntry error:', error)
    return { success: false, error: 'Failed to create entry' }
  }
}

export async function updateEntry(input: unknown): Promise<ActionResult<JournalEntry>> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = journalEntryUpdateSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: 'Invalid journal entry payload' }
    }

    const { id } = validated.data

    const { data: existing, error: loadError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (loadError || !existing) {
      return { success: false, error: 'Entry not found' }
    }

    const payload = sanitizeJournalWriteInput(validated.data as unknown as Record<string, unknown>)
    delete payload.id

    const direction = (payload.direction as JournalDirection | undefined) ?? existing.direction
    const nextEntryPrice = toNumber(payload.entry_price ?? existing.entry_price)
    const nextExitPrice = toNumber(payload.exit_price ?? existing.exit_price)
    const nextPositionSize = toNumber(payload.position_size ?? existing.position_size)

    const priceFieldsChanged = (
      Object.prototype.hasOwnProperty.call(payload, 'entry_price')
      || Object.prototype.hasOwnProperty.call(payload, 'exit_price')
      || Object.prototype.hasOwnProperty.call(payload, 'direction')
      || Object.prototype.hasOwnProperty.call(payload, 'position_size')
    )

    if (priceFieldsChanged && !Object.prototype.hasOwnProperty.call(payload, 'pnl')) {
      payload.pnl = calculatePnl(direction, nextEntryPrice, nextExitPrice, nextPositionSize)
    }

    if (priceFieldsChanged && !Object.prototype.hasOwnProperty.call(payload, 'pnl_percentage')) {
      payload.pnl_percentage = calculatePnlPercentage(direction, nextEntryPrice, nextExitPrice)
    }

    if (
      existing.is_open
      && payload.exit_price != null
      && !Object.prototype.hasOwnProperty.call(payload, 'is_open')
    ) {
      payload.is_open = false
    }

    const mergedValidation = journalEntryCreateSchema.safeParse({
      ...existing,
      ...payload,
    })

    if (!mergedValidation.success) {
      return { success: false, error: 'Invalid journal entry payload' }
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error || !data) {
      console.error('updateEntry failed:', error)
      return { success: false, error: 'Failed to update entry' }
    }

    revalidatePath('/members/journal')
    revalidatePath('/members')

    return {
      success: true,
      data: sanitizeJournalEntry(data),
    }
  } catch (error) {
    console.error('updateEntry error:', error)
    return { success: false, error: 'Failed to update entry' }
  }
}

export async function deleteEntry(input: unknown): Promise<ActionResult<null>> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = deleteEntrySchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: 'Invalid journal entry payload' }
    }

    const { data: existing, error: existingError } = await supabase
      .from('journal_entries')
      .select('id,screenshot_storage_path')
      .eq('id', validated.data.id)
      .eq('user_id', user.id)
      .single()

    if (existingError || !existing) {
      return { success: false, error: 'Entry not found' }
    }

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', validated.data.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('deleteEntry failed:', error)
      return { success: false, error: 'Failed to delete entry' }
    }

    if (typeof existing.screenshot_storage_path === 'string' && existing.screenshot_storage_path.length > 0) {
      const { error: storageError } = await supabase
        .storage
        .from('journal-screenshots')
        .remove([existing.screenshot_storage_path])

      if (storageError) {
        console.error('deleteEntry screenshot cleanup failed:', storageError)
      }
    }

    revalidatePath('/members/journal')
    revalidatePath('/members')

    return { success: true, data: null }
  } catch (error) {
    console.error('deleteEntry error:', error)
    return { success: false, error: 'Failed to delete entry' }
  }
}
