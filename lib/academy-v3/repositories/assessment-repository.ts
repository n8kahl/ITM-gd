import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AcademyAssessment,
  AcademyAssessmentItem,
  AcademyAssessmentRepository,
} from './types'

function mapAssessment(row: Record<string, unknown>): AcademyAssessment {
  return {
    id: String(row.id),
    moduleId: row.module_id ? String(row.module_id) : null,
    lessonId: row.lesson_id ? String(row.lesson_id) : null,
    title: String(row.title || ''),
    assessmentType: (row.assessment_type as AcademyAssessment['assessmentType']) || 'formative',
    masteryThreshold: typeof row.mastery_threshold === 'number' ? row.mastery_threshold : 0.75,
    isPublished: row.is_published === true,
  }
}

function mapAssessmentItem(row: Record<string, unknown>): AcademyAssessmentItem {
  return {
    id: String(row.id),
    assessmentId: String(row.assessment_id),
    competencyId: row.competency_id ? String(row.competency_id) : null,
    itemType: (row.item_type as AcademyAssessmentItem['itemType']) || 'single_select',
    prompt: String(row.prompt || ''),
    answerKeyJson:
      typeof row.answer_key_json === 'object' && row.answer_key_json !== null
        ? (row.answer_key_json as Record<string, unknown>)
        : {},
  }
}

export class SupabaseAcademyAssessmentRepository implements AcademyAssessmentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getPublishedAssessmentById(assessmentId: string): Promise<AcademyAssessment | null> {
    const { data, error } = await this.supabase
      .from('academy_assessments')
      .select('id, module_id, lesson_id, title, assessment_type, mastery_threshold, is_published')
      .eq('id', assessmentId)
      .eq('is_published', true)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch assessment: ${error.message}`)
    }

    return data ? mapAssessment(data) : null
  }

  async listAssessmentItems(assessmentId: string): Promise<AcademyAssessmentItem[]> {
    const { data, error } = await this.supabase
      .from('academy_assessment_items')
      .select('id, assessment_id, competency_id, item_type, prompt, answer_key_json')
      .eq('assessment_id', assessmentId)
      .order('position', { ascending: true })

    if (error) {
      throw new Error(`Failed to list assessment items: ${error.message}`)
    }

    return (data || []).map((row) => mapAssessmentItem(row))
  }

  async insertAssessmentAttempt(input: {
    userId: string
    assessmentId: string
    status: 'submitted' | 'passed' | 'failed'
    score: number
    competencyScoresJson: Record<string, unknown>
    answersJson: Record<string, unknown>
    feedbackJson: Record<string, unknown>
  }): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('academy_user_assessment_attempts')
      .insert({
        user_id: input.userId,
        assessment_id: input.assessmentId,
        status: input.status,
        score: input.score,
        competency_scores_json: input.competencyScoresJson,
        answers_json: input.answersJson,
        feedback_json: input.feedbackJson,
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Failed to insert assessment attempt: ${error?.message || 'unknown error'}`)
    }

    return { id: String(data.id) }
  }
}
