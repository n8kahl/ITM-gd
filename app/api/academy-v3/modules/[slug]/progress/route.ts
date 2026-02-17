import { NextRequest, NextResponse } from 'next/server'

import {
  getAcademyModuleParamsSchema,
  getAcademyModuleProgressResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  AcademyModuleNotFoundError,
  AcademyModuleService,
} from '@/lib/academy-v3/services'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

type AttemptRow = {
  lesson_id: string
  status: 'in_progress' | 'submitted' | 'passed' | 'failed' | null
  progress_percent: number | null
  metadata: Record<string, unknown> | null
}

function resolveCompletedBlockIds(metadata: Record<string, unknown> | null): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const maybeIds = metadata.completedBlockIds
  if (!Array.isArray(maybeIds)) return []
  return maybeIds.filter((value): value is string => typeof value === 'string')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return academyV3ErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const parsedParams = getAcademyModuleParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return academyV3ErrorResponse(400, 'INVALID_PARAMS', 'Invalid route parameters', parsedParams.error.flatten())
    }

    const moduleData = await new AcademyModuleService(auth.supabase).getModuleBySlug(parsedParams.data.slug)
    const lessonIds = moduleData.lessons.map((lesson) => lesson.id)

    const attemptMap = new Map<string, AttemptRow>()
    if (lessonIds.length > 0) {
      const attemptsResult = await auth.supabase
        .from('academy_user_lesson_attempts')
        .select('lesson_id, status, progress_percent, metadata')
        .eq('user_id', auth.user.id)
        .in('lesson_id', lessonIds)

      if (attemptsResult.error) {
        throw new Error(attemptsResult.error.message)
      }

      for (const row of (attemptsResult.data || []) as AttemptRow[]) {
        attemptMap.set(row.lesson_id, row)
      }
    }

    const payload = getAcademyModuleProgressResponseSchema.parse({
      data: {
        moduleId: moduleData.id,
        moduleSlug: moduleData.slug,
        lessons: moduleData.lessons.map((lesson) => {
          const attempt = attemptMap.get(lesson.id)
          return {
            lessonId: lesson.id,
            status: attempt?.status || 'not_started',
            progressPercent: typeof attempt?.progress_percent === 'number' ? attempt.progress_percent : 0,
            completedBlockIds: resolveCompletedBlockIds(attempt?.metadata || null),
          }
        }),
      },
    })

    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof AcademyModuleNotFoundError) {
      return academyV3ErrorResponse(404, 'MODULE_NOT_FOUND', error.message)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load module progress')
    )
  }
}
