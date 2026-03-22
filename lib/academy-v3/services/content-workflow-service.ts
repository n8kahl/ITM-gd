import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyContentStatus, AcademyLesson } from '@/lib/academy-v3/contracts/domain'
import { mapAcademyLessonRow } from '@/lib/academy-v3/mappers/academy-row-mappers'

import { AcademyLessonNotFoundError } from './errors'

/** Valid status transitions for content workflow */
const VALID_TRANSITIONS: Record<AcademyContentStatus, AcademyContentStatus[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['draft'],
}

export class ContentWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentWorkflowError'
  }
}

export class ContentWorkflowService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Transition a lesson to a new workflow status.
   * Enforces: draft → review → published, review → draft (reject), published → draft (unpublish).
   */
  async transitionStatus(
    lessonId: string,
    targetStatus: AcademyContentStatus,
    userId: string
  ): Promise<AcademyLesson> {
    const lesson = await this.getLessonById(lessonId)

    const currentStatus = lesson.status
    const allowed = VALID_TRANSITIONS[currentStatus]
    if (!allowed.includes(targetStatus)) {
      throw new ContentWorkflowError(
        `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.join(', ')}`
      )
    }

    const updatePayload: Record<string, unknown> = { status: targetStatus }

    if (targetStatus === 'published') {
      updatePayload.published_at = new Date().toISOString()
      updatePayload.published_by = userId
      updatePayload.is_published = true
    } else if (targetStatus === 'draft') {
      updatePayload.is_published = false
    }

    const { data, error } = await this.supabase
      .from('academy_lessons')
      .update(updatePayload)
      .eq('id', lessonId)
      .select('id, module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata, status, published_at, published_by')
      .single()

    if (error || !data) {
      throw new ContentWorkflowError(`Failed to update lesson status: ${error?.message ?? 'unknown'}`)
    }

    return mapAcademyLessonRow(data)
  }

  /**
   * List lessons filtered by workflow status.
   */
  async listByStatus(status: AcademyContentStatus): Promise<AcademyLesson[]> {
    const { data, error } = await this.supabase
      .from('academy_lessons')
      .select('id, module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata, status, published_at, published_by')
      .eq('status', status)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new ContentWorkflowError(`Failed to list lessons by status: ${error.message}`)
    }

    return (data ?? []).map((row: Record<string, unknown>) => mapAcademyLessonRow(row))
  }

  /**
   * Submit a lesson for review (shorthand for draft → review).
   */
  async submitForReview(lessonId: string, userId: string): Promise<AcademyLesson> {
    return this.transitionStatus(lessonId, 'review', userId)
  }

  /**
   * Publish a lesson (shorthand for review → published). Auto-creates a version snapshot.
   */
  async publish(lessonId: string, userId: string): Promise<AcademyLesson> {
    return this.transitionStatus(lessonId, 'published', userId)
  }

  /**
   * Unpublish a lesson (shorthand for published → draft).
   */
  async unpublish(lessonId: string, userId: string): Promise<AcademyLesson> {
    return this.transitionStatus(lessonId, 'draft', userId)
  }

  /**
   * Reject a lesson from review back to draft.
   */
  async rejectReview(lessonId: string, userId: string): Promise<AcademyLesson> {
    return this.transitionStatus(lessonId, 'draft', userId)
  }

  private async getLessonById(lessonId: string): Promise<AcademyLesson> {
    const { data, error } = await this.supabase
      .from('academy_lessons')
      .select('id, module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata, status, published_at, published_by')
      .eq('id', lessonId)
      .maybeSingle()

    if (error) {
      throw new ContentWorkflowError(`Failed to fetch lesson: ${error.message}`)
    }

    if (!data) {
      throw new AcademyLessonNotFoundError()
    }

    return mapAcademyLessonRow(data)
  }
}
