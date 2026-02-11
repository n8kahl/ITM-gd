import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { shareTradeCardSchema } from '@/lib/validation/social'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import {
  generateTradeCardImage,
  formatPnl,
  formatPnlPercentage,
  formatHoldDuration,
} from '@/lib/social/trade-card-generator'
import type { TradeCardDisplayData } from '@/lib/types/social'
import type { TradeCardTemplate } from '@/lib/social/trade-card-generator'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rl.success) return errorResponse('Too many requests', 429)

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

    // Fetch member profile for trade card metadata
    const { data: memberProfile } = await supabase
      .from('member_profiles')
      .select('display_name, membership_tier')
      .eq('user_id', user.id)
      .single()

    // Generate trade card image (best-effort, don't block the response)
    let imageUrl: string | null = null
    try {
      const metadata = {
        symbol: entry.symbol,
        direction: (entry.direction || 'long').toUpperCase() as 'LONG' | 'SHORT',
        contractType: (entry.contract_type || 'Stock') as 'Stock' | 'Call' | 'Put',
        pnl: formatPnl(entry.pnl),
        pnlPercentage: formatPnlPercentage(entry.pnl_percentage ?? null),
        isWinner: entry.pnl > 0,
        entryPrice: entry.entry_price ? `$${entry.entry_price}` : 'N/A',
        exitPrice: entry.exit_price ? `$${entry.exit_price}` : 'N/A',
        strategy: entry.strategy ?? null,
        aiGrade: entry.ai_analysis?.grade ?? null,
        memberName: memberProfile?.display_name || 'ITM Member',
        memberTier: memberProfile?.membership_tier || 'core',
        tradeDate: new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        holdDuration: formatHoldDuration(entry.hold_duration_minutes ?? null),
      }

      const imageBuffer = await generateTradeCardImage(
        metadata,
        template as TradeCardTemplate,
      )

      // Upload to Supabase Storage
      const fileName = `trade-cards/${user.id}/${tradeCard.id}.png`
      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        })

      if (!uploadError) {
        const { data: publicUrl } = supabase.storage
          .from('public-assets')
          .getPublicUrl(fileName)
        imageUrl = publicUrl.publicUrl

        // Update the trade card with the image URL
        await supabase
          .from('shared_trade_cards')
          .update({ image_url: imageUrl, display_data: { ...displayData, image_url: imageUrl } })
          .eq('id', tradeCard.id)
      }
    } catch (imgError) {
      // Image generation is best-effort — log but don't fail the request
      console.error('Trade card image generation failed:', imgError)
    }

    // Insert into social_feed_items
    const feedDisplayData = imageUrl ? { ...displayData, image_url: imageUrl } : displayData
    const { data: feedItem, error: feedError } = await supabase
      .from('social_feed_items')
      .insert({
        user_id: user.id,
        item_type: 'trade_card',
        reference_id: tradeCard.id,
        reference_table: 'shared_trade_cards',
        display_data: feedDisplayData,
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
      image_url: imageUrl,
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
