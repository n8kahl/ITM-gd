import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import { updateLessonStatusRequestSchema } from '@/lib/academy-v3/contracts/api'
import { AcademyContentWorkflowService } from '@/lib/academy-v3/services/content-workflow-service'
import {
  AcademyInvalidStatusTransitionError,
  AcademyLessonNotFoundError,
} from '@/lib/academy-v3/services/errors'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminUser())) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateLessonStatusRequestSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('Invalid request body', 400, parsed.error.flatten())
    }

    const supabase = getSupabaseAdmin()
    const service = new AcademyContentWorkflowService(supabase)

    const { lesson, previousStatus } = await service.transitionLessonStatus(
      id,
      parsed.data.status,
      parsed.data.publishedBy
    )

    return successResponse({
      lessonId: lesson.id,
      previousStatus,
      newStatus: lesson.status,
      publishedAt: lesson.publishedAt,
    })
  } catch (err) {
    if (err instanceof AcademyLessonNotFoundError) {
      return errorResponse('Lesson not found', 404)
    }
    if (err instanceof AcademyInvalidStatusTransitionError) {
      return errorResponse(err.message, 422)
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
