import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BulkExportPayload,
  BulkExportTrack,
  BulkExportModule,
  BulkExportLesson,
  BulkExportLessonBlock,
  BulkImportPayload,
  BulkImportLessonBlock,
} from '@/lib/academy-v3/contracts/api'

// ---------------------------------------------------------------------------
// Database row shapes (snake_case from Supabase)
// ---------------------------------------------------------------------------

interface ProgramRow {
  id: string
  code: string
  title: string
  description: string | null
  is_active: boolean
}

interface TrackRow {
  id: string
  program_id: string
  code: string
  title: string
  description: string | null
  position: number
  is_active: boolean
}

interface ModuleRow {
  id: string
  track_id: string
  slug: string
  code: string
  title: string
  description: string | null
  cover_image_url: string | null
  learning_outcomes: string[]
  estimated_minutes: number
  position: number
  is_published: boolean
}

interface LessonRow {
  id: string
  module_id: string
  slug: string
  title: string
  learning_objective: string
  hero_image_url: string | null
  estimated_minutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  position: number
  is_published: boolean
  status: string | null
  published_at: string | null
}

interface BlockRow {
  id: string
  lesson_id: string
  block_type: string
  position: number
  title: string | null
  content_json: Record<string, unknown>
}

interface VersionRow {
  version_number: number
}

