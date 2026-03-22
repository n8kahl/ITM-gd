import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type BulkCurriculum,
  type BulkLessonBlock,
  bulkCurriculumSchema,
} from '@/lib/academy-v3/contracts/domain'

export class BulkContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BulkContentError'
  }
}

interface BulkImportResult {
  programId: string
  tracksCreated: number
  modulesCreated: number
  lessonsCreated: number
  blocksCreated: number
}

export class BulkContentService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Export the entire curriculum (or a specific program) as structured JSON.
   */
  async exportCurriculum(programCode?: string): Promise<BulkCurriculum> {
    const programQuery = this.supabase
      .from('academy_programs')
      .select('id, code, title, description')
      .eq('is_active', true)

    if (programCode) {
      programQuery.eq('code', programCode)
    }

    const { data: programs, error: progError } = await programQuery.limit(1).maybeSingle()

    if (progError || !programs) {
      throw new BulkContentError('No active program found')
    }

    const { data: tracks, error: tracksError } = await this.supabase
      .from('academy_tracks')
      .select('id, code, title, description, position')
      .eq('program_id', programs.id)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (tracksError) {
      throw new BulkContentError(`Failed to fetch tracks: ${tracksError.message}`)
    }

    const exportTracks = []
    for (const track of tracks ?? []) {
      const { data: modules, error: modError } = await this.supabase
        .from('academy_modules')
        .select('id, slug, code, title, description, learning_outcomes, estimated_minutes, position')
        .eq('track_id', track.id)
        .order('position', { ascending: true })

      if (modError) {
        throw new BulkContentError(`Failed to fetch modules: ${modError.message}`)
      }

      const exportModules = []
      for (const mod of modules ?? []) {
        const { data: lessons, error: lessonError } = await this.supabase
          .from('academy_lessons')
          .select('id, slug, title, learning_objective, estimated_minutes, difficulty, position')
          .eq('module_id', mod.id)
          .order('position', { ascending: true })

        if (lessonError) {
          throw new BulkContentError(`Failed to fetch lessons: ${lessonError.message}`)
        }

        const exportLessons = []
        for (const lesson of lessons ?? []) {
          const { data: blocks, error: blockError } = await this.supabase
            .from('academy_lesson_blocks')
            .select('block_type, position, title, content_json')
            .eq('lesson_id', lesson.id)
            .order('position', { ascending: true })

          if (blockError) {
            throw new BulkContentError(`Failed to fetch blocks: ${blockError.message}`)
          }

          exportLessons.push({
            slug: String(lesson.slug),
            title: String(lesson.title),
            learningObjective: String(lesson.learning_objective),
            estimatedMinutes: Number(lesson.estimated_minutes ?? 0),
            difficulty: lesson.difficulty as 'beginner' | 'intermediate' | 'advanced',
            position: Number(lesson.position ?? 0),
            blocks: (blocks ?? []).map((b: Record<string, unknown>) => ({
              blockType: String(b.block_type) as BulkCurriculum['tracks'][number]['modules'][number]['lessons'][number]['blocks'][number]['blockType'],
              position: Number(b.position ?? 0),
              title: b.title != null ? String(b.title) : null,
              contentJson: (b.content_json ?? {}) as Record<string, unknown>,
            })),
          })
        }

        exportModules.push({
          slug: String(mod.slug),
          code: String(mod.code),
          title: String(mod.title),
          description: mod.description != null ? String(mod.description) : null,
          learningOutcomes: Array.isArray(mod.learning_outcomes) ? mod.learning_outcomes.map(String) : [],
          estimatedMinutes: Number(mod.estimated_minutes ?? 0),
          position: Number(mod.position ?? 0),
          lessons: exportLessons,
        })
      }

      exportTracks.push({
        code: String(track.code),
        title: String(track.title),
        description: track.description != null ? String(track.description) : null,
        position: Number(track.position ?? 0),
        modules: exportModules,
      })
    }

    return {
      program: {
        code: String(programs.code),
        title: String(programs.title),
        description: programs.description != null ? String(programs.description) : null,
      },
      tracks: exportTracks,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }
  }

  /**
   * Import a curriculum JSON payload. Uses UPSERT to allow re-import.
   * Validates the entire payload with Zod before any DB writes.
   */
  async importCurriculum(payload: unknown): Promise<BulkImportResult> {
    const parsed = bulkCurriculumSchema.parse(payload)

    let tracksCreated = 0
    let modulesCreated = 0
    let lessonsCreated = 0
    let blocksCreated = 0

    // Upsert program
    const { data: program, error: progError } = await this.supabase
      .from('academy_programs')
      .upsert({
        code: parsed.program.code,
        title: parsed.program.title,
        description: parsed.program.description,
        is_active: true,
      }, { onConflict: 'code' })
      .select('id')
      .single()

    if (progError || !program) {
      throw new BulkContentError(`Failed to upsert program: ${progError?.message ?? 'unknown'}`)
    }

    for (const track of parsed.tracks) {
      const { data: trackRow, error: trackError } = await this.supabase
        .from('academy_tracks')
        .upsert({
          program_id: program.id,
          code: track.code,
          title: track.title,
          description: track.description,
          position: track.position,
          is_active: true,
        }, { onConflict: 'program_id,code' })
        .select('id')
        .single()

      if (trackError || !trackRow) {
        throw new BulkContentError(`Failed to upsert track '${track.code}': ${trackError?.message ?? 'unknown'}`)
      }
      tracksCreated++

      for (const mod of track.modules ?? []) {
        const { data: modRow, error: modError } = await this.supabase
          .from('academy_modules')
          .upsert({
            track_id: trackRow.id,
            slug: mod.slug,
            code: mod.code,
            title: mod.title,
            description: mod.description,
            learning_outcomes: mod.learningOutcomes,
            estimated_minutes: mod.estimatedMinutes,
            position: mod.position,
            is_published: false,
          }, { onConflict: 'slug' })
          .select('id')
          .single()

        if (modError || !modRow) {
          throw new BulkContentError(`Failed to upsert module '${mod.slug}': ${modError?.message ?? 'unknown'}`)
        }
        modulesCreated++

        for (const lesson of mod.lessons ?? []) {
          const { data: lessonRow, error: lessonError } = await this.supabase
            .from('academy_lessons')
            .upsert({
              module_id: modRow.id,
              slug: lesson.slug,
              title: lesson.title,
              learning_objective: lesson.learningObjective,
              estimated_minutes: lesson.estimatedMinutes,
              difficulty: lesson.difficulty,
              position: lesson.position,
              is_published: false,
              status: 'draft',
            }, { onConflict: 'slug' })
            .select('id')
            .single()

          if (lessonError || !lessonRow) {
            throw new BulkContentError(
              `Failed to upsert lesson '${lesson.slug}': ${lessonError?.message ?? 'unknown'}`
            )
          }
          lessonsCreated++

          if (lesson.blocks && lesson.blocks.length > 0) {
            // Clear existing blocks first, then insert fresh
            await this.supabase
              .from('academy_lesson_blocks')
              .delete()
              .eq('lesson_id', lessonRow.id)

            const blockRows = lesson.blocks.map((block: BulkLessonBlock) => ({
              lesson_id: lessonRow.id,
              block_type: block.blockType,
              position: block.position,
              title: block.title,
              content_json: block.contentJson,
            }))

            const { error: blockError } = await this.supabase
              .from('academy_lesson_blocks')
              .insert(blockRows)

            if (blockError) {
              throw new BulkContentError(
                `Failed to insert blocks for lesson '${lesson.slug}': ${blockError.message}`
              )
            }
            blocksCreated += blockRows.length
          }
        }
      }
    }

    return {
      programId: program.id as string,
      tracksCreated,
      modulesCreated,
      lessonsCreated,
      blocksCreated,
    }
  }
}
