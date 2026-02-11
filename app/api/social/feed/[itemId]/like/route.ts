import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { sanitizeUUID } from '@/lib/sanitize'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { itemId } = await params
    const sanitizedItemId = sanitizeUUID(itemId)
    if (!sanitizedItemId) {
      return errorResponse('Invalid item ID', 400)
    }

    // Insert like (unique constraint prevents duplicates)
    const { error: insertError } = await supabase
      .from('social_likes')
      .insert({
        user_id: user.id,
        feed_item_id: sanitizedItemId,
      })

    if (insertError) {
      // Unique constraint violation means already liked
      if (insertError.code === '23505') {
        return successResponse({ liked: true, message: 'Already liked' })
      }
      return errorResponse(insertError.message, 500)
    }

    return successResponse({ liked: true })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
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
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
