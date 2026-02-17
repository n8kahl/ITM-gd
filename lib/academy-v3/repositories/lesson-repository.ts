import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapAcademyLessonBlockRow,
  mapAcademyLessonRow,
} from '@/lib/academy-v3/mappers/academy-row-mappers'

import type { AcademyLessonRecommendation, AcademyLessonRepository } from './types'
import type { AcademyLesson, AcademyLessonBlock } from '@/lib/academy-v3/contracts/domain'

export class SupabaseAcademyLessonRepository implements AcademyLessonRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getPublishedLessonById(lessonId: string): Promise<AcademyLesson | null> {
    const { data, error } = await this.supabase
      .from('academy_lessons')
      .select('id, module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata')
      .eq('id', lessonId)
      .eq('is_published', true)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch academy lesson by id: ${error.message}`)
    }

    return data ? mapAcademyLessonRow(data) : null
  }

  async listPublishedLessonsForModule(moduleId: string): Promise<AcademyLesson[]> {
    const { data, error } = await this.supabase
      .from('academy_lessons')
      .select('id, module_id, slug, title, learning_objective, estimated_minutes, difficulty, prerequisite_lesson_ids, position, is_published, metadata')
      .eq('module_id', moduleId)
      .eq('is_published', true)
      .order('position', { ascending: true })

    if (error) {
      throw new Error(`Failed to list academy lessons: ${error.message}`)
    }

    return (data ?? []).map((row) => mapAcademyLessonRow(row))
  }

  async listBlocksForLesson(lessonId: string): Promise<AcademyLessonBlock[]> {
    const { data, error } = await this.supabase
      .from('academy_lesson_blocks')
      .select('id, lesson_id, block_type, position, title, content_json')
      .eq('lesson_id', lessonId)
      .order('position', { ascending: true })

    if (error) {
      throw new Error(`Failed to list academy lesson blocks: ${error.message}`)
    }

    return (data ?? []).map((row) => mapAcademyLessonBlockRow(row))
  }

  async listRecommendedLessonsForCompetencies(
    competencyIds: string[],
    limit: number
  ): Promise<AcademyLessonRecommendation[]> {
    if (competencyIds.length === 0) {
      return []
    }

    const { data, error } = await this.supabase
      .from('academy_lesson_competencies')
      .select(`
        competency_id,
        academy_lessons!inner(
          id,
          title,
          is_published,
          academy_modules!inner(
            slug,
            title,
            is_published
          )
        )
      `)
      .in('competency_id', competencyIds)
      .limit(Math.max(1, Math.min(limit, 20)))

    if (error) {
      throw new Error(`Failed to list recommended lessons: ${error.message}`)
    }

    const recommendations: AcademyLessonRecommendation[] = []
    const seenLessonIds = new Set<string>()

    for (const row of data || []) {
      const competencyId = String(row.competency_id)
      const lessonRelation = Array.isArray(row.academy_lessons)
        ? row.academy_lessons[0]
        : row.academy_lessons

      if (!lessonRelation || typeof lessonRelation !== 'object') {
        continue
      }

      const lesson = lessonRelation as Record<string, unknown>
      if (lesson.is_published !== true) {
        continue
      }

      const moduleRelation = Array.isArray(lesson.academy_modules)
        ? lesson.academy_modules[0]
        : lesson.academy_modules

      if (!moduleRelation || typeof moduleRelation !== 'object') {
        continue
      }

      const moduleRecord = moduleRelation as Record<string, unknown>
      if (moduleRecord.is_published !== true) {
        continue
      }

      const lessonId = String(lesson.id)
      if (seenLessonIds.has(lessonId)) {
        continue
      }
      seenLessonIds.add(lessonId)

      recommendations.push({
        lessonId,
        lessonTitle: String(lesson.title || 'Lesson'),
        moduleSlug: String(moduleRecord.slug || ''),
        moduleTitle: String(moduleRecord.title || 'Module'),
        competencyId,
      })
    }

    return recommendations
  }
}
