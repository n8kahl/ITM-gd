import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Difficulty = 'beginner' | 'intermediate' | 'advanced'
type LessonType = 'text' | 'video' | 'interactive' | 'scenario' | 'practice' | 'guided'

interface GeneratedQuizQuestion {
  question: string
  options: string[]
  correct_answer: number
  explanation: string
}

interface GeneratedLessonPayload {
  title: string
  content_markdown: string
  quiz_questions: GeneratedQuizQuestion[]
  key_takeaways: string[]
  estimated_minutes: number
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizeGeneratedContent(
  fallbackTitle: string,
  raw: unknown
): GeneratedLessonPayload {
  const parsed = (raw || {}) as Record<string, unknown>
  const quizQuestionsRaw = Array.isArray(parsed.quiz_questions)
    ? parsed.quiz_questions
    : []

  const quizQuestions = quizQuestionsRaw
    .map((entry) => {
      const item = entry as Record<string, unknown>
      const options = Array.isArray(item.options)
        ? item.options.map((option) => String(option)).slice(0, 4)
        : []
      return {
        question: String(item.question || item.question_text || '').trim(),
        options,
        correct_answer: Number.isFinite(item.correct_answer as number)
          ? Number(item.correct_answer)
          : 0,
        explanation: String(item.explanation || '').trim(),
      }
    })
    .filter((item) => item.question.length > 0 && item.options.length >= 2)

  const takeaways = Array.isArray(parsed.key_takeaways)
    ? parsed.key_takeaways.map((value) => String(value).trim()).filter(Boolean)
    : []

  return {
    title: String(parsed.title || fallbackTitle).trim(),
    content_markdown: String(parsed.content_markdown || parsed.content || '').trim(),
    quiz_questions: quizQuestions,
    key_takeaways: takeaways,
    estimated_minutes: Number.isFinite(parsed.estimated_minutes as number)
      ? Math.max(5, Math.round(Number(parsed.estimated_minutes)))
      : 15,
  }
}

async function generateLessonContent(input: {
  courseTitle: string
  title: string
  topic: string
  difficulty: Difficulty
  lessonType: LessonType
  keyTopics: string[]
  estimatedMinutes: number
}): Promise<GeneratedLessonPayload> {
  const systemPrompt = `You are an expert options trading educator creating academy lesson content.
Return valid JSON only.`

  const topicLine = input.keyTopics.length > 0
    ? `Key topics: ${input.keyTopics.join(', ')}`
    : `Topic: ${input.topic}`

  const userPrompt = `Create a lesson with this input:
Course: ${input.courseTitle}
Title: ${input.title}
Difficulty: ${input.difficulty}
Lesson type: ${input.lessonType}
${topicLine}
Target length: ${input.estimatedMinutes} minutes.

Return JSON:
{
  "title": "${input.title}",
  "content_markdown": "full markdown lesson",
  "key_takeaways": ["..."],
  "estimated_minutes": ${input.estimatedMinutes},
  "quiz_questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_answer": 0,
      "explanation": "..."
    }
  ]
}`

  if (process.env.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || ''
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
    return normalizeGeneratedContent(input.title, JSON.parse(jsonMatch[1]!.trim()))
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const result = await response.json()
  return normalizeGeneratedContent(
    input.title,
    JSON.parse(result.choices?.[0]?.message?.content || '{}')
  )
}

function buildLessonQuizData(questions: GeneratedQuizQuestion[]) {
  return {
    questions: questions.map((question, index) => {
      const normalizedOptions = question.options.map((option, optionIndex) => ({
        id: String.fromCharCode(97 + optionIndex),
        text: option,
      }))
      const correctIndex = Math.max(0, Math.min(normalizedOptions.length - 1, question.correct_answer))
      return {
        id: `q${index + 1}`,
        type: 'multiple_choice',
        text: question.question,
        options: normalizedOptions,
        correct_answer: normalizedOptions[correctIndex]?.id || 'a',
        explanation: question.explanation || '',
      }
    }),
    passing_score: 70,
  }
}

async function getNextLessonDisplayOrder(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  courseId: string
) {
  const { data: lastLesson } = await supabaseAdmin
    .from('lessons')
    .select('display_order')
    .eq('course_id', courseId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (lastLesson?.display_order || 0) + 1
}

async function createLesson(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  input: {
    courseId: string
    title: string
    lessonType: LessonType
    generated: GeneratedLessonPayload
  }
) {
  const baseSlug = slugify(input.title)
  const displayOrder = await getNextLessonDisplayOrder(supabaseAdmin, input.courseId)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  const { data: lesson, error } = await supabaseAdmin
    .from('lessons')
    .insert({
      course_id: input.courseId,
      title: input.generated.title || input.title,
      slug,
      content_markdown: input.generated.content_markdown,
      lesson_type: input.lessonType,
      estimated_minutes: input.generated.estimated_minutes,
      display_order: displayOrder,
      key_takeaways: input.generated.key_takeaways,
      quiz_data: buildLessonQuizData(input.generated.quiz_questions),
    })
    .select('id, title, slug')
    .single()

  if (error || !lesson) {
    throw new Error('Failed to create lesson')
  }

  return lesson
}

/**
 * POST /api/admin/academy/generate-lesson
 * Generates lesson content preview. Optional `persist: true` saves immediately.
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const courseId = body?.course_id
    const title = body?.title
    const topic = body?.topic || body?.key_topics?.join(', ') || title
    const keyTopics = Array.isArray(body?.key_topics)
      ? body.key_topics.map((topic: unknown) => String(topic)).filter(Boolean)
      : []
    const difficulty: Difficulty =
      body?.difficulty === 'beginner' || body?.difficulty === 'intermediate' || body?.difficulty === 'advanced'
        ? body.difficulty
        : 'beginner'
    const lessonType: LessonType =
      body?.lesson_type === 'video' ||
      body?.lesson_type === 'text' ||
      body?.lesson_type === 'interactive' ||
      body?.lesson_type === 'scenario' ||
      body?.lesson_type === 'practice' ||
      body?.lesson_type === 'guided'
        ? body.lesson_type
        : 'text'
    const estimatedMinutes = Number.isFinite(body?.estimated_minutes)
      ? Math.max(5, Math.round(Number(body.estimated_minutes)))
      : 15
    const persist = body?.persist === true

    if (!courseId || !title || !topic) {
      return NextResponse.json(
        { success: false, error: 'course_id, title, and topic are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .maybeSingle()

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    const generated = await generateLessonContent({
      courseTitle: course.title,
      title,
      topic,
      difficulty,
      lessonType,
      keyTopics,
      estimatedMinutes,
    })

    if (!persist) {
      return NextResponse.json({
        success: true,
        data: generated,
      })
    }

    const lesson = await createLesson(supabaseAdmin, {
      courseId,
      title,
      lessonType,
      generated,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...generated,
        lesson,
      },
    })
  } catch (error) {
    console.error('academy admin generate lesson failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/academy/generate-lesson
 * Persists generated content to the lessons table.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const courseId = body?.course_id
    const title = body?.title
    const contentMarkdown = body?.content_markdown

    if (!courseId || !title || !contentMarkdown) {
      return NextResponse.json(
        { success: false, error: 'course_id, title, and content_markdown are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const difficulty: Difficulty =
      body?.difficulty === 'beginner' || body?.difficulty === 'intermediate' || body?.difficulty === 'advanced'
        ? body.difficulty
        : 'beginner'

    const generated: GeneratedLessonPayload = normalizeGeneratedContent(title, {
      title,
      content_markdown: contentMarkdown,
      quiz_questions: body?.quiz_questions || [],
      key_takeaways: body?.key_takeaways || [],
      estimated_minutes: body?.estimated_minutes || 15,
      difficulty,
    })

    const lesson = await createLesson(supabaseAdmin, {
      courseId,
      title,
      lessonType: 'text',
      generated,
    })

    return NextResponse.json({
      success: true,
      data: lesson,
    })
  } catch (error) {
    console.error('academy admin save generated lesson failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
