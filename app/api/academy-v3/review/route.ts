import { NextRequest, NextResponse } from 'next/server'

import { getReviewQueueResponseSchema } from '@/lib/academy-v3/contracts/api'
import { AcademyReviewService } from '@/lib/academy-v3/services'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

function parseLimit(searchParams: URLSearchParams): number {
  const value = searchParams.get('limit')
  if (!value) return 20
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 20
  return Math.trunc(parsed)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const limit = parseLimit(new URL(request.url).searchParams)
    const service = new AcademyReviewService(auth.supabase)
    const result = await service.getDueQueue({
      userId: auth.user.id,
      limit,
    })

    return NextResponse.json(getReviewQueueResponseSchema.parse({ data: result }))
  } catch (error) {
    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load review queue')
    )
  }
}
