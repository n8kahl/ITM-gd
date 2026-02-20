import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  DEFAULT_PRIVACY_SETTINGS,
  type MemberProfile,
  type PrivacySettings,
} from '@/lib/types/social'
import { getSocialUserMetaMap } from '@/lib/social/membership'

function toPrivacySettings(value: unknown): PrivacySettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PRIVACY_SETTINGS
  }

  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...(value as Partial<PrivacySettings>),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
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

  const { userId } = await params
  const targetUserId = sanitizeUUID(userId)

  if (!targetUserId) {
    return errorResponse('Invalid user ID', 400)
  }

  const { data: profile, error: profileError } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (profileError) {
    return errorResponse(profileError.message, 500)
  }

  if (!profile) {
    return errorResponse('Profile not found', 404)
  }

  const profileRow = profile as MemberProfile
  const privacySettings = toPrivacySettings(profileRow.privacy_settings)
  const isOwner = targetUserId === user.id

  if (!isOwner && privacySettings.profile_visibility === 'private') {
    return errorResponse('This profile is private', 403)
  }

  if (!isOwner) {
    await supabase
      .from('profile_views')
      .insert({
        viewer_id: user.id,
        profile_user_id: targetUserId,
      })
  }

  const socialMetaMap = await getSocialUserMetaMap(supabase, [targetUserId])
  const socialMeta = socialMetaMap.get(targetUserId)

  const responseProfile: Record<string, unknown> = {
    id: profileRow.id,
    user_id: profileRow.user_id,
    display_name: profileRow.display_name,
    bio: profileRow.bio,
    tagline: profileRow.tagline,
    custom_avatar_url: profileRow.custom_avatar_url,
    banner_url: profileRow.banner_url,
    top_symbols: profileRow.top_symbols,
    preferred_strategy: profileRow.preferred_strategy,
    trading_style: profileRow.trading_style,
    last_active_at: profileRow.last_active_at,
    created_at: profileRow.created_at,
    privacy_settings: {
      profile_visibility: privacySettings.profile_visibility,
      show_transcript: privacySettings.show_transcript,
      show_academy: privacySettings.show_academy,
      show_trades_in_feed: privacySettings.show_trades_in_feed,
      show_discord_roles: privacySettings.show_discord_roles,
    },
  }

  if (isOwner || privacySettings.show_transcript) {
    responseProfile.avg_hold_minutes = profileRow.avg_hold_minutes
  }

  if (isOwner) {
    responseProfile.whop_user_id = profileRow.whop_user_id
    responseProfile.whop_affiliate_url = profileRow.whop_affiliate_url
    responseProfile.whop_membership_id = profileRow.whop_membership_id
    responseProfile.notification_preferences = profileRow.notification_preferences
    responseProfile.ai_preferences = profileRow.ai_preferences
  }

  responseProfile.discord_username = socialMeta?.discord_username ?? null
  responseProfile.discord_avatar = socialMeta?.discord_avatar ?? null
  responseProfile.discord_user_id = socialMeta?.discord_user_id ?? null
  responseProfile.membership_tier = (
    isOwner || privacySettings.show_discord_roles
      ? socialMeta?.membership_tier ?? null
      : null
  )
  responseProfile.discord_roles = (
    isOwner || privacySettings.show_discord_roles
      ? socialMeta?.discord_roles ?? []
      : []
  )
  responseProfile.discord_role_titles = (
    isOwner || privacySettings.show_discord_roles
      ? socialMeta?.discord_role_titles ?? {}
      : {}
  )

  return successResponse(responseProfile)
}
