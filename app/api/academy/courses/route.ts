import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  toSafeErrorMessage,
} from '@/lib/academy/api-utils'

interface CourseRow {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnail_url: string | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  tier_required: 'core' | 'pro' | 'executive'
  estimated_hours: number | null
  learning_path_id: string | null
}

function getPathName(course: CourseRow, pathNamesById: Map<string, string>): string {
  if (!course.learning_path_id) {
    return 'General'
  }

  return pathNamesById.get(course.learning_path_id) || 'General'
}

/**
 * GET /api/academy/courses
 * Lists courses available to the member, including progress metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const pathId = searchParams.get('path_id')
    const difficulty = searchParams.get('difficulty')

    let query = supabase
      .from('courses')
      .select(`
        id,
        slug,
        title,
        description,
        thumbnail_url,
        difficulty_level,
        tier_required,
        estimated_hours,
        learning_path_id
      `)
      .eq('is_published', true)
      .order('display_order', { ascending: true })

    if (difficulty && ['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      query = query.eq('difficulty_level', difficulty)
    }

    const { data: rawCourses, error: coursesError } = await query
    if (coursesError) {
      console.error('academy courses query failed', coursesError)
      return NextResponse.json(
        { success: false, error: 'Failed to load courses' },
        { status: 500 }
      )
    }

    let courses = (rawCourses || []) as CourseRow[]

    if (pathId) {
      const { data: pathMappings } = await supabase
        .from('learning_path_courses')
        .select('course_id')
        .eq('learning_path_id', pathId)

      const allowedCourseIds = new Set((pathMappings || []).map((mapping) => mapping.course_id))
      courses = courses.filter((course) => allowedCourseIds.has(course.id))
    }

    const learningPathIds = Array.from(
      new Set(courses.map((course) => course.learning_path_id).filter((value): value is string => !!value))
    )

    const { data: learningPaths } = learningPathIds.length > 0
      ? await supabase
          .from('learning_paths')
          .select('id, name')
          .in('id', learningPathIds)
      : { data: [] as Array<{ id: string; name: string | null }> }

    const pathNamesById = new Map(
      (learningPaths || []).map((row) => [row.id, row.name || 'General'])
    )

    const courseIds = courses.map((course) => course.id)

    const [lessonsResult, progressResult] = await Promise.all([
      courseIds.length > 0
        ? supabase
            .from('lessons')
            .select('id, course_id, estimated_minutes')
            .in('course_id', courseIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length > 0
        ? supabase
            .from('user_lesson_progress')
            .select('course_id, lesson_id, status')
            .eq('user_id', user.id)
            .in('course_id', courseIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (lessonsResult.error || progressResult.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load course progress' },
        { status: 500 }
      )
    }

    const lessonCountByCourse = new Map<string, number>()
    const estimatedMinutesByCourse = new Map<string, number>()
    for (const lesson of lessonsResult.data || []) {
      lessonCountByCourse.set(lesson.course_id, (lessonCountByCourse.get(lesson.course_id) || 0) + 1)
      estimatedMinutesByCourse.set(
        lesson.course_id,
        (estimatedMinutesByCourse.get(lesson.course_id) || 0) + (lesson.estimated_minutes || 0)
      )
    }

    const completedLessonsByCourse = new Map<string, number>()
    for (const progress of progressResult.data || []) {
      if (progress.status !== 'completed') continue
      completedLessonsByCourse.set(
        progress.course_id,
        (completedLessonsByCourse.get(progress.course_id) || 0) + 1
      )
    }

    const mappedCourses = courses.map((course) => ({
      slug: course.slug,
      title: course.title,
      description: course.description || '',
      thumbnailUrl: course.thumbnail_url,
      difficulty: course.difficulty_level,
      path: getPathName(course, pathNamesById),
      totalLessons: lessonCountByCourse.get(course.id) || 0,
      completedLessons: completedLessonsByCourse.get(course.id) || 0,
      estimatedMinutes:
        estimatedMinutesByCourse.get(course.id) || Math.round((course.estimated_hours || 0) * 60),
    }))

    const paths = Array.from(new Set(mappedCourses.map((course) => course.path))).sort()

    return NextResponse.json({
      success: true,
      data: {
        courses: mappedCourses,
        paths,
      },
    })
  } catch (error) {
    console.error('academy courses failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
