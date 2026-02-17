import { z } from 'zod'
import {
  academyLessonBlockSchema,
  academyLessonSchema,
  academyModuleSchema,
  academyPlanSchema,
} from './domain'

export const academyErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
})

export const getAcademyPlanResponseSchema = z.object({
  data: academyPlanSchema,
})

export const getAcademyModuleParamsSchema = z.object({
  slug: z.string().min(1),
})

export const getAcademyModuleResponseSchema = z.object({
  data: academyModuleSchema.extend({
    lessons: z.array(academyLessonSchema),
  }),
})

export const getAcademyLessonParamsSchema = z.object({
  id: z.string().uuid(),
})

export const getAcademyAssessmentParamsSchema = z.object({
  id: z.string().uuid(),
})

export const getReviewQueueParamsSchema = z.object({
  queueId: z.string().uuid(),
})

export const getAcademyLessonResponseSchema = z.object({
  data: academyLessonSchema.extend({
    blocks: z.array(academyLessonBlockSchema),
  }),
})

export const startLessonRequestSchema = z.object({
  source: z.enum(['plan', 'module', 'recommendation']).default('plan'),
})

export const startLessonResponseSchema = z.object({
  data: z.object({
    lessonAttemptId: z.string().uuid(),
    status: z.enum(['in_progress']),
  }),
})

export const completeBlockRequestSchema = z.object({
  blockId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const completeBlockResponseSchema = z.object({
  data: z.object({
    progressPercent: z.number().min(0).max(100),
    nextBlockId: z.string().uuid().nullable(),
    status: z.enum(['in_progress', 'passed']),
  }),
})

export const submitAssessmentRequestSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
})

export const submitAssessmentResponseSchema = z.object({
  data: z.object({
    attemptId: z.string().uuid(),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
    remediationCompetencyIds: z.array(z.string().uuid()),
  }),
})

export const reviewQueueItemSchema = z.object({
  queueId: z.string().uuid(),
  competencyId: z.string().uuid(),
  prompt: z.record(z.string(), z.unknown()),
  dueAt: z.string(),
  intervalDays: z.number().int().positive(),
  priorityWeight: z.number().positive(),
})

export const getReviewQueueResponseSchema = z.object({
  data: z.object({
    dueCount: z.number().int().nonnegative(),
    items: z.array(reviewQueueItemSchema),
  }),
})

export const submitReviewRequestSchema = z.object({
  answer: z.unknown(),
  confidenceRating: z.number().int().min(1).max(5).optional(),
  latencyMs: z.number().int().nonnegative().optional(),
})

export const submitReviewResponseSchema = z.object({
  data: z.object({
    queueId: z.string().uuid(),
    isCorrect: z.boolean(),
    nextDueAt: z.string(),
    intervalDays: z.number().int().positive(),
  }),
})

export const masteryItemSchema = z.object({
  competencyId: z.string().uuid(),
  competencyKey: z.string().min(1),
  competencyTitle: z.string().min(1),
  currentScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  needsRemediation: z.boolean(),
  lastEvaluatedAt: z.string().nullable(),
})

export const getMasteryResponseSchema = z.object({
  data: z.object({
    items: z.array(masteryItemSchema),
  }),
})

export const recommendationItemSchema = z.object({
  type: z.enum(['review', 'lesson']),
  title: z.string().min(1),
  reason: z.string().min(1),
  actionLabel: z.string().min(1),
  actionTarget: z.string().min(1),
})

export const getRecommendationsResponseSchema = z.object({
  data: z.object({
    items: z.array(recommendationItemSchema),
  }),
})

export const academyResumeTargetSchema = z.object({
  lessonId: z.string().uuid(),
  lessonTitle: z.string().min(1),
  lessonNumber: z.number().int().positive(),
  totalLessons: z.number().int().positive(),
  completedLessons: z.number().int().nonnegative(),
  courseProgressPercent: z.number().min(0).max(100),
  courseId: z.string().uuid(),
  courseSlug: z.string().min(1),
  courseTitle: z.string().min(1),
  resumeUrl: z.string().min(1),
  courseUrl: z.string().min(1),
  source: z.enum(['in_progress', 'next_unlocked']),
  source_reason: z.enum(['last_in_progress', 'next_unlocked', 'first_lesson']),
})

export const getAcademyResumeResponseSchema = z.object({
  data: academyResumeTargetSchema.nullable(),
})

