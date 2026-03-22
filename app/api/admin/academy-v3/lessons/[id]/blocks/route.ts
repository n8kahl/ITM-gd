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
 * POST /api/admin/academy-v3/lessons/[id]/blocks
 * Add a new block to a lesson.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: lessonId } = await params
    const body = await request.json()
    const { blockType, title, contentJson } = body as {
      blockType: string
      title?: string
      contentJson?: Record<string, unknown>
    }

    if (!blockType) {
      return NextResponse.json(
        { success: false, error: 'blockType is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Get next position
    const { data: existing } = await supabase
      .from('academy_lesson_blocks')
      .select('position')
      .eq('lesson_id', lessonId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

    const { data, error } = await supabase
      .from('academy_lesson_blocks')
      .insert({
        lesson_id: lessonId,
        block_type: blockType,
        title: title ?? null,
        content_json: contentJson ?? {},
        position: nextPosition,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[academy-admin-blocks] POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/academy-v3/lessons/[id]/blocks
 * Reorder blocks within a lesson.
 * Body: { orderedIds: string[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await params // validate route param exists
    const body = await request.json()
    const { orderedIds } = body as { orderedIds: string[] }

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderedIds must be a non-empty array' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const updates = orderedIds.map((blockId, index) =>
      supabase
        .from('academy_lesson_blocks')
        .update({ position: index })
        .eq('id', blockId)
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[academy-admin-blocks] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
