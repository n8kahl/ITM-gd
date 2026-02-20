import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  extractDiscordRoleIdsFromUser,
  hasMembersAreaAccess,
  normalizeDiscordRoleIds,
} from '@/lib/discord-role-access'

export class AcademyAccessError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AcademyAccessError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function getRequiredRoleFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null

  const asRecord = metadata as Record<string, unknown>
  const preferred = asRecord.discord_role_required
  if (typeof preferred === 'string' && preferred.trim().length > 0) {
    return preferred.trim()
  }

  const legacy = asRecord.legacy_discord_role_required
  if (typeof legacy === 'string' && legacy.trim().length > 0) {
    return legacy.trim()
  }

  return null
}

export async function resolveEffectiveDiscordRoleIds(params: {
  user: User
  supabase: SupabaseClient
}): Promise<string[]> {
  const { user, supabase } = params
  let roleIds = extractDiscordRoleIdsFromUser(user)

  try {
    const { data: profile } = await supabase
      .from('user_discord_profiles')
      .select('discord_roles')
      .eq('user_id', user.id)
      .maybeSingle()

    const profileRoleIds = normalizeDiscordRoleIds(profile?.discord_roles)
    if (profileRoleIds.length > 0) {
      roleIds = Array.from(new Set([...roleIds, ...profileRoleIds]))
    }
  } catch {
    // Non-fatal: fallback to JWT/user metadata role IDs only.
  }

  return roleIds
}

export async function assertMembersAreaRoleAccess(params: {
  user: User
  supabase: SupabaseClient
}): Promise<string[]> {
  const roleIds = await resolveEffectiveDiscordRoleIds(params)

  if (!hasMembersAreaAccess(roleIds)) {
    throw new AcademyAccessError(
      403,
      'MEMBERS_ROLE_REQUIRED',
      'Members-area Discord role required to access academy resources.',
    )
  }

  return roleIds
}

async function resolveProgramIdFromTrackId(params: {
  supabase: SupabaseClient
  trackId: string
}): Promise<string> {
  const { supabase, trackId } = params
  const { data: trackRow, error: trackError } = await supabase
    .from('academy_tracks')
    .select('program_id')
    .eq('id', trackId)
    .maybeSingle()

  if (trackError || !trackRow?.program_id) {
    throw new AcademyAccessError(500, 'TRACK_RESOLUTION_FAILED', 'Failed to resolve academy track program')
  }

  return String(trackRow.program_id)
}

export async function ensureProgramEnrollment(params: {
  supabase: SupabaseClient
  userId: string
  programId: string
}): Promise<void> {
  const { supabase, userId, programId } = params

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('academy_user_enrollments')
    .select('id, status')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .maybeSingle()

  if (enrollmentError) {
    throw new AcademyAccessError(500, 'ENROLLMENT_LOOKUP_FAILED', 'Failed to load academy enrollment')
  }

  if (!enrollment) {
    const nowIso = new Date().toISOString()
    const { error: createError } = await supabase
      .from('academy_user_enrollments')
      .insert({
        user_id: userId,
        program_id: programId,
        status: 'active',
        started_at: nowIso,
        metadata: {
          source: 'academy_v3_auto_enroll',
        },
      })

    if (createError) {
      throw new AcademyAccessError(500, 'ENROLLMENT_CREATE_FAILED', 'Failed to initialize academy enrollment')
    }

    return
  }

  const status = String(enrollment.status || '').toLowerCase()
  if (status === 'active' || status === 'completed') {
    return
  }

  const { error: reactivateError } = await supabase
    .from('academy_user_enrollments')
    .update({ status: 'active' })
    .eq('id', enrollment.id)

  if (reactivateError) {
    throw new AcademyAccessError(500, 'ENROLLMENT_REACTIVATE_FAILED', 'Failed to reactivate academy enrollment')
  }
}

export async function ensureEnrollmentForProgramCode(params: {
  supabase: SupabaseClient
  userId: string
  programCode?: string
}): Promise<{ programId: string }> {
  const { supabase, userId, programCode } = params

  let programQuery = supabase
    .from('academy_programs')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)

  if (programCode && programCode.trim().length > 0) {
    programQuery = supabase
      .from('academy_programs')
      .select('id')
      .eq('is_active', true)
      .eq('code', programCode.trim())
      .limit(1)
  }

  const { data: programRows, error: programError } = await programQuery
  if (programError || !Array.isArray(programRows) || programRows.length === 0) {
    throw new AcademyAccessError(404, 'PROGRAM_NOT_FOUND', 'Academy program not found')
  }

  const programId = String(programRows[0].id)
  await ensureProgramEnrollment({ supabase, userId, programId })
  return { programId }
}

