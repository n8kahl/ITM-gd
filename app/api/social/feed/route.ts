import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSocialUserMetaMap } from '@/lib/social/membership'
import type { FeedResponse, SocialFeedItem } from '@/lib/types/social'
import { createFeedItemSchema, feedQuerySchema } from '@/lib/validation/social'
import { buildFeedVisibilityFilter } from '@/lib/social/feed-query'

interface FeedQueryResult {
  items: SocialFeedItem[]
  totalCount: number | undefined
  hasMore: boolean
}

const SUPPORTED_REFERENCE_TABLES = new Set(['shared_trade_cards', 'user_achievements'])

function toPnlSortValue(item: SocialFeedItem): number {
  const displayData = item.display_data as unknown

  if (!displayData || typeof displayData !== 'object' || Array.isArray(displayData)) {
    return Number.NEGATIVE_INFINITY
  }

  const rawPnl = (displayData as Record<string, unknown>).pnl

  if (typeof rawPnl === 'number' && Number.isFinite(rawPnl)) {
    return rawPnl
  }

  if (typeof rawPnl === 'string') {
    const parsed = Number(rawPnl)
    if (Number.isFinite(parsed)) return parsed
  }

  return Number.NEGATIVE_INFINITY
}

async function fetchFeedRows(
  request: NextRequest,
  currentUserId: string,
): Promise<FeedQueryResult | Response> {
  const supabase = await createServerSupabaseClient()
  const searchParams = new URL(request.url).searchParams
  const parsedQuery = feedQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))

  if (!parsedQuery.success) {
    return errorResponse('Invalid query parameters', 400, parsedQuery.error.flatten())
  }

  const { type, sort, featured_only: featuredOnly, cursor, limit } = parsedQuery.data

  let baseQuery = supabase
    .from('social_feed_items')
    .select('*', { count: 'exact' })
    .or(buildFeedVisibilityFilter(currentUserId))

  if (type !== 'all') {
    baseQuery = baseQuery.eq('item_type', type)
  }

  if (featuredOnly) {
    baseQuery = baseQuery.eq('is_featured', true)
  }

  if (cursor) {
    baseQuery = baseQuery.lt('created_at', cursor)
  }

  if (sort === 'top_pnl') {
    const orderedByPnl = await baseQuery
      .order('display_data->>pnl', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (!orderedByPnl.error) {
      const rows = (orderedByPnl.data ?? []) as SocialFeedItem[]
      return {
        items: rows.slice(0, limit),
        totalCount: orderedByPnl.count ?? undefined,
        hasMore: rows.length > limit,
      }
    }

    // Fallback for environments where PostgREST expression ordering is unavailable.
    const fallback = await baseQuery
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 5, 100))

    if (fallback.error) {
      return errorResponse(fallback.error.message, 500)
    }

    const sortedRows = ((fallback.data ?? []) as SocialFeedItem[])
      .sort((left, right) => {
        const pnlDiff = toPnlSortValue(right) - toPnlSortValue(left)
        if (pnlDiff !== 0) return pnlDiff
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      })

    return {
      items: sortedRows.slice(0, limit),
      totalCount: fallback.count ?? undefined,
      hasMore: sortedRows.length > limit,
    }
  }

  const orderedQuery = sort === 'most_liked'
    ? baseQuery
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
    : baseQuery.order('created_at', { ascending: false })

  const { data, error, count } = await orderedQuery.limit(limit + 1)

  if (error) {
    return errorResponse(error.message, 500)
  }

  const rows = (data ?? []) as SocialFeedItem[]

  return {
    items: rows.slice(0, limit),
    totalCount: count ?? undefined,
    hasMore: rows.length > limit,
  }
}

export async function GET(request: NextRequest) {
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

  const feedResult = await fetchFeedRows(request, user.id)
  if (feedResult instanceof Response) {
    return feedResult
  }

  const feedItems = feedResult.items
  const userIds = Array.from(new Set(feedItems.map((item) => item.user_id)))
  const feedItemIds = feedItems.map((item) => item.id)

  const [authorMetaMap, userLikesResult] = await Promise.all([
    getSocialUserMetaMap(supabase, userIds),
    feedItemIds.length > 0
      ? supabase
          .from('social_likes')
          .select('feed_item_id')
          .eq('user_id', user.id)
          .in('feed_item_id', feedItemIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (userLikesResult.error) {
    return errorResponse(userLikesResult.error.message, 500)
  }

  const likedFeedItemIds = new Set(
    (userLikesResult.data ?? []).map((row) => row.feed_item_id),
  )

  const enrichedItems: SocialFeedItem[] = feedItems.map((item) => {
    const authorMeta = authorMetaMap.get(item.user_id)

    return {
      ...item,
      author: {
        display_name: authorMeta?.display_name ?? null,
        discord_username: authorMeta?.discord_username ?? null,
        discord_avatar: authorMeta?.discord_avatar ?? null,
        discord_user_id: authorMeta?.discord_user_id ?? null,
        membership_tier: authorMeta?.membership_tier ?? null,
      },
      user_has_liked: likedFeedItemIds.has(item.id),
      is_owner: item.user_id === user.id,
    }
  })

  const response: FeedResponse = {
    items: enrichedItems,
    next_cursor: feedResult.hasMore && enrichedItems.length > 0
      ? enrichedItems[enrichedItems.length - 1].created_at
      : null,
    has_more: feedResult.hasMore,
    total_count: feedResult.totalCount,
  }

  return successResponse(response)
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
    const parsedBody = createFeedItemSchema.safeParse(body)

    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 400, parsedBody.error.flatten())
    }

    const { item_type: itemType, reference_id: referenceId, reference_table: referenceTable, display_data: displayData, visibility } = parsedBody.data

    if (!SUPPORTED_REFERENCE_TABLES.has(referenceTable)) {
      return errorResponse(`Unsupported reference table: ${referenceTable}`, 400)
    }

    const referenceResult = referenceTable === 'shared_trade_cards'
      ? await supabase
          .from('shared_trade_cards')
          .select('id, user_id')
          .eq('id', referenceId)
          .maybeSingle()
      : await supabase
          .from('user_achievements')
          .select('id, user_id')
          .eq('id', referenceId)
          .maybeSingle()

    if (referenceResult.error) {
      return errorResponse(referenceResult.error.message, 500)
    }

    if (!referenceResult.data) {
      return errorResponse('Referenced item not found', 404)
    }

    if (referenceResult.data.user_id !== user.id) {
      return errorResponse('You can only share your own items', 403)
    }

    const { data: insertedItem, error: insertError } = await supabase
      .from('social_feed_items')
      .insert({
        user_id: user.id,
        item_type: itemType,
        reference_id: referenceId,
        reference_table: referenceTable,
        display_data: displayData,
        visibility,
      })
      .select('*')
      .single()

    if (insertError || !insertedItem) {
      return errorResponse(insertError?.message ?? 'Failed to create feed item', 500)
    }

    return successResponse(insertedItem)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
    )
  }
}
