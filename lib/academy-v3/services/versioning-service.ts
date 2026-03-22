import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyLessonVersion } from '@/lib/academy-v3/contracts/domain'
import { SupabaseAcademyLessonRepository } from '@/lib/academy-v3/repositories/lesson-repository'
import { SupabaseAcademyLessonVersionRepository } from '@/lib/academy-v3/repositories/lesson-version-repository'

import { AcademyLessonNotFoundError, AcademyLessonVersionNotFoundError } from './errors'

export class AcademyVersioningService {
  private readonly lessons: SupabaseAcademyLessonRepository
  private readonly versions: SupabaseAcademyLessonVersionRepository
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
    this.versions = new SupabaseAcademyLessonVersionRepository(supabase)
  }

  async createSnapshot(
    lessonId: string,
    publishedBy?: string,
    changeSummary?: string
  ): Promise<AcademyLessonVersion> {
    const lesson = await this.lessons.getLessonById(lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const blocks = await this.lessons.listBlocksForLesson(lessonId)

    const contentSnapshot: Record<string, unknown> = {
      lesson: {
        title: lesson.title,
        slug: lesson.slug,
        learningObjective: lesson.learningObjective,
        difficulty: lesson.difficulty,
        estimatedMinutes: lesson.estimatedMinutes,
        prerequisiteLessonIds: lesson.prerequisiteLessonIds,
      },
      blocks: blocks.map((block) => ({
        id: block.id,
        blockType: block.blockType,
        position: block.position,
        title: block.title,
        contentJson: block.contentJson,
      })),
    }

    const latestVersion = await this.versions.getLatestVersionNumber(lessonId)
    const nextVersion = latestVersion + 1

    return this.versions.createVersion({
      lessonId,
      versionNumber: nextVersion,
      contentSnapshot,
      changeSummary,
      publishedBy,
    })
  }

  async listVersionHistory(lessonId: string): Promise<AcademyLessonVersion[]> {
    const lesson = await this.lessons.getLessonById(lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    return this.versions.listVersionsForLesson(lessonId)
  }

  async rollbackToVersion(
    lessonId: string,
    versionId: string
  ): Promise<{ restoredVersionNumber: number }> {
    const lesson = await this.lessons.getLessonById(lessonId)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const version = await this.versions.getVersion(lessonId, versionId)
    if (!version) {
      throw new AcademyLessonVersionNotFoundError()
    }

    const snapshot = version.contentSnapshot
    const lessonData = snapshot.lesson as Record<string, unknown> | undefined
    const blocksData = snapshot.blocks as Array<Record<string, unknown>> | undefined

    if (!lessonData) {
      throw new Error('Version snapshot is missing lesson data')
    }

    // Restore lesson metadata
    const { error: lessonError } = await this.supabase
      .from('academy_lessons')
      .update({
        title: lessonData.title,
        slug: lessonData.slug,
        learning_objective: lessonData.learningObjective,
        difficulty: lessonData.difficulty,
        estimated_minutes: lessonData.estimatedMinutes,
        prerequisite_lesson_ids: lessonData.prerequisiteLessonIds,
        status: 'draft', // rollback always resets to draft
      })
      .eq('id', lessonId)

    if (lessonError) {
      throw new Error(`Failed to restore lesson: ${lessonError.message}`)
    }

    // Restore blocks: delete existing and re-insert from snapshot
    if (blocksData && blocksData.length > 0) {
      const { error: deleteError } = await this.supabase
        .from('academy_lesson_blocks')
        .delete()
        .eq('lesson_id', lessonId)

      if (deleteError) {
        throw new Error(`Failed to clear lesson blocks: ${deleteError.message}`)
      }

      const blockInserts = blocksData.map((block) => ({
        lesson_id: lessonId,
        block_type: block.blockType,
        position: block.position,
        title: block.title ?? null,
        content_json: block.contentJson ?? {},
      }))

      const { error: insertError } = await this.supabase
        .from('academy_lesson_blocks')
        .insert(blockInserts)

      if (insertError) {
        throw new Error(`Failed to restore lesson blocks: ${insertError.message}`)
      }
    }

    return { restoredVersionNumber: version.versionNumber }
  }
}
