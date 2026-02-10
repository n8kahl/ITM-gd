import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const XP_LESSON_VIEW = 5
const XP_LESSON_COMPLETE = 10
const XP_COURSE_COMPLETE = 100

/**
 * POST /api/academy/lessons/[id]/progress
 * Updates lesson progress status and awards XP on first view/completion.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user } = auth
    const { id: lessonId } = await params
    const body = await request.json()
    const action = body?.action
    const timeSpentSeconds = Number.isFinite(body?.time_spent_seconds)
      ? Math.max(0, Math.round(body.time_spent_seconds))
      : Number.isFinite(body?.time_spent_minutes)
        ? Math.max(0, Math.round(Number(body.time_spent_minutes) * 60))
        : 0

    if (action !== 'view' && action !== 'complete') {
      return NextResponse.json(
        { success: false, error: 'action must be "view" or "complete"' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id')
      .eq('id', lessonId)
      .maybeSingle()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const { data: existingProgress } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('id, status, started_at, time_spent_seconds')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    const now = new Date().toISOString()
    const previousTime = existingProgress?.time_spent_seconds || 0
    const nextTimeSpent = previousTime + timeSpentSeconds

    let xpAwarded = 0

    if (action === 'view') {
      if (!existingProgress) {
        await supabaseAdmin.from('user_lesson_progress').insert({
          user_id: user.id,
          lesson_id: lessonId,
          course_id: lesson.course_id,
          status: 'in_progress',
          started_at: now,
          time_spent_seconds: nextTimeSpent,
        })

        xpAwarded += XP_LESSON_VIEW
        await awardXp(supabaseAdmin, user.id, XP_LESSON_VIEW, 'lesson_view', lessonId)
      } else {
        await supabaseAdmin
          .from('user_lesson_progress')
          .update({
            status: existingProgress.status === 'not_started' ? 'in_progress' : existingProgress.status,
            time_spent_seconds: nextTimeSpent,
            started_at: existingProgress.started_at || now,
          })
          .eq('id', existingProgress.id)
      }
    }

    if (action === 'complete') {
      const alreadyCompleted = existingProgress?.status === 'completed'

      if (!existingProgress) {
        await supabaseAdmin.from('user_lesson_progress').insert({
          user_id: user.id,
          lesson_id: lessonId,
          course_id: lesson.course_id,
          status: 'completed',
          started_at: now,
          completed_at: now,
          time_spent_seconds: nextTimeSpent,
        })
      } else if (!alreadyCompleted) {
        await supabaseAdmin
          .from('user_lesson_progress')
          .update({
            status: 'completed',
            completed_at: now,
            started_at: existingProgress.started_at || now,
            time_spent_seconds: nextTimeSpent,
          })
          .eq('id', existingProgress.id)
      }

      if (!alreadyCompleted) {
        xpAwarded += XP_LESSON_COMPLETE
        await awardXp(supabaseAdmin, user.id, XP_LESSON_COMPLETE, 'lesson_complete', lessonId)
        await supabaseAdmin.rpc('update_streak', { p_user_id: user.id })
        await supabaseAdmin.rpc('seed_review_items_for_lesson', {
          p_user_id: user.id,
          p_lesson_id: lessonId,
        })

        const courseCompletion = await syncCourseCompletion(
          supabaseAdmin,
          user.id,
          lesson.course_id
        )

        if (courseCompletion.newlyCompleted) {
          xpAwarded += XP_COURSE_COMPLETE
          await awardXp(
            supabaseAdmin,
            user.id,
            XP_COURSE_COMPLETE,
            'course_complete',
            lesson.course_id
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lesson_id: lessonId,
        action,
        xp_awarded: xpAwarded,
        xp_earned: xpAwarded,
        time_spent_seconds: nextTimeSpent,
        time_spent_minutes: Math.round((nextTimeSpent / 60) * 10) / 10,
      },
    })
  } catch (error) {
    console.error('academy lesson progress failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

async function awardXp(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  amount: number,
  activityType:
    | 'lesson_view'
    | 'lesson_complete'
    | 'course_complete',
  entityId: string
) {
  await supabaseAdmin.rpc('increment_user_xp', {
    p_user_id: userId,
    p_xp: amount,
  })

  await supabaseAdmin.from('user_learning_activity_log').insert({
    user_id: userId,
    activity_type: activityType,
    entity_id: entityId,
    entity_type: activityType.startsWith('course') ? 'course' : 'lesson',
    xp_earned: amount,
    metadata: {},
  })
}

async function syncCourseCompletion(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  courseId: string
): Promise<{ completed: boolean; newlyCompleted: boolean }> {
  const [{ data: courseLessons }, { data: completedRows }, { data: existingCourseProgress }] = await Promise.all([
    supabaseAdmin
      .from('lessons')
      .select('id')
      .eq('course_id', courseId),
    supabaseAdmin
      .from('user_lesson_progress')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'completed'),
    supabaseAdmin
      .from('user_course_progress')
      .select('status, started_at, completed_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle(),
  ])

  const totalLessons = (courseLessons || []).length
  const completedLessons = (completedRows || []).length
  const completed = totalLessons > 0 && completedLessons >= totalLessons
  const newlyCompleted = completed && existingCourseProgress?.status !== 'completed'

  await supabaseAdmin
    .from('user_course_progress')
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        status: completed ? 'completed' : completedLessons > 0 ? 'in_progress' : 'not_started',
        lessons_completed: completedLessons,
        total_lessons: totalLessons,
        started_at: existingCourseProgress?.started_at || new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,course_id' }
    )

  return {
    completed,
    newlyCompleted,
  }
}
