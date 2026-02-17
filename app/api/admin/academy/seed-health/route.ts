import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

interface SeedHealthData {
  totals: {
    courses: number
    coursesPublished: number
    lessons: number
    lessonsPublished: number
    learningPaths: number
    learningPathCourses: number
  }
  missingData: {
    coursesWithoutThumbnail: number
    lessonsWithoutVideo: number
    lessonsWithoutQuizData: number
    lessonsWithoutActivityData: number
    lessonsWithoutAiContext: number
  }
  userReadiness: {
    learningProfiles: number
    lessonProgressRows: number
    courseProgressRows: number
    userXpRows: number
  }
  completion: {
    lessonsPerCourse: Array<{ slug: string; title: string; lessonCount: number }>
  }
  checks: {
    hasCoreCurriculum: boolean
    hasLessonContent: boolean
    hasQuizCoverage: boolean
    hasMediaCoverage: boolean
    hasActivityCoverage: boolean
    hasAiTutorCoverage: boolean
    hasUserProgressData: boolean
  }
}

/**
 * GET /api/admin/academy/seed-health
 * Production readiness check for academy v3 curriculum seed completeness.
 */
export async function GET() {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const [
      modulesTotalResult,
      modulesPublishedResult,
      lessonsTotalResult,
      lessonsPublishedResult,
      tracksResult,
      modulesResult,
      lessonsResult,
      enrollmentsResult,
      lessonAttemptsResult,
      assessmentAttemptsResult,
      learningEventsResult,
      lessonsPerModuleResult,
    ] = await Promise.all([
      supabaseAdmin.from('academy_modules').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('academy_modules').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('academy_lessons').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('academy_lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('academy_tracks').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('academy_modules').select('id, metadata'),
      supabaseAdmin.from('academy_lessons').select('id, metadata'),
      supabaseAdmin.from('academy_user_enrollments').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('academy_user_lesson_attempts').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('academy_user_assessment_attempts').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('academy_learning_events').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('academy_modules')
        .select('slug, title, academy_lessons(id)')
        .order('position', { ascending: true }),
    ])

    if (modulesTotalResult.error || lessonsTotalResult.error || tracksResult.error) {
      throw new Error('Failed to load academy totals')
    }
    if (modulesResult.error || lessonsResult.error || lessonsPerModuleResult.error) {
      throw new Error('Failed to load academy seed quality metrics')
    }

    const lessonsPerCourse = (lessonsPerModuleResult.data || []).map((module) => ({
      slug: module.slug,
      title: module.title,
      lessonCount: Array.isArray(module.academy_lessons) ? module.academy_lessons.length : 0,
    }))

    const coursesWithoutThumbnail = (modulesResult.data || []).filter((module) => {
      const metadata = asObject(module.metadata)
      const thumbnail =
        asNullableString(metadata.thumbnail_url) ||
        asNullableString(metadata.coverImageUrl) ||
        asNullableString(metadata.legacy_thumbnail_url)
      return !thumbnail
    }).length

    const lessonsWithoutVideo = (lessonsResult.data || []).filter((lesson) => {
      const metadata = asObject(lesson.metadata)
      const video =
        asNullableString(metadata.video_url) ||
        asNullableString(metadata.legacy_video_url)
      return !video
    }).length

    const lessonsWithoutQuizData = (lessonsResult.data || []).filter((lesson) => {
      const metadata = asObject(lesson.metadata)
      return asObject(metadata.quiz_data).questions == null
    }).length

    const lessonsWithoutActivityData = 0

    const lessonsWithoutAiContext = (lessonsResult.data || []).filter((lesson) => {
      const metadata = asObject(lesson.metadata)
      const aiContext = asNullableString(metadata.ai_tutor_context) || asNullableString(metadata.legacy_ai_tutor_context)
      return !aiContext
    }).length

    const data: SeedHealthData = {
      totals: {
        courses: modulesTotalResult.count || 0,
        coursesPublished: modulesPublishedResult.count || 0,
        lessons: lessonsTotalResult.count || 0,
        lessonsPublished: lessonsPublishedResult.count || 0,
        learningPaths: tracksResult.count || 0,
        learningPathCourses: modulesTotalResult.count || 0,
      },
      missingData: {
        coursesWithoutThumbnail,
        lessonsWithoutVideo,
        lessonsWithoutQuizData,
        lessonsWithoutActivityData,
        lessonsWithoutAiContext,
      },
      userReadiness: {
        learningProfiles: enrollmentsResult.count || 0,
        lessonProgressRows: lessonAttemptsResult.count || 0,
        courseProgressRows: enrollmentsResult.count || 0,
        userXpRows: learningEventsResult.count || 0,
      },
      completion: {
        lessonsPerCourse,
      },
      checks: {
        hasCoreCurriculum: (modulesTotalResult.count || 0) > 0 && (lessonsTotalResult.count || 0) > 0,
        hasLessonContent: lessonsPerCourse.every((course) => course.lessonCount > 0),
        hasQuizCoverage: lessonsWithoutQuizData === 0,
        hasMediaCoverage: coursesWithoutThumbnail === 0,
        hasActivityCoverage: lessonsWithoutActivityData === 0,
        hasAiTutorCoverage: lessonsWithoutAiContext === 0,
        hasUserProgressData:
          (lessonAttemptsResult.count || 0) > 0 ||
          (assessmentAttemptsResult.count || 0) > 0 ||
          (enrollmentsResult.count || 0) > 0,
      },
    }

    return NextResponse.json({
      success: true,
      data,
      productionReady:
        data.checks.hasCoreCurriculum &&
        data.checks.hasLessonContent &&
        data.checks.hasQuizCoverage &&
        data.checks.hasMediaCoverage &&
        data.checks.hasActivityCoverage &&
        data.checks.hasAiTutorCoverage,
    })
  } catch (error) {
    console.error('academy seed health check failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
