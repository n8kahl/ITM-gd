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
 * PATCH /api/admin/academy-v3/lessons/[id]/blocks/[blockId]
 * Update a block's content or metadata.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { blockId } = await params
    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.contentJson !== undefined) updates.content_json = body.contentJson
    if (body.blockType !== undefined) updates.block_type = body.blockType

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('academy_lesson_blocks')
      .update(updates)
      .eq('id', blockId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[academy-admin-block] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/academy-v3/lessons/[id]/blocks/[blockId]
 * Delete a block.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { blockId } = await params
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('academy_lesson_blocks')
      .delete()
      .eq('id', blockId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[academy-admin-block] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
