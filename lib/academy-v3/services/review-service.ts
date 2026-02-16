import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getReviewQueueResponseSchema,
  submitReviewResponseSchema,
} from '@/lib/academy-v3/contracts/api'
import {
  SupabaseAcademyLearningEventRepository,
  SupabaseAcademyReviewRepository,
  type AcademyAssessmentItem,
} from '@/lib/academy-v3/repositories'

import { scoreAssessmentItem } from './assessment-scoring'
import { AcademyReviewQueueItemNotFoundError } from './errors'
import { safeInsertLearningEvent } from './event-utils'

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }

  return { value }
}

function getEvaluationInput(promptJson: Record<string, unknown>): {
  itemType: AcademyAssessmentItem['itemType']
  answerKeyJson: Record<string, unknown>
} {
  const itemType =
    promptJson.itemType === 'multi_select' ||
    promptJson.itemType === 'ordered_steps' ||
    promptJson.itemType === 'short_answer_rubric' ||
    promptJson.itemType === 'scenario_branch'
      ? promptJson.itemType
      : 'single_select'

  const answerKeyJson =
    typeof promptJson.answerKey === 'object' && promptJson.answerKey !== null
      ? (promptJson.answerKey as Record<string, unknown>)
      : {}

  return {
    itemType,
    answerKeyJson,
  }
}

export class AcademyReviewService {
  private readonly review
  private readonly events

  constructor(supabase: SupabaseClient) {
    this.review = new SupabaseAcademyReviewRepository(supabase)
    this.events = new SupabaseAcademyLearningEventRepository(supabase)
  }

  async getDueQueue(input: { userId: string; limit: number }) {
    const safeLimit = Math.max(1, Math.min(input.limit, 50))
    const items = await this.review.listDueQueueItemsForUser(input.userId, safeLimit)

    return getReviewQueueResponseSchema.parse({
      data: {
        dueCount: items.length,
        items: items.map((item) => ({
          queueId: item.queueId,
          competencyId: item.competencyId,
          prompt: item.promptJson,
          dueAt: item.dueAt,
          intervalDays: item.intervalDays,
          priorityWeight: item.priorityWeight,
        })),
      },
    }).data
  }

  async submitReview(input: {
    userId: string
    queueId: string
    answer: unknown
    confidenceRating?: number
    latencyMs?: number
  }) {
    const queueItem = await this.review.getQueueItemForUser(input.queueId, input.userId)
    if (!queueItem) {
      throw new AcademyReviewQueueItemNotFoundError()
    }

    const evalInput = getEvaluationInput(queueItem.promptJson)

    const scored = scoreAssessmentItem(
      {
        id: queueItem.queueId,
        assessmentId: 'review',
        competencyId: queueItem.competencyId,
        itemType: evalInput.itemType,
        prompt: String(queueItem.promptJson.prompt || ''),
        answerKeyJson: evalInput.answerKeyJson,
      },
      input.answer
    )

    const isCorrect = evalInput.itemType === 'short_answer_rubric' ? scored.score >= 0.7 : scored.isCorrect

    const nextIntervalDays = isCorrect
      ? Math.min(30, Math.max(1, queueItem.intervalDays * 2))
      : 1

    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + nextIntervalDays)

    const nextPriorityWeight = isCorrect
      ? Number(Math.max(0.5, queueItem.priorityWeight * 0.9).toFixed(2))
      : Number((queueItem.priorityWeight + 0.5).toFixed(2))

    await this.review.insertReviewAttempt({
      queueId: queueItem.queueId,
      userId: input.userId,
      answerJson: toRecord(input.answer),
      isCorrect,
      confidenceRating: input.confidenceRating,
      latencyMs: input.latencyMs,
    })

    await this.review.updateQueueItem({
      queueId: queueItem.queueId,
      userId: input.userId,
      dueAt: nextDueDate.toISOString(),
      intervalDays: nextIntervalDays,
      priorityWeight: nextPriorityWeight,
      status: 'due',
    })

    await safeInsertLearningEvent(this.events, {
      userId: input.userId,
      eventType: 'review_completed',
      payload: {
        queueId: queueItem.queueId,
        competencyId: queueItem.competencyId,
        isCorrect,
      },
    })

    return submitReviewResponseSchema.parse({
      data: {
        queueId: queueItem.queueId,
        isCorrect,
        nextDueAt: nextDueDate.toISOString(),
        intervalDays: nextIntervalDays,
      },
    }).data
  }
}
