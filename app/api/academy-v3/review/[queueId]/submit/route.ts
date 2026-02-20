import { NextRequest, NextResponse } from 'next/server'

import {
  getReviewQueueParamsSchema,
  submitReviewRequestSchema,
  submitReviewResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyReviewQueueItemNotFoundError,
  AcademyReviewService,
} from '@/lib/academy-v3/services'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
  ensureEnrollmentForProgramCode,
} from '@/lib/academy-v3/access-control'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ queueId: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }
    await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })
    await ensureEnrollmentForProgramCode({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    const parsedParams = getReviewQueueParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }

    const rawBody = await request.json().catch(() => null)
    const parsedBody = submitReviewRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return academyV3ErrorResponse(400, 'INVALID_BODY', 'Invalid request body', parsedBody.error.flatten())
    }

    const service = new AcademyReviewService(auth.supabase)
    const result = await service.submitReview({
      userId: auth.user.id,
      queueId: parsedParams.data.queueId,
      answer: parsedBody.data.answer,
      confidenceRating: parsedBody.data.confidenceRating,
      latencyMs: parsedBody.data.latencyMs,
    })

    return NextResponse.json(submitReviewResponseSchema.parse({ data: result }))
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    if (error instanceof AcademyReviewQueueItemNotFoundError) {
      return academyV3ErrorResponse(404, 'QUEUE_ITEM_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to submit review answer')
    )
  }
}
