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
 * GET /api/admin/academy-v3/lessons/[id]
 * Fetch a lesson with its blocks for the admin editor.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    const [lessonResult, blocksResult] = await Promise.all([
      supabase
        .from('academy_lessons')
        .select('id, module_id, slug, title, learning_objective, hero_image_url, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, status, published_at, published_by')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('academy_lesson_blocks')
        .select('id, lesson_id, block_type, position, title, content_json')
        .eq('lesson_id', id)
        .order('position', { ascending: true }),
    ])

    if (lessonResult.error) throw lessonResult.error
    if (!lessonResult.data) {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    if (blocksResult.error) throw blocksResult.error

    return NextResponse.json({
      success: true,
      data: {
        ...lessonResult.data,
        blocks: blocksResult.data ?? [],
      },
    })
  } catch (error) {
    console.error('[academy-admin-lesson] GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/academy-v3/lessons/[id]
 * Update lesson metadata.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const fieldMap: Record<string, string> = {
      title: 'title',
      slug: 'slug',
      learningObjective: 'learning_objective',
      heroImageUrl: 'hero_image_url',
      estimatedMinutes: 'estimated_minutes',
      difficulty: 'difficulty',
      prerequisiteLessonIds: 'prerequisite_lesson_ids',
      isPublished: 'is_published',
      status: 'status',
    }

    const updates: Record<string, unknown> = {}
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (body[camel] !== undefined) {
        updates[snake] = body[camel]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('academy_lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[academy-admin-lesson] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/academy-v3/lessons/[id]
 * Delete a lesson and its blocks.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Delete blocks first (may have FK constraints)
    await supabase
      .from('academy_lesson_blocks')
      .delete()
      .eq('lesson_id', id)

    const { error } = await supabase
      .from('academy_lessons')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[academy-admin-lesson] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
