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
 * GET /api/admin/academy-v3/modules?trackId=<id>
 * List modules for a track, or all modules if no trackId.
 */
export async function GET(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trackId = searchParams.get('trackId')

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('academy_modules')
      .select('id, track_id, slug, code, title, description, learning_outcomes, estimated_minutes, position, is_published, metadata, cover_image_url, difficulty, created_at')
      .order('position', { ascending: true })

    if (trackId) {
      query = query.eq('track_id', trackId)
    }

    const { data, error } = await query
    if (error) throw error

    // Get lesson counts per module
    const { data: lessons, error: lessonsError } = await supabase
      .from('academy_lessons')
      .select('id, module_id, is_published')

    if (lessonsError) throw lessonsError

    const modulesWithCounts = (data ?? []).map(mod => {
      const modLessons = (lessons ?? []).filter(l => l.module_id === mod.id)
      return {
        ...mod,
        lessonCount: modLessons.length,
        publishedLessonCount: modLessons.filter(l => l.is_published).length,
      }
    })

    return NextResponse.json({ success: true, data: modulesWithCounts })
  } catch (error) {
    console.error('[academy-admin-modules] GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/academy-v3/modules
 * Create a new module.
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      trackId,
      title,
      slug,
      code,
      description,
      learningOutcomes,
      estimatedMinutes,
      difficulty,
      isPublished,
    } = body as {
      trackId: string
      title: string
      slug: string
      code: string
      description?: string
      learningOutcomes?: string[]
      estimatedMinutes?: number
      difficulty?: string
      isPublished?: boolean
    }

    if (!trackId || !title || !slug || !code) {
      return NextResponse.json(
        { success: false, error: 'trackId, title, slug, and code are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Get next position
    const { data: existing } = await supabase
      .from('academy_modules')
      .select('position')
      .eq('track_id', trackId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

    const { data, error } = await supabase
      .from('academy_modules')
      .insert({
        track_id: trackId,
        title,
        slug,
        code,
        description: description ?? null,
        learning_outcomes: learningOutcomes ?? [],
        estimated_minutes: estimatedMinutes ?? 0,
        difficulty: difficulty ?? 'beginner',
        position: nextPosition,
        is_published: isPublished ?? false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A module with this slug or code already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[academy-admin-modules] POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/academy-v3/modules
 * Reorder modules within a track.
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
        .from('academy_modules')
        .update({ position: index })
        .eq('id', id)
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[academy-admin-modules] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
