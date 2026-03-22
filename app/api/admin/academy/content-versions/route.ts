import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { isAdminUser, getServerUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { ContentVersioningService, ContentVersioningError } from '@/lib/academy-v3/services'
import { AcademyLessonNotFoundError } from '@/lib/academy-v3/services'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const listVersionsSchema = z.object({
  lessonId: z.string().uuid(),
})

const createSnapshotSchema = z.object({
  lessonId: z.string().uuid(),
  changeSummary: z.string().optional(),
})

const rollbackSchema = z.object({
  lessonId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
})

/**
 * GET /api/admin/academy/content-versions?lessonId=<uuid>
 * List all versions for a lesson.
 */
export async function GET(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const params = listVersionsSchema.parse({
      lessonId: url.searchParams.get('lessonId') ?? '',
    })

    const service = new ContentVersioningService(getSupabaseAdmin())
    const versions = await service.listVersions(params.lessonId)

    return NextResponse.json({ success: true, data: versions })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'lessonId query parameter is required (valid UUID)' },
        { status: 400 }
      )
    }
    console.error('content-versions GET failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/academy/content-versions
 * Create a manual version snapshot.
 * Body: { lessonId: string, changeSummary?: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSnapshotSchema.parse(body)

    const service = new ContentVersioningService(getSupabaseAdmin())
    const version = await service.createSnapshot(
      parsed.lessonId,
      user.id,
      parsed.changeSummary
    )

    return NextResponse.json({ success: true, data: version })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: (err as z.ZodError).errors },
        { status: 400 }
      )
    }
    if (err instanceof AcademyLessonNotFoundError) {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }
    console.error('content-versions POST failed', err)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(err) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/academy/content-versions
 * Rollback a lesson to a previous version.
 * Body: { lessonId: string, versionNumber: number }
 */
export async function PUT(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = rollbackSchema.parse(body)

    const service = new ContentVersioningService(getSupabaseAdmin())
    const version = await service.rollbackToVersion(
      parsed.lessonId,
      parsed.versionNumber,
      user.id
    )

    return NextResponse.json({ success: true, data: version })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: (err as z.ZodError).errors },
        { status: 400 }
      )
    }
    if (err instanceof ContentVersioningError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 422 })
    }
    console.error('content-versions PUT failed', err)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(err) },
      { status: 500 }
    )
  }
}
