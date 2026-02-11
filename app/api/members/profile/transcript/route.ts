import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { sanitizeUUID } from '@/lib/sanitize'
import type { TradingTranscript } from '@/lib/types/social'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    const targetUserId = userIdParam ? sanitizeUUID(userIdParam) : user.id

    if (!targetUserId) {
      return errorResponse('Invalid user ID', 400)
    }

    // If viewing another user's transcript, check their privacy settings
    if (targetUserId !== user.id) {
      const { data: profile } = await supabase
        .from('member_profiles')
        .select('privacy_settings')
        .eq('user_id', targetUserId)
        .single()

      if (!profile?.privacy_settings?.show_transcript) {
        return errorResponse('This user has hidden their transcript', 403)
      }
    }

    // Call the RPC function to compute transcript stats
    const { data: transcript, error: rpcError } = await supabase
      .rpc('get_trading_transcript', { target_user_id: targetUserId })

    if (rpcError) {
      return errorResponse(rpcError.message, 500)
    }

    return successResponse<TradingTranscript>(transcript)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
