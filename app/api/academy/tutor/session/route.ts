import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const XP_TUTOR_QUESTION = 2

/**
 * POST /api/academy/tutor/session
 * Create an AI tutor session scoped to a specific lesson.
 * Creates a record in ai_coach_sessions with academy metadata.
 * Body: { lesson_id, initial_question? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user } = auth
    const body = await request.json()
    const { lesson_id, initial_question } = body

    if (!lesson_id) {
      return NextResponse.json(
        { success: false, error: 'lesson_id is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify lesson exists and get context
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, title, slug, content, course_id, courses(id, title)')
      .eq('id', lesson_id)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Check rate limiting: max 10 sessions per day per user
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: sessionsToday } = await supabaseAdmin
      .from('ai_coach_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('session_type', 'academy_tutor')
      .gte('created_at', todayStart.toISOString())

    if ((sessionsToday || 0) >= 10) {
      return NextResponse.json(
        { success: false, error: 'Daily tutor session limit reached (10/day)' },
        { status: 429 }
      )
    }

    // Create the AI coach session with academy metadata
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('ai_coach_sessions')
      .insert({
        user_id: user.id,
        session_type: 'academy_tutor',
        status: 'active',
        metadata: {
          lesson_id: lesson.id,
          lesson_title: lesson.title,
          course_id: lesson.course_id,
          course_title: (lesson.courses as { title: string })?.title || null,
          initial_question: initial_question || null,
        },
        context: {
          scope: 'lesson',
          lesson_slug: lesson.slug,
          content_summary: lesson.content
            ? String(lesson.content).substring(0, 500)
            : null,
        },
      })
      .select()
      .single()

    if (sessionError) {
      return NextResponse.json(
        { success: false, error: sessionError.message },
        { status: 500 }
      )
    }

    // Award XP for asking a tutor question (if initial question provided)
    let xpAwarded = 0
    if (initial_question) {
      xpAwarded = XP_TUTOR_QUESTION
      await supabaseAdmin.from('xp_transactions').insert({
        user_id: user.id,
        amount: XP_TUTOR_QUESTION,
        source: 'tutor_question',
        reference_id: session.id,
        description: 'Asked AI tutor a question',
      })
      await supabaseAdmin.rpc('increment_user_xp', {
        p_user_id: user.id,
        p_amount: XP_TUTOR_QUESTION,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.id,
        session_type: 'academy_tutor',
        lesson: {
          id: lesson.id,
          title: lesson.title,
        },
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
