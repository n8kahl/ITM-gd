import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyLessonAttemptResponseSchema,
  getAcademyLessonParamsSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyLessonNotFoundError,
  AcademyLessonService,
} from '@/lib/academy-v3/services'
import { SupabaseAcademyProgressRepository } from '@/lib/academy-v3/repositories'
import {
  AcademyAccessError,
  assertLessonContentAccess,
  assertMembersAreaRoleAccess,
} from '@/lib/academy-v3/access-control'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

function resolveCompletedBlockIds(metadata: Record<string, unknown>): string[] {
  const maybeIds = metadata.completedBlockIds
  if (!Array.isArray(maybeIds)) return []
  return maybeIds.filter((value): value is string => typeof value === 'string')
}

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

    const parsedParams = getAcademyLessonParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }
    await assertLessonContentAccess({
      supabase: auth.supabase,
      userId: auth.user.id,
      roleIds,
      lessonId: parsedParams.data.id,
    })

    await new AcademyLessonService(auth.supabase).getLessonById(parsedParams.data.id)

    const attempt = await new SupabaseAcademyProgressRepository(auth.supabase).getLessonAttempt(
      auth.user.id,
      parsedParams.data.id
    )

    const payload = getAcademyLessonAttemptResponseSchema.parse({
      data: {
        lessonId: parsedParams.data.id,
        status: attempt?.status || 'not_started',
        progressPercent: attempt?.progressPercent || 0,
        completedBlockIds: attempt ? resolveCompletedBlockIds(attempt.metadata || {}) : [],
      },
    })

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
      toSafeErrorMessage(error, 'Failed to load lesson attempt')
    )
  }
}
