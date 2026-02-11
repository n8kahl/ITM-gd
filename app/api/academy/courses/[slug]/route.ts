import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import {
  toSafeErrorMessage,
} from '@/lib/academy/api-utils'
import { resolveAcademyResumeTarget } from '@/lib/academy/resume'

interface LessonRow {
  id: string
  title: string
  lesson_type: 'video' | 'text' | 'interactive' | 'scenario' | 'practice' | 'guided' | null
  estimated_minutes: number | null
  duration_minutes: number | null
  display_order: number
}

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
        learning_path_id
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

    const typedCourse = course as CourseRow
    let learningPathName = 'General'
    if (typedCourse.learning_path_id) {
      const { data: learningPath } = await supabase
        .from('learning_paths')
        .select('name')
        .eq('id', typedCourse.learning_path_id)
        .maybeSingle()
      learningPathName = learningPath?.name || 'General'
    }

    const [{ data: lessons, error: lessonsError }, resumeTarget] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, title, lesson_type, estimated_minutes, duration_minutes, display_order')
        .eq('course_id', typedCourse.id)
        .order('display_order', { ascending: true }),
      resolveAcademyResumeTarget(supabase, { userId: user.id, courseId: typedCourse.id }),
    ])

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
        isLocked: false, // TODO: restore gating → !isCompleted && !previousCompleted
      }
    })

    const completedLessons = mappedLessons.filter((lesson) => lesson.isCompleted).length
    const estimatedMinutes = mappedLessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)

    return NextResponse.json({
      success: true,
      data: {
        slug: typedCourse.slug,
        title: typedCourse.title,
        description: typedCourse.description || '',
        longDescription: typedCourse.description || '',
        thumbnailUrl: typedCourse.thumbnail_url,
        difficulty: typedCourse.difficulty_level,
        path: learningPathName,
        estimatedMinutes: estimatedMinutes || Math.round((typedCourse.estimated_hours || 0) * 60),
        lessons: mappedLessons,
        totalLessons: mappedLessons.length,
        completedLessons,
        resumeLessonId: resumeTarget?.lessonId || null,
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