export async function assertModuleContentAccess(params: {
  supabase: SupabaseClient
  userId: string
  roleIds: string[]
  moduleSlug: string
}): Promise<{ moduleId: string; programId: string; requiredRoleId: string | null }> {
  const { supabase, userId, roleIds, moduleSlug } = params

  const { data: moduleRow, error: moduleError } = await supabase
    .from('academy_modules')
    .select('id, track_id, is_published, metadata')
    .eq('slug', moduleSlug)
    .maybeSingle()

  if (moduleError || !moduleRow || moduleRow.is_published !== true) {
    throw new AcademyAccessError(404, 'MODULE_NOT_FOUND', 'Academy module not found')
  }

  const programId = await resolveProgramIdFromTrackId({
    supabase,
    trackId: String(moduleRow.track_id),
  })

  await ensureProgramEnrollment({ supabase, userId, programId })

  const requiredRoleId = getRequiredRoleFromMetadata(moduleRow.metadata)
  if (requiredRoleId && !roleIds.includes(requiredRoleId)) {
    throw new AcademyAccessError(
      403,
      'MODULE_ROLE_REQUIRED',
      'A specific Discord role is required to access this module.',
      { required_role_id: requiredRoleId },
    )
  }

  return {
    moduleId: String(moduleRow.id),
    programId,
    requiredRoleId,
  }
}

export async function assertLessonContentAccess(params: {
  supabase: SupabaseClient
  userId: string
  roleIds: string[]
  lessonId: string
}): Promise<{ lessonId: string; moduleId: string; programId: string; requiredRoleId: string | null }> {
  const { supabase, userId, roleIds, lessonId } = params

  const { data: lessonRow, error: lessonError } = await supabase
    .from('academy_lessons')
    .select('id, module_id, is_published')
    .eq('id', lessonId)
    .maybeSingle()

  if (lessonError || !lessonRow || lessonRow.is_published !== true) {
    throw new AcademyAccessError(404, 'LESSON_NOT_FOUND', 'Academy lesson not found')
  }

  const { data: moduleRow, error: moduleError } = await supabase
    .from('academy_modules')
    .select('id, track_id, is_published, metadata')
    .eq('id', lessonRow.module_id)
    .maybeSingle()

  if (moduleError || !moduleRow || moduleRow.is_published !== true) {
    throw new AcademyAccessError(404, 'MODULE_NOT_FOUND', 'Academy module not found')
  }

  const programId = await resolveProgramIdFromTrackId({
    supabase,
    trackId: String(moduleRow.track_id),
  })

  await ensureProgramEnrollment({ supabase, userId, programId })

  const requiredRoleId = getRequiredRoleFromMetadata(moduleRow.metadata)
  if (requiredRoleId && !roleIds.includes(requiredRoleId)) {
    throw new AcademyAccessError(
      403,
      'LESSON_ROLE_REQUIRED',
      'A specific Discord role is required to access this lesson.',
      { required_role_id: requiredRoleId },
    )
  }

  return {
    lessonId: String(lessonRow.id),
    moduleId: String(moduleRow.id),
    programId,
    requiredRoleId,
  }
}

export async function assertAssessmentAccess(params: {
  supabase: SupabaseClient
  userId: string
  roleIds: string[]
  assessmentId: string
}): Promise<{ assessmentId: string; moduleId: string; programId: string; requiredRoleId: string | null }> {
  const { supabase, userId, roleIds, assessmentId } = params

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('academy_assessments')
    .select('id, module_id, lesson_id, is_published')
    .eq('id', assessmentId)
    .maybeSingle()

  if (assessmentError || !assessmentRow || assessmentRow.is_published !== true) {
    throw new AcademyAccessError(404, 'ASSESSMENT_NOT_FOUND', 'Academy assessment not found')
  }

  let moduleId: string | null = assessmentRow.module_id ? String(assessmentRow.module_id) : null
  if (!moduleId && assessmentRow.lesson_id) {
    const { data: lessonRow, error: lessonError } = await supabase
      .from('academy_lessons')
      .select('module_id')
      .eq('id', assessmentRow.lesson_id)
      .maybeSingle()

    if (lessonError || !lessonRow?.module_id) {
      throw new AcademyAccessError(500, 'ASSESSMENT_MODULE_RESOLUTION_FAILED', 'Failed to resolve assessment module')
    }

    moduleId = String(lessonRow.module_id)
  }

  if (!moduleId) {
    throw new AcademyAccessError(500, 'ASSESSMENT_MODULE_MISSING', 'Assessment is missing module linkage')
  }

  const { data: moduleRow, error: moduleError } = await supabase
    .from('academy_modules')
    .select('id, track_id, is_published, metadata')
    .eq('id', moduleId)
    .maybeSingle()

  if (moduleError || !moduleRow || moduleRow.is_published !== true) {
    throw new AcademyAccessError(404, 'MODULE_NOT_FOUND', 'Academy module not found')
  }

  const programId = await resolveProgramIdFromTrackId({
    supabase,
    trackId: String(moduleRow.track_id),
  })

  await ensureProgramEnrollment({ supabase, userId, programId })

  const requiredRoleId = getRequiredRoleFromMetadata(moduleRow.metadata)
  if (requiredRoleId && !roleIds.includes(requiredRoleId)) {
    throw new AcademyAccessError(
      403,
      'ASSESSMENT_ROLE_REQUIRED',
      'A specific Discord role is required to access this assessment.',
      { required_role_id: requiredRoleId },
    )
  }

  return {
    assessmentId: String(assessmentRow.id),
    moduleId: String(moduleRow.id),
    programId,
    requiredRoleId,
  }
}
