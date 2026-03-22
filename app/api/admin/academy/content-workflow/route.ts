import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { isAdminUser, getServerUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { ContentWorkflowService, ContentWorkflowError } from '@/lib/academy-v3/services'
import { AcademyLessonNotFoundError } from '@/lib/academy-v3/services'
import { academyContentStatusSchema } from '@/lib/academy-v3/contracts/domain'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const transitionRequestSchema = z.object({
  lessonId: z.string().uuid(),
  targetStatus: academyContentStatusSchema,
})

const listQuerySchema = z.object({
  status: academyContentStatusSchema.optional(),
})

/**
 * GET /api/admin/academy/content-workflow
 * List lessons by workflow status. Query param: ?status=draft|review|published
 */
export async function GET(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const query = listQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
    })

    const service = new ContentWorkflowService(getSupabaseAdmin())

    if (query.status) {
      const lessons = await service.listByStatus(query.status)
      return NextResponse.json({ success: true, data: lessons })
    }

    // Return all statuses grouped
    const [drafts, reviews, published] = await Promise.all([
      service.listByStatus('draft'),
      service.listByStatus('review'),
      service.listByStatus('published'),
    ])

    return NextResponse.json({
      success: true,
      data: { drafts, reviews, published },
    })
  } catch (error) {
    console.error('content-workflow GET failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/academy/content-workflow
 * Transition a lesson's workflow status.
 * Body: { lessonId: string, targetStatus: 'draft' | 'review' | 'published' }
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
    const parsed = transitionRequestSchema.parse(body)

    const supabaseAdmin = getSupabaseAdmin()
    const workflowService = new ContentWorkflowService(supabaseAdmin)

    const lesson = await workflowService.transitionStatus(
      parsed.lessonId,
      parsed.targetStatus,
      user.id
    )

    // Auto-snapshot on publish
    if (parsed.targetStatus === 'published') {
      const { ContentVersioningService } = await import('@/lib/academy-v3/services')
      const versioningService = new ContentVersioningService(supabaseAdmin)
      await versioningService.createSnapshot(parsed.lessonId, user.id, 'Published')
    }

    return NextResponse.json({ success: true, data: lesson })
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
    if (err instanceof ContentWorkflowError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 422 })
    }
    console.error('content-workflow POST failed', err)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(err) },
      { status: 500 }
    )
  }
}
