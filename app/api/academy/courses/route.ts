import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

interface BaseCourseRow {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnail_url: string | null
  updated_at?: string | null
}

interface ExtendedCourseRow extends BaseCourseRow {
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
  estimated_hours?: number | null
  learning_path_id?: string | null
}

interface LessonRow {
  id: string
  course_id: string
  estimated_minutes?: number | null
  duration_minutes?: number | null
}

const DIFFICULTY_VALUES = new Set(['beginner', 'intermediate', 'advanced'])

function normalizeDifficulty(value: string | null | undefined): 'beginner' | 'intermediate' | 'advanced' {
  if (value && DIFFICULTY_VALUES.has(value)) {
    return value as 'beginner' | 'intermediate' | 'advanced'
  }

  return 'beginner'
}

function inferSkills(title: string, description: string): string[] {
  const searchText = `${title} ${description}`.toLowerCase()
  const skillMap: Array<{ key: string; label: string }> = [
    { key: 'entry', label: 'Entry Validation' },
    { key: 'risk', label: 'Risk Sizing' },
    { key: 'manage', label: 'Trade Management' },
    { key: 'exit', label: 'Exit Discipline' },
    { key: 'journal', label: 'Review and Reflection' },
    { key: 'greek', label: 'Options Greeks' },
    { key: 'context', label: 'Market Context' },
  ]

  const matched = skillMap
    .filter((item) => searchText.includes(item.key))
    .map((item) => item.label)

  return matched.length > 0 ? matched.slice(0, 3) : ['Execution Framework']
}

async function fetchLessonsWithFallback(
  supabase: SupabaseClient,
  courseIds: string[]
) {
  if (courseIds.length === 0) {
    return { data: [] as LessonRow[], error: null }
  }

  const primary = await supabase
    .from('lessons')
    .select('id, course_id, estimated_minutes, duration_minutes')
    .in('course_id', courseIds)

  if (!primary.error) {
    return { data: (primary.data || []) as LessonRow[], error: null }
  }

  const fallback = await supabase
    .from('lessons')
    .select('id, course_id, duration_minutes')
    .in('course_id', courseIds)

  return {
    data: (fallback.data || []) as LessonRow[],
    error: fallback.error,
  }
}

/**
 * GET /api/academy/courses
 * Lists courses for the member academy UI.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const pathId = searchParams.get('path_id')
    const difficultyFilter = searchParams.get('difficulty')

    const extendedSelect = `
      id,
      slug,
      title,
      description,
      thumbnail_url,
      difficulty_level,
      estimated_hours,
      learning_path_id,
      updated_at,
      display_order
    `

    let rawCourses: ExtendedCourseRow[] = []
    let extendedSchemaAvailable = true

    let extendedQuery = supabase
      .from('courses')
      .select(extendedSelect)
      .eq('is_published', true)
      .order('display_order', { ascending: true })

    if (difficultyFilter && DIFFICULTY_VALUES.has(difficultyFilter)) {
      extendedQuery = extendedQuery.eq('difficulty_level', difficultyFilter)
    }

    const extendedResult = await extendedQuery
    if (!extendedResult.error) {
      rawCourses = (extendedResult.data || []) as ExtendedCourseRow[]
    } else {
      extendedSchemaAvailable = false
      const fallbackResult = await supabase
        .from('courses')
        .select('id, slug, title, description, thumbnail_url, updated_at, display_order')
        .eq('is_published', true)
        .order('display_order', { ascending: true })

      if (fallbackResult.error) {
        console.error('academy courses query failed', fallbackResult.error)
        return NextResponse.json(
          { success: false, error: 'Failed to load courses' },
          { status: 500 }
        )
      }

      rawCourses = (fallbackResult.data || []) as ExtendedCourseRow[]
    }

    let courses = rawCourses
    if (pathId && extendedSchemaAvailable) {
      courses = courses.filter((course) => course.learning_path_id === pathId)
    }
    if (difficultyFilter && DIFFICULTY_VALUES.has(difficultyFilter) && !extendedSchemaAvailable) {
      courses = courses.filter((course) => normalizeDifficulty(course.difficulty_level) === difficultyFilter)
    }

    const learningPathIds = Array.from(
      new Set(courses.map((course) => course.learning_path_id).filter((value): value is string => Boolean(value)))
    )

    let pathNamesById = new Map<string, string>()
    if (learningPathIds.length > 0) {
      const learningPathResult = await supabase
        .from('learning_paths')
        .select('id, name')
        .in('id', learningPathIds)

      if (!learningPathResult.error) {
        pathNamesById = new Map(
          (learningPathResult.data || []).map((row) => [row.id, row.name || 'General'])
        )
      }
    }

    const courseIds = courses.map((course) => course.id)
    const [lessonsResult, progressResult] = await Promise.all([
      fetchLessonsWithFallback(supabase, courseIds),
      courseIds.length > 0
        ? supabase
            .from('user_lesson_progress')
            .select('course_id, lesson_id, status')
            .eq('user_id', user.id)
            .in('course_id', courseIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (lessonsResult.error) {
      console.error('academy lessons query failed', lessonsResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to load lessons' },
        { status: 500 }
      )
    }

    const safeProgressRows = progressResult.error ? [] : progressResult.data || []

    const lessonCountByCourse = new Map<string, number>()
    const estimatedMinutesByCourse = new Map<string, number>()
    const hasMicroLessonByCourse = new Map<string, boolean>()

    for (const lesson of lessonsResult.data || []) {
      lessonCountByCourse.set(lesson.course_id, (lessonCountByCourse.get(lesson.course_id) || 0) + 1)
      const duration = lesson.estimated_minutes || lesson.duration_minutes || 0
      estimatedMinutesByCourse.set(
        lesson.course_id,
        (estimatedMinutesByCourse.get(lesson.course_id) || 0) + duration
      )
      if (duration > 0 && duration <= 10) {
        hasMicroLessonByCourse.set(lesson.course_id, true)
      }
    }

    const completedLessonsByCourse = new Map<string, number>()
    for (const progress of safeProgressRows) {
      if (progress.status !== 'completed') continue
      completedLessonsByCourse.set(
        progress.course_id,
        (completedLessonsByCourse.get(progress.course_id) || 0) + 1
      )
    }

    const mappedCourses = courses.map((course) => {
      const description = course.description || ''
      const path = course.learning_path_id
        ? pathNamesById.get(course.learning_path_id) || 'General'
        : 'General'
      const estimatedFromLessons = estimatedMinutesByCourse.get(course.id) || 0

      return {
        slug: course.slug,
        title: course.title,
        description,
        thumbnailUrl: course.thumbnail_url,
        difficulty: normalizeDifficulty(course.difficulty_level),
        path,
        totalLessons: lessonCountByCourse.get(course.id) || 0,
        completedLessons: completedLessonsByCourse.get(course.id) || 0,
        estimatedMinutes:
          estimatedFromLessons || Math.round(((course.estimated_hours || 0) * 60)),
        skills: inferSkills(course.title, description),
        microLearningAvailable:
          hasMicroLessonByCourse.get(course.id) || (lessonCountByCourse.get(course.id) || 0) > 0,
        lastUpdatedAt: course.updated_at || null,
      }
    })

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
