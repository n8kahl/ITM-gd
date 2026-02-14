import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { deleteTradeCardFromStorage } from '@/lib/uploads/trade-card-storage'

interface FeedItemRow {
  id: string
  user_id: string
  item_type: string
  reference_id: string | null
  reference_table: string | null
  display_data: Record<string, unknown> | null
}

interface SharedTradeCardRow {
  id: string
  user_id: string
  image_url: string | null
}

function getDisplayDataImageUrl(displayData: Record<string, unknown> | null): string | null {
  if (!displayData || Array.isArray(displayData)) return null

  const imageUrl = displayData.image_url
  if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
    return imageUrl.trim()
  }

  return null
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
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

  const { itemId } = await params
  const sanitizedItemId = sanitizeUUID(itemId)
  if (!sanitizedItemId) {
    return errorResponse('Invalid item ID', 400)
  }

  const { data: feedItem, error: feedItemError } = await supabase
    .from('social_feed_items')
    .select('id, user_id, item_type, reference_id, reference_table, display_data')
    .eq('id', sanitizedItemId)
    .maybeSingle<FeedItemRow>()

  if (feedItemError) {
    return errorResponse(feedItemError.message, 500)
  }

  if (!feedItem) {
    return errorResponse('Feed item not found', 404)
  }

  if (feedItem.user_id !== user.id) {
    return errorResponse('You can only delete your own feed items', 403)
  }

  let imageUrlToDelete = getDisplayDataImageUrl(feedItem.display_data)

  if (
    feedItem.item_type === 'trade_card'
    && feedItem.reference_table === 'shared_trade_cards'
    && feedItem.reference_id
  ) {
    const { data: sharedCard, error: sharedCardError } = await supabase
      .from('shared_trade_cards')
      .select('id, user_id, image_url')
      .eq('id', feedItem.reference_id)
      .maybeSingle<SharedTradeCardRow>()

    if (sharedCardError) {
      return errorResponse(sharedCardError.message, 500)
    }

    if (sharedCard && sharedCard.user_id !== user.id) {
      return errorResponse('You can only delete your own trade cards', 403)
    }

    if (sharedCard?.image_url) {
      imageUrlToDelete = sharedCard.image_url
    }

    const { error: sharedCardDeleteError } = await supabase
      .from('shared_trade_cards')
      .delete()
      .eq('id', feedItem.reference_id)
      .eq('user_id', user.id)

    if (sharedCardDeleteError) {
      return errorResponse(sharedCardDeleteError.message, 500)
    }
  }

  const { error: feedDeleteError } = await supabase
    .from('social_feed_items')
    .delete()
    .eq('id', sanitizedItemId)
    .eq('user_id', user.id)

  if (feedDeleteError) {
    return errorResponse(feedDeleteError.message, 500)
  }

  if (imageUrlToDelete) {
    try {
      await deleteTradeCardFromStorage(imageUrlToDelete)
    } catch (storageError) {
      console.error('Failed to delete shared trade card image from storage:', storageError)
    }
  }

  return successResponse({ deleted: true, item_id: sanitizedItemId })
}
