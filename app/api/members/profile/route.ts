import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeContent } from '@/lib/sanitize'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type {
  AIPreferences,
  MemberProfile,
  NotificationPreferences,
  PrivacySettings,
} from '@/lib/types/social'
import {
  DEFAULT_AI_PREFERENCES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PRIVACY_SETTINGS,
} from '@/lib/types/social'
import { memberProfileUpdateSchema } from '@/lib/validation/social'

function normalizePrivacySettings(value: unknown): PrivacySettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PRIVACY_SETTINGS
  }

  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...(value as Partial<PrivacySettings>),
  }
}

function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_NOTIFICATION_PREFERENCES
  }

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(value as Partial<NotificationPreferences>),
  }
}

function normalizeAiPreferences(value: unknown): AIPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_AI_PREFERENCES
  }

  return {
    ...DEFAULT_AI_PREFERENCES,
    ...(value as Partial<AIPreferences>),
  }
}

async function getOrCreateMemberProfile(
  userId: string,
): Promise<{ profile: MemberProfile | null; errorMessage: string | null }> {
  const supabase = await createServerSupabaseClient()

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingProfileError) {
    return { profile: null, errorMessage: existingProfileError.message }
  }

  if (existingProfile) {
    return { profile: existingProfile as MemberProfile, errorMessage: null }
  }

  const { data: createdProfile, error: createError } = await supabase
    .from('member_profiles')
    .insert({ user_id: userId })
    .select('*')
    .single()

  if (createError || !createdProfile) {
    return {
      profile: null,
      errorMessage: createError?.message ?? 'Failed to create profile',
    }
  }

  return { profile: createdProfile as MemberProfile, errorMessage: null }
}

function sanitizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value
  return sanitizeContent(value)
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

  const { profile, errorMessage } = await getOrCreateMemberProfile(user.id)

  if (!profile) {
    return errorResponse(errorMessage ?? 'Failed to load profile', 500)
  }

  return successResponse(profile)
}

export async function PATCH(request: NextRequest) {
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
    const parsedBody = memberProfileUpdateSchema.safeParse(body)

    if (!parsedBody.success) {
      return errorResponse('Invalid request body', 400, parsedBody.error.flatten())
    }

    const { profile, errorMessage } = await getOrCreateMemberProfile(user.id)

    if (!profile) {
      return errorResponse(errorMessage ?? 'Failed to load profile', 500)
    }

    const updateData: Record<string, unknown> = {}
    const parsed = parsedBody.data

    if (Object.prototype.hasOwnProperty.call(parsed, 'display_name')) {
      updateData.display_name = sanitizeOptionalString(parsed.display_name)
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'bio')) {
      updateData.bio = sanitizeOptionalString(parsed.bio)
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'tagline')) {
      updateData.tagline = sanitizeOptionalString(parsed.tagline)
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'trading_style')) {
      updateData.trading_style = parsed.trading_style
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'whop_affiliate_url')) {
      updateData.whop_affiliate_url = parsed.whop_affiliate_url
    }

    if (parsed.privacy_settings) {
      updateData.privacy_settings = {
        ...normalizePrivacySettings(profile.privacy_settings),
        ...parsed.privacy_settings,
      }
    }

    if (parsed.notification_preferences) {
      updateData.notification_preferences = {
        ...normalizeNotificationPreferences(profile.notification_preferences),
        ...parsed.notification_preferences,
      }
    }

    if (parsed.ai_preferences) {
      const mergedAiPreferences = {
        ...normalizeAiPreferences(profile.ai_preferences),
        ...parsed.ai_preferences,
      }

      updateData.ai_preferences = {
        ...mergedAiPreferences,
        trading_style_notes: sanitizeContent(mergedAiPreferences.trading_style_notes),
      }
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('member_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError || !updatedProfile) {
      return errorResponse(updateError?.message ?? 'Failed to update profile', 500)
    }

    return successResponse(updatedProfile)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
    )
  }
}
