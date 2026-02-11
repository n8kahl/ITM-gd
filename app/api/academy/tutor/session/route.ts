import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const XP_TUTOR_QUESTION = 2
const DAILY_SESSION_LIMIT = 10
const OPENAI_TUTOR_MODEL = 'gpt-4o-mini'
const LESSON_SELECT_QUERY =
  'id, title, slug, course_id, content_markdown, chunk_data, competency_keys, ai_tutor_context, ai_tutor_chips, key_takeaways'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizeApiBase(rawValue: string | undefined): string | null {
  if (!rawValue) return null
  const trimmed = rawValue.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return `https://${trimmed}`
}

function resolveAICoachApiBases(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_AI_COACH_API_URL,
    process.env.AI_COACH_API_URL,
    process.env.RAILWAY_SERVICE_ITM_GD_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_STATIC_URL,
    'http://localhost:3001',
  ]

  const uniqueBases: string[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const normalized = normalizeApiBase(candidate)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    uniqueBases.push(normalized)
  }

  return uniqueBases
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

type ExistingTutorSession = {
  id: string
  created_at: string | null
  metadata: unknown
}

type StoredTutorMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function sanitizeContextText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 1200)
}

function sanitizeQuestionText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 2000)
}

function sanitizeSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseSessionLessonIdentifier(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null

  const record = metadata as Record<string, unknown>
  for (const field of ['lesson_id', 'lesson_slug']) {
    const value = record[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function isLookupMiss(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : ''
  return code === '' || code === 'PGRST116' || code === '22P02'
}

async function loadLessonByIdentifier(
  client: SupabaseClient,
  identifier: string
): Promise<{ lesson: TutorLesson | null; fatalError: boolean }> {
  const normalizedIdentifier = identifier.trim()
  if (!normalizedIdentifier) {
    return { lesson: null, fatalError: false }
  }

  const { data: byId, error: byIdError } = await client
    .from('lessons')
    .select(LESSON_SELECT_QUERY)
    .eq('id', normalizedIdentifier)
    .maybeSingle()

  if (byId) {
    return { lesson: byId as TutorLesson, fatalError: false }
  }

  if (byIdError && !isLookupMiss(byIdError)) {
    return { lesson: null, fatalError: true }
  }

  const { data: bySlug, error: bySlugError } = await client
    .from('lessons')
    .select(LESSON_SELECT_QUERY)
    .eq('slug', normalizedIdentifier)
    .maybeSingle()

  if (bySlug) {
    return { lesson: bySlug as TutorLesson, fatalError: false }
  }

  if (bySlugError && !isLookupMiss(bySlugError)) {
    return { lesson: null, fatalError: true }
  }

  return { lesson: null, fatalError: false }
}

async function resolveTutorLesson(
  supabaseAdmin: SupabaseClient,
  supabaseRequest: SupabaseClient,
  identifiers: string[]
): Promise<{ lesson: TutorLesson | null; fatalError: boolean }> {
  const normalized = Array.from(
    new Set(identifiers.map((value) => value.trim()).filter((value) => value.length > 0))
  )

  if (normalized.length === 0) {
    return { lesson: null, fatalError: false }
  }

  let fatalError = false
  for (const client of [supabaseAdmin, supabaseRequest]) {
    for (const identifier of normalized) {
      const result = await loadLessonByIdentifier(client, identifier)
      if (result.lesson) {
        return { lesson: result.lesson, fatalError: false }
      }
      fatalError = fatalError || result.fatalError
    }
  }

  return { lesson: null, fatalError }
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

async function resolveRequestAccessToken(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<string | null> {
  const cookieSupabase = await createServerSupabaseClient()
  const { data: { session: cookieSession } } = await cookieSupabase.auth.getSession()
  if (cookieSession?.access_token) {
    return cookieSession.access_token
  }

  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || getBearerToken(request)
}

async function requestTutorReplyFromAICoach(args: {
  apiBases: string[]
  accessToken: string | null
  sessionId: string
  outboundMessage: string
}): Promise<{ id: string; content: string } | null> {
  if (!args.accessToken) return null

  for (const apiBase of args.apiBases) {
    try {
      const aiResponse = await fetch(`${apiBase}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${args.accessToken}`,
        },
        body: JSON.stringify({
          sessionId: args.sessionId,
          message: args.outboundMessage,
        }),
      })

      if (!aiResponse.ok) {
        const errorPayload = await aiResponse.json().catch(() => null)
        console.warn('[academy tutor] AI coach backend request failed', {
          apiBase,
          status: aiResponse.status,
          error: errorPayload?.message || errorPayload?.error || null,
        })
        continue
      }

      const data = await aiResponse.json().catch(() => null)
      const content =
        typeof data?.content === 'string' && data.content.trim().length > 0
          ? data.content.trim()
          : null

      if (!content) {
        console.warn('[academy tutor] AI coach backend returned empty content', { apiBase })
        continue
      }

      return {
        id:
          typeof data?.messageId === 'string' && data.messageId.trim().length > 0
            ? data.messageId
            : crypto.randomUUID(),
        content,
      }
    } catch (error) {
      console.warn('[academy tutor] AI coach backend request threw', {
        apiBase,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return null
}

async function loadRecentTutorMessages(
  supabaseAdmin: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<StoredTutorMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('ai_coach_messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !Array.isArray(data)) {
    return []
  }

  return data
    .slice()
    .reverse()
    .map((row) => ({
      role: row.role as 'system' | 'user' | 'assistant',
      content: typeof row.content === 'string' ? row.content : '',
    }))
    .filter((row) => ['system', 'user', 'assistant'].includes(row.role) && row.content.trim().length > 0)
}

async function requestTutorReplyFromOpenAI(args: {
  systemPrompt: string
  question: string
  recentMessages: StoredTutorMessage[]
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const history = args.recentMessages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TUTOR_MODEL,
      temperature: 0.35,
      max_tokens: 450,
      messages: [
        { role: 'system', content: args.systemPrompt },
        ...history,
        { role: 'user', content: args.question },
      ],
    }),
  })

  if (!response.ok) {
    console.warn('[academy tutor] OpenAI fallback request failed', { status: response.status })
    return null
  }

  const payload = await response.json().catch(() => null) as
    | { choices?: Array<{ message?: { content?: string | null } }> }
    | null

  const content = payload?.choices?.[0]?.message?.content?.trim()
  return content && content.length > 0 ? content : null
}

function buildTutorHeuristicReply(args: {
  question: string
  lesson: TutorLesson
  inputContext: TutorInputContext
}): string {
  const lowerQuestion = args.question.toLowerCase()
  const chunk = resolveChunkContext(args.lesson, args.inputContext.chunkId)
  const takeaways = Array.isArray(args.lesson.key_takeaways)
    ? args.lesson.key_takeaways.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  const topicAnchor = chunk?.title || takeaways[0] || args.lesson.title
  const practicalStep = takeaways[1] || 'Write one execution rule you can apply on your next trade.'
  const checkQuestion = takeaways[2]
    ? `Quick check: how would you apply "${takeaways[2]}" in your next setup?`
    : `Quick check: what is one rule from "${args.lesson.title}" you will follow on your next trade?`

  if (
    lowerQuestion.includes('focus') ||
    lowerQuestion.includes('priority') ||
    lowerQuestion.includes('what should i')
  ) {
    const priorities = [
      `Anchor to ${topicAnchor}: explain it in your own words before placing a trade.`,
      `Tie the concept to risk: keep position risk capped (typically 1-2% account risk).`,
      `Apply immediately: ${practicalStep}`,
    ]

    return [
      'Top 3 priorities right now:',
      ...priorities.map((priority, index) => `${index + 1}. ${priority}`),
      '',
      'TITM example: If you are trading SPX 0DTE, define your invalidation and size before entry so the rule controls the trade, not emotion.',
      '',
      checkQuestion,
    ].join('\n')
  }

  return [
    `Direct answer: focus first on "${topicAnchor}" in this lesson and connect it to how you size and manage risk.`,
    '',
    'Why it matters: most avoidable losses come from breaking process rules, not from missing a perfect entry.',
    '',
    'TITM example: In SPX 0DTE, set your stop and target before clicking buy so execution stays disciplined if volatility spikes.',
    '',
    `Next step: ${practicalStep}`,
    '',
    checkQuestion,
  ].join('\n')
}

async function persistFallbackExchange(args: {
  supabaseAdmin: SupabaseClient
  userId: string
  sessionId: string
  question: string
  reply: string
}) {
  const { error } = await args.supabaseAdmin
    .from('ai_coach_messages')
    .insert([
      {
        session_id: args.sessionId,
        user_id: args.userId,
        role: 'user',
        content: args.question,
      },
      {
        session_id: args.sessionId,
        user_id: args.userId,
        role: 'assistant',
        content: args.reply,
      },
    ])

  if (error) {
    console.warn('[academy tutor] failed to persist fallback tutor exchange', {
      sessionId: args.sessionId,
      error: error.message,
    })
  }
}

/**
 * POST /api/academy/tutor/session
 * Creates or reuses a lesson-scoped AI tutor session record.
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
    const lessonIdValue = body?.lesson_id ?? body?.lessonId
    const sessionIdFromClient = sanitizeSessionId(body?.session_id ?? body?.sessionId)
    const initialQuestion = sanitizeQuestionText(
      body?.question ?? body?.initial_question ?? body?.message ?? body?.initialMessage
    )
    const inputContext: TutorInputContext = {
      chunkId: sanitizeContextText(body?.chunk_id),
      competencyKey: sanitizeContextText(body?.competency_key),
      lastQuizError: sanitizeContextText(body?.last_quiz_error),
      userJournalContext: sanitizeContextText(body?.user_journal_context),
    }

    if (typeof lessonIdValue !== 'string' || lessonIdValue.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'lesson_id is required' },
        { status: 400 }
      )
    }

    const lessonIdentifier = lessonIdValue.trim()
    const supabaseAdmin = getSupabaseAdmin()

    let existingSession: ExistingTutorSession | null = null
    if (sessionIdFromClient) {
      const { data, error } = await supabaseAdmin
        .from('ai_coach_sessions')
        .select('id, created_at, metadata')
        .eq('id', sessionIdFromClient)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: 'Tutor session not found' },
          { status: 404 }
        )
      }

      existingSession = data as ExistingTutorSession
    }

    const lessonIdentifiers = [
      lessonIdentifier,
      parseSessionLessonIdentifier(existingSession?.metadata),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    const lessonLookup = await resolveTutorLesson(supabaseAdmin, supabase, lessonIdentifiers)
    if (!lessonLookup.lesson) {
      if (lessonLookup.fatalError) {
        return NextResponse.json(
          { success: false, error: 'Failed to load lesson for tutor' },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const lessonRow = lessonLookup.lesson

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
    const systemPrompt = buildTutorSystemPrompt({
      lesson: lessonRow,
      courseTitle,
      experienceLevel: profile?.experience_level || null,
      currentRank: userXp?.current_rank || null,
      coursesCompletedCount: userXp?.courses_completed_count ?? null,
      inputContext,
    })

    let sessionId: string
    let createdAt: string | null = null
    let createdNewSession = false

    if (existingSession) {
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
    if (initialQuestion) {
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

    let firstMessage: { id: string; role: 'assistant'; content: string } | null = null

    if (initialQuestion) {
      const contextLines = [
        inputContext.chunkId ? `chunk_id: ${inputContext.chunkId}` : null,
        inputContext.competencyKey ? `competency_key: ${inputContext.competencyKey}` : null,
        inputContext.lastQuizError ? `last_quiz_error: ${inputContext.lastQuizError}` : null,
        inputContext.userJournalContext ? `user_journal_context: ${inputContext.userJournalContext}` : null,
      ].filter((line): line is string => Boolean(line))

      const outboundMessage = contextLines.length > 0
        ? `[ACADEMY_CONTEXT]\n${contextLines.join('\n')}\n\n${initialQuestion}`
        : initialQuestion

      const accessToken = await resolveRequestAccessToken(request, supabase)
      const aiCoachReply = await requestTutorReplyFromAICoach({
        apiBases: resolveAICoachApiBases(),
        accessToken,
        sessionId,
        outboundMessage,
      })

      if (aiCoachReply) {
        firstMessage = {
          id: aiCoachReply.id,
          role: 'assistant',
          content: aiCoachReply.content,
        }
      } else {
        const recentMessages = await loadRecentTutorMessages(supabaseAdmin, user.id, sessionId)
        const openAiReply = await requestTutorReplyFromOpenAI({
          systemPrompt,
          question: initialQuestion,
          recentMessages,
        })

        const fallbackReply =
          openAiReply ||
          buildTutorHeuristicReply({
            question: initialQuestion,
            lesson: lessonRow,
            inputContext,
          })

        await persistFallbackExchange({
          supabaseAdmin,
          userId: user.id,
          sessionId,
          question: initialQuestion,
          reply: fallbackReply,
        })

        firstMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fallbackReply,
        }
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
