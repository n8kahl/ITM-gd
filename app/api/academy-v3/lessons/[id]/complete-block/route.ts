import { NextRequest, NextResponse } from 'next/server'

import {
  completeBlockRequestSchema,
  completeBlockResponseSchema,
  getAcademyLessonParamsSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyBlockNotFoundError,
  AcademyLessonNotFoundError,
  AcademyProgressionService,
} from '@/lib/academy-v3/services'
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

    const parsedParams = getAcademyLessonParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }

    const rawBody = await request.json().catch(() => null)
    const parsedBody = completeBlockRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return academyV3ErrorResponse(400, 'INVALID_BODY', 'Invalid request body', parsedBody.error.flatten())
    }

    const service = new AcademyProgressionService(auth.supabase)
    const result = await service.completeBlock({
      userId: auth.user.id,
      lessonId: parsedParams.data.id,
      blockId: parsedBody.data.blockId,
      payload: parsedBody.data.payload,
    })

    return NextResponse.json(completeBlockResponseSchema.parse({ data: result }))
  } catch (error) {
    if (error instanceof AcademyLessonNotFoundError) {
      return academyV3ErrorResponse(404, 'LESSON_NOT_FOUND', error.message)
    }

    if (error instanceof AcademyBlockNotFoundError) {
      return academyV3ErrorResponse(404, 'BLOCK_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to complete lesson block')
    )
  }
}
