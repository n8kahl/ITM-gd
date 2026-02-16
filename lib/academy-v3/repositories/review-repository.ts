import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyReviewQueueRecord, AcademyReviewRepository } from './types'

function mapReviewQueueRecord(row: Record<string, unknown>): AcademyReviewQueueRecord {
  const competencyRelation = Array.isArray(row.academy_competencies)
    ? row.academy_competencies[0]
    : row.academy_competencies

  const competency =
    competencyRelation && typeof competencyRelation === 'object'
      ? (competencyRelation as Record<string, unknown>)
      : {}

  return {
    queueId: String(row.id),
    userId: String(row.user_id),
    competencyId: String(row.competency_id),
    competencyKey: typeof competency.key === 'string' ? competency.key : null,
    competencyTitle: typeof competency.title === 'string' ? competency.title : null,
    promptJson:
      typeof row.prompt_json === 'object' && row.prompt_json !== null
        ? (row.prompt_json as Record<string, unknown>)
        : {},
    dueAt: String(row.due_at),
    intervalDays: typeof row.interval_days === 'number' ? row.interval_days : 1,
    priorityWeight: typeof row.priority_weight === 'number' ? row.priority_weight : 1,
  }
}

export class SupabaseAcademyReviewRepository implements AcademyReviewRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listDueQueueItemsForUser(userId: string, limit: number): Promise<AcademyReviewQueueRecord[]> {
    const { data, error } = await this.supabase
      .from('academy_review_queue')
      .select(`
        id,
        user_id,
        competency_id,
        prompt_json,
        due_at,
        interval_days,
        priority_weight,
        academy_competencies(key, title)
      `)
      .eq('user_id', userId)
      .eq('status', 'due')
      .lte('due_at', new Date().toISOString())
      .order('priority_weight', { ascending: false })
      .order('due_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to list due review queue items: ${error.message}`)
    }

    return (data || []).map((row) => mapReviewQueueRecord(row))
  }

  async getQueueItemForUser(queueId: string, userId: string): Promise<AcademyReviewQueueRecord | null> {
    const { data, error } = await this.supabase
      .from('academy_review_queue')
      .select(`
        id,
        user_id,
        competency_id,
        prompt_json,
        due_at,
        interval_days,
        priority_weight,
        academy_competencies(key, title)
      `)
      .eq('id', queueId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch review queue item: ${error.message}`)
    }

    return data ? mapReviewQueueRecord(data) : null
  }

  async insertQueueItem(input: {
    userId: string
    competencyId: string
    sourceAssessmentItemId: string | null
    promptJson: Record<string, unknown>
    dueAt: string
    intervalDays: number
    priorityWeight: number
    status: 'due' | 'completed' | 'snoozed' | 'skipped'
  }): Promise<void> {
    const { error } = await this.supabase.from('academy_review_queue').insert({
      user_id: input.userId,
      competency_id: input.competencyId,
      source_assessment_item_id: input.sourceAssessmentItemId,
      prompt_json: input.promptJson,
      due_at: input.dueAt,
      interval_days: input.intervalDays,
      priority_weight: input.priorityWeight,
      status: input.status,
    })

    if (error) {
      throw new Error(`Failed to insert review queue item: ${error.message}`)
    }
  }

  async updateQueueItem(input: {
    queueId: string
    userId: string
    dueAt: string
    intervalDays: number
    priorityWeight: number
    status: 'due' | 'completed' | 'snoozed' | 'skipped'
  }): Promise<void> {
    const { error } = await this.supabase
      .from('academy_review_queue')
      .update({
        due_at: input.dueAt,
        interval_days: input.intervalDays,
        priority_weight: input.priorityWeight,
        status: input.status,
      })
      .eq('id', input.queueId)
      .eq('user_id', input.userId)

    if (error) {
      throw new Error(`Failed to update review queue item: ${error.message}`)
    }
  }

  async insertReviewAttempt(input: {
    queueId: string
    userId: string
    answerJson: Record<string, unknown>
    isCorrect: boolean
    confidenceRating?: number
    latencyMs?: number
  }): Promise<void> {
    const { error } = await this.supabase.from('academy_review_attempts').insert({
      queue_id: input.queueId,
      user_id: input.userId,
      answer_json: input.answerJson,
      is_correct: input.isCorrect,
      confidence_rating: input.confidenceRating,
      latency_ms: input.latencyMs,
    })

    if (error) {
      throw new Error(`Failed to insert review attempt: ${error.message}`)
    }
  }
}
