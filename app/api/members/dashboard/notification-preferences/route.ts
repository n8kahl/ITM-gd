import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'

interface AiCoachNotificationPreferences {
  setups: boolean
  alerts: boolean
  positionAdvice: boolean
  morningBrief: boolean
}

const DEFAULT_NOTIFICATION_PREFERENCES: AiCoachNotificationPreferences = {
  setups: true,
  alerts: true,
  positionAdvice: true,
  morningBrief: true,
}

function normalizePreferences(value: unknown): AiCoachNotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_NOTIFICATION_PREFERENCES
  }
  const candidate = value as Record<string, unknown>
  return {
    setups: candidate.setups !== false,
    alerts: candidate.alerts !== false,
    positionAdvice: candidate.positionAdvice !== false,
    morningBrief: candidate.morningBrief !== false,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('ai_coach_user_preferences')
      .select('notification_preferences')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: normalizePreferences(data?.notification_preferences),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
