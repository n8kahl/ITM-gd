import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/admin/academy-v3/tracks
 * List all tracks with their modules (count + published status).
 */
export async function GET() {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    const { data: tracks, error: tracksError } = await supabase
      .from('academy_tracks')
      .select('id, program_id, code, title, description, position, is_active')
      .order('position', { ascending: true })

    if (tracksError) throw tracksError

    const { data: modules, error: modulesError } = await supabase
      .from('academy_modules')
      .select('id, track_id, is_published')

    if (modulesError) throw modulesError

    const tracksWithCounts = (tracks ?? []).map(track => {
      const trackModules = (modules ?? []).filter(m => m.track_id === track.id)
      return {
        ...track,
        moduleCount: trackModules.length,
        publishedModuleCount: trackModules.filter(m => m.is_published).length,
      }
    })

    return NextResponse.json({ success: true, data: tracksWithCounts })
  } catch (error) {
    console.error('[academy-admin-tracks] GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/academy-v3/tracks
 * Reorder tracks by updating position values.
 * Body: { orderedIds: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderedIds } = body as { orderedIds: string[] }

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderedIds must be a non-empty array' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const updates = orderedIds.map((id, index) =>
      supabase
        .from('academy_tracks')
        .update({ position: index })
        .eq('id', id)
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[academy-admin-tracks] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
