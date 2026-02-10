import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

type SavedEntityType = 'course' | 'lesson'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function resolveEntityId(args: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  entityType: SavedEntityType
  entityId: string
}): Promise<string | null> {
  if (isUuid(args.entityId)) {
    return args.entityId
  }

  if (args.entityType === 'course') {
    const { data } = await args.supabaseAdmin
      .from('courses')
      .select('id')
      .eq('slug', args.entityId)
      .maybeSingle()
    return data?.id || null
  }

  const { data } = await args.supabaseAdmin
    .from('lessons')
    .select('id')
    .eq('slug', args.entityId)
    .maybeSingle()
  return data?.id || null
}

/**
 * GET /api/academy/saved
 * Returns saved courses and lessons for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user } = auth
    const supabaseAdmin = getSupabaseAdmin()

    const { data: savedItems, error: savedError } = await supabaseAdmin
      .from('user_saved_items')
      .select('id, entity_type, entity_id, notes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (savedError) {
      return NextResponse.json({ success: false, error: 'Failed to load saved items' }, { status: 500 })
    }

    const courseIds = Array.from(
      new Set(
        (savedItems || [])
          .filter((item) => item.entity_type === 'course')
          .map((item) => item.entity_id)
      )
    )

    const lessonIds = Array.from(
      new Set(
        (savedItems || [])
          .filter((item) => item.entity_type === 'lesson')
          .map((item) => item.entity_id)
      )
    )

    const [coursesResult, lessonsResult] = await Promise.all([
      courseIds.length > 0
        ? supabaseAdmin
            .from('courses')
            .select('id, slug, title, description, thumbnail_url')
            .in('id', courseIds)
        : Promise.resolve({ data: [], error: null }),
      lessonIds.length > 0
        ? supabaseAdmin
            .from('lessons')
            .select('id, slug, title, course_id, courses:course_id (id, slug, title)')
            .in('id', lessonIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (coursesResult.error || lessonsResult.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load saved item details' },
        { status: 500 }
      )
    }

    const courseById = new Map(
      (coursesResult.data || []).map((course) => [course.id, course])
    )
    const lessonById = new Map(
      (lessonsResult.data || []).map((lesson) => [lesson.id, lesson])
    )

    const items = (savedItems || []).map((item) => {
      if (item.entity_type === 'course') {
        const course = courseById.get(item.entity_id)
        return {
          id: item.id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          notes: item.notes,
          created_at: item.created_at,
          course: course
            ? {
                id: course.id,
                slug: course.slug,
                title: course.title,
                description: course.description,
                thumbnail_url: course.thumbnail_url,
              }
            : null,
          lesson: null,
        }
      }

      const lesson = lessonById.get(item.entity_id)
      const lessonCourse = lesson
        ? (Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses)
        : null
      return {
        id: item.id,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        notes: item.notes,
        created_at: item.created_at,
        course: null,
        lesson: lesson
          ? {
              id: lesson.id,
              slug: lesson.slug,
              title: lesson.title,
              course_id: lesson.course_id,
              course_slug: lessonCourse?.slug || null,
              course_title: lessonCourse?.title || null,
            }
          : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        items,
        courses: items.filter((item) => item.entity_type === 'course'),
        lessons: items.filter((item) => item.entity_type === 'lesson'),
      },
    })
  } catch (error) {
    console.error('academy saved get failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/academy/saved
 * Body: { entity_type: 'course' | 'lesson', entity_id: string }
 * Toggles saved state for the given entity.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user } = auth
    const body = await request.json().catch(() => ({}))
    const entityType = body?.entity_type as SavedEntityType
    const rawEntityId = typeof body?.entity_id === 'string' ? body.entity_id : null

    if ((entityType !== 'course' && entityType !== 'lesson') || !rawEntityId) {
      return NextResponse.json(
        { success: false, error: 'entity_type and entity_id are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const resolvedEntityId = await resolveEntityId({
      supabaseAdmin,
      entityType,
      entityId: rawEntityId,
    })

    if (!resolvedEntityId) {
      return NextResponse.json(
        { success: false, error: 'Entity not found' },
        { status: 404 }
      )
    }

    const { data: existingSave } = await supabaseAdmin
      .from('user_saved_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('entity_type', entityType)
      .eq('entity_id', resolvedEntityId)
      .maybeSingle()

    if (existingSave?.id) {
      const { error: deleteError } = await supabaseAdmin
        .from('user_saved_items')
        .delete()
        .eq('id', existingSave.id)
        .eq('user_id', user.id)

      if (deleteError) {
        return NextResponse.json({ success: false, error: 'Failed to unsave item' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: { saved: false },
      })
    }

    const { error: insertError } = await supabaseAdmin
      .from('user_saved_items')
      .insert({
        user_id: user.id,
        entity_type: entityType,
        entity_id: resolvedEntityId,
      })

    if (insertError) {
      return NextResponse.json({ success: false, error: 'Failed to save item' }, { status: 500 })
    }

    await supabaseAdmin.from('user_learning_activity_log').insert({
      user_id: user.id,
      activity_type: 'bookmark',
      entity_id: resolvedEntityId,
      entity_type: entityType,
      xp_earned: 0,
      metadata: {
        action: 'saved',
      },
    })

    return NextResponse.json({
      success: true,
      data: { saved: true },
    })
  } catch (error) {
    console.error('academy saved post failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
