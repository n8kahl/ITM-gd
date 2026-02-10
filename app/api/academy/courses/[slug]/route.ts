import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  toSafeErrorMessage,
} from '@/lib/academy/api-utils'

interface LessonRow {
  id: string
  title: string
  lesson_type: 'video' | 'text' | 'interactive' | 'scenario' | 'practice' | 'guided' | null
  estimated_minutes: number | null
  duration_minutes: number | null
  display_order: number
}

function normalizePathName(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined
    return first?.name || 'General'
  }

  if (value && typeof value === 'object') {
    return ((value as { name?: string }).name) || 'General'
  }

  return 'General'
}

/**
 * GET /api/academy/courses/[slug]
 * Course detail endpoint for the member academy UI.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { slug } = await params

    const { data: course, error: courseError } = await supabase
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
        learning_paths:learning_path_id(name)
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, title, lesson_type, estimated_minutes, duration_minutes, display_order')
      .eq('course_id', course.id)
      .order('display_order', { ascending: true })

    if (lessonsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load lessons' },
        { status: 500 }
      )
    }

    const lessonRows = (lessons || []) as LessonRow[]
    const lessonIds = lessonRows.map((lesson) => lesson.id)

    const { data: progressRows } = lessonIds.length > 0
      ? await supabase
          .from('user_lesson_progress')
          .select('lesson_id, status')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds)
      : { data: [] as Array<{ lesson_id: string; status: string }> }

    const progressByLesson = new Map(
      (progressRows || []).map((row) => [row.lesson_id, row.status])
    )

    const mappedLessons = lessonRows.map((lesson, index) => {
      const status = progressByLesson.get(lesson.id) || 'not_started'
      const isCompleted = status === 'completed'
      const previousLesson = index > 0 ? lessonRows[index - 1] : null
      const previousCompleted = previousLesson
        ? progressByLesson.get(previousLesson.id) === 'completed'
        : true

      return {
        id: lesson.id,
        title: lesson.title,
        order: lesson.display_order || index + 1,
        durationMinutes: lesson.estimated_minutes || lesson.duration_minutes || 0,
        contentType: lesson.lesson_type === 'video'
          ? 'video'
          : lesson.lesson_type === 'text'
            ? 'markdown'
            : 'mixed',
        isCompleted,
        isLocked: !isCompleted && !previousCompleted,
      }
    })

    const completedLessons = mappedLessons.filter((lesson) => lesson.isCompleted).length
    const estimatedMinutes = mappedLessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)

    return NextResponse.json({
      success: true,
      data: {
        slug: course.slug,
        title: course.title,
        description: course.description || '',
        longDescription: course.description || '',
        thumbnailUrl: course.thumbnail_url,
        difficulty: course.difficulty_level,
        path: normalizePathName(course.learning_paths),
        estimatedMinutes: estimatedMinutes || Math.round((course.estimated_hours || 0) * 60),
        lessons: mappedLessons,
        totalLessons: mappedLessons.length,
        completedLessons,
        objectives: [],
        prerequisites: [],
      },
    })
  } catch (error) {
    console.error('academy course detail failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
