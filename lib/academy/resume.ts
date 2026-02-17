import type { SupabaseClient } from '@supabase/supabase-js'

interface PublishedCourseRow {
  id: string
  slug: string
  title: string
  display_order: number | null
}

interface LessonRow {
  id: string
  course_id: string
  title: string
  display_order: number | null
}

interface LessonProgressRow {
  course_id: string
  lesson_id: string
  status: 'not_started' | 'in_progress' | 'completed' | null
  started_at: string | null
}

export interface AcademyResumeTarget {
  lessonId: string
  lessonTitle: string
  lessonNumber: number
  totalLessons: number
  completedLessons: number
  courseProgressPercent: number
  courseId: string
  courseSlug: string
  courseTitle: string
  resumeUrl: string
  courseUrl: string
  source: 'in_progress' | 'next_unlocked'
  source_reason: 'last_in_progress' | 'next_unlocked' | 'first_lesson'
}

type ResolveResumeTargetOptions = {
  userId: string
  courseId?: string
}

type CourseWithLessons = {
  course: PublishedCourseRow
  lessons: LessonRow[]
}

function sortCourses(courses: PublishedCourseRow[]): PublishedCourseRow[] {
  return [...courses].sort((a, b) => {
    const orderDelta = (a.display_order ?? 0) - (b.display_order ?? 0)
    if (orderDelta !== 0) return orderDelta
    return a.slug.localeCompare(b.slug)
  })
}

function sortLessons(lessons: LessonRow[]): LessonRow[] {
  return [...lessons].sort((a, b) => {
    const orderDelta = (a.display_order ?? 0) - (b.display_order ?? 0)
    if (orderDelta !== 0) return orderDelta
    return a.id.localeCompare(b.id)
  })
}

function buildResumeTarget(
  scopedCourse: CourseWithLessons,
  lesson: LessonRow,
  completedLessons: number,
  sourceReason: AcademyResumeTarget['source_reason']
): AcademyResumeTarget {
  const lessonIndex = scopedCourse.lessons.findIndex((courseLesson) => courseLesson.id === lesson.id)
  const totalLessons = scopedCourse.lessons.length
  const courseProgressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const source: AcademyResumeTarget['source'] =
    sourceReason === 'last_in_progress' ? 'in_progress' : 'next_unlocked'

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonNumber: lessonIndex >= 0 ? lessonIndex + 1 : 1,
    totalLessons,
    completedLessons,
    courseProgressPercent,
    courseId: scopedCourse.course.id,
    courseSlug: scopedCourse.course.slug,
    courseTitle: scopedCourse.course.title,
    resumeUrl: `/members/academy-v3/modules?lesson=${encodeURIComponent(lesson.id)}`,
    courseUrl: `/members/academy-v3/modules?module=${encodeURIComponent(scopedCourse.course.slug)}`,
    source,
    source_reason: sourceReason,
  }
}

export async function resolveAcademyResumeTarget(
  supabase: SupabaseClient,
  options: ResolveResumeTargetOptions
): Promise<AcademyResumeTarget | null> {
  const { userId, courseId } = options

  let coursesQuery = supabase
    .from('courses')
    .select('id, slug, title, display_order')
    .eq('is_published', true)
    .order('display_order', { ascending: true })

  if (courseId) {
    coursesQuery = coursesQuery.eq('id', courseId)
  }

  const { data: publishedCourses, error: coursesError } = await coursesQuery

  if (coursesError || !publishedCourses || publishedCourses.length === 0) {
    return null
  }

  const courses = sortCourses((publishedCourses || []) as PublishedCourseRow[])
  const courseIds = courses.map((course) => course.id)

  const [lessonsResult, progressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, course_id, title, display_order')
      .in('course_id', courseIds)
      .order('course_id', { ascending: true })
      .order('display_order', { ascending: true }),
    supabase
      .from('user_lesson_progress')
      .select('course_id, lesson_id, status, started_at')
      .eq('user_id', userId)
      .in('course_id', courseIds),
  ])

  if (lessonsResult.error) {
    return null
  }

  const lessons = (lessonsResult.data || []) as LessonRow[]
  if (lessons.length === 0) {
    return null
  }

  const progressRows: LessonProgressRow[] = progressResult.error
    ? []
    : ((progressResult.data || []) as LessonProgressRow[])

  const lessonById = new Map<string, LessonRow>()
  const lessonsByCourseId = new Map<string, LessonRow[]>()

  for (const lesson of lessons) {
    lessonById.set(lesson.id, lesson)
    const scoped = lessonsByCourseId.get(lesson.course_id) || []
    scoped.push(lesson)
    lessonsByCourseId.set(lesson.course_id, scoped)
  }

  const progressByLessonId = new Map<string, LessonProgressRow>()
  for (const row of progressRows) {
    progressByLessonId.set(row.lesson_id, row)
  }

  const completedLessonsByCourseId = new Map<string, number>()
  for (const row of progressRows) {
    if (row.status !== 'completed') continue
    completedLessonsByCourseId.set(
      row.course_id,
      (completedLessonsByCourseId.get(row.course_id) || 0) + 1
    )
  }

  const scopedCourses: CourseWithLessons[] = courses
    .map((course) => {
      const courseLessons = sortLessons(lessonsByCourseId.get(course.id) || [])
      return {
        course,
        lessons: courseLessons,
      }
    })
    .filter((entry) => entry.lessons.length > 0)

  if (scopedCourses.length === 0) {
    return null
  }

  const latestInProgress = progressRows
    .filter((row) => row.status === 'in_progress' && lessonById.has(row.lesson_id))
    .sort((a, b) => {
      const aStartedAt = a.started_at ? Date.parse(a.started_at) : 0
      const bStartedAt = b.started_at ? Date.parse(b.started_at) : 0
      return bStartedAt - aStartedAt
    })[0]

  if (latestInProgress) {
    const lesson = lessonById.get(latestInProgress.lesson_id)
    const scopedCourse = scopedCourses.find((entry) => entry.course.id === latestInProgress.course_id)
    if (lesson && scopedCourse) {
      return buildResumeTarget(
        scopedCourse,
        lesson,
        completedLessonsByCourseId.get(scopedCourse.course.id) || 0,
        'last_in_progress'
      )
    }
  }

  for (const scopedCourse of scopedCourses) {
    for (let index = 0; index < scopedCourse.lessons.length; index += 1) {
      const lesson = scopedCourse.lessons[index]
      const currentStatus = progressByLessonId.get(lesson.id)?.status || 'not_started'
      const isCompleted = currentStatus === 'completed'
      const previousLesson = index > 0 ? scopedCourse.lessons[index - 1] : null
      const previousStatus = previousLesson
        ? progressByLessonId.get(previousLesson.id)?.status || 'not_started'
        : 'completed'
      const previousCompleted = previousStatus === 'completed'
      const isUnlocked = isCompleted || previousCompleted

      if (!isCompleted && isUnlocked) {
        return buildResumeTarget(
          scopedCourse,
          lesson,
          completedLessonsByCourseId.get(scopedCourse.course.id) || 0,
          'next_unlocked'
        )
      }
    }
  }

  const firstCourse = scopedCourses[0]
  const firstLesson = firstCourse?.lessons[0]
  if (firstCourse && firstLesson) {
    return buildResumeTarget(
      firstCourse,
      firstLesson,
      completedLessonsByCourseId.get(firstCourse.course.id) || 0,
      'first_lesson'
    )
  }

  return null
}
