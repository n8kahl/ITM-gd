'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export interface JournalEntryInput {
  trade_date?: string
  symbol?: string | null
  direction?: 'long' | 'short' | 'neutral' | null
  entry_price?: number | null
  exit_price?: number | null
  position_size?: number | null
  pnl?: number | null
  pnl_percentage?: number | null
  screenshot_url?: string | null
  screenshot_thumbnail_url?: string | null
  screenshot_storage_path?: string | null
  ai_analysis?: any
  setup_notes?: string | null
  execution_notes?: string | null
  lessons_learned?: string | null
  tags?: string[]
  rating?: number | null
  is_winner?: boolean | null
}

/**
 * Create a new journal entry
 */
export async function createEntry(data: JournalEntryInput): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Insert entry
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        ...data,
      })
      .select()
      .single()

    if (error) {
      console.error('Create entry error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/members/journal')

    return { success: true, data: entry }
  } catch (error) {
    console.error('createEntry error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create entry'
    }
  }
}

/**
 * Update an existing journal entry
 */
export async function updateEntry(
  id: string,
  data: JournalEntryInput
): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update entry (RLS will ensure user owns it)
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .update(data)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Update entry error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/members/journal')

    return { success: true, data: entry }
  } catch (error) {
    console.error('updateEntry error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update entry'
    }
  }
}

/**
 * Delete a journal entry
 */
export async function deleteEntry(id: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Delete entry (RLS will ensure user owns it)
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete entry error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/members/journal')

    return { success: true }
  } catch (error) {
    console.error('deleteEntry error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete entry'
    }
  }
}

/**
 * Get all journal entries for the current user
 */
export async function getEntries(options?: {
  limit?: number
  offset?: number
  orderBy?: 'trade_date' | 'created_at'
  orderDirection?: 'asc' | 'desc'
}): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const {
      limit = 50,
      offset = 0,
      orderBy = 'trade_date',
      orderDirection = 'desc'
    } = options || {}

    // Fetch entries
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: entries, error } = await query

    if (error) {
      console.error('Get entries error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: entries }
  } catch (error) {
    console.error('getEntries error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch entries'
    }
  }
}

/**
 * Get journal statistics for the current user
 */
export async function getJournalStats(): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Call RPC function
    const { data, error } = await supabase
      .rpc('get_journal_stats', { target_user_id: user.id })
      .maybeSingle()

    if (error) {
      console.error('Get stats error:', error)
      return { success: false, error: error.message }
    }

    // Return default stats when user has no journal entries
    return {
      success: true,
      data: data ?? {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        avg_pnl: 0,
        best_trade: 0,
        worst_trade: 0,
        unique_symbols: 0,
        last_trade_date: null,
      },
    }
  } catch (error) {
    console.error('getJournalStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics'
    }
  }
}
