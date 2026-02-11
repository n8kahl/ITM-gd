import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import {
  formatHoldDuration,
  formatPnl,
  formatPnlPercentage,
  type TradeCardFormat,
  generateTradeCardImage,
  type TradeCardTemplate,
} from '@/lib/social/trade-card-generator'
import { getSocialUserMetaMap } from '@/lib/social/membership'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TradeCardDisplayData } from '@/lib/types/social'
import { shareTradeCardSchema } from '@/lib/validation/social'
import { uploadTradeCardToStorage } from '@/lib/uploads/trade-card-storage'

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function formatUsd(value: number | null): string {
  if (value == null) return 'N/A'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function toContractTypeLabel(contractType: unknown): 'Stock' | 'Call' | 'Put' {
  if (contractType === 'call') return 'Call'
  if (contractType === 'put') return 'Put'
  return 'Stock'
}

function toDirectionLabel(direction: unknown): 'LONG' | 'SHORT' {
  return direction === 'short' ? 'SHORT' : 'LONG'
}

async function cleanupUploadedTradeCard(uploadPath: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey)
    await admin.storage.from('trade-cards').remove([uploadPath])
  } catch (cleanupError) {
    console.error('Failed to clean up uploaded trade card image:', cleanupError)
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimitResult = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rateLimitResult.success) {
    return errorResponse('Too many requests', 429)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const body = await request.json()
    const parsedBody = shareTradeCardSchema.safeParse(body)

    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 400, parsedBody.error.flatten())
    }

    const {
      journal_entry_id: journalEntryId,
      template,
      format,
      visibility,
      share_to_discord: shareToDiscord,
    } = parsedBody.data

    const { data: journalEntry, error: journalEntryError } = await supabase
      .from('journal_entries')
      .select('id, symbol, direction, contract_type, pnl, pnl_percentage, entry_price, exit_price, strategy, ai_analysis, trade_date, hold_duration_min, is_open, created_at')
      .eq('id', journalEntryId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (journalEntryError) {
      return errorResponse(journalEntryError.message, 500)
    }

    if (!journalEntry) {
      return errorResponse('Journal entry not found', 404)
    }

    if (journalEntry.is_open) {
      return errorResponse('Cannot share an open trade', 400)
    }

    const pnlValue = toNumber(journalEntry.pnl)
    if (pnlValue == null) {
      return errorResponse('Cannot share a trade without P&L data', 400)
    }

    const { data: existingCards, error: existingCardsError } = await supabase
      .from('shared_trade_cards')
      .select('id')
      .eq('user_id', user.id)
      .eq('journal_entry_id', journalEntryId)
      .limit(1)

    if (existingCardsError) {
      return errorResponse(existingCardsError.message, 500)
    }

    if ((existingCards?.length ?? 0) > 0) {
      return errorResponse('This trade has already been shared', 409)
    }

    const socialMetaMap = await getSocialUserMetaMap(supabase, [user.id])
    const currentUserMeta = socialMetaMap.get(user.id)

    const direction = toDirectionLabel(journalEntry.direction)
    const contractType = toContractTypeLabel(journalEntry.contract_type)
    const pnlPercentageValue = toNumber(journalEntry.pnl_percentage)
    const tradeDate = new Date(journalEntry.trade_date || journalEntry.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const aiGrade = (
      journalEntry.ai_analysis
      && typeof journalEntry.ai_analysis === 'object'
      && !Array.isArray(journalEntry.ai_analysis)
      && typeof (journalEntry.ai_analysis as Record<string, unknown>).grade === 'string'
    )
      ? (journalEntry.ai_analysis as Record<string, unknown>).grade as string
      : null

    const displayData: TradeCardDisplayData = {
      symbol: journalEntry.symbol,
      direction: direction === 'SHORT' ? 'short' : 'long',
      contract_type: contractType.toLowerCase() as 'stock' | 'call' | 'put',
      pnl: pnlValue,
      pnl_percentage: pnlPercentageValue,
      is_winner: pnlValue > 0,
      template,
      image_url: null,
      ai_grade: aiGrade,
      strategy: journalEntry.strategy,
      entry_price: toNumber(journalEntry.entry_price),
      exit_price: toNumber(journalEntry.exit_price),
    }

    const imageBuffer = await generateTradeCardImage(
      {
        symbol: journalEntry.symbol,
        direction,
        contractType,
        pnl: formatPnl(pnlValue),
        pnlPercentage: formatPnlPercentage(pnlPercentageValue),
        isWinner: pnlValue > 0,
        entryPrice: formatUsd(toNumber(journalEntry.entry_price)),
        exitPrice: formatUsd(toNumber(journalEntry.exit_price)),
        strategy: journalEntry.strategy,
        aiGrade,
        memberName: currentUserMeta?.display_name || currentUserMeta?.discord_username || 'ITM Member',
        memberTier: currentUserMeta?.membership_tier || 'core',
        tradeDate,
        holdDuration: formatHoldDuration(toNumber(journalEntry.hold_duration_min)),
      },
      template as TradeCardTemplate,
      format as TradeCardFormat,
    )

    const uploadPath = `shared/${user.id}/${journalEntryId}-${Date.now()}.png`
    const imageUrl = await uploadTradeCardToStorage(imageBuffer, uploadPath)

    const cardConfig = {
      source: 'journal_entry',
      template,
      format,
      visibility,
      share_to_discord: shareToDiscord,
      display_data: {
        ...displayData,
        image_url: imageUrl,
      },
    }

    const { data: tradeCard, error: tradeCardError } = await supabase
      .from('shared_trade_cards')
      .insert({
        user_id: user.id,
        journal_entry_id: journalEntryId,
        template,
        card_config: cardConfig,
        image_url: imageUrl,
        share_platform: 'community_feed',
        is_public: visibility === 'public',
      })
      .select('*')
      .single()

    if (tradeCardError || !tradeCard) {
      await cleanupUploadedTradeCard(uploadPath)
      return errorResponse(tradeCardError?.message ?? 'Failed to create shared trade card', 500)
    }

    const { data: feedItem, error: feedItemError } = await supabase
      .from('social_feed_items')
      .insert({
        user_id: user.id,
        item_type: 'trade_card',
        reference_id: tradeCard.id,
        reference_table: 'shared_trade_cards',
        display_data: {
          ...displayData,
          image_url: imageUrl,
        },
        visibility,
      })
      .select('*')
      .single()

    if (feedItemError || !feedItem) {
      await Promise.all([
        supabase.from('shared_trade_cards').delete().eq('id', tradeCard.id),
        cleanupUploadedTradeCard(uploadPath),
      ])

      return errorResponse(feedItemError?.message ?? 'Failed to create social feed item', 500)
    }

    return successResponse({
      feed_item: feedItem,
      trade_card: tradeCard,
      image_url: imageUrl,
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
    )
  }
}
