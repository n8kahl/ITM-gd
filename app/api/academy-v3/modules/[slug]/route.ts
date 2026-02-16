import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyModuleParamsSchema,
  getAcademyModuleResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyModuleNotFoundError,
  AcademyModuleService,
} from '@/lib/academy-v3/services'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const rawParams = await params
    const parsedParams = getAcademyModuleParamsSchema.safeParse(rawParams)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }

    const service = new AcademyModuleService(auth.supabase)
    const moduleData = await service.getModuleBySlug(parsedParams.data.slug)

    const payload = getAcademyModuleResponseSchema.parse({ data: moduleData })
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof AcademyModuleNotFoundError) {
      return academyV3ErrorResponse(404, 'MODULE_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load academy module')
    )
  }
}
