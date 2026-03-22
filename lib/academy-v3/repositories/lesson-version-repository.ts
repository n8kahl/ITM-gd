import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyLessonVersion } from '@/lib/academy-v3/contracts/domain'
import type { AcademyLessonVersionRepository } from './types'

function mapVersionRow(row: Record<string, unknown>): AcademyLessonVersion {
  return {
    id: String(row.id ?? ''),
    lessonId: String(row.lesson_id ?? ''),
    versionNumber: typeof row.version_number === 'number' ? row.version_number : 0,
    contentSnapshot:
      typeof row.content_snapshot === 'object' && row.content_snapshot !== null
        ? (row.content_snapshot as Record<string, unknown>)
        : {},
    changeSummary: typeof row.change_summary === 'string' ? row.change_summary : null,
    publishedBy: typeof row.published_by === 'string' ? row.published_by : null,
    publishedAt: String(row.published_at ?? ''),
  }
}

export class SupabaseAcademyLessonVersionRepository implements AcademyLessonVersionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createVersion(input: {
    lessonId: string
    versionNumber: number
    contentSnapshot: Record<string, unknown>
    changeSummary?: string
    publishedBy?: string
  }): Promise<AcademyLessonVersion> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .insert({
        lesson_id: input.lessonId,
        version_number: input.versionNumber,
        content_snapshot: input.contentSnapshot,
        change_summary: input.changeSummary ?? null,
        published_by: input.publishedBy ?? null,
      })
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to create lesson version: ${error.message}`)
    }

    return mapVersionRow(data as Record<string, unknown>)
  }

  async listVersionsForLesson(lessonId: string): Promise<AcademyLessonVersion[]> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('version_number', { ascending: false })

    if (error) {
      throw new Error(`Failed to list lesson versions: ${error.message}`)
    }

    return (data ?? []).map((row) => mapVersionRow(row as Record<string, unknown>))
  }

  async getVersion(lessonId: string, versionId: string): Promise<AcademyLessonVersion | null> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('id', versionId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to get lesson version: ${error.message}`)
    }

    return data ? mapVersionRow(data as Record<string, unknown>) : null
  }

  async getLatestVersionNumber(lessonId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('academy_lesson_versions')
      .select('version_number')
      .eq('lesson_id', lessonId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to get latest version number: ${error.message}`)
    }

    if (!data) return 0

    const row = data as Record<string, unknown>
    return typeof row.version_number === 'number' ? row.version_number : 0
  }
}
