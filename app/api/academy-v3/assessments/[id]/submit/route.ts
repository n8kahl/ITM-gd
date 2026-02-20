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
import {
  AcademyAccessError,
  assertAssessmentAccess,
  assertMembersAreaRoleAccess,
} from '@/lib/academy-v3/access-control'
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
    const roleIds = await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })

    const parsedParams = getAcademyAssessmentParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }
    await assertAssessmentAccess({
      supabase: auth.supabase,
      userId: auth.user.id,
      roleIds,
      assessmentId: parsedParams.data.id,
    })

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
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

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
