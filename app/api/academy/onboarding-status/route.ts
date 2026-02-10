import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { resolveUserMembershipTier } from '@/lib/academy/api-utils'

/**
 * GET /api/academy/onboarding-status
 * Check if the authenticated user has completed academy onboarding.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth

    const { data: profile, error } = await supabase
      .from('user_learning_profiles')
      .select(`
        id,
        onboarding_completed,
        current_learning_path_id,
        learning_paths:current_learning_path_id(id, name)
      `)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load onboarding status' },
        { status: 500 }
      )
    }

    const tier = await resolveUserMembershipTier(user, supabase)
    const learningPath = Array.isArray(profile?.learning_paths)
      ? profile?.learning_paths[0]
      : profile?.learning_paths

    return NextResponse.json({
      success: true,
      data: {
        completed: !!profile && !!profile.onboarding_completed,
        profile_id: profile?.id || null,
        tier,
        learning_path_id: profile?.current_learning_path_id || null,
        learning_path_name: learningPath?.name || null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
