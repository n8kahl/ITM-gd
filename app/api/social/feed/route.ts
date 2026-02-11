import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { feedQuerySchema, createFeedItemSchema } from '@/lib/validation/social'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import type { FeedResponse, SocialFeedItem } from '@/lib/types/social'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rl.success) return errorResponse('Too many requests', 429)

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    const parsed = feedQuerySchema.safeParse(params)

    if (!parsed.success) {
      return errorResponse('Invalid query parameters', 400, parsed.error.flatten())
    }

    const { type, sort, featured_only, cursor, limit } = parsed.data

    // Build the query
    let query = supabase
      .from('social_feed_items')
      .select('*')
      .in('visibility', ['public', 'members'])

    // Filter by type
    if (type !== 'all') {
      query = query.eq('item_type', type)
    }

    // Filter by featured
    if (featured_only) {
      query = query.eq('is_featured', true)
    }

    // Cursor-based pagination
    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    // Sort
    if (sort === 'most_liked') {
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Fetch limit + 1 to detect has_more
    query = query.limit(limit + 1)

    const { data: items, error: queryError } = await query

    if (queryError) {
      return errorResponse(queryError.message, 500)
    }

    const hasMore = (items?.length ?? 0) > limit
    const feedItems = (items?.slice(0, limit) ?? []) as SocialFeedItem[]

    // Fetch author data and user likes in parallel, guarding empty arrays
    const userIds = [...new Set(feedItems.map(item => item.user_id))]
    const feedItemIds = feedItems.map(item => item.id)

    const [profilesResult, likesResult] = await Promise.all([
      userIds.length > 0
        ? supabase
            .from('member_profiles')
            .select('user_id, display_name, membership_tier')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      feedItemIds.length > 0
        ? supabase
            .from('social_likes')
            .select('feed_item_id')
            .eq('user_id', user.id)
            .in('feed_item_id', feedItemIds)
        : Promise.resolve({ data: [] }),
    ])

    const profiles = 'data' in profilesResult ? profilesResult.data : profilesResult
    const userLikes = 'data' in likesResult ? likesResult.data : likesResult

    const likedItemIds = new Set((userLikes as Array<{ feed_item_id: string }> | null)?.map(l => l.feed_item_id) || [])
    const profileMap = new Map(
      (profiles as Array<{ user_id: string; display_name: string | null; membership_tier: string | null }> | null)?.map(p => [p.user_id, p]) || []
    )

    // Enrich feed items with author data
    const enrichedItems: SocialFeedItem[] = feedItems.map(item => {
      const profile = profileMap.get(item.user_id)
      return {
        ...item,
        author: {
          display_name: profile?.display_name ?? null,
          discord_username: null,
          discord_avatar: null,
          membership_tier: profile?.membership_tier ?? null,
        },
        user_has_liked: likedItemIds.has(item.id),
      }
    })

    const response: FeedResponse = {
      items: enrichedItems,
      next_cursor: hasMore && feedItems.length > 0
        ? feedItems[feedItems.length - 1].created_at
        : null,
      has_more: hasMore,
    }

    return successResponse(response)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

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
    const parsed = createFeedItemSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('Invalid request body', 400, parsed.error.flatten())
    }

    const { item_type, reference_id, reference_table, display_data, visibility } = parsed.data

    // Verify reference exists and belongs to user
    if (reference_table === 'shared_trade_cards') {
      const { data: ref, error: refError } = await supabase
        .from('shared_trade_cards')
        .select('id, user_id')
        .eq('id', reference_id)
        .single()

      if (refError || !ref) {
        return errorResponse('Referenced item not found', 404)
      }
      if (ref.user_id !== user.id) {
        return errorResponse('You can only share your own items', 403)
      }
    }

    // Insert feed item
    const { data: feedItem, error: insertError } = await supabase
      .from('social_feed_items')
      .insert({
        user_id: user.id,
        item_type,
        reference_id,
        reference_table,
        display_data,
        visibility,
      })
      .select('*')
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 500)
    }

    return successResponse(feedItem)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
