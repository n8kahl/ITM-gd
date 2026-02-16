import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyLessonAttempt, AcademyProgressRepository } from './types'

function mapLessonAttempt(row: Record<string, unknown>): AcademyLessonAttempt {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    lessonId: String(row.lesson_id),
    status: (row.status as AcademyLessonAttempt['status']) || 'in_progress',
    progressPercent: typeof row.progress_percent === 'number' ? row.progress_percent : 0,
    metadata:
      typeof row.metadata === 'object' && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export class SupabaseAcademyProgressRepository implements AcademyProgressRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertLessonAttempt(input: {
    userId: string
    lessonId: string
    status: AcademyLessonAttempt['status']
    progressPercent: number
    metadata: Record<string, unknown>
  }): Promise<AcademyLessonAttempt> {
    const { data, error } = await this.supabase
      .from('academy_user_lesson_attempts')
      .upsert(
        {
          user_id: input.userId,
          lesson_id: input.lessonId,
          status: input.status,
          progress_percent: input.progressPercent,
          metadata: input.metadata,
          completed_at: input.status === 'passed' ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id,lesson_id' }
      )
      .select('id, user_id, lesson_id, status, progress_percent, metadata')
      .single()

    if (error || !data) {
      throw new Error(`Failed to upsert lesson attempt: ${error?.message || 'unknown error'}`)
    }

    return mapLessonAttempt(data)
  }

  async getLessonAttempt(userId: string, lessonId: string): Promise<AcademyLessonAttempt | null> {
    const { data, error } = await this.supabase
      .from('academy_user_lesson_attempts')
      .select('id, user_id, lesson_id, status, progress_percent, metadata')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch lesson attempt: ${error.message}`)
    }

    return data ? mapLessonAttempt(data) : null
  }
}
