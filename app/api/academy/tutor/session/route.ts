import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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
  content_markdown: string | null
  chunk_data: unknown
  competency_keys: string[] | null
  ai_tutor_context: string | null
  ai_tutor_chips: string[] | null
  key_takeaways: string[] | null
}

type TutorChunk = {
  id?: string
  title?: string
  content?: string
}

type TutorInputContext = {
  chunkId: string | null
  competencyKey: string | null
  lastQuizError: string | null
  userJournalContext: string | null
}

function sanitizeContextText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 1200)
}

function resolveChunkContext(lesson: TutorLesson, chunkId: string | null): TutorChunk | null {
  if (!chunkId) return null
  if (!Array.isArray(lesson.chunk_data)) return null

  const chunk = (lesson.chunk_data as TutorChunk[]).find((item) => item?.id === chunkId)
  if (!chunk) return null
  return chunk
}

function buildTutorSystemPrompt(args: {
  lesson: TutorLesson
  courseTitle: string | null
  experienceLevel: string | null
  currentRank: string | null
  coursesCompletedCount: number | null
  inputContext: TutorInputContext
}): string {
  const takeaways = Array.isArray(args.lesson.key_takeaways)
    ? args.lesson.key_takeaways.filter(Boolean).slice(0, 10)
    : []
  const tutorChips = Array.isArray(args.lesson.ai_tutor_chips)
    ? args.lesson.ai_tutor_chips.filter(Boolean).slice(0, 6)
    : []

  const chunk = resolveChunkContext(args.lesson, args.inputContext.chunkId)
  const chunkTitle = chunk?.title || null
  const chunkContent =
    typeof chunk?.content === 'string' && chunk.content.trim().length > 0
      ? chunk.content.trim().slice(0, 1200)
      : null

  return [
    'You are a TITM Academy tutor helping a member understand this lesson.',
    '',
    `LESSON: ${args.lesson.title}`,
    `COURSE: ${args.courseTitle || 'Unknown'}`,
    'DIFFICULTY: unknown',
    '',
    'LESSON CONTENT SUMMARY:',
    args.lesson.content_markdown ? String(args.lesson.content_markdown).slice(0, 2000) : '(no content available)',
    '',
    'AUTHORING CONTEXT:',
    args.lesson.ai_tutor_context || '(none)',
    '',
    'KEY TAKEAWAYS:',
    takeaways.length > 0 ? takeaways.map((t) => `- ${t}`).join('\n') : '(none)',
    '',
    'SUGGESTED MEMBER QUESTIONS:',
    tutorChips.length > 0 ? tutorChips.map((chip) => `- ${chip}`).join('\n') : '(none)',
    '',
    'CHUNK-LEVEL CONTEXT:',
    chunkTitle ? `- Chunk title: ${chunkTitle}` : '- Chunk title: (not provided)',
    chunkContent ? `- Chunk content: ${chunkContent}` : '- Chunk content: (not provided)',
    `- Competency focus: ${args.inputContext.competencyKey || 'not provided'}`,
    `- Last quiz error: ${args.inputContext.lastQuizError || 'not provided'}`,
    `- Journal context: ${args.inputContext.userJournalContext || 'not provided'}`,
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
    '- If chunk context is provided, anchor the explanation to that exact chunk first',
    '- If a quiz error is provided, explain why it was wrong and what rule to remember',
    '- If journal context is provided, tie your explanation to that real trade behavior',
    '- Use practical examples: "When trading SPX 0DTE..."',
    '- Never make up statistics or win rates',
    '',
    'RESPONSE QUALITY BAR:',
    '- Be concise but specific; avoid generic motivation-only replies',
    '- Default structure: direct answer, why it matters, one practical TITM example, one next step',
    '- For "What should I focus on?" questions, return top 3 priorities in order',
    '- Use plain language first, then introduce technical terms',
    '- End with one short check question to confirm understanding',
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
      body?.question || body?.initial_question || body?.message || body?.initialMessage || null
    const inputContext: TutorInputContext = {
      chunkId: sanitizeContextText(body?.chunk_id),
      competencyKey: sanitizeContextText(body?.competency_key),
      lastQuizError: sanitizeContextText(body?.last_quiz_error),
      userJournalContext: sanitizeContextText(body?.user_journal_context),
    }

    if (!lessonId || typeof lessonId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'lesson_id is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, title, slug, course_id, content_markdown, chunk_data, competency_keys, ai_tutor_context, ai_tutor_chips, key_takeaways')
      .eq('id', lessonId)
      .maybeSingle()

    if (lessonError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load lesson for tutor' },
        { status: 500 }
      )
    }

    if (!lesson) {
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
        inputContext,
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
            chunk_id: inputContext.chunkId,
            competency_key: inputContext.competencyKey,
            last_quiz_error: inputContext.lastQuizError,
            user_journal_context: inputContext.userJournalContext,
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
      // Prefer cookie session token (freshest source); fall back to bearer header.
      const cookieSupabase = await createServerSupabaseClient()
      const { data: { session: cookieSession } } = await cookieSupabase.auth.getSession()
      let accessToken = cookieSession?.access_token || null
      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession()
        accessToken = session?.access_token || getBearerToken(request)
      }

      if (!accessToken) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const apiBase = resolveAICoachApiBase()
      const contextLines = [
        inputContext.chunkId ? `chunk_id: ${inputContext.chunkId}` : null,
        inputContext.competencyKey ? `competency_key: ${inputContext.competencyKey}` : null,
        inputContext.lastQuizError ? `last_quiz_error: ${inputContext.lastQuizError}` : null,
        inputContext.userJournalContext ? `user_journal_context: ${inputContext.userJournalContext}` : null,
      ].filter((line): line is string => Boolean(line))
      const outboundMessage = contextLines.length > 0
        ? `[ACADEMY_CONTEXT]\n${contextLines.join('\n')}\n\n${initialQuestion.trim()}`
        : initialQuestion.trim()

      const aiResponse = await fetch(`${apiBase}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionId,
          message: outboundMessage,
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
          chunk_id: inputContext.chunkId,
          competency_key: inputContext.competencyKey,
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