interface ImportResult {
  lessonsCreated: number
  lessonsUpdated: number
  blocksWritten: number
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BulkContentService {
  constructor(private readonly supabase: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  async exportCurriculum(): Promise<BulkExportPayload> {
    const program = await this.fetchProgram()
    const tracks = await this.fetchTracks(program.id)
    const trackIds = tracks.map((t) => t.id)
    const modules = trackIds.length > 0 ? await this.fetchModules(trackIds) : []
    const moduleIds = modules.map((m) => m.id)
    const lessons = moduleIds.length > 0 ? await this.fetchLessons(moduleIds) : []
    const lessonIds = lessons.map((l) => l.id)
    const blocks = lessonIds.length > 0 ? await this.fetchBlocks(lessonIds) : []
    const versions = lessonIds.length > 0 ? await this.fetchLatestVersionNumbers(lessonIds) : new Map<string, number>()

    const blocksByLesson = this.groupBy(blocks, (b) => b.lesson_id)
    const lessonsByModule = this.groupBy(lessons, (l) => l.module_id)
    const modulesByTrack = this.groupBy(modules, (m) => m.track_id)

    const exportTracks: BulkExportTrack[] = tracks.map((track) => {
      const trackModules = modulesByTrack.get(track.id) ?? []
      const exportModules: BulkExportModule[] = trackModules.map((mod) => {
        const modLessons = lessonsByModule.get(mod.id) ?? []
        const exportLessons: BulkExportLesson[] = modLessons.map((lesson) => {
          const lessonBlocks = blocksByLesson.get(lesson.id) ?? []
          const exportBlocks: BulkExportLessonBlock[] = lessonBlocks.map((b) => ({
            blockType: b.block_type as BulkExportLessonBlock['blockType'],
            position: b.position,
            title: b.title,
            contentJson: b.content_json,
          }))
          return {
            slug: lesson.slug,
            title: lesson.title,
            learningObjective: lesson.learning_objective,
            heroImageUrl: lesson.hero_image_url,
            estimatedMinutes: lesson.estimated_minutes,
            difficulty: lesson.difficulty,
            position: lesson.position,
            status: (lesson.status ?? (lesson.is_published ? 'published' : 'draft')) as BulkExportLesson['status'],
            publishedAt: lesson.published_at,
            versionNumber: versions.get(lesson.id) ?? null,
            blocks: exportBlocks,
          }
        })
        return {
          slug: mod.slug,
          code: mod.code,
          title: mod.title,
          description: mod.description,
          coverImageUrl: mod.cover_image_url,
          learningOutcomes: mod.learning_outcomes ?? [],
          estimatedMinutes: mod.estimated_minutes,
          position: mod.position,
          isPublished: mod.is_published,
          lessons: exportLessons,
        }
      })
      return {
        code: track.code,
        title: track.title,
        description: track.description,
        position: track.position,
        isActive: track.is_active,
        modules: exportModules,
      }
    })

    return {
      exportedAt: new Date().toISOString(),
      version: '1.0' as const,
      program: {
        code: program.code,
        title: program.title,
        description: program.description,
        isActive: program.is_active,
      },
      tracks: exportTracks,
    }
  }

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  async importLessons(payload: BulkImportPayload): Promise<ImportResult> {
    const { data: moduleRow, error: moduleError } = await this.supabase
      .from('academy_modules')
      .select('id')
      .eq('slug', payload.moduleSlug)
      .maybeSingle()

    if (moduleError || !moduleRow) {
      throw new Error(`Module with slug "${payload.moduleSlug}" not found`)
    }

    const moduleId: string = moduleRow.id
    let lessonsCreated = 0
    let lessonsUpdated = 0
    let blocksWritten = 0

    for (const importLesson of payload.lessons) {
      const { data: existingLesson } = await this.supabase
        .from('academy_lessons')
        .select('id')
        .eq('module_id', moduleId)
        .eq('slug', importLesson.slug)
        .maybeSingle()

      let lessonId: string

      if (existingLesson) {
        const { error: updateError } = await this.supabase
          .from('academy_lessons')
          .update({
            title: importLesson.title,
            learning_objective: importLesson.learningObjective,
            hero_image_url: importLesson.heroImageUrl,
            estimated_minutes: importLesson.estimatedMinutes,
            difficulty: importLesson.difficulty,
            position: importLesson.position,
            status: 'draft',
          })
          .eq('id', existingLesson.id)

        if (updateError) {
          throw new Error(`Failed to update lesson "${importLesson.slug}": ${updateError.message}`)
        }
        lessonId = existingLesson.id
        lessonsUpdated++
      } else {
        const { data: newLesson, error: insertError } = await this.supabase
          .from('academy_lessons')
          .insert({
            module_id: moduleId,
            slug: importLesson.slug,
            title: importLesson.title,
            learning_objective: importLesson.learningObjective,
            hero_image_url: importLesson.heroImageUrl,
            estimated_minutes: importLesson.estimatedMinutes,
            difficulty: importLesson.difficulty,
            position: importLesson.position,
            is_published: false,
            status: 'draft',
          })
          .select('id')
          .single()

        if (insertError || !newLesson) {
          throw new Error(`Failed to create lesson "${importLesson.slug}": ${insertError?.message}`)
        }
        lessonId = newLesson.id
        lessonsCreated++
      }

      if (importLesson.blocks.length > 0) {
        const { error: deleteError } = await this.supabase
          .from('academy_lesson_blocks')
          .delete()
          .eq('lesson_id', lessonId)

        if (deleteError) {
          throw new Error(`Failed to clear blocks for lesson "${importLesson.slug}": ${deleteError.message}`)
        }

        const blockRows = importLesson.blocks.map((block: BulkImportLessonBlock) => ({
          lesson_id: lessonId,
          block_type: block.blockType,
          position: block.position,
          title: block.title,
          content_json: block.contentJson,
        }))

        const { error: blockError } = await this.supabase
          .from('academy_lesson_blocks')
          .insert(blockRows)

        if (blockError) {
          throw new Error(`Failed to insert blocks for lesson "${importLesson.slug}": ${blockError.message}`)
        }
        blocksWritten += blockRows.length
      }
    }

    return { lessonsCreated, lessonsUpdated, blocksWritten }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async fetchProgram(): Promise<ProgramRow> {
    const { data, error } = await this.supabase
      .from('academy_programs')
      .select('id, code, title, description, is_active')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !data) {
      throw new Error('No academy program found')
    }
    return data as ProgramRow
  }

  private async fetchTracks(programId: string): Promise<TrackRow[]> {
    const { data, error } = await this.supabase
      .from('academy_tracks')
      .select('id, program_id, code, title, description, position, is_active')
      .eq('program_id', programId)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch tracks: ${error.message}`)
    return (data ?? []) as TrackRow[]
  }

  private async fetchModules(trackIds: string[]): Promise<ModuleRow[]> {
    const { data, error } = await this.supabase
      .from('academy_modules')
      .select('id, track_id, slug, code, title, description, cover_image_url, learning_outcomes, estimated_minutes, position, is_published')
      .in('track_id', trackIds)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch modules: ${error.message}`)
    return (data ?? []) as ModuleRow[]
  }

  private async fetchLessons(moduleIds: string[]): Promise<LessonRow[]> {
    const { data, error } = await this.supabase
      .from('academy_lessons')
      .select('id, module_id, slug, title, learning_objective, hero_image_url, estimated_minutes, difficulty, position, is_published, status, published_at')
      .in('module_id', moduleIds)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch lessons: ${error.message}`)
    return (data ?? []) as LessonRow[]
  }

  private async fetchBlocks(lessonIds: string[]): Promise<BlockRow[]> {
    const { data, error } = await this.supabase
      .from('academy_lesson_blocks')
      .select('id, lesson_id, block_type, position, title, content_json')
      .in('lesson_id', lessonIds)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch blocks: ${error.message}`)
    return (data ?? []) as BlockRow[]
  }

  private async fetchLatestVersionNumbers(lessonIds: string[]): Promise<Map<string, number>> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .select('lesson_id, version_number')
      .in('lesson_id', lessonIds)
      .order('version_number', { ascending: false })

    if (error) {
      // Table may not exist yet — graceful degradation
      return new Map()
    }

    const map = new Map<string, number>()
    for (const row of (data ?? []) as Array<{ lesson_id: string } & VersionRow>) {
      if (!map.has(row.lesson_id)) {
        map.set(row.lesson_id, row.version_number)
      }
    }
    return map
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const item of items) {
      const k = keyFn(item)
      const group = map.get(k)
      if (group) {
        group.push(item)
      } else {
        map.set(k, [item])
      }
    }
    return map
  }
}
