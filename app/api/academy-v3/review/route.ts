import { NextRequest, NextResponse } from 'next/server'

import { getReviewQueueResponseSchema } from '@/lib/academy-v3/contracts/api'
import { AcademyReviewService } from '@/lib/academy-v3/services'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
  ensureEnrollmentForProgramCode,
} from '@/lib/academy-v3/access-control'
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
    await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })
    await ensureEnrollmentForProgramCode({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    const limit = parseLimit(new URL(request.url).searchParams)
    const service = new AcademyReviewService(auth.supabase)
    const result = await service.getDueQueue({
      userId: auth.user.id,
      limit,
    })

    return NextResponse.json(getReviewQueueResponseSchema.parse({ data: result }))
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load review queue')
    )
  }
}
