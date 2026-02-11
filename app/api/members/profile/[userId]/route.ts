import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { sanitizeUUID } from '@/lib/sanitize'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, RATE_LIMITS.apiGeneral)
  if (!rl.success) return errorResponse('Too many requests', 429)

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { userId } = await params
    const sanitizedUserId = sanitizeUUID(userId)
    if (!sanitizedUserId) {
      return errorResponse('Invalid user ID', 400)
    }

    // Fetch the target user's profile
    const { data: profile, error: fetchError } = await supabase
      .from('member_profiles')
      .select('*')
      .eq('user_id', sanitizedUserId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return errorResponse('Profile not found', 404)
      }
      return errorResponse(fetchError.message, 500)
    }

    // Check privacy
    const visibility = profile.privacy_settings?.profile_visibility
    if (visibility === 'private' && sanitizedUserId !== user.id) {
      return errorResponse('This profile is private', 403)
    }

    // Record profile view (skip if viewer is profile owner)
    if (sanitizedUserId !== user.id) {
      await supabase
        .from('profile_views')
        .insert({
          viewer_id: user.id,
          profile_user_id: sanitizedUserId,
        })
    }

    // Filter fields based on privacy settings
    const privacySettings = profile.privacy_settings
    const publicProfile = {
      id: profile.id,
      user_id: profile.user_id,
      display_name: profile.display_name,
      bio: profile.bio,
      tagline: profile.tagline,
      custom_avatar_url: profile.custom_avatar_url,
      banner_url: profile.banner_url,
      top_symbols: profile.top_symbols,
      preferred_strategy: profile.preferred_strategy,
      trading_style: profile.trading_style,
      privacy_settings: { profile_visibility: visibility },
      last_active_at: profile.last_active_at,
      created_at: profile.created_at,
      // Conditionally include fields based on privacy
      ...(privacySettings?.show_transcript ? {
        avg_hold_minutes: profile.avg_hold_minutes,
      } : {}),
    }

    return successResponse(publicProfile)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
