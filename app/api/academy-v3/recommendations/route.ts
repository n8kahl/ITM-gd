import { NextRequest, NextResponse } from 'next/server'

import { getRecommendationsResponseSchema } from '@/lib/academy-v3/contracts/api'
import { AcademyRecommendationService } from '@/lib/academy-v3/services'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const service = new AcademyRecommendationService(auth.supabase)
    const result = await service.getRecommendations(auth.user.id)

    return NextResponse.json(getRecommendationsResponseSchema.parse({ data: result }))
  } catch (error) {
    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load recommendations')
    )
  }
}
