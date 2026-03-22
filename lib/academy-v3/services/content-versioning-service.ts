import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyLessonVersion } from '@/lib/academy-v3/contracts/domain'
import { mapAcademyLessonVersionRow } from '@/lib/academy-v3/mappers/academy-row-mappers'

import { AcademyLessonNotFoundError } from './errors'

export class ContentVersioningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentVersioningError'
  }
}

export class ContentVersioningService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Create a version snapshot of a lesson's current state.
   * Captures the lesson row + all blocks as an immutable record.
   */
  async createSnapshot(
    lessonId: string,
    userId: string,
    changeSummary?: string
  ): Promise<AcademyLessonVersion> {
    const { data: lesson, error: lessonError } = await this.supabase
      .from('academy_lessons')
      .select('*')
      .eq('id', lessonId)
      .maybeSingle()

    if (lessonError || !lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const { data: blocks, error: blocksError } = await this.supabase
      .from('academy_lesson_blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('position', { ascending: true })

    if (blocksError) {
      throw new ContentVersioningError(`Failed to fetch lesson blocks: ${blocksError.message}`)
    }

    const nextVersion = await this.getNextVersionNumber(lessonId)

    const contentSnapshot = {
      lesson: {
        title: lesson.title,
        slug: lesson.slug,
        learning_objective: lesson.learning_objective,
        estimated_minutes: lesson.estimated_minutes,
        difficulty: lesson.difficulty,
        position: lesson.position,
        metadata: lesson.metadata,
      },
      blocks: (blocks ?? []).map((block: Record<string, unknown>) => ({
        block_type: block.block_type,
        position: block.position,
        title: block.title,
        content_json: block.content_json,
      })),
    }

    const { data: version, error: insertError } = await this.supabase
      .from('academy_lesson_versions')
      .insert({
        lesson_id: lessonId,
        version_number: nextVersion,
        content_snapshot: contentSnapshot,
        change_summary: changeSummary ?? null,
        published_by: userId,
      })
      .select('*')
      .single()

    if (insertError || !version) {
      throw new ContentVersioningError(`Failed to create version: ${insertError?.message ?? 'unknown'}`)
    }

    return mapAcademyLessonVersionRow(version)
  }

  /**
   * List all versions for a lesson, newest first.
   */
  async listVersions(lessonId: string): Promise<AcademyLessonVersion[]> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('version_number', { ascending: false })

    if (error) {
      throw new ContentVersioningError(`Failed to list versions: ${error.message}`)
    }

    return (data ?? []).map((row: Record<string, unknown>) => mapAcademyLessonVersionRow(row))
  }

  /**
   * Get a specific version by lesson ID and version number.
   */
  async getVersion(lessonId: string, versionNumber: number): Promise<AcademyLessonVersion> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('version_number', versionNumber)
      .maybeSingle()

    if (error) {
      throw new ContentVersioningError(`Failed to fetch version: ${error.message}`)
    }

    if (!data) {
      throw new ContentVersioningError(
        `Version ${versionNumber} not found for lesson ${lessonId}`
      )
    }

    return mapAcademyLessonVersionRow(data)
  }

  /**
   * Rollback a lesson to a previous version.
   * Restores the lesson fields and replaces all blocks.
   */
  async rollbackToVersion(
    lessonId: string,
    versionNumber: number,
    userId: string
  ): Promise<AcademyLessonVersion> {
    const version = await this.getVersion(lessonId, versionNumber)
    const snapshot = version.contentSnapshot as {
      lesson: Record<string, unknown>
      blocks: Array<Record<string, unknown>>
    }

    if (!snapshot.lesson || !Array.isArray(snapshot.blocks)) {
      throw new ContentVersioningError('Invalid version snapshot structure')
    }

    // Update the lesson row with snapshot data
    const { error: updateError } = await this.supabase
      .from('academy_lessons')
      .update({
        title: snapshot.lesson.title,
        slug: snapshot.lesson.slug,
        learning_objective: snapshot.lesson.learning_objective,
        estimated_minutes: snapshot.lesson.estimated_minutes,
        difficulty: snapshot.lesson.difficulty,
        position: snapshot.lesson.position,
        metadata: snapshot.lesson.metadata,
        status: 'draft',
        is_published: false,
      })
      .eq('id', lessonId)

    if (updateError) {
      throw new ContentVersioningError(`Failed to restore lesson: ${updateError.message}`)
    }

    // Delete existing blocks and re-insert from snapshot
    const { error: deleteError } = await this.supabase
      .from('academy_lesson_blocks')
      .delete()
      .eq('lesson_id', lessonId)

    if (deleteError) {
      throw new ContentVersioningError(`Failed to clear lesson blocks: ${deleteError.message}`)
    }

    if (snapshot.blocks.length > 0) {
      const blocksToInsert = snapshot.blocks.map((block) => ({
        lesson_id: lessonId,
        block_type: block.block_type,
        position: block.position,
        title: block.title ?? null,
        content_json: block.content_json ?? {},
      }))

      const { error: insertError } = await this.supabase
        .from('academy_lesson_blocks')
        .insert(blocksToInsert)

      if (insertError) {
        throw new ContentVersioningError(`Failed to restore blocks: ${insertError.message}`)
      }
    }

    // Create a new version recording the rollback
    return this.createSnapshot(
      lessonId,
      userId,
      `Rolled back to version ${versionNumber}`
    )
  }

  private async getNextVersionNumber(lessonId: string): Promise<number> {
    const { data } = await this.supabase
      .from('academy_lesson_versions')
      .select('version_number')
      .eq('lesson_id', lessonId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    return (data?.version_number ?? 0) + 1
  }
}
