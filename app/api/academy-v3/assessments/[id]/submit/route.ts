import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyAssessmentParamsSchema,
  submitAssessmentRequestSchema,
  submitAssessmentResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyAssessmentNotFoundError,
  AcademyAssessmentService,
} from '@/lib/academy-v3/services'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse, logAcademyError } from '@/app/api/academy-v3/_shared'

const ROUTE = 'assessments/[id]/submit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const parsedParams = getAcademyAssessmentParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }

    const rawBody = await request.json().catch(() => null)
    if (rawBody === null) {
      return academyV3ErrorResponse(400, 'INVALID_BODY', 'Request body must be valid JSON')
    }

    const parsedBody = submitAssessmentRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return academyV3ErrorResponse(400, 'INVALID_BODY', 'Invalid request body', parsedBody.error.flatten())
    }

    // Validate answers are not empty
    if (!parsedBody.data.answers || parsedBody.data.answers.length === 0) {
      return academyV3ErrorResponse(400, 'EMPTY_ANSWERS', 'Assessment submission must include at least one answer')
    }

    const service = new AcademyAssessmentService(auth.supabase)
    const result = await service.submitAssessment({
      userId: auth.user.id,
      assessmentId: parsedParams.data.id,
      answers: parsedBody.data.answers,
    })

    return NextResponse.json(submitAssessmentResponseSchema.parse({ data: result }))
  } catch (error) {
    if (error instanceof AcademyAssessmentNotFoundError) {
      return academyV3ErrorResponse(404, 'ASSESSMENT_NOT_FOUND', error.message)
    }

    logAcademyError(ROUTE, 'INTERNAL_ERROR', error, {
      assessmentId: (await params).id,
    })

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to submit assessment')
    )
  }
}
