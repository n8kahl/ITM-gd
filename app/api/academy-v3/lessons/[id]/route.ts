import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyLessonParamsSchema,
  getAcademyLessonResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyLessonNotFoundError,
  AcademyLessonService,
} from '@/lib/academy-v3/services'
import {
  AcademyAccessError,
  assertLessonContentAccess,
  assertMembersAreaRoleAccess,
} from '@/lib/academy-v3/access-control'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

export async function GET(
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

    const rawParams = await params
    const parsedParams = getAcademyLessonParamsSchema.safeParse(rawParams)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }
    await assertLessonContentAccess({
      supabase: auth.supabase,
      userId: auth.user.id,
      roleIds,
      lessonId: parsedParams.data.id,
    })

    const service = new AcademyLessonService(auth.supabase)
    const lessonData = await service.getLessonById(parsedParams.data.id)

    const payload = getAcademyLessonResponseSchema.parse({ data: lessonData })
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    if (error instanceof AcademyLessonNotFoundError) {
      return academyV3ErrorResponse(404, 'LESSON_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load academy lesson')
    )
  }
}
