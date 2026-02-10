import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const XP_ONBOARDING = 50

/**
 * POST /api/academy/onboarding
 * Submit onboarding data. Creates a user_learning_profiles record,
 * determines a recommended learning path, and awards 50 XP.
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

    const { user } = auth
    const body = await request.json()
    const {
      experience_level,
      learning_goals,
      preferred_style,
      trading_instruments,
      weekly_hours,
    } = body

    if (!experience_level || !learning_goals || !preferred_style) {
      return NextResponse.json(
        { success: false, error: 'experience_level, learning_goals, and preferred_style are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user already completed onboarding
    const { data: existing } = await supabaseAdmin
      .from('user_learning_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Onboarding already completed' },
        { status: 409 }
      )
    }

    // Determine recommended learning path based on experience level
    const pathMapping: Record<string, string> = {
      beginner: 'foundations',
      intermediate: 'strategy-builder',
      advanced: 'advanced-mastery',
    }
    const recommendedPath = pathMapping[experience_level] || 'foundations'

    // Look up the learning path
    const { data: learningPath } = await supabaseAdmin
      .from('learning_paths')
      .select('id, name')
      .eq('slug', recommendedPath)
      .maybeSingle()

    // Create user learning profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_learning_profiles')
      .insert({
        user_id: user.id,
        experience_level,
        learning_goals,
        preferred_style,
        trading_instruments: trading_instruments || [],
        weekly_hours: weekly_hours || 5,
        recommended_path_id: learningPath?.id || null,
      })
      .select()
      .single()

    if (profileError) {
      return NextResponse.json(
        { success: false, error: profileError.message },
        { status: 500 }
      )
    }

    // Award onboarding XP
    await supabaseAdmin.from('xp_transactions').insert({
      user_id: user.id,
      amount: XP_ONBOARDING,
      source: 'onboarding_complete',
      description: 'Completed academy onboarding',
    })

    // Update user XP total
    await supabaseAdmin.rpc('increment_user_xp', {
      p_user_id: user.id,
      p_amount: XP_ONBOARDING,
    })

    return NextResponse.json({
      success: true,
      data: {
        profile,
        recommended_path: learningPath || null,
        xp_awarded: XP_ONBOARDING,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
