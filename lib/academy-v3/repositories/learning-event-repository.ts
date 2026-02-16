import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyLearningEventRepository } from './types'

export class SupabaseAcademyLearningEventRepository implements AcademyLearningEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertEvent(input: {
    userId: string
    eventType:
      | 'lesson_started'
      | 'block_completed'
      | 'assessment_submitted'
      | 'assessment_passed'
      | 'assessment_failed'
      | 'remediation_assigned'
      | 'review_completed'
    lessonId?: string | null
    moduleId?: string | null
    assessmentId?: string | null
    payload?: Record<string, unknown>
  }): Promise<void> {
    const { error } = await this.supabase.from('academy_learning_events').insert({
      user_id: input.userId,
      event_type: input.eventType,
      lesson_id: input.lessonId || null,
      module_id: input.moduleId || null,
      assessment_id: input.assessmentId || null,
      payload: input.payload || {},
    })

    if (error) {
      throw new Error(`Failed to insert learning event: ${error.message}`)
    }
  }
}
