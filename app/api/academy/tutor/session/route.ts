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

const XP_TUTOR_QUESTION = 2
const DAILY_SESSION_LIMIT = 10

function resolveAICoachApiBase(): string {
  const url = process.env.NEXT_PUBLIC_AI_COACH_API_URL
  if (!url) return 'http://localhost:3001'
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token.length > 0 ? token : null
}

type TutorLesson = {
  id: string
  title: string
  slug: string | null
  course_id: string
  difficulty_level: string | null
  content_markdown: string | null
  key_takeaways: string[] | null
}

function buildTutorSystemPrompt(args: {
  lesson: TutorLesson
  courseTitle: string | null
  experienceLevel: string | null
  currentRank: string | null
  coursesCompletedCount: number | null
}): string {
  const takeaways = Array.isArray(args.lesson.key_takeaways)
    ? args.lesson.key_takeaways.filter(Boolean).slice(0, 10)
    : []

  return [
    'You are a TITM Academy tutor helping a member understand this lesson.',
    '',
    `LESSON: ${args.lesson.title}`,
    `COURSE: ${args.courseTitle || 'Unknown'}`,
    `DIFFICULTY: ${args.lesson.difficulty_level || 'unknown'}`,
    '',
    'LESSON CONTENT SUMMARY:',
    args.lesson.content_markdown ? String(args.lesson.content_markdown).slice(0, 2000) : '(no content available)',
    '',
    'KEY TAKEAWAYS:',
    takeaways.length > 0 ? takeaways.map((t) => `- ${t}`).join('\n') : '(none)',
    '',
    'MEMBER CONTEXT:',
    `- Experience: ${args.experienceLevel || 'unknown'}`,
    `- Current rank: ${args.currentRank || 'unknown'}`,
    `- Courses completed: ${Number.isFinite(args.coursesCompletedCount) ? args.coursesCompletedCount : 'unknown'}`,
    '',
    'TITM TRADING CONTEXT:',
    'TITM specializes in options scalping (0DTE SPX/NDX), day trading, swing trading, and LEAPS.',
    'We focus on: gamma exposure, theta decay, IV crush, position sizing (1-2% risk max), and disciplined execution.',
    '',
    'INSTRUCTIONS:',
    "- Stay focused on this lesson's topic",
    '- Use TITM terminology and trading examples',
    '- If asked about unrelated topics, redirect back to the lesson topic',
    `- Explain concepts at the member's level (${args.experienceLevel || 'unknown'})`,
    '- Use practical examples: "When trading SPX 0DTE..."',
    '- Never make up statistics or win rates',
  ].join('\n')
}

