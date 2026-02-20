import { NextRequest, NextResponse } from 'next/server'

import { getAcademyProgressSummaryResponseSchema } from '@/lib/academy-v3/contracts/api'
import { AcademyPlanService } from '@/lib/academy-v3/services'
import {
  AcademyAccessError,
  assertMembersAreaRoleAccess,
  ensureProgramEnrollment,
} from '@/lib/academy-v3/access-control'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { academyV3ErrorResponse } from '@/app/api/academy-v3/_shared'

type AttemptRow = {
  lesson_id: string
  status: 'in_progress' | 'submitted' | 'passed' | 'failed' | null
}

function asProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((completed / total) * 100)
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

    const plan = await new AcademyPlanService(auth.supabase).getPlan()
    await ensureProgramEnrollment({
      supabase: auth.supabase,
      userId: auth.user.id,
      programId: plan.program.id,
    })

    const trackMap = new Map<string, {
      trackId: string
      trackTitle: string
      totalLessons: number
      completedLessons: number
      inProgressLessons: number
    }>()
    const moduleMap = new Map<string, {
      moduleId: string
      moduleSlug: string
      moduleTitle: string
      trackId: string
      totalLessons: number
      completedLessons: number
      inProgressLessons: number
    }>()
    const lessonToModuleId = new Map<string, string>()
    const moduleToTrackId = new Map<string, string>()

    for (const track of plan.tracks) {
      trackMap.set(track.id, {
        trackId: track.id,
        trackTitle: track.title,
        totalLessons: 0,
        completedLessons: 0,
        inProgressLessons: 0,
      })

      for (const moduleItem of track.modules) {
        moduleToTrackId.set(moduleItem.id, track.id)
        moduleMap.set(moduleItem.id, {
          moduleId: moduleItem.id,
          moduleSlug: moduleItem.slug,
          moduleTitle: moduleItem.title,
          trackId: track.id,
          totalLessons: moduleItem.lessons.length,
          completedLessons: 0,
          inProgressLessons: 0,
        })

        const scopedTrack = trackMap.get(track.id)
        if (scopedTrack) scopedTrack.totalLessons += moduleItem.lessons.length

        for (const lesson of moduleItem.lessons) {
          lessonToModuleId.set(lesson.id, moduleItem.id)
        }
      }
    }

    const lessonIds = Array.from(lessonToModuleId.keys())
    let attempts: AttemptRow[] = []

    if (lessonIds.length > 0) {
      const attemptsResult = await auth.supabase
        .from('academy_user_lesson_attempts')
        .select('lesson_id, status')
        .eq('user_id', auth.user.id)
        .in('lesson_id', lessonIds)

      if (attemptsResult.error) {
        throw new Error(attemptsResult.error.message)
      }

      attempts = (attemptsResult.data || []) as AttemptRow[]
    }

    for (const attempt of attempts) {
      const moduleId = lessonToModuleId.get(attempt.lesson_id)
      if (!moduleId) continue

      const moduleSummary = moduleMap.get(moduleId)
      if (!moduleSummary) continue

      const trackId = moduleToTrackId.get(moduleId)
      const trackSummary = trackId ? trackMap.get(trackId) : null

      if (attempt.status === 'passed') {
        moduleSummary.completedLessons += 1
        if (trackSummary) trackSummary.completedLessons += 1
        continue
      }

      if (attempt.status === 'in_progress' || attempt.status === 'submitted') {
        moduleSummary.inProgressLessons += 1
        if (trackSummary) trackSummary.inProgressLessons += 1
      }
    }

    const tracks = Array.from(trackMap.values()).map((track) => ({
      ...track,
      progressPercent: asProgressPercent(track.completedLessons, track.totalLessons),
    }))

    const modules = Array.from(moduleMap.values()).map((moduleItem) => ({
      ...moduleItem,
      progressPercent: asProgressPercent(moduleItem.completedLessons, moduleItem.totalLessons),
    }))

    const totalLessons = tracks.reduce((sum, track) => sum + track.totalLessons, 0)
    const completedLessons = tracks.reduce((sum, track) => sum + track.completedLessons, 0)
    const inProgressLessons = tracks.reduce((sum, track) => sum + track.inProgressLessons, 0)

    return NextResponse.json(
      getAcademyProgressSummaryResponseSchema.parse({
        data: {
          totalLessons,
          completedLessons,
          inProgressLessons,
          progressPercent: asProgressPercent(completedLessons, totalLessons),
          tracks,
          modules,
        },
      })
    )
  } catch (error) {
    if (error instanceof AcademyAccessError) {
      return academyV3ErrorResponse(error.status, error.code, error.message, error.details)
    }

    return academyV3ErrorResponse(
      500,
      'INTERNAL_ERROR',
      toSafeErrorMessage(error, 'Failed to load academy progress summary')
    )
  }
}
