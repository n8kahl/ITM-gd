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
 * Production readiness check for academy curriculum seed completeness.
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
      coursesTotalResult,
      coursesPublishedResult,
      lessonsTotalResult,
      lessonsPublishedResult,
      learningPathsResult,
      learningPathCoursesResult,
      courseAssetsResult,
      lessonAssetsResult,
      learningProfilesResult,
      lessonProgressResult,
      courseProgressResult,
      userXpResult,
      lessonsPerCourseResult,
    ] = await Promise.all([
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('lessons').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('learning_paths').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('learning_path_courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('courses').select('id, thumbnail_url'),
      supabaseAdmin.from('lessons').select('id, video_url, quiz_data, activity_data, ai_tutor_context'),
      supabaseAdmin.from('user_learning_profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_lesson_progress').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_course_progress').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_xp').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('courses')
        .select('slug, title, lessons(id)')
        .order('display_order', { ascending: true }),
    ])

    if (coursesTotalResult.error || lessonsTotalResult.error || learningPathsResult.error) {
      throw new Error('Failed to load academy totals')
    }
    if (courseAssetsResult.error || lessonAssetsResult.error || lessonsPerCourseResult.error) {
      throw new Error('Failed to load academy seed quality metrics')
    }

    const lessonsPerCourse = (lessonsPerCourseResult.data || []).map((course) => ({
      slug: course.slug,
      title: course.title,
      lessonCount: Array.isArray(course.lessons) ? course.lessons.length : 0,
    }))

    const coursesWithoutThumbnail = (courseAssetsResult.data || []).filter(
      (course) => !course.thumbnail_url
    ).length
    const lessonsWithoutVideo = (lessonAssetsResult.data || []).filter(
      (lesson) => !lesson.video_url
    ).length
    const lessonsWithoutQuizData = (lessonAssetsResult.data || []).filter(
      (lesson) => !lesson.quiz_data
    ).length
    const lessonsWithoutActivityData = (lessonAssetsResult.data || []).filter(
      (lesson) => !lesson.activity_data
    ).length
    const lessonsWithoutAiContext = (lessonAssetsResult.data || []).filter(
      (lesson) => !lesson.ai_tutor_context
    ).length

    const data: SeedHealthData = {
      totals: {
        courses: coursesTotalResult.count || 0,
        coursesPublished: coursesPublishedResult.count || 0,
        lessons: lessonsTotalResult.count || 0,
        lessonsPublished: lessonsPublishedResult.count || 0,
        learningPaths: learningPathsResult.count || 0,
        learningPathCourses: learningPathCoursesResult.count || 0,
      },
      missingData: {
        coursesWithoutThumbnail,
        lessonsWithoutVideo,
        lessonsWithoutQuizData,
        lessonsWithoutActivityData,
        lessonsWithoutAiContext,
      },
      userReadiness: {
        learningProfiles: learningProfilesResult.count || 0,
        lessonProgressRows: lessonProgressResult.count || 0,
        courseProgressRows: courseProgressResult.count || 0,
        userXpRows: userXpResult.count || 0,
      },
      completion: {
        lessonsPerCourse,
      },
      checks: {
        hasCoreCurriculum: (coursesTotalResult.count || 0) > 0 && (lessonsTotalResult.count || 0) > 0,
        hasLessonContent: lessonsPerCourse.every((course) => course.lessonCount > 0),
        hasQuizCoverage: lessonsWithoutQuizData === 0,
        hasMediaCoverage: coursesWithoutThumbnail === 0,
        hasActivityCoverage: lessonsWithoutActivityData === 0,
        hasAiTutorCoverage: lessonsWithoutAiContext === 0,
        hasUserProgressData: (learningProfilesResult.count || 0) > 0,
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
