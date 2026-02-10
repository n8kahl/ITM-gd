import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { resolveUserMembershipTier, toSafeErrorMessage } from '@/lib/academy/api-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const XP_ONBOARDING = 50

type ExperienceLevel = 'never' | 'paper' | 'beginner' | 'intermediate' | 'advanced'
type BrokerStatus = 'choosing' | 'not_setup' | 'setup'

interface OnboardingInput {
  experience_level: ExperienceLevel
  learning_goals: string[]
  weekly_time_minutes: number
  broker_status: BrokerStatus
  preferred_lesson_type: 'video' | 'text' | 'interactive' | 'scenario' | 'practice' | 'guided'
  onboarding_data: Record<string, unknown>
}

function mapExperienceLevel(value: unknown): ExperienceLevel {
  if (value === 'never' || value === 'paper' || value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value
  }

  if (value === 'brand-new') {
    return 'never'
  }

  return 'beginner'
}

function mapBrokerStatus(value: unknown): BrokerStatus {
  if (value === 'choosing' || value === 'not_setup' || value === 'setup') {
    return value
  }

  if (value === 'yes') return 'setup'
  if (value === 'no' || value === 'paper') return 'not_setup'
  if (value === 'have_account') return 'setup'
  if (value === 'no_account') return 'not_setup'

  return 'choosing'
}

function mapWeeklyTimeMinutes(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '1-2') return 90
    if (trimmed === '3-5') return 240
    if (trimmed === '5-10') return 450
    if (trimmed === '10+') return 720

    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 120
}

function mapPreferredLessonType(value: unknown): OnboardingInput['preferred_lesson_type'] {
  if (
    value === 'video' ||
    value === 'text' ||
    value === 'interactive' ||
    value === 'scenario' ||
    value === 'practice' ||
    value === 'guided'
  ) {
    return value
  }

  return 'video'
}

function normalizeGoals(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((goal) => String(goal).trim().toLowerCase())
    .filter((goal) => goal.length > 0)
    .slice(0, 12)
}

function normalizeOnboardingInput(raw: Record<string, unknown>): OnboardingInput {
  const learningGoals = normalizeGoals(
    raw.learning_goals ?? raw.goals ?? raw.key_topics
  )

  return {
    experience_level: mapExperienceLevel(raw.experience_level ?? raw.experienceLevel),
    learning_goals: learningGoals,
    weekly_time_minutes: mapWeeklyTimeMinutes(raw.weekly_time_minutes ?? raw.time_per_week_minutes ?? raw.weeklyHours),
    broker_status: mapBrokerStatus(raw.broker_status ?? raw.hasBroker),
    preferred_lesson_type: mapPreferredLessonType(raw.preferred_lesson_type ?? raw.preferredStyle),
    onboarding_data: raw,
  }
}

function preferredPathSlug(experienceLevel: ExperienceLevel): string {
  switch (experienceLevel) {
    case 'advanced':
      return 'advanced-mastery'
    case 'intermediate':
      return 'strategy-builder'
    default:
      return 'options-scalping-fundamentals'
  }
}

/**
 * POST /api/academy/onboarding
 * Submit onboarding data and initialize academy profile.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const body = await request.json()
    const input = normalizeOnboardingInput(body as Record<string, unknown>)

    if (input.learning_goals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one learning goal is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: existingProfile, error: existingError } = await supabaseAdmin
      .from('user_learning_profiles')
      .select('id, onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { success: false, error: 'Failed to check onboarding profile' },
        { status: 500 }
      )
    }

    if (existingProfile?.onboarding_completed) {
      return NextResponse.json(
        { success: false, error: 'Onboarding already completed' },
        { status: 409 }
      )
    }

    const targetPathSlug = preferredPathSlug(input.experience_level)
    let selectedPathId: string | null = null
    let selectedPathName: string | null = null

    const { data: preferredPath } = await supabaseAdmin
      .from('learning_paths')
      .select('id, name, slug')
      .eq('slug', targetPathSlug)
      .eq('is_published', true)
      .maybeSingle()

    if (preferredPath) {
      selectedPathId = preferredPath.id
      selectedPathName = preferredPath.name
    } else {
      const { data: fallbackPath } = await supabaseAdmin
        .from('learning_paths')
        .select('id, name')
        .eq('is_published', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      selectedPathId = fallbackPath?.id || null
      selectedPathName = fallbackPath?.name || null
    }

    const profilePayload = {
      user_id: user.id,
      experience_level: input.experience_level,
      learning_goals: input.learning_goals,
      weekly_time_minutes: input.weekly_time_minutes,
      broker_status: input.broker_status,
      preferred_lesson_type: input.preferred_lesson_type,
      current_learning_path_id: selectedPathId,
      onboarding_completed: true,
      onboarding_data: input.onboarding_data,
    }

    const { data: profile, error: profileError } = existingProfile
      ? await supabaseAdmin
          .from('user_learning_profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id)
          .select('id')
          .single()
      : await supabaseAdmin
          .from('user_learning_profiles')
          .insert(profilePayload)
          .select('id')
          .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Failed to save onboarding profile' },
        { status: 500 }
      )
    }

    const tier = await resolveUserMembershipTier(user, supabase)

    await supabaseAdmin.rpc('increment_user_xp', {
      p_user_id: user.id,
      p_xp: XP_ONBOARDING,
    })

    await supabaseAdmin
      .from('user_learning_activity_log')
      .insert({
        user_id: user.id,
        activity_type: 'achievement_earned',
        entity_type: 'onboarding',
        xp_earned: XP_ONBOARDING,
        metadata: {
          source: 'onboarding_complete',
          experience_level: input.experience_level,
          goals_count: input.learning_goals.length,
        },
      })

    return NextResponse.json(
      {
        success: true,
        data: {
          profile_id: profile.id,
          learning_path_id: selectedPathId,
          learning_path_name: selectedPathName,
          tier,
          xp_earned: XP_ONBOARDING,
          message: "Welcome! You're all set to begin your trading education.",
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('academy onboarding failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
