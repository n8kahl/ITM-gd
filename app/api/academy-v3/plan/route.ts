import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyPlanResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyPlanNotFoundError,
  AcademyPlanService,
} from '@/lib/academy-v3/services'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
  ensureProgramEnrollment,
} from '@/lib/academy-v3/access-control'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }
    await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })

    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') ?? undefined

    const service = new AcademyPlanService(auth.supabase)
    const plan = await service.getPlan({ programCode })
    await ensureProgramEnrollment({
      supabase: auth.supabase,
      userId: auth.user.id,
      programId: plan.program.id,
    })

    const payload = getAcademyPlanResponseSchema.parse({ data: plan })
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

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
