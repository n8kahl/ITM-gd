import type { SupabaseClient } from '@supabase/supabase-js'

import { submitAssessmentResponseSchema } from '@/lib/academy-v3/contracts/api'
import {
  SupabaseAcademyAssessmentRepository,
  SupabaseAcademyLearningEventRepository,
  SupabaseAcademyMasteryRepository,
  SupabaseAcademyReviewRepository,
} from '@/lib/academy-v3/repositories'

import { AcademyAssessmentNotFoundError } from './errors'
import { scoreAssessment } from './assessment-scoring'
import { safeInsertLearningEvent } from './event-utils'

function toPercent(value: number): number {
  return Number((Math.max(0, Math.min(1, value)) * 100).toFixed(2))
}

export class AcademyAssessmentService {
  private readonly assessments
  private readonly mastery
  private readonly review
  private readonly events

  constructor(supabase: SupabaseClient) {
    this.assessments = new SupabaseAcademyAssessmentRepository(supabase)
    this.mastery = new SupabaseAcademyMasteryRepository(supabase)
    this.review = new SupabaseAcademyReviewRepository(supabase)
    this.events = new SupabaseAcademyLearningEventRepository(supabase)
  }

  async submitAssessment(input: {
    userId: string
    assessmentId: string
    answers: Record<string, unknown>
  }) {
    const assessment = await this.assessments.getPublishedAssessmentById(input.assessmentId)
    if (!assessment) {
      throw new AcademyAssessmentNotFoundError()
    }

    const items = await this.assessments.listAssessmentItems(assessment.id)
    const scoring = scoreAssessment(items, input.answers)

    const competencyThreshold = assessment.masteryThreshold
    const competencyIds = Object.keys(scoring.competencyScores)
    const remediationCompetencyIds = competencyIds.filter(
      (competencyId) => scoring.competencyScores[competencyId] < competencyThreshold
    )

    const passedByCompetency = remediationCompetencyIds.length === 0
    const passedByOverall = scoring.overallScore >= competencyThreshold
    const passed = passedByOverall && passedByCompetency

    const attempt = await this.assessments.insertAssessmentAttempt({
      userId: input.userId,
      assessmentId: assessment.id,
      status: passed ? 'passed' : 'failed',
      score: scoring.overallScore,
      competencyScoresJson: scoring.competencyScores,
      answersJson: input.answers,
      feedbackJson: {
        itemScores: scoring.itemScores,
        passedByOverall,
        passedByCompetency,
        threshold: competencyThreshold,
      },
    })

    const masteryRecords = await this.mastery.listMasteryForUser(input.userId)
    const masteryByCompetencyId = new Map(masteryRecords.map((record) => [record.competencyId, record]))

    await Promise.all(
      competencyIds.map(async (competencyId) => {
        const existing = masteryByCompetencyId.get(competencyId)
        const competencyScorePercent = toPercent(scoring.competencyScores[competencyId])

        const currentScore = existing
          ? Number((existing.currentScore * 0.7 + competencyScorePercent * 0.3).toFixed(2))
          : competencyScorePercent

        const confidence = existing
          ? Number((Math.min(1, existing.confidence * 0.8 + 0.2)).toFixed(4))
          : 0.5

        await this.mastery.upsertMastery({
          userId: input.userId,
          competencyId,
          currentScore,
          confidence,
          needsRemediation: remediationCompetencyIds.includes(competencyId),
          metadata: {
            latestAssessmentId: assessment.id,
            latestAttemptId: attempt.id,
          },
        })
      })
    )

    const nowIso = new Date().toISOString()

    const remediationItems = items.filter(
      (item) => item.competencyId && remediationCompetencyIds.includes(item.competencyId)
    )

    await Promise.all(
      remediationItems.map(async (item) => {
        if (!item.competencyId) return

        await this.review.insertQueueItem({
          userId: input.userId,
          competencyId: item.competencyId,
          sourceAssessmentItemId: item.id,
          promptJson: {
            prompt: item.prompt,
            answerKey: item.answerKeyJson,
            itemType: item.itemType,
            source: 'assessment_remediation',
          },
          dueAt: nowIso,
          intervalDays: 1,
          priorityWeight: 1.5,
          status: 'due',
        })
      })
    )

    await safeInsertLearningEvent(this.events, {
      userId: input.userId,
      eventType: 'assessment_submitted',
      assessmentId: assessment.id,
      moduleId: assessment.moduleId,
      lessonId: assessment.lessonId,
      payload: {
        attemptId: attempt.id,
        score: scoring.overallScore,
      },
    })

    await safeInsertLearningEvent(this.events, {
      userId: input.userId,
      eventType: passed ? 'assessment_passed' : 'assessment_failed',
      assessmentId: assessment.id,
      moduleId: assessment.moduleId,
      lessonId: assessment.lessonId,
      payload: {
        attemptId: attempt.id,
        score: scoring.overallScore,
      },
    })

    if (remediationCompetencyIds.length > 0) {
      await safeInsertLearningEvent(this.events, {
        userId: input.userId,
        eventType: 'remediation_assigned',
        assessmentId: assessment.id,
        moduleId: assessment.moduleId,
        lessonId: assessment.lessonId,
        payload: {
          remediationCompetencyIds,
        },
      })
    }

    return submitAssessmentResponseSchema.parse({
      data: {
        attemptId: attempt.id,
        score: scoring.overallScore,
        passed,
        remediationCompetencyIds,
      },
    }).data
  }
}
