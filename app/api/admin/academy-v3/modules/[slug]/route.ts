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
 * GET /api/admin/academy-v3/modules/[slug]
 * Fetch a single module with its lessons.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params
    const supabase = getSupabaseAdmin()

    const { data: mod, error: modError } = await supabase
      .from('academy_modules')
      .select('id, track_id, slug, code, title, description, learning_outcomes, estimated_minutes, position, is_published, metadata, cover_image_url, difficulty')
      .eq('slug', slug)
      .maybeSingle()

    if (modError) throw modError
    if (!mod) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from('academy_lessons')
      .select('id, module_id, slug, title, learning_objective, hero_image_url, estimated_minutes, difficulty, position, is_published, status')
      .eq('module_id', mod.id)
      .order('position', { ascending: true })

    if (lessonsError) throw lessonsError

    return NextResponse.json({
      success: true,
      data: { ...mod, lessons: lessons ?? [] },
    })
  } catch (error) {
    console.error('[academy-admin-module-detail] GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/academy-v3/modules/[slug]
 * Update a module's fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()

    const allowedFields: Record<string, string> = {
      title: 'title',
      description: 'description',
      learningOutcomes: 'learning_outcomes',
      estimatedMinutes: 'estimated_minutes',
      difficulty: 'difficulty',
      isPublished: 'is_published',
      coverImageUrl: 'cover_image_url',
      newSlug: 'slug',
    }

    const updates: Record<string, unknown> = {}
    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (body[camel] !== undefined) {
        updates[snake] = body[camel]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('academy_modules')
      .update(updates)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A module with this slug already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[academy-admin-module-detail] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/academy-v3/modules/[slug]
 * Delete a module and its associated lessons/blocks.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params
    const supabase = getSupabaseAdmin()

    // Get module ID first
    const { data: mod, error: findError } = await supabase
      .from('academy_modules')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (findError) throw findError
    if (!mod) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
    }

    // Delete lessons (CASCADE will handle blocks)
    await supabase
      .from('academy_lessons')
      .delete()
      .eq('module_id', mod.id)

    // Delete the module
    const { error: deleteError } = await supabase
      .from('academy_modules')
      .delete()
      .eq('id', mod.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[academy-admin-module-detail] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
