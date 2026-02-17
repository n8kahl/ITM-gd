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

type LessonRow = {
  id: string
  module_id: string
  title: string
  slug: string
  estimated_minutes: number | null
  position: number | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown> | null
}

type BlockRow = {
  lesson_id: string
  position: number
  content_json: Record<string, unknown> | null
}

function extractLessonMarkdown(blocks: BlockRow[]): string | null {
  for (const block of blocks) {
    const content = asObject(block.content_json)
    const markdown = asNullableString(content.markdown)
    if (markdown) return markdown
    const fallback = asNullableString(content.content)
    if (fallback) return fallback
  }
  return null
}

function mapLessonToAdminShape(lesson: LessonRow, blocksByLessonId: Map<string, BlockRow[]>) {
  const metadata = asObject(lesson.metadata)
  const blocks = blocksByLessonId.get(lesson.id) || []

  return {
    id: lesson.id,
    course_id: lesson.module_id,
    title: lesson.title,
    slug: lesson.slug,
    video_url: asNullableString(metadata.video_url) || asNullableString(metadata.legacy_video_url),
    content_markdown: extractLessonMarkdown(blocks),
    is_free_preview: metadata.is_free_preview === true || metadata.legacy_is_free_preview === true,
    duration_minutes: lesson.estimated_minutes,
    display_order: Number(lesson.position || 0),
    created_at: lesson.created_at,
    updated_at: lesson.updated_at,
  }
}

async function upsertLessonContentBlock(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: { lessonId: string; title: string; markdown: string | null }
) {
  const content = input.markdown || ''
  const { error } = await supabase
    .from('academy_lesson_blocks')
    .upsert({
      lesson_id: input.lessonId,
      block_type: 'concept_explanation',
      position: 1,
      title: input.title,
      content_json: {
        source: 'admin_editor',
        title: input.title,
        markdown: content,
        content,
      },
    }, { onConflict: 'lesson_id,position' })

  if (error) {
    throw new Error(`Failed to upsert lesson content block: ${error.message}`)
  }
}

