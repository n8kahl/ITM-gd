import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

const TIER_HIERARCHY: Record<string, number> = { core: 1, pro: 2, executive: 3 }

function getAccessibleTiers(userTier: string): string[] {
  const level = TIER_HIERARCHY[userTier] || 1
  return Object.entries(TIER_HIERARCHY)
    .filter(([, l]) => l <= level)
    .map(([tier]) => tier)
}

/**
 * GET /api/academy/paths
 * List learning paths filtered by the user's subscription tier.
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

    // Get user tier from their profile or subscription
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle()

    const userTier = membership?.tier || 'core'
    const accessibleTiers = getAccessibleTiers(userTier)

    // Fetch paths filtered by tier
    const { data: paths, error } = await supabase
      .from('learning_paths')
      .select(`
        id,
        name,
        slug,
        description,
        tier_required,
        estimated_hours,
        difficulty,
        icon,
        is_published,
        display_order,
        courses:learning_path_courses(
          course_id,
          display_order,
          courses(id, title, slug)
        )
      `)
      .eq('is_published', true)
      .in('tier_required', accessibleTiers)
      .order('display_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Get user progress for each path
    const { data: userProgress } = await supabase
      .from('user_path_progress')
      .select('path_id, progress_pct, status')
      .eq('user_id', user.id)

    const progressMap = new Map(
      (userProgress || []).map((p) => [p.path_id, p])
    )

    const pathsWithProgress = (paths || []).map((path) => ({
      ...path,
      user_progress: progressMap.get(path.id) || { progress_pct: 0, status: 'not_started' },
    }))

    return NextResponse.json({
      success: true,
      data: {
        paths: pathsWithProgress,
        user_tier: userTier,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
