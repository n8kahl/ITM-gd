import type { SupabaseClient } from '@supabase/supabase-js'

import { completeBlockResponseSchema, startLessonResponseSchema } from '@/lib/academy-v3/contracts/api'
import {
  SupabaseAcademyLearningEventRepository,
  SupabaseAcademyLessonRepository,
  SupabaseAcademyProgressRepository,
} from '@/lib/academy-v3/repositories'

import { AcademyBlockNotFoundError, AcademyLessonNotFoundError } from './errors'
import {
  computeProgressPercent,
  getCompletedBlockIds,
  getNextIncompleteBlockId,
} from './progression-logic'
import { safeInsertLearningEvent } from './event-utils'

export class AcademyProgressionService {
  private readonly lessons
  private readonly progress
  private readonly events

  constructor(supabase: SupabaseClient) {
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
    this.progress = new SupabaseAcademyProgressRepository(supabase)
    this.events = new SupabaseAcademyLearningEventRepository(supabase)
  }

  async startLesson(input: { userId: string; lessonId: string; source: 'plan' | 'module' | 'recommendation' }) {
    const lesson = await this.lessons.getPublishedLessonById(input.lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const existingAttempt = await this.progress.getLessonAttempt(input.userId, lesson.id)
    const existingMetadata = existingAttempt?.metadata || {}

    const attempt = await this.progress.upsertLessonAttempt({
      userId: input.userId,
      lessonId: lesson.id,
      status: 'in_progress',
      progressPercent: existingAttempt?.progressPercent || 0,
      metadata: {
        ...existingMetadata,
        source: input.source,
      },
    })

    await safeInsertLearningEvent(this.events, {
      userId: input.userId,
      eventType: 'lesson_started',
      lessonId: lesson.id,
      moduleId: lesson.moduleId,
      payload: { source: input.source },
    })

    return startLessonResponseSchema.parse({
      data: {
        lessonAttemptId: attempt.id,
        status: 'in_progress',
      },
    }).data
  }

  async completeBlock(input: {
    userId: string
    lessonId: string
    blockId: string
    payload?: Record<string, unknown>
  }) {
    const lesson = await this.lessons.getPublishedLessonById(input.lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const blocks = await this.lessons.listBlocksForLesson(lesson.id)
    const blockIds = blocks.map((block) => block.id)
    if (!blockIds.includes(input.blockId)) {
      throw new AcademyBlockNotFoundError()
    }

    const existingAttempt = await this.progress.getLessonAttempt(input.userId, lesson.id)

    const existingMetadata = existingAttempt?.metadata || {}
    const completedBlockIds = new Set(getCompletedBlockIds(existingMetadata))
    completedBlockIds.add(input.blockId)

    const payloadByBlock =
      typeof existingMetadata.blockPayloadByBlock === 'object' && existingMetadata.blockPayloadByBlock !== null
        ? { ...(existingMetadata.blockPayloadByBlock as Record<string, unknown>) }
        : {}

    if (input.payload) {
      payloadByBlock[input.blockId] = input.payload
    }

    const nextCompletedBlockIds = Array.from(completedBlockIds)
    const progressPercent = computeProgressPercent(nextCompletedBlockIds.length, blocks.length)
    const nextBlockId = getNextIncompleteBlockId(blockIds, nextCompletedBlockIds)
    const status: 'in_progress' | 'passed' = progressPercent >= 100 ? 'passed' : 'in_progress'

    await this.progress.upsertLessonAttempt({
      userId: input.userId,
      lessonId: lesson.id,
      status,
      progressPercent,
      metadata: {
        ...existingMetadata,
        completedBlockIds: nextCompletedBlockIds,
        blockPayloadByBlock: payloadByBlock,
      },
    })

    await safeInsertLearningEvent(this.events, {
      userId: input.userId,
      eventType: 'block_completed',
      lessonId: lesson.id,
      moduleId: lesson.moduleId,
      payload: {
        blockId: input.blockId,
        progressPercent,
      },
    })

    return completeBlockResponseSchema.parse({
      data: {
        progressPercent,
        nextBlockId,
        status,
      },
    }).data
  }
}
