import type {
  AcademyLesson,
  AcademyLessonBlock,
  AcademyModule,
  AcademyProgram,
  AcademyTrack,
} from '../contracts/domain'

type Nullable<T> = T | null | undefined

function asString(value: Nullable<unknown>): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: Nullable<unknown>, fallback = 0): number {
  return typeof value === 'number' ? value : fallback
}

function asBoolean(value: Nullable<unknown>, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: Nullable<unknown>): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecord(value: Nullable<unknown>): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function resolveImageUrl(metadata: Nullable<unknown>, keys: string[]): string | null {
  const record = asRecord(metadata)
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return null
}

export function mapAcademyProgramRow(row: Record<string, unknown>): AcademyProgram {
  return {
    id: asString(row.id),
    code: asString(row.code),
    title: asString(row.title),
    description: typeof row.description === 'string' ? row.description : null,
    isActive: asBoolean(row.is_active),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapAcademyTrackRow(row: Record<string, unknown>): AcademyTrack {
  return {
    id: asString(row.id),
    programId: asString(row.program_id),
    code: asString(row.code),
    title: asString(row.title),
    description: typeof row.description === 'string' ? row.description : null,
    position: asNumber(row.position),
    isActive: asBoolean(row.is_active),
  }
}

export function mapAcademyModuleRow(row: Record<string, unknown>): AcademyModule {
  return {
    id: asString(row.id),
    trackId: asString(row.track_id),
    slug: asString(row.slug),
    code: asString(row.code),
    title: asString(row.title),
    description: typeof row.description === 'string' ? row.description : null,
    coverImageUrl: resolveImageUrl(row.metadata, ['coverImageUrl', 'cover_image_url', 'imageUrl', 'image_url']),
    learningOutcomes: asStringArray(row.learning_outcomes),
    estimatedMinutes: asNumber(row.estimated_minutes),
    position: asNumber(row.position),
    isPublished: asBoolean(row.is_published),
  }
}

export function mapAcademyLessonRow(row: Record<string, unknown>): AcademyLesson {
  return {
    id: asString(row.id),
    moduleId: asString(row.module_id),
    slug: asString(row.slug),
    title: asString(row.title),
    learningObjective: asString(row.learning_objective),
    heroImageUrl: resolveImageUrl(row.metadata, ['heroImageUrl', 'hero_image_url', 'coverImageUrl', 'cover_image_url']),
    estimatedMinutes: asNumber(row.estimated_minutes),
    difficulty: row.difficulty === 'intermediate' || row.difficulty === 'advanced' ? row.difficulty : 'beginner',
    prerequisiteLessonIds: asStringArray(row.prerequisite_lesson_ids),
    position: asNumber(row.position),
    isPublished: asBoolean(row.is_published),
  }
}

export function mapAcademyLessonBlockRow(row: Record<string, unknown>): AcademyLessonBlock {
  return {
    id: asString(row.id),
    lessonId: asString(row.lesson_id),
    blockType:
      row.block_type === 'concept_explanation' ||
      row.block_type === 'worked_example' ||
      row.block_type === 'guided_practice' ||
      row.block_type === 'independent_practice' ||
      row.block_type === 'reflection'
        ? row.block_type
        : 'hook',
    position: asNumber(row.position),
    title: typeof row.title === 'string' ? row.title : null,
    contentJson: typeof row.content_json === 'object' && row.content_json !== null
      ? (row.content_json as Record<string, unknown>)
      : {},
  }
}
