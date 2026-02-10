import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/academy/achievements/[code]
 * Public verification endpoint (no auth required).
 * Verifies an achievement by its unique code and returns public details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabaseAdmin = getSupabaseAdmin()

    // Look up the achievement verification record
    const { data: verification, error } = await supabaseAdmin
      .from('achievement_verifications')
      .select(`
        id,
        verification_code,
        earned_at,
        user_id,
        achievement_id,
        achievements(
          id,
          name,
          description,
          icon,
          badge_image_url,
          category,
          tier
        )
      `)
      .eq('verification_code', code)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    if (!verification) {
      // Fallback: try looking up by achievement code in user_achievements
      const { data: achievement } = await supabaseAdmin
        .from('achievements')
        .select('id, name, description, icon, badge_image_url, category, tier')
        .eq('code', code)
        .maybeSingle()

      if (!achievement) {
        return NextResponse.json(
          { success: false, error: 'Achievement not found' },
          { status: 404 }
        )
      }

      // Return achievement info without user verification details
      return NextResponse.json({
        success: true,
        data: {
          verified: false,
          achievement,
          message: 'Achievement exists but no verification record found for this code.',
        },
      })
    }

    // Get limited user info (display name only, for privacy)
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', verification.user_id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        achievement: verification.achievements,
        earned_at: verification.earned_at,
        earner: userProfile
          ? { display_name: userProfile.display_name, avatar_url: userProfile.avatar_url }
          : null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
