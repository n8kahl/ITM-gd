import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { shareTradeCardSchema } from '@/lib/validation/social'
import type { TradeCardDisplayData } from '@/lib/types/social'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const body = await request.json()
    const parsed = shareTradeCardSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('Invalid request body', 400, parsed.error.flatten())
    }

    const { journal_entry_id, template, visibility } = parsed.data

    // Fetch the journal entry
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', journal_entry_id)
      .eq('user_id', user.id)
      .single()

    if (entryError || !entry) {
      return errorResponse('Journal entry not found', 404)
    }

    if (entry.is_open) {
      return errorResponse('Cannot share an open trade', 400)
    }

    if (entry.pnl === null || entry.pnl === undefined) {
      return errorResponse('Cannot share a trade without P&L data', 400)
    }

    // Check if already shared
    const { data: existingCard } = await supabase
      .from('shared_trade_cards')
      .select('id')
      .eq('journal_entry_id', journal_entry_id)
      .eq('user_id', user.id)
      .single()

    if (existingCard) {
      return errorResponse('This trade has already been shared', 409)
    }

    // Build display data
    const displayData: TradeCardDisplayData = {
      symbol: entry.symbol,
      direction: entry.direction || 'long',
      contract_type: entry.contract_type || 'stock',
      pnl: entry.pnl,
      pnl_percentage: entry.pnl_percentage ?? null,
      is_winner: entry.pnl > 0,
      template,
      image_url: null,
      ai_grade: entry.ai_analysis?.grade ?? null,
      strategy: entry.strategy ?? null,
      entry_price: entry.entry_price ?? null,
      exit_price: entry.exit_price ?? null,
    }

    // Insert into shared_trade_cards
    const { data: tradeCard, error: cardError } = await supabase
      .from('shared_trade_cards')
      .insert({
        user_id: user.id,
        journal_entry_id,
        template,
        display_data: displayData,
        is_public: visibility === 'public',
      })
      .select('*')
      .single()

    if (cardError) {
      return errorResponse(cardError.message, 500)
    }

    // Insert into social_feed_items
    const { data: feedItem, error: feedError } = await supabase
      .from('social_feed_items')
      .insert({
        user_id: user.id,
        item_type: 'trade_card',
        reference_id: tradeCard.id,
        reference_table: 'shared_trade_cards',
        display_data: displayData,
        visibility,
      })
      .select('*')
      .single()

    if (feedError) {
      return errorResponse(feedError.message, 500)
    }

    return successResponse({
      feed_item: feedItem,
      trade_card: tradeCard,
      image_url: tradeCard.image_url ?? null,
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
