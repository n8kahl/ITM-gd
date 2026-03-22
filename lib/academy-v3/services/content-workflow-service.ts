import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyLesson, AcademyLessonStatus } from '@/lib/academy-v3/contracts/domain'
import { SupabaseAcademyLessonRepository } from '@/lib/academy-v3/repositories'

import { AcademyInvalidStatusTransitionError, AcademyLessonNotFoundError } from './errors'

/**
 * Valid status transitions for the content workflow.
 * draft → review → published
 * review → draft (reject back)
 * published → draft (unpublish)
 */
const VALID_TRANSITIONS: Record<AcademyLessonStatus, AcademyLessonStatus[]> = {
  draft: ['review'],
  review: ['published', 'draft'],
  published: ['draft'],
}

export class AcademyContentWorkflowService {
  private readonly lessons: SupabaseAcademyLessonRepository

  constructor(supabase: SupabaseClient) {
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
  }

  async transitionLessonStatus(
    lessonId: string,
    targetStatus: AcademyLessonStatus,
    actorId?: string
  ): Promise<{ lesson: AcademyLesson; previousStatus: AcademyLessonStatus }> {
    const lesson = await this.lessons.getLessonById(lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const currentStatus = lesson.status
    const allowedTargets = VALID_TRANSITIONS[currentStatus]

    if (!allowedTargets.includes(targetStatus)) {
      throw new AcademyInvalidStatusTransitionError(currentStatus, targetStatus)
    }

    const updated = await this.lessons.updateLessonStatus(
      lessonId,
      targetStatus,
      targetStatus === 'published' ? actorId : undefined
    )

    if (!updated) {
      throw new AcademyLessonNotFoundError()
    }

    return { lesson: updated, previousStatus: currentStatus }
  }

  async listLessons(params: {
    status?: AcademyLessonStatus
    moduleId?: string
    limit: number
    offset: number
  }): Promise<{ lessons: AcademyLesson[]; total: number }> {
    return this.lessons.listLessonsByStatus(params)
  }

  async getLessonForAdmin(lessonId: string): Promise<AcademyLesson> {
    const lesson = await this.lessons.getLessonById(lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }
    return lesson
  }
}
