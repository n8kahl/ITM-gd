import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

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
 * Update lesson progress. Supports actions: 'view' and 'complete'.
 * Awards XP on view and completion.
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
    const { action, time_spent_seconds } = body

    if (!action || !['view', 'complete'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "view" or "complete"' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify lesson exists
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Check existing progress
    const { data: existing } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('id, status, time_spent_seconds')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    let xpAwarded = 0
    const now = new Date().toISOString()

    if (action === 'view') {
      if (!existing) {
        // First view - create progress record and award view XP
        await supabaseAdmin.from('user_lesson_progress').insert({
          user_id: user.id,
          lesson_id: lessonId,
          status: 'in_progress',
          progress_pct: 10,
          time_spent_seconds: time_spent_seconds || 0,
          started_at: now,
        })

        xpAwarded = XP_LESSON_VIEW
        await supabaseAdmin.from('xp_transactions').insert({
          user_id: user.id,
          amount: XP_LESSON_VIEW,
          source: 'lesson_view',
          reference_id: lessonId,
          description: 'Started a lesson',
        })
        await supabaseAdmin.rpc('increment_user_xp', {
          p_user_id: user.id,
          p_amount: XP_LESSON_VIEW,
        })
      } else {
        // Update time spent
        const totalTime = (existing.time_spent_seconds || 0) + (time_spent_seconds || 0)
        await supabaseAdmin
          .from('user_lesson_progress')
          .update({
            time_spent_seconds: totalTime,
            updated_at: now,
          })
          .eq('id', existing.id)
      }
    }

    if (action === 'complete') {
      const alreadyCompleted = existing?.status === 'completed'

      if (!existing) {
        // Direct complete (no prior view)
        await supabaseAdmin.from('user_lesson_progress').insert({
          user_id: user.id,
          lesson_id: lessonId,
          status: 'completed',
          progress_pct: 100,
          completed_at: now,
          started_at: now,
          time_spent_seconds: time_spent_seconds || 0,
        })
      } else if (!alreadyCompleted) {
        const totalTime = (existing.time_spent_seconds || 0) + (time_spent_seconds || 0)
        await supabaseAdmin
          .from('user_lesson_progress')
          .update({
            status: 'completed',
            progress_pct: 100,
            completed_at: now,
            time_spent_seconds: totalTime,
            updated_at: now,
          })
          .eq('id', existing.id)
      }

      if (!alreadyCompleted) {
        // Award completion XP
        xpAwarded = XP_LESSON_COMPLETE
        await supabaseAdmin.from('xp_transactions').insert({
          user_id: user.id,
          amount: XP_LESSON_COMPLETE,
          source: 'lesson_complete',
          reference_id: lessonId,
          description: 'Completed a lesson',
        })
        await supabaseAdmin.rpc('increment_user_xp', {
          p_user_id: user.id,
          p_amount: XP_LESSON_COMPLETE,
        })

        // Update learning streak
        await supabaseAdmin.rpc('update_learning_streak', {
          p_user_id: user.id,
        })

        // Check if the whole course is now complete
        const courseComplete = await checkCourseCompletion(
          supabaseAdmin,
          user.id,
          lesson.course_id
        )
        if (courseComplete) {
          xpAwarded += XP_COURSE_COMPLETE
          await supabaseAdmin.from('xp_transactions').insert({
            user_id: user.id,
            amount: XP_COURSE_COMPLETE,
            source: 'course_complete',
            reference_id: lesson.course_id,
            description: 'Completed a course',
          })
          await supabaseAdmin.rpc('increment_user_xp', {
            p_user_id: user.id,
            p_amount: XP_COURSE_COMPLETE,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lesson_id: lessonId,
        action,
        xp_awarded: xpAwarded,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Check if all published lessons in a course are completed.
 * If so, mark the course as complete and return true.
 */
async function checkCourseCompletion(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  courseId: string
): Promise<boolean> {
  const { data: allLessons } = await supabaseAdmin
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('is_published', true)

  if (!allLessons || allLessons.length === 0) return false

  const { data: completedLessons } = await supabaseAdmin
    .from('user_lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .in('lesson_id', allLessons.map((l) => l.id))

  const allComplete = (completedLessons?.length || 0) >= allLessons.length

  if (allComplete) {
    // Upsert course progress to completed
    await supabaseAdmin
      .from('user_course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          progress_pct: 100,
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,course_id' }
      )
  } else {
    // Update course progress percentage
    const pct = Math.round(
      ((completedLessons?.length || 0) / allLessons.length) * 100
    )
    await supabaseAdmin
      .from('user_course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          progress_pct: pct,
          status: 'in_progress',
        },
        { onConflict: 'user_id,course_id' }
      )
  }

  return allComplete
}
