import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const ACADEMY_E2E_PREFIX = 'e2e-academy-'

type AnySupabaseClient = SupabaseClient<any, 'public', any>

interface SeedCourseOverrides {
  slug: string
  title: string
  description: string
  lessonCount: number
}

export interface SeededCourse {
  courseId: string
  courseSlug: string
  lessonIds: string[]
}

export interface SeededReviewItems {
  queueItemIds: string[]
  courseId: string
  lessonIds: string[]
}

export interface SeededSavedItems {
  courseId: string
  lessonId: string
}

function buildE2EName(suffix: string): string {
  return `${ACADEMY_E2E_PREFIX}${suffix}`
}

export async function seedTestCourse(
  supabase: AnySupabaseClient,
  overrides: Partial<SeedCourseOverrides> = {}
): Promise<SeededCourse> {
  const token = randomUUID().slice(0, 8)
  const courseSlug = overrides.slug || buildE2EName(`course-${token}`)
  const courseTitle = overrides.title || `E2E Academy Course ${token}`
  const courseDescription = overrides.description || 'E2E academy seed course'
  const lessonCount = Math.max(1, overrides.lessonCount || 3)

  const { data: courseRow, error: courseError } = await supabase
    .from('courses')
    .insert({
      slug: courseSlug,
      title: courseTitle,
      description: courseDescription,
      is_published: true,
      display_order: 999,
    })
    .select('id')
    .single()

  if (courseError || !courseRow?.id) {
    throw new Error(`seedTestCourse failed to create course: ${courseError?.message || 'unknown error'}`)
  }

  const lessonRows = Array.from({ length: lessonCount }).map((_, index) => {
    const lessonOrder = index + 1
    return {
      course_id: courseRow.id,
      slug: buildE2EName(`lesson-${token}-${lessonOrder}`),
      title: `E2E Lesson ${lessonOrder}`,
      content_markdown: `## E2E Lesson ${lessonOrder}\n\nValidation content for automated tests.`,
      lesson_type: 'chunk',
      display_order: lessonOrder,
      estimated_minutes: 8,
      is_published: true,
      competency_keys: ['market_context'],
      chunk_data: [
        {
          id: `chunk-${lessonOrder}-1`,
          title: 'Concept',
          content_type: 'rich_text',
          content: 'Core concept.',
          duration_minutes: 3,
          order_index: 0,
        },
        {
          id: `chunk-${lessonOrder}-2`,
          title: 'Quick Check',
          content_type: 'quick_check',
          content: '',
          duration_minutes: 2,
          order_index: 1,
          quick_check: {
            question: 'What should come first?',
            options: ['Risk definition', 'Entry speed', 'Sizing up losses', 'Skipping checklist'],
            correct_index: 0,
            explanation: 'Risk definition and checklist-first execution come first.',
          },
        },
      ],
      quiz_data: [
        {
          question: 'What is the first priority in TITM execution?',
          options: ['Risk definition', 'Speed', 'Averaging down', 'No stop'],
          correct_index: 0,
          explanation: 'Define risk first.',
        },
        {
          question: 'What supports retention?',
          options: ['Review and reflection', 'Random entries', 'Oversizing', 'Ignoring process'],
          correct_index: 0,
          explanation: 'Review loops improve retention and decision quality.',
        },
      ],
      key_takeaways: [
        'Define risk before entry.',
        'Use checklist-first execution.',
      ],
      ai_tutor_context: 'Use concise guidance and emphasize risk controls.',
      ai_tutor_chips: [
        'How do I define risk quickly?',
        'What should my checklist include?',
        'How do I review this lesson?',
      ],
    }
  })

  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .insert(lessonRows)
    .select('id')

  if (lessonError || !lessonData) {
    throw new Error(`seedTestCourse failed to create lessons: ${lessonError?.message || 'unknown error'}`)
  }

  return {
    courseId: courseRow.id,
    courseSlug,
    lessonIds: lessonData.map((row) => row.id),
  }
}

export async function seedTestReviewItems(
  supabase: AnySupabaseClient,
  userId: string,
  count = 3
): Promise<SeededReviewItems> {
  const safeCount = Math.max(1, count)
  const seededCourse = await seedTestCourse(supabase, { lessonCount: safeCount })
  const now = Date.now()

  const reviewRows = seededCourse.lessonIds.map((lessonId, index) => ({
    user_id: userId,
    competency_key: 'market_context',
    source_lesson_id: lessonId,
    source_course_id: seededCourse.courseId,
    question_data: {
      question: `E2E review question ${index + 1}`,
      options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'],
      correct_index: 1,
      explanation: 'E2E explanation.',
    },
    due_at: new Date(now - index * 60_000).toISOString(),
    status: 'due',
  }))

  const { data: queueItems, error: reviewError } = await supabase
    .from('review_queue_items')
    .insert(reviewRows)
    .select('id')

  if (reviewError || !queueItems) {
    throw new Error(`seedTestReviewItems failed: ${reviewError?.message || 'unknown error'}`)
  }

  return {
    queueItemIds: queueItems.map((row) => row.id),
    courseId: seededCourse.courseId,
    lessonIds: seededCourse.lessonIds,
  }
}

export async function seedTestSavedItems(
  supabase: AnySupabaseClient,
  userId: string
): Promise<SeededSavedItems> {
  const seededCourse = await seedTestCourse(supabase, { lessonCount: 1 })
  const lessonId = seededCourse.lessonIds[0]

  const { error: savedError } = await supabase
    .from('user_saved_items')
    .insert([
      {
        user_id: userId,
        entity_type: 'course',
        entity_id: seededCourse.courseId,
      },
      {
        user_id: userId,
        entity_type: 'lesson',
        entity_id: lessonId,
      },
    ])

  if (savedError) {
    throw new Error(`seedTestSavedItems failed: ${savedError.message}`)
  }

  return {
    courseId: seededCourse.courseId,
    lessonId,
  }
}

export async function cleanupTestData(
  supabase: AnySupabaseClient,
  userId: string
): Promise<void> {
  const { data: courses, error: courseQueryError } = await supabase
    .from('courses')
    .select('id')
    .like('slug', `${ACADEMY_E2E_PREFIX}%`)

  if (courseQueryError) {
    throw new Error(`cleanupTestData failed querying courses: ${courseQueryError.message}`)
  }

  const courseIds = (courses || []).map((row) => row.id)
  if (courseIds.length === 0) {
    return
  }

  const { data: lessons, error: lessonQueryError } = await supabase
    .from('lessons')
    .select('id')
    .in('course_id', courseIds)

  if (lessonQueryError) {
    throw new Error(`cleanupTestData failed querying lessons: ${lessonQueryError.message}`)
  }

  const lessonIds = (lessons || []).map((row) => row.id)

  if (lessonIds.length > 0) {
    await supabase
      .from('review_queue_items')
      .delete()
      .eq('user_id', userId)
      .in('source_lesson_id', lessonIds)

    await supabase
      .from('user_saved_items')
      .delete()
      .eq('user_id', userId)
      .in('entity_id', lessonIds)

    await supabase
      .from('lessons')
      .delete()
      .in('id', lessonIds)
  }

  await supabase
    .from('user_saved_items')
    .delete()
    .eq('user_id', userId)
    .in('entity_id', courseIds)

  await supabase
    .from('courses')
    .delete()
    .in('id', courseIds)
}
