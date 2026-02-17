import { NextRequest, NextResponse } from 'next/server'

import { getAcademyResumeResponseSchema } from '@/lib/academy-v3/contracts/api'
import { resolveAcademyResumeTarget } from '@/lib/academy/resume'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const target = await resolveAcademyResumeTarget(auth.supabase, {
      userId: auth.user.id,
    })

    return NextResponse.json(getAcademyResumeResponseSchema.parse({ data: target }))
  } catch (error) {
    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to resolve academy resume target')
    )
  }
}