async function resolveUniqueLessonSlug(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  requestedSlug: string,
  excludeLessonId?: string
) {
  const base = requestedSlug
  let candidate = base
  let suffix = 2

  for (;;) {
    let query = supabase
      .from('academy_lessons')
      .select('id')
      .eq('slug', candidate)
      .limit(1)

    if (excludeLessonId) {
      query = query.neq('id', excludeLessonId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return candidate

    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

// GET - Fetch lessons for a course/module
export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: lessonRows, error: lessonsError } = await supabase
      .from('academy_lessons')
      .select('id, module_id, title, slug, estimated_minutes, position, created_at, updated_at, metadata')
      .eq('module_id', courseId)
      .order('position', { ascending: true })

    if (lessonsError) {
      return NextResponse.json({ error: lessonsError.message }, { status: 500 })
    }

    const lessons = (lessonRows || []) as LessonRow[]
    if (lessons.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const lessonIds = lessons.map((lesson) => lesson.id)
    const { data: blockRows, error: blocksError } = await supabase
      .from('academy_lesson_blocks')
      .select('lesson_id, position, content_json')
      .in('lesson_id', lessonIds)
      .order('lesson_id', { ascending: true })
      .order('position', { ascending: true })

    if (blocksError) {
      return NextResponse.json({ error: blocksError.message }, { status: 500 })
    }

    const blocksByLessonId = new Map<string, BlockRow[]>()
    for (const row of (blockRows || []) as BlockRow[]) {
      const scoped = blocksByLessonId.get(row.lesson_id) || []
      scoped.push(row)
      blocksByLessonId.set(row.lesson_id, scoped)
    }

    const data = lessons.map((lesson) => mapLessonToAdminShape(lesson, blocksByLessonId))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create a new lesson
export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      course_id,
      title,
      slug,
      video_url,
      content_markdown,
      is_free_preview,
      duration_minutes,
      display_order,
    } = body || {}

    if (!course_id || !title || !slug) {
      return NextResponse.json({ error: 'Course ID, title, and slug are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get max display_order for this module if not provided
    let order = display_order
    if (order === undefined) {
      const { data: maxOrder } = await supabase
        .from('academy_lessons')
        .select('position')
        .eq('module_id', course_id)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      order = (maxOrder?.position || 0) + 1
    }

    const uniqueSlug = await resolveUniqueLessonSlug(supabase, String(slug))

    const { data: lessonRow, error } = await supabase
      .from('academy_lessons')
      .insert({
        module_id: course_id,
        title,
        slug: uniqueSlug,
        learning_objective: title,
        estimated_minutes: duration_minutes || 0,
        position: order,
        is_published: true,
        metadata: {
          source: 'admin_lessons_api',
          video_url: asNullableString(video_url),
          is_free_preview: is_free_preview === true,
        },
      })
      .select('id, module_id, title, slug, estimated_minutes, position, created_at, updated_at, metadata')
      .single()

    if (error || !lessonRow) {
      return NextResponse.json({ error: error?.message || 'Failed to create lesson' }, { status: 500 })
    }

    await upsertLessonContentBlock(supabase, {
      lessonId: lessonRow.id as string,
      title: String(title),
      markdown: asNullableString(content_markdown),
    })

    const blocksByLessonId = new Map<string, BlockRow[]>()
    blocksByLessonId.set(String(lessonRow.id), [
      {
        lesson_id: String(lessonRow.id),
        position: 1,
        content_json: {
          markdown: asNullableString(content_markdown) || '',
          content: asNullableString(content_markdown) || '',
        },
      },
    ])

    const mappedLesson = mapLessonToAdminShape(lessonRow as LessonRow, blocksByLessonId)

    await logAdminActivity({
      action: 'lesson_created',
      targetType: 'lesson',
      targetId: mappedLesson.id,
      details: {
        course_id: mappedLesson.course_id,
        title: mappedLesson.title,
        slug: mappedLesson.slug,
      },
    })

    return NextResponse.json({ success: true, data: mappedLesson })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH - Update a lesson
export async function PATCH(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing, error: existingError } = await supabase
      .from('academy_lessons')
      .select('id, module_id, title, slug, estimated_minutes, position, created_at, updated_at, metadata')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const nextMetadata = {
      ...asObject(existing.metadata),
    }

    if ('video_url' in updates) {
      nextMetadata.video_url = asNullableString(updates.video_url)
    }
    if ('is_free_preview' in updates) {
      nextMetadata.is_free_preview = updates.is_free_preview === true
    }

    const lessonUpdates: Record<string, unknown> = {
      metadata: nextMetadata,
    }
    if (typeof updates.title === 'string') {
      lessonUpdates.title = updates.title
      lessonUpdates.learning_objective = updates.title
    }
    if (typeof updates.slug === 'string') {
      lessonUpdates.slug = await resolveUniqueLessonSlug(supabase, updates.slug, String(id))
    }
    if (typeof updates.duration_minutes === 'number' || updates.duration_minutes === null) {
      lessonUpdates.estimated_minutes = updates.duration_minutes || 0
    }
    if (typeof updates.display_order === 'number') {
      lessonUpdates.position = updates.display_order
    }

    const { data: updatedRows, error } = await supabase
      .from('academy_lessons')
      .update(lessonUpdates)
      .eq('id', id)
      .select('id, module_id, title, slug, estimated_minutes, position, created_at, updated_at, metadata')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const updatedLesson = updatedRows[0] as LessonRow

    const { data: existingBlocks } = await supabase
      .from('academy_lesson_blocks')
      .select('lesson_id, position, content_json')
      .eq('lesson_id', String(id))
      .order('position', { ascending: true })

    const blockRows = (existingBlocks || []) as BlockRow[]
    const existingMarkdown = extractLessonMarkdown(blockRows)
    const nextMarkdown =
      'content_markdown' in updates ? asNullableString(updates.content_markdown) : existingMarkdown

    if ('content_markdown' in updates || typeof updates.title === 'string') {
      await upsertLessonContentBlock(supabase, {
        lessonId: String(id),
        title: String(updatedLesson.title),
        markdown: nextMarkdown,
      })
    }

    const blocksByLessonId = new Map<string, BlockRow[]>()
    if (blockRows.length > 0) {
      blocksByLessonId.set(String(id), blockRows)
    }
    if ((blocksByLessonId.get(String(id)) || []).length === 0 && nextMarkdown) {
      blocksByLessonId.set(String(id), [
        {
          lesson_id: String(id),
          position: 1,
          content_json: {
            markdown: nextMarkdown,
            content: nextMarkdown,
          },
        },
      ])
    }

    const mappedLesson = mapLessonToAdminShape(updatedLesson, blocksByLessonId)

    await logAdminActivity({
      action: 'lesson_updated',
      targetType: 'lesson',
      targetId: String(id),
      details: lessonUpdates,
    })

    return NextResponse.json({ success: true, data: mappedLesson })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Delete a lesson
export async function DELETE(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('academy_lessons')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminActivity({
      action: 'lesson_deleted',
      targetType: 'lesson',
      targetId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
