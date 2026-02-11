import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function ensureFeedItemIsLikeable(
  itemId: string,
  currentUserId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: feedItem, error } = await supabase
    .from('social_feed_items')
    .select('id, user_id, visibility')
    .eq('id', itemId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  if (!feedItem) {
    return { ok: false, status: 404, error: 'Feed item not found' }
  }

  if (feedItem.visibility === 'private' && feedItem.user_id !== currentUserId) {
    return { ok: false, status: 403, error: 'Cannot like a private feed item' }
  }

  return { ok: true }
}

export async function POST(
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

  const visibilityCheck = await ensureFeedItemIsLikeable(sanitizedItemId, user.id)
  if (!visibilityCheck.ok) {
    return errorResponse(visibilityCheck.error, visibilityCheck.status)
  }

  const { error: insertError } = await supabase
    .from('social_likes')
    .insert({
      user_id: user.id,
      feed_item_id: sanitizedItemId,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return successResponse({ liked: true })
    }

    return errorResponse(insertError.message, 500)
  }

  return successResponse({ liked: true })
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

  const { error: deleteError } = await supabase
    .from('social_likes')
    .delete()
    .eq('user_id', user.id)
    .eq('feed_item_id', sanitizedItemId)

  if (deleteError) {
    return errorResponse(deleteError.message, 500)
  }

  return successResponse({ liked: false })
}