export const lessonAttemptStateSchema = z.object({
  lessonId: z.string().uuid(),
  status: z.enum(['not_started', 'in_progress', 'submitted', 'passed', 'failed']),
  progressPercent: z.number().min(0).max(100),
  completedBlockIds: z.array(z.string().uuid()),
})

export const getAcademyModuleProgressResponseSchema = z.object({
  data: z.object({
    moduleId: z.string().uuid(),
    moduleSlug: z.string().min(1),
    lessons: z.array(lessonAttemptStateSchema),
  }),
})

export const getAcademyLessonAttemptResponseSchema = z.object({
  data: lessonAttemptStateSchema,
})

export const moduleProgressSummaryItemSchema = z.object({
  moduleId: z.string().uuid(),
  moduleSlug: z.string().min(1),
  moduleTitle: z.string().min(1),
  trackId: z.string().uuid(),
  totalLessons: z.number().int().nonnegative(),
  completedLessons: z.number().int().nonnegative(),
  inProgressLessons: z.number().int().nonnegative(),
  progressPercent: z.number().min(0).max(100),
})

export const trackProgressSummaryItemSchema = z.object({
  trackId: z.string().uuid(),
  trackTitle: z.string().min(1),
  totalLessons: z.number().int().nonnegative(),
  completedLessons: z.number().int().nonnegative(),
  inProgressLessons: z.number().int().nonnegative(),
  progressPercent: z.number().min(0).max(100),
})

export const getAcademyProgressSummaryResponseSchema = z.object({
  data: z.object({
    totalLessons: z.number().int().nonnegative(),
    completedLessons: z.number().int().nonnegative(),
    inProgressLessons: z.number().int().nonnegative(),
    progressPercent: z.number().min(0).max(100),
    tracks: z.array(trackProgressSummaryItemSchema),
    modules: z.array(moduleProgressSummaryItemSchema),
  }),
})

export type ApiErrorResponse = z.infer<typeof academyErrorResponseSchema>
export type GetAcademyPlanResponse = z.infer<typeof getAcademyPlanResponseSchema>
export type GetAcademyModuleParams = z.infer<typeof getAcademyModuleParamsSchema>
export type GetAcademyModuleResponse = z.infer<typeof getAcademyModuleResponseSchema>
export type GetAcademyLessonParams = z.infer<typeof getAcademyLessonParamsSchema>
export type GetAcademyAssessmentParams = z.infer<typeof getAcademyAssessmentParamsSchema>
export type GetAcademyLessonResponse = z.infer<typeof getAcademyLessonResponseSchema>
export type GetReviewQueueParams = z.infer<typeof getReviewQueueParamsSchema>
export type StartLessonRequest = z.infer<typeof startLessonRequestSchema>
export type StartLessonResponse = z.infer<typeof startLessonResponseSchema>
export type CompleteBlockRequest = z.infer<typeof completeBlockRequestSchema>
export type CompleteBlockResponse = z.infer<typeof completeBlockResponseSchema>
export type SubmitAssessmentRequest = z.infer<typeof submitAssessmentRequestSchema>
export type SubmitAssessmentResponse = z.infer<typeof submitAssessmentResponseSchema>
export type GetReviewQueueResponse = z.infer<typeof getReviewQueueResponseSchema>
export type SubmitReviewRequest = z.infer<typeof submitReviewRequestSchema>
export type SubmitReviewResponse = z.infer<typeof submitReviewResponseSchema>
export type GetMasteryResponse = z.infer<typeof getMasteryResponseSchema>
export type GetRecommendationsResponse = z.infer<typeof getRecommendationsResponseSchema>
export type AcademyResumeTarget = z.infer<typeof academyResumeTargetSchema>
export type GetAcademyResumeResponse = z.infer<typeof getAcademyResumeResponseSchema>
export type LessonAttemptState = z.infer<typeof lessonAttemptStateSchema>
export type GetAcademyModuleProgressResponse = z.infer<typeof getAcademyModuleProgressResponseSchema>
export type GetAcademyLessonAttemptResponse = z.infer<typeof getAcademyLessonAttemptResponseSchema>
export type ModuleProgressSummaryItem = z.infer<typeof moduleProgressSummaryItemSchema>
export type TrackProgressSummaryItem = z.infer<typeof trackProgressSummaryItemSchema>
export type GetAcademyProgressSummaryResponse = z.infer<typeof getAcademyProgressSummaryResponseSchema>
