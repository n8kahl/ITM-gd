import { describe, expect, it } from 'vitest'

import { scoreAssessment } from '@/lib/academy-v3/services/assessment-scoring'
import type { AcademyAssessmentItem } from '@/lib/academy-v3/repositories'

const baseItem = {
  assessmentId: 'assessment-1',
  prompt: 'Prompt',
} satisfies Partial<AcademyAssessmentItem>

describe('academy-v3 assessment scoring', () => {
  it('scores mixed item types and competency aggregates', () => {
    const items: AcademyAssessmentItem[] = [
      {
        ...baseItem,
        id: 'q1',
        competencyId: 'comp-a',
        itemType: 'single_select',
        answerKeyJson: { correctOptionId: 'A' },
      } as AcademyAssessmentItem,
      {
        ...baseItem,
        id: 'q2',
        competencyId: 'comp-a',
        itemType: 'ordered_steps',
        answerKeyJson: { steps: ['one', 'two', 'three'] },
      } as AcademyAssessmentItem,
      {
        ...baseItem,
        id: 'q3',
        competencyId: 'comp-b',
        itemType: 'short_answer_rubric',
        answerKeyJson: { keywords: ['risk', 'invalidation'] },
      } as AcademyAssessmentItem,
    ]

    const result = scoreAssessment(items, {
      q1: 'A',
      q2: ['one', 'three', 'two'],
      q3: 'Risk first, then invalidation level',
    })

    expect(result.itemScores).toHaveLength(3)
    expect(result.competencyScores['comp-a']).toBeCloseTo(0.8333, 3)
    expect(result.competencyScores['comp-b']).toBe(1)
    expect(result.overallScore).toBeCloseTo(0.8889, 3)
  })

  it('requires exact set matching for multi select', () => {
    const items: AcademyAssessmentItem[] = [
      {
        ...baseItem,
        id: 'q4',
        competencyId: null,
        itemType: 'multi_select',
        answerKeyJson: { correctOptionIds: ['A', 'C'] },
      } as AcademyAssessmentItem,
    ]

    const pass = scoreAssessment(items, { q4: ['C', 'A'] })
    const fail = scoreAssessment(items, { q4: ['A'] })

    expect(pass.overallScore).toBe(1)
    expect(fail.overallScore).toBe(0)
  })
})
