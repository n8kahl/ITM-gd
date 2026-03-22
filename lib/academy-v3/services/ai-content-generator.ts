import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GenerateLessonRequest,
  GenerateLessonResponse,
  GeneratedLessonBlock,
} from '@/lib/academy-v3/contracts/api'
import type { AcademyBlockType } from '@/lib/academy-v3/contracts/domain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawGeneratedBlock {
  block_type: string
  title: string
  content: Record<string, unknown>
}

interface RawGeneratedLesson {
  title: string
  learning_objective: string
  blocks: RawGeneratedBlock[]
  quiz?: {
    questions: Array<{
      question: string
      options: string[]
      correct_answer: number
      explanation: string
    }>
    passing_score?: number
  }
}

const VALID_BLOCK_TYPES: Set<string> = new Set([
  'hook',
  'concept_explanation',
  'worked_example',
  'guided_practice',
  'independent_practice',
  'reflection',
  'flashcard_deck',
  'timed_challenge',
  'journal_prompt',
  'what_went_wrong',
])

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AiContentGeneratorService {
  constructor(private readonly supabase: SupabaseClient) {}

  async generateLesson(request: GenerateLessonRequest): Promise<GenerateLessonResponse> {
    const rawLesson = await this.callAiProvider(request)
    const blocks = this.normalizeBlocks(rawLesson, request.blockTypes)
    const title = rawLesson.title || request.topic
    const slug = this.slugify(title) + '-' + Date.now().toString(36)

    const response: GenerateLessonResponse = {
      title,
      slug,
      learningObjective: rawLesson.learning_objective || title,
      difficulty: request.difficulty,
      estimatedMinutes: request.estimatedMinutes,
      blocks,
      status: 'draft',
    }

    if (request.persist && request.moduleId) {
      const lessonId = await this.persistLesson(request.moduleId, response)
      response.lessonId = lessonId
    }

    return response
  }

  // -------------------------------------------------------------------------
  // AI Provider Call
  // -------------------------------------------------------------------------

  private async callAiProvider(request: GenerateLessonRequest): Promise<RawGeneratedLesson> {
    const blockTypesHint = request.blockTypes && request.blockTypes.length > 0
      ? `Use these block types: ${request.blockTypes.join(', ')}`
      : 'Use a mix of: hook, concept_explanation, worked_example, guided_practice, reflection'

    const systemPrompt = `You are an expert options trading educator creating structured academy lessons.
Return valid JSON only. Generate lesson content organized into discrete learning blocks.`

    const userPrompt = `Create a structured lesson on: ${request.topic}
Difficulty: ${request.difficulty}
Target length: ${request.estimatedMinutes} minutes

${blockTypesHint}

Return JSON in this exact structure:
{
  "title": "Lesson Title",
  "learning_objective": "Students will be able to...",
  "blocks": [
    {
      "block_type": "hook",
      "title": "Opening Hook",
      "content": {
        "markdown": "An engaging opening that connects to the topic...",
        "key_question": "What would you do if...?"
      }
    },
    {
      "block_type": "concept_explanation",
      "title": "Core Concept",
      "content": {
        "markdown": "Detailed explanation with examples...",
        "key_points": ["point 1", "point 2"]
      }
    },
    {
      "block_type": "worked_example",
      "title": "Example Trade",
      "content": {
        "markdown": "Step-by-step walkthrough...",
        "scenario": "Description of the trade setup",
        "steps": ["Step 1", "Step 2"]
      }
    },
    {
      "block_type": "guided_practice",
      "title": "Practice Exercise",
      "content": {
        "markdown": "Instructions for practice...",
        "prompts": ["What would you do if...?"]
      }
    },
    {
      "block_type": "reflection",
      "title": "Key Takeaways",
      "content": {
        "markdown": "Summary of what was learned...",
        "takeaways": ["takeaway 1", "takeaway 2"]
      }
    }
  ],
  "quiz": {
    "questions": [
      {
        "question": "Question text",
        "options": ["A", "B", "C", "D"],
        "correct_answer": 0,
        "explanation": "Why A is correct"
      }
    ],
    "passing_score": 70
  }
}

Include at least 3 blocks and 3 quiz questions. Make content specific to options trading.`

    const rawJson = await this.fetchAiCompletion(systemPrompt, userPrompt)
    return this.parseRawLesson(rawJson, request.topic)
  }

  private async fetchAiCompletion(systemPrompt: string, userPrompt: string): Promise<unknown> {
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
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`)
      }

      const result = await response.json()
      const text: string = result.content?.[0]?.text || ''
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
      return JSON.parse(jsonMatch[1]!.trim())
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('AI API key not configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)')
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
        max_tokens: 8192,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()
    return JSON.parse(result.choices?.[0]?.message?.content || '{}')
  }

  // -------------------------------------------------------------------------
  // Normalization
  // -------------------------------------------------------------------------

  private parseRawLesson(raw: unknown, fallbackTitle: string): RawGeneratedLesson {
    const parsed = (raw || {}) as Record<string, unknown>

    const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
    const blocks: RawGeneratedBlock[] = rawBlocks
      .map((entry) => {
        const item = entry as Record<string, unknown>
        return {
          block_type: String(item.block_type || 'concept_explanation'),
          title: String(item.title || ''),
          content: (item.content && typeof item.content === 'object' ? item.content : { markdown: String(item.content || '') }) as Record<string, unknown>,
        }
      })
      .filter((b) => b.title.length > 0)

    const rawQuiz = parsed.quiz as Record<string, unknown> | undefined
    const quizQuestions = rawQuiz && Array.isArray(rawQuiz.questions)
      ? rawQuiz.questions.map((q) => {
          const item = q as Record<string, unknown>
          const options = Array.isArray(item.options)
            ? item.options.map((o) => String(o)).slice(0, 4)
            : []
          return {
            question: String(item.question || '').trim(),
            options,
            correct_answer: Number.isFinite(item.correct_answer) ? Number(item.correct_answer) : 0,
            explanation: String(item.explanation || '').trim(),
          }
        }).filter((q) => q.question.length > 0 && q.options.length >= 2)
      : []

    return {
      title: String(parsed.title || fallbackTitle).trim(),
      learning_objective: String(parsed.learning_objective || fallbackTitle).trim(),
      blocks,
      quiz: quizQuestions.length > 0
        ? { questions: quizQuestions, passing_score: Number(rawQuiz?.passing_score) || 70 }
        : undefined,
    }
  }

  private normalizeBlocks(
    lesson: RawGeneratedLesson,
    requestedBlockTypes?: AcademyBlockType[],
  ): GeneratedLessonBlock[] {
    const allowedTypes = requestedBlockTypes && requestedBlockTypes.length > 0
      ? new Set(requestedBlockTypes)
      : VALID_BLOCK_TYPES

    const blocks: GeneratedLessonBlock[] = []
    let position = 0

    for (const raw of lesson.blocks) {
      const blockType = allowedTypes.has(raw.block_type)
        ? raw.block_type as AcademyBlockType
        : 'concept_explanation' as AcademyBlockType

      if (!allowedTypes.has(blockType)) continue

      blocks.push({
        blockType,
        position,
        title: raw.title,
        contentJson: {
          source: 'ai_content_generator',
          ...raw.content,
        },
      })
      position++
    }

    // Append quiz as a timed_challenge block if quiz data exists
    if (lesson.quiz && lesson.quiz.questions.length > 0) {
      const quizBlockType: AcademyBlockType = 'timed_challenge'
      blocks.push({
        blockType: quizBlockType,
        position,
        title: 'Knowledge Check',
        contentJson: {
          source: 'ai_content_generator',
          questions: lesson.quiz.questions.map((q, idx) => {
            const normalizedOptions = q.options.map((opt, optIdx) => ({
              id: String.fromCharCode(97 + optIdx),
              text: opt,
            }))
            const correctIdx = Math.max(0, Math.min(normalizedOptions.length - 1, q.correct_answer))
            return {
              id: `q${idx + 1}`,
              type: 'multiple_choice',
              text: q.question,
              options: normalizedOptions,
              correct_answer: normalizedOptions[correctIdx]?.id || 'a',
              explanation: q.explanation,
            }
          }),
          passing_score: lesson.quiz.passing_score ?? 70,
        },
      })
    }

    return blocks
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async persistLesson(moduleId: string, lesson: GenerateLessonResponse): Promise<string> {
    const displayOrder = await this.getNextPosition(moduleId)

    const { data: row, error } = await this.supabase
      .from('academy_lessons')
      .insert({
        module_id: moduleId,
        slug: lesson.slug,
        title: lesson.title,
        learning_objective: lesson.learningObjective,
        estimated_minutes: lesson.estimatedMinutes,
        difficulty: lesson.difficulty,
        position: displayOrder,
        is_published: false,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error || !row) {
      throw new Error(`Failed to create lesson: ${error?.message}`)
    }

    const lessonId: string = row.id

    if (lesson.blocks.length > 0) {
      const blockRows = lesson.blocks.map((block: GeneratedLessonBlock) => ({
        lesson_id: lessonId,
        block_type: block.blockType,
        position: block.position,
        title: block.title,
        content_json: block.contentJson,
      }))

      const { error: blockError } = await this.supabase
        .from('academy_lesson_blocks')
        .insert(blockRows)

      if (blockError) {
        throw new Error(`Failed to create blocks: ${blockError.message}`)
      }
    }

    return lessonId
  }

  private async getNextPosition(moduleId: string): Promise<number> {
    const { data } = await this.supabase
      .from('academy_lessons')
      .select('position')
      .eq('module_id', moduleId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    return (data?.position || 0) + 1
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
}
