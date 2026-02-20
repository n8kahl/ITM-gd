import { NextRequest, NextResponse } from 'next/server'

import { getAcademyResumeResponseSchema } from '@/lib/academy-v3/contracts/api'
import { resolveAcademyResumeTarget } from '@/lib/academy/resume'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
  ensureEnrollmentForProgramCode,
} from '@/lib/academy-v3/access-control'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }
    const roleIds = await assertMembersAreaRoleAccess({
      user: auth.user,
      supabase: auth.supabase,
    })
    await ensureEnrollmentForProgramCode({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    const target = await resolveAcademyResumeTarget(auth.supabase, {
      userId: auth.user.id,
      roleIds,
    })

    return NextResponse.json(getAcademyResumeResponseSchema.parse({ data: target }))
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to resolve academy resume target')
    )
  }
}