/**
 * POST /api/academy/tutor/session
 * Creates a lesson-scoped AI tutor session record.
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

    const { user, supabase } = auth
    const body = await request.json().catch(() => ({}))
    const lessonId = body?.lesson_id || body?.lessonId
    const sessionIdFromClient = body?.session_id || body?.sessionId || null
    const initialQuestion =
      body?.initial_question || body?.message || body?.initialMessage || null

    if (!lessonId || typeof lessonId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'lesson_id is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, title, slug, course_id, difficulty_level, content_markdown, key_takeaways')
      .eq('id', lessonId)
      .maybeSingle()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const lessonRow = lesson as TutorLesson

    const [{ data: course }, { data: profile }, { data: userXp }] = await Promise.all([
      supabaseAdmin
        .from('courses')
        .select('title')
        .eq('id', lessonRow.course_id)
        .maybeSingle(),
      supabaseAdmin
        .from('user_learning_profiles')
        .select('experience_level')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('user_xp')
        .select('current_rank, courses_completed_count')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const nowIso = new Date().toISOString()
    const courseTitle = course?.title || null

    let sessionId: string
    let createdAt: string | null = null
    let createdNewSession = false

    if (sessionIdFromClient && typeof sessionIdFromClient === 'string') {
      // Reuse existing session if it belongs to the user.
      const { data: existingSession, error: sessionFetchError } = await supabaseAdmin
        .from('ai_coach_sessions')
        .select('id, created_at, metadata')
        .eq('id', sessionIdFromClient)
        .eq('user_id', user.id)
        .maybeSingle()

      if (sessionFetchError || !existingSession) {
        return NextResponse.json(
          { success: false, error: 'Tutor session not found' },
          { status: 404 }
        )
      }

      sessionId = existingSession.id
      createdAt = existingSession.created_at
    } else {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { count: sessionsToday, error: countError } = await supabaseAdmin
        .from('ai_coach_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .contains('metadata', { context_type: 'academy_tutor' })
        .gte('created_at', todayStart.toISOString())

      if (countError) {
        return NextResponse.json(
          { success: false, error: 'Failed to check tutor limits' },
          { status: 500 }
        )
      }

      if ((sessionsToday || 0) >= DAILY_SESSION_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily tutor session limit reached (${DAILY_SESSION_LIMIT}/day)`,
          },
          { status: 429 }
        )
      }

      sessionId = crypto.randomUUID()
      createdNewSession = true

      const systemPrompt = buildTutorSystemPrompt({
        lesson: lessonRow,
        courseTitle,
        experienceLevel: profile?.experience_level || null,
        currentRank: userXp?.current_rank || null,
        coursesCompletedCount: userXp?.courses_completed_count ?? null,
      })

      const { data: createdSession, error: sessionCreateError } = await supabaseAdmin
        .from('ai_coach_sessions')
        .insert({
          id: sessionId,
          user_id: user.id,
          title: `${lessonRow.title} Tutor`,
          metadata: {
            context_type: 'academy_tutor',
            lesson_id: lessonRow.id,
            lesson_title: lessonRow.title,
            course_id: lessonRow.course_id,
            course_title: courseTitle,
            lesson_slug: lessonRow.slug,
            system_prompt_category: 'academy_tutor_lesson_context',
            created_at: nowIso,
          },
        })
        .select('id, created_at')
        .single()

      if (sessionCreateError || !createdSession) {
        return NextResponse.json(
          { success: false, error: 'Failed to start tutor session' },
          { status: 500 }
        )
      }

      createdAt = createdSession.created_at

      const { error: systemMsgError } = await supabaseAdmin
        .from('ai_coach_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'system',
          content: systemPrompt,
        })

      if (systemMsgError) {
        return NextResponse.json(
          { success: false, error: 'Failed to initialize tutor session' },
          { status: 500 }
        )
      }
    }

    let xpAwarded = 0
    if (initialQuestion && typeof initialQuestion === 'string' && initialQuestion.trim().length > 0) {
      xpAwarded = XP_TUTOR_QUESTION
      await supabaseAdmin.rpc('increment_user_xp', {
        p_user_id: user.id,
        p_xp: XP_TUTOR_QUESTION,
      })

      await supabaseAdmin.from('user_learning_activity_log').insert({
        user_id: user.id,
        activity_type: 'tutor_question',
        entity_id: sessionId,
        entity_type: 'ai_session',
        xp_earned: XP_TUTOR_QUESTION,
        metadata: {
          lesson_id: lessonRow.id,
        },
      })
    }

    // If we have a question, ask the AI Coach backend in the context of this session.
    let firstMessage: { id: string; role: 'assistant'; content: string } | null = null
    if (initialQuestion && typeof initialQuestion === 'string' && initialQuestion.trim().length > 0) {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token || getBearerToken(request)

      if (!accessToken) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const apiBase = resolveAICoachApiBase()
      const aiResponse = await fetch(`${apiBase}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionId,
          message: initialQuestion.trim(),
        }),
      })

      if (!aiResponse.ok) {
        const errorPayload = await aiResponse.json().catch(() => null)
        return NextResponse.json(
          { success: false, error: errorPayload?.message || 'Failed to get tutor response' },
          { status: 502 }
        )
      }

      const data = await aiResponse.json()
      firstMessage = {
        id: data.messageId || crypto.randomUUID(),
        role: 'assistant',
        content: data.content || 'I could not generate a response. Please try again.',
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          session_id: sessionId,
          lesson_id: lessonRow.id,
          lesson_title: lessonRow.title,
          ai_coach_session_id: sessionId,
          title: `${lessonRow.title} Tutor`,
          created_at: createdAt || nowIso,
          system_prompt_category: 'academy_tutor_lesson_context',
          first_message: firstMessage,
          reply: firstMessage?.content || `Ask me anything about: ${lessonRow.title}`,
          xp_awarded: xpAwarded,
        },
      },
      { status: createdNewSession ? 201 : 200 }
    )
  } catch (error) {
    console.error('academy tutor session failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
