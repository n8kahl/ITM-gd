import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyLessonParamsSchema,
  startLessonRequestSchema,
  startLessonResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyLessonNotFoundError,
  AcademyProgressionService,
} from '@/lib/academy-v3/services'
import {
  AcademyAccessError,
  assertLessonContentAccess,
  assertMembersAreaRoleAccess,
} from '@/lib/academy-v3/access-control'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }
    const roleIds = await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })

    const parsedParams = getAcademyLessonParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }
    await assertLessonContentAccess({
      supabase: auth.supabase,
      userId: auth.user.id,
      roleIds,
      lessonId: parsedParams.data.id,
    })

    const rawBody = await request.json().catch(() => ({}))
    const parsedBody = startLessonRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return academyV3ErrorResponse(400, 'INVALID_BODY', 'Invalid request body', parsedBody.error.flatten())
    }

    const service = new AcademyProgressionService(auth.supabase)
    const result = await service.startLesson({
      userId: auth.user.id,
      lessonId: parsedParams.data.id,
      source: parsedBody.data.source,
    })

    return NextResponse.json(startLessonResponseSchema.parse({ data: result }))
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    if (error instanceof AcademyLessonNotFoundError) {
      return academyV3ErrorResponse(404, 'LESSON_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to start lesson')
    )
  }
}
