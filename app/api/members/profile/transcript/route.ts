import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  DEFAULT_PRIVACY_SETTINGS,
  type PrivacySettings,
  type TradingTranscript,
} from '@/lib/types/social'

const EMPTY_TRANSCRIPT: TradingTranscript = {
  total_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  win_rate: null,
  total_pnl: 0,
  profit_factor: null,
  avg_pnl: null,
  best_trade_pnl: null,
  worst_trade_pnl: null,
  best_month: null,
  current_win_streak: 0,
  longest_win_streak: 0,
  avg_discipline_score: null,
  avg_ai_grade: null,
  ai_grade_distribution: {},
  most_profitable_symbol: null,
  most_traded_symbol: null,
  avg_hold_duration_min: null,
  equity_curve: [],
}

function toPrivacySettings(value: unknown): PrivacySettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PRIVACY_SETTINGS
  }

  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...(value as Partial<PrivacySettings>),
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

  const searchParams = new URL(request.url).searchParams
  const userIdParam = searchParams.get('userId')
  const targetUserId = userIdParam ? sanitizeUUID(userIdParam) : user.id

  if (!targetUserId) {
    return errorResponse('Invalid user ID', 400)
  }

  if (targetUserId !== user.id) {
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('member_profiles')
      .select('privacy_settings')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetProfileError) {
      return errorResponse(targetProfileError.message, 500)
    }

    if (!targetProfile) {
      return errorResponse('Profile not found', 404)
    }

    const privacySettings = toPrivacySettings(targetProfile.privacy_settings)

    if (privacySettings.profile_visibility === 'private') {
      return errorResponse('This profile is private', 403)
    }

    if (!privacySettings.show_transcript) {
      return errorResponse('This user has hidden their transcript', 403)
    }
  }

  const { data: transcriptData, error: transcriptError } = await supabase
    .rpc('get_trading_transcript', { target_user_id: targetUserId })

  if (transcriptError) {
    return errorResponse(transcriptError.message, 500)
  }

  return successResponse((transcriptData as TradingTranscript | null) ?? EMPTY_TRANSCRIPT)
}
