import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { logAdminActivity } from '@/lib/admin/audit-log'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function mapModuleToCourse(module: Record<string, unknown>) {
  const metadata = asObject(module.metadata)
  const lessonsRelation = Array.isArray(module.academy_lessons) ? module.academy_lessons : []

  return {
    id: String(module.id || ''),
    title: String(module.title || ''),
    slug: String(module.slug || ''),
    description: asNullableString(module.description),
    thumbnail_url:
      asNullableString(metadata.thumbnail_url) ||
      asNullableString(metadata.coverImageUrl) ||
      asNullableString(metadata.legacy_thumbnail_url),
    discord_role_required:
      asNullableString(metadata.discord_role_required) ||
      asNullableString(metadata.legacy_discord_role_required),
    is_published: module.is_published === true,
    display_order: Number(module.position || 0),
    created_at: String(module.created_at || ''),
    updated_at: String(module.updated_at || ''),
    lessons: lessonsRelation,
  }
}

async function resolveDefaultTrackId(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: legacyTrack } = await supabase
    .from('academy_tracks')
    .select('id')
    .eq('code', 'legacy-v2-library')
    .maybeSingle()

  if (legacyTrack?.id) return legacyTrack.id as string

  const { data: firstTrack, error } = await supabase
    .from('academy_tracks')
    .select('id')
    .eq('is_active', true)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !firstTrack?.id) {
    throw new Error('No active academy track found for course creation')
  }

  return firstTrack.id as string
}

// GET - Fetch all courses with lesson count
export async function GET() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('academy_modules')
      .select('id, slug, title, description, position, is_published, created_at, updated_at, metadata, academy_lessons(id)')
      .order('position', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const courses = (data || []).map((course) => mapModuleToCourse(course as Record<string, unknown>))

    return NextResponse.json({ success: true, data: courses })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create a new course
export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, slug, description, thumbnail_url, discord_role_required, is_published } = body || {}

    if (!title || !slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const trackId = await resolveDefaultTrackId(supabase)

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('academy_modules')
      .select('position')
      .eq('track_id', trackId)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const { data, error } = await supabase
      .from('academy_modules')
      .insert({
        track_id: trackId,
        code: slug,
        title,
        slug,
        description,
        metadata: {
          thumbnail_url: asNullableString(thumbnail_url),
          discord_role_required: asNullableString(discord_role_required),
        },
        is_published: is_published || false,
        position: Number(maxOrder?.position || 0) + 1,
      })
      .select('id, slug, title, description, position, is_published, created_at, updated_at, metadata')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'course_created',
      targetType: 'course',
      targetId: data.id,
      details: {
        title: data.title,
        slug: data.slug,
        is_published: data.is_published,
      },
    })

    return NextResponse.json({ success: true, data: mapModuleToCourse(data as Record<string, unknown>) })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH - Update a course
export async function PATCH(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: currentModule, error: currentError } = await supabase
      .from('academy_modules')
      .select('id, metadata')
      .eq('id', id)
      .maybeSingle()

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 })
    }

    if (!currentModule) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const nextMetadata = {
      ...asObject(currentModule.metadata),
    }

    if ('thumbnail_url' in updates) {
      nextMetadata.thumbnail_url = asNullableString(updates.thumbnail_url)
    }
    if ('discord_role_required' in updates) {
      nextMetadata.discord_role_required = asNullableString(updates.discord_role_required)
    }

    const moduleUpdates: Record<string, unknown> = {
      metadata: nextMetadata,
    }
    if (typeof updates.title === 'string') moduleUpdates.title = updates.title
    if (typeof updates.slug === 'string') {
      moduleUpdates.slug = updates.slug
      moduleUpdates.code = updates.slug
    }
    if (typeof updates.description === 'string' || updates.description === null) {
      moduleUpdates.description = updates.description
    }
    if (typeof updates.is_published === 'boolean') moduleUpdates.is_published = updates.is_published
    if (typeof updates.display_order === 'number') moduleUpdates.position = updates.display_order

    const { data, error } = await supabase
      .from('academy_modules')
      .update(moduleUpdates)
      .eq('id', id)
      .select('id, slug, title, description, position, is_published, created_at, updated_at, metadata, academy_lessons(id)')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    await logAdminActivity({
      action: 'course_updated',
      targetType: 'course',
      targetId: id,
      details: moduleUpdates,
    })

    return NextResponse.json({ success: true, data: mapModuleToCourse(data[0] as Record<string, unknown>) })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Delete a course
export async function DELETE(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('academy_modules')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'course_deleted',
      targetType: 'course',
      targetId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
