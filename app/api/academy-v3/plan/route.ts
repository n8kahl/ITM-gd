import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyPlanResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyPlanNotFoundError,
  AcademyPlanService,
} from '@/lib/academy-v3/services'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') ?? undefined

    const service = new AcademyPlanService(auth.supabase)
    const plan = await service.getPlan({ programCode })

    const payload = getAcademyPlanResponseSchema.parse({ data: plan })
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof AcademyPlanNotFoundError) {
      return academyV3ErrorResponse(404, 'PLAN_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load academy plan')
    )
  }
}
